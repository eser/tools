import type { ToolDefinition } from "../types.ts";
import { RetrieverInputSchema, RawSocialPostSchema } from "./schema.ts";
import { execute } from "./execute.ts";

export const tool: ToolDefinition<
  typeof RetrieverInputSchema,
  typeof RawSocialPostSchema
> = {
  id: "social-media-retriever",
  name: "Social Media Retriever",
  description:
    "Fetch posts and comments from social media platforms. Supports Twitter/X and Reddit. Returns raw post data without any transformation.",
  category: "Social Media",
  inputSchema: RetrieverInputSchema,
  outputSchema: RawSocialPostSchema,
  execute,
};
