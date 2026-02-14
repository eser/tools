import type { ToolDefinition } from "../types.ts";
import { AnonymizerInputSchema, AnonymizerOutputSchema } from "./schema.ts";
import { execute } from "./execute.ts";

export const tool: ToolDefinition<
  typeof AnonymizerInputSchema,
  typeof AnonymizerOutputSchema
> = {
  id: "social-media-anonymizer",
  name: "Social Media Anonymizer",
  description:
    "Anonymize social media posts by replacing all user identities with consistent pseudonyms. Generates a themed SVG preview matching the original platform's visual style.",
  category: "Privacy",
  inputSchema: AnonymizerInputSchema,
  outputSchema: AnonymizerOutputSchema,
  execute,
};
