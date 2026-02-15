import type { ToolContext, ToolResult } from "../types.ts";
import { toolFail, toolOk } from "../types.ts";
import type { RawSocialPost } from "../social-media-post-retriever/schema.ts";
import type { AnonymizerInput } from "./schema.ts";
import type { AnonymizedUser } from "./anonymizer.ts";
import { Anonymizer } from "./anonymizer.ts";

function toRawUser(anon: AnonymizedUser) {
  return {
    id: anon.anonymizedId,
    username: anon.anonymizedName.toLowerCase(),
    displayName: anon.anonymizedName,
    avatarUrl: anon.anonymizedAvatarUrl,
  };
}

export async function execute(
  input: AnonymizerInput,
  context: ToolContext,
): Promise<ToolResult<RawSocialPost>> {
  context.onProgress?.({ message: "Anonymizing users...", percent: 10 });

  try {
    const anonymizer = new Anonymizer();

    const postAuthor = await anonymizer.anonymize(input.author);

    // Anonymize quoted post author if present
    let anonymizedQuotedPost: { author: AnonymizedUser; content: string; timestamp?: string } | undefined;
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
        metrics: c.metrics,
      })),
    );

    context.onProgress?.({ message: "Anonymizing content...", percent: 40 });

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

    context.onProgress?.({ message: "Done", percent: 100 });

    return toolOk({
      id: input.id,
      platform: input.platform,
      author: toRawUser(postAuthor),
      content: postContent,
      timestamp: input.timestamp,
      media: input.media,
      quotedPost: anonymizedQuotedPost !== undefined
        ? {
            author: toRawUser(anonymizedQuotedPost.author),
            content: anonymizedQuotedPost.content,
            timestamp: anonymizedQuotedPost.timestamp,
          }
        : undefined,
      metrics: input.metrics,
      comments: anonymizedComments.map((c) => ({
        author: toRawUser(c.author),
        content: c.content,
        timestamp: c.timestamp,
        depth: c.depth,
        metrics: c.metrics,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolFail(`Anonymization failed: ${message}`);
  }
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
