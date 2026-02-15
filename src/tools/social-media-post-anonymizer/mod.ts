import type { ToolDefinition } from "../types.ts";
import { RawSocialPostSchema } from "../social-media-post-retriever/schema.ts";
import { AnonymizerInputSchema } from "./schema.ts";
import { execute } from "./execute.ts";

export const tool: ToolDefinition<
  typeof AnonymizerInputSchema,
  typeof RawSocialPostSchema
> = {
  id: "social-media-post-anonymizer",
  name: "Social Media Post Anonymizer",
  description:
    "Anonymize social media posts by replacing all user identities with consistent pseudonyms. Output matches the retriever format for pipeline composability.",
  category: "Social Media",
  inputSchema: AnonymizerInputSchema,
  outputSchema: RawSocialPostSchema,
  execute,
};
