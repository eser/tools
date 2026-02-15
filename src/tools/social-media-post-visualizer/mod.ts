import type { ToolDefinition } from "../types.ts";
import { VisualizerInputSchema, VisualizerOutputSchema } from "./schema.ts";
import { execute } from "./execute.ts";

export const tool: ToolDefinition<
  typeof VisualizerInputSchema,
  typeof VisualizerOutputSchema
> = {
  id: "social-media-post-visualizer",
  name: "Social Media Post Visualizer",
  description:
    "Generate a themed SVG preview of a social media post matching the original platform's visual style. Works with both raw and anonymized post data.",
  category: "Social Media",
  inputSchema: VisualizerInputSchema,
  outputSchema: VisualizerOutputSchema,
  execute,
};
