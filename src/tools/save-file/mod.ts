import type { ToolDefinition } from "../types.ts";
import { SaveFileInputSchema, SaveFileOutputSchema } from "./schema.ts";
import { execute } from "./execute.ts";

export const tool: ToolDefinition<
  typeof SaveFileInputSchema,
  typeof SaveFileOutputSchema
> = {
  id: "save-file",
  name: "Save File",
  description:
    "Save content to a file on disk. Accepts text or base64-encoded binary data with a MIME type. Supports absolute or relative paths.",
  category: "Utility",
  inputSchema: SaveFileInputSchema,
  outputSchema: SaveFileOutputSchema,
  execute,
};
