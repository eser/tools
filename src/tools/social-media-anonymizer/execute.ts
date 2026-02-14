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

    const anonymizedComments = await Promise.all(
      input.comments.map(async (c) => ({
        author: await anonymizer.anonymize(c.author),
        content: c.content,
        timestamp: c.timestamp,
        depth: c.depth,
      })),
    );

    context.onProgress?.({ message: "Rendering themed preview...", percent: 60 });

    // Render themed SVG
    const renderer = themeRenderers.find((r) => r.platform === input.platform);
    let svg = "";

    if (renderer !== undefined) {
      svg = await renderer.render({
        platform: input.platform,
        post: {
          author: postAuthor,
          content: input.content,
          timestamp: input.timestamp,
        },
        comments: anonymizedComments.map((c) => ({
          author: c.author,
          content: c.content,
          depth: c.depth,
        })),
      });
    }

    context.onProgress?.({ message: "Done", percent: 100 });

    return toolOk({
      platform: input.platform,
      post: {
        author: postAuthor,
        content: input.content,
        timestamp: input.timestamp,
        media: input.media,
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
