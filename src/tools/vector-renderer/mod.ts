import type { ToolDefinition } from "../types.ts";
import { VectorRendererInputSchema, VectorRendererOutputSchema } from "./schema.ts";
import { execute } from "./execute.ts";

export const tool: ToolDefinition<
  typeof VectorRendererInputSchema,
  typeof VectorRendererOutputSchema
> = {
  id: "vector-renderer",
  name: "Vector Renderer",
  description:
    "Convert SVG content to PNG or SVG output. Generic format conversion tool — pass through SVG or rasterize to PNG (base64 encoded).",
  category: "Rendering",
  inputSchema: VectorRendererInputSchema,
  outputSchema: VectorRendererOutputSchema,
  execute,
};
