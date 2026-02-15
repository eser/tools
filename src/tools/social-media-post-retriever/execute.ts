import type { ToolContext, ToolResult } from "../types.ts";
import { toolFail, toolOk } from "../types.ts";
import type { RetrieverInput, RawSocialPost } from "./schema.ts";
import type { SocialAdapter } from "./adapters/types.ts";
import { RedditAdapter } from "./adapters/reddit.ts";
import { TwitterAdapter } from "./adapters/twitter.ts";

const adapters: SocialAdapter[] = [
  new RedditAdapter(),
  new TwitterAdapter(),
];

export async function execute(
  input: RetrieverInput,
  context: ToolContext,
): Promise<ToolResult<RawSocialPost>> {
  const adapter = input.platform !== undefined
    ? adapters.find((a) => a.platform === input.platform)
    : adapters.find((a) => a.canHandle(input.url));

  if (adapter === undefined) {
    return toolFail(
      `No adapter found for URL: ${input.url}. Supported platforms: twitter, reddit`,
    );
  }

  context.onProgress?.({
    message: `Fetching from ${adapter.platform}...`,
    percent: 10,
  });

  try {
    const rawPost = await adapter.fetchPost(
      input.url,
      {
        includeComments: input.includeComments,
        maxComments: input.maxComments,
      },
      context.env,
      context.signal,
    );

    // Strip metrics if not requested
    if (!input.includeMetrics) {
      rawPost.metrics = undefined;
      for (const comment of rawPost.comments) {
        comment.metrics = undefined;
      }
    }

    context.onProgress?.({ message: "Done", percent: 100 });
    return toolOk(rawPost);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolFail(`Failed to fetch post: ${message}`);
  }
}
