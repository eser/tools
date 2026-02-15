import type { ToolDefinition } from "../types.ts";
import { VariableSetInputSchema, VariableSetOutputSchema } from "./schema.ts";
import { execute } from "./execute.ts";

export const tool: ToolDefinition = {
  id: "variable-set",
  name: "Variable Set",
  description: "Set a named variable for use in subsequent pipeline steps",
  category: "Utility",
  inputSchema: VariableSetInputSchema,
  outputSchema: VariableSetOutputSchema,
  execute,
};
