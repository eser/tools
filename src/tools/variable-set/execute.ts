import type { ToolContext, ToolResult } from "../types.ts";
import { toolOk } from "../types.ts";
import type { VariableSetInput, VariableSetOutput } from "./schema.ts";

export async function execute(
  input: VariableSetInput,
  _context: ToolContext,
): Promise<ToolResult<VariableSetOutput>> {
  return toolOk({ name: input.name, value: input.value });
}
