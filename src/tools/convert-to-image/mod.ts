import type { ToolDefinition } from "../types.ts";
import { ConvertToImageInputSchema, ConvertToImageOutputSchema } from "./schema.ts";
import { execute } from "./execute.ts";

export const tool: ToolDefinition<
  typeof ConvertToImageInputSchema,
  typeof ConvertToImageOutputSchema
> = {
  id: "convert-to-image",
  name: "Convert to Image",
  description:
    "Rasterize SVG content to PNG or JPEG. Outputs base64-encoded image data.",
  category: "Utility",
  inputSchema: ConvertToImageInputSchema,
  outputSchema: ConvertToImageOutputSchema,
  execute,
};
