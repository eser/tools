import type { ToolContext, ToolResult } from "../types.ts";
import { toolFail, toolOk } from "../types.ts";
import type { AnonymizerInput, AnonymizerOutput } from "./schema.ts";
import { Anonymizer } from "./anonymizer.ts";
import type { ThemeRenderer } from "./themes/types.ts";
import { TwitterThemeRenderer } from "./themes/twitter.tsx";
import { RedditThemeRenderer } from "./themes/reddit.tsx";

const themeRenderers: ThemeRenderer[] = [
  new TwitterThemeRenderer(),
  new RedditThemeRenderer(),
];

export async function execute(
  input: AnonymizerInput,
  context: ToolContext,
): Promise<ToolResult<AnonymizerOutput>> {
  context.onProgress?.({ message: "Anonymizing users...", percent: 10 });

  try {
    const anonymizer = new Anonymizer();

    const postAuthor = await anonymizer.anonymize(input.author);

    // Anonymize quoted post author if present
    let anonymizedQuotedPost: { author: Awaited<ReturnType<typeof anonymizer.anonymize>>; content: string; timestamp?: string } | undefined;
    if (input.quotedPost !== undefined) {
      const quotedAuthor = await anonymizer.anonymize(input.quotedPost.author);
      anonymizedQuotedPost = {
        author: quotedAuthor,
        content: input.quotedPost.content,
        timestamp: input.quotedPost.timestamp,
      };
    }

    const anonymizedComments = await Promise.all(
      input.comments.map(async (c) => ({
        author: await anonymizer.anonymize(c.author),
        content: c.content,
        timestamp: c.timestamp,
        depth: c.depth,
      })),
    );

    // Anonymize @mentions in content if enabled
    let postContent = input.content;
    if (input.anonymizeMentions) {
      postContent = await anonymizeMentionsInText(postContent, anonymizer);
      for (const comment of anonymizedComments) {
        comment.content = await anonymizeMentionsInText(comment.content, anonymizer);
      }
      if (anonymizedQuotedPost !== undefined) {
        anonymizedQuotedPost.content = await anonymizeMentionsInText(anonymizedQuotedPost.content, anonymizer);
      }
    }

    context.onProgress?.({ message: "Fetching assets...", percent: 40 });

    // Pre-fetch avatar SVGs and media images as data URIs for satori embedding
    const allAuthors = [
      postAuthor,
      ...anonymizedComments.map((c) => c.author),
      ...(anonymizedQuotedPost !== undefined ? [anonymizedQuotedPost.author] : []),
    ];
    const [avatarDataUris, mediaDataUris] = await Promise.all([
      fetchAvatarDataUris(allAuthors),
      fetchMediaDataUris(input.media),
    ]);

    const inlineAuthor = (author: typeof postAuthor) => ({
      ...author,
      anonymizedAvatarUrl: avatarDataUris.get(author.anonymizedAvatarUrl) ?? author.anonymizedAvatarUrl,
    });

    const inlineMedia = input.media.map((m) => ({
      ...m,
      url: mediaDataUris.get(m.url) ?? m.url,
    }));

    context.onProgress?.({ message: "Rendering themed preview...", percent: 60 });

    // Render themed SVG
    const renderer = themeRenderers.find((r) => r.platform === input.platform);
    let svg = "";

    if (renderer !== undefined) {
      const inlineQuotedPost = anonymizedQuotedPost !== undefined
        ? { author: inlineAuthor(anonymizedQuotedPost.author), content: anonymizedQuotedPost.content, timestamp: anonymizedQuotedPost.timestamp }
        : undefined;

      svg = await renderer.render({
        platform: input.platform,
        post: {
          author: inlineAuthor(postAuthor),
          content: postContent,
          timestamp: input.timestamp,
          media: inlineMedia,
          quotedPost: inlineQuotedPost,
        },
        comments: anonymizedComments.map((c) => ({
          author: inlineAuthor(c.author),
          content: c.content,
          timestamp: c.timestamp,
          depth: c.depth,
        })),
      });
    }

    context.onProgress?.({ message: "Done", percent: 100 });

    return toolOk({
      platform: input.platform,
      post: {
        author: postAuthor,
        content: postContent,
        timestamp: input.timestamp,
        media: input.media,
        quotedPost: anonymizedQuotedPost,
      },
      comments: anonymizedComments,
      metadata: {
        totalCommentsFound: input.totalCommentsFound,
        commentsReturned: anonymizedComments.length,
        uniqueUsersAnonymized: anonymizer.uniqueCount,
      },
      svg,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolFail(`Anonymization failed: ${message}`);
  }
}

async function fetchAvatarDataUris(
  authors: Array<{ anonymizedAvatarUrl: string }>,
): Promise<Map<string, string>> {
  const uniqueUrls = [...new Set(authors.map((a) => a.anonymizedAvatarUrl))];
  const dataUris = new Map<string, string>();

  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        // Strip <metadata> block which contains non-Latin1 characters that break satori
        const svgText = (await res.text()).replace(/<metadata[^>]*>[\s\S]*?<\/metadata>/, "");
        dataUris.set(url, `data:image/svg+xml;base64,${btoa(svgText)}`);
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

const MENTION_RE = /@([a-zA-Z0-9_]{1,50})\b/g;

async function anonymizeMentionsInText(
  text: string,
  anonymizer: Anonymizer,
): Promise<string> {
  const matches = [...text.matchAll(MENTION_RE)];
  if (matches.length === 0) return text;

  const replacements = new Map<string, string>();
  for (const match of matches) {
    const handle = match[1];
    if (!replacements.has(handle)) {
      const anon = await anonymizer.anonymizeHandle(handle);
      replacements.set(handle, `@${anon.anonymizedName.toLowerCase()}`);
    }
  }

  return text.replace(MENTION_RE, (_, handle: string) => {
    return replacements.get(handle) ?? `@${handle}`;
  });
}
