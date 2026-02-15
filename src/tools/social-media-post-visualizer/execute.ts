import type { ToolContext, ToolResult } from "../types.ts";
import { toolFail, toolOk } from "../types.ts";
import type { VisualizerInput, VisualizerOutput } from "./schema.ts";
import type { ThemeRenderer } from "./themes/types.ts";
import { TwitterThemeRenderer } from "./themes/twitter.tsx";
import { RedditThemeRenderer } from "./themes/reddit.tsx";

const themeRenderers: ThemeRenderer[] = [
  new TwitterThemeRenderer(),
  new RedditThemeRenderer(),
];

export async function execute(
  input: VisualizerInput,
  context: ToolContext,
): Promise<ToolResult<VisualizerOutput>> {
  context.onProgress?.({ message: "Preparing visualization...", percent: 10 });

  try {
    const renderer = themeRenderers.find((r) => r.platform === input.platform);
    if (renderer === undefined) {
      return toolFail(`Unsupported platform: ${input.platform}`);
    }

    // Collect all authors for avatar fetching
    const allAuthors = [
      input.author,
      ...input.comments.map((c) => c.author),
      ...(input.quotedPost !== undefined ? [input.quotedPost.author] : []),
    ];

    context.onProgress?.({ message: "Fetching assets...", percent: 30 });

    const [avatarDataUris, mediaDataUris] = await Promise.all([
      fetchAvatarDataUris(allAuthors),
      fetchMediaDataUris(input.media),
    ]);

    const inlineAuthor = (author: typeof input.author) => ({
      ...author,
      avatarUrl: author.avatarUrl !== undefined
        ? (avatarDataUris.get(author.avatarUrl) ?? author.avatarUrl)
        : undefined,
    });

    const inlineMedia = input.media.map((m) => ({
      ...m,
      url: mediaDataUris.get(m.url) ?? m.url,
    }));

    context.onProgress?.({ message: "Rendering themed preview...", percent: 60 });

    const inlineQuotedPost = input.quotedPost !== undefined
      ? {
          author: inlineAuthor(input.quotedPost.author),
          content: input.quotedPost.content,
          timestamp: input.quotedPost.timestamp,
        }
      : undefined;

    const svg = await renderer.render({
      platform: input.platform,
      showMetrics: input.metrics !== undefined,
      post: {
        author: inlineAuthor(input.author),
        content: input.content,
        timestamp: input.timestamp,
        media: inlineMedia,
        quotedPost: inlineQuotedPost,
        metrics: input.metrics,
      },
      comments: input.comments.map((c) => ({
        author: inlineAuthor(c.author),
        content: c.content,
        timestamp: c.timestamp,
        depth: c.depth,
        metrics: c.metrics,
      })),
    });

    context.onProgress?.({ message: "Done", percent: 100 });

    return toolOk({
      id: input.id,
      metadata: {
        commentsRendered: input.comments.length,
      },
      svg,
      mimeType: "image/svg+xml",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolFail(`Visualization failed: ${message}`);
  }
}

async function fetchAvatarDataUris(
  authors: Array<{ avatarUrl?: string }>,
): Promise<Map<string, string>> {
  const uniqueUrls = [...new Set(
    authors.map((a) => a.avatarUrl).filter((url): url is string => url !== undefined && url !== ""),
  )];
  const dataUris = new Map<string, string>();

  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const contentType = res.headers.get("content-type") ?? "";

        if (contentType.includes("svg")) {
          // Strip <metadata> block which contains non-Latin1 characters that break satori
          const svgText = (await res.text()).replace(/<metadata[^>]*>[\s\S]*?<\/metadata>/, "");
          dataUris.set(url, `data:image/svg+xml;base64,${btoa(svgText)}`);
        } else {
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (const byte of bytes) {
            binary += String.fromCharCode(byte);
          }
          const mime = contentType || "image/jpeg";
          dataUris.set(url, `data:${mime};base64,${btoa(binary)}`);
        }
      } catch {
        // Keep original URL as fallback
      }
    }),
  );

  return dataUris;
}

async function fetchMediaDataUris(
  media: Array<{ type: string; url: string }>,
): Promise<Map<string, string>> {
  const dataUris = new Map<string, string>();
  const images = media.filter((m) => m.type === "image" && m.url !== "");

  await Promise.all(
    images.map(async ({ url }) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const contentType = res.headers.get("content-type") ?? "image/jpeg";
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (const byte of bytes) {
          binary += String.fromCharCode(byte);
        }
        dataUris.set(url, `data:${contentType};base64,${btoa(binary)}`);
      } catch {
        // Keep original URL as fallback
      }
    }),
  );

  return dataUris;
}
