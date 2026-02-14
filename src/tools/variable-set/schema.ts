import { z } from "zod";

export const VariableSetInputSchema = z.object({
  name: z.string().describe("Variable name"),
  value: z.unknown().describe("Variable value (can be an expression like ${{ steps.0.output.field }})"),
});

export const VariableSetOutputSchema = z.object({
  name: z.string(),
  value: z.unknown(),
});

export type VariableSetInput = z.infer<typeof VariableSetInputSchema>;
export type VariableSetOutput = z.infer<typeof VariableSetOutputSchema>;
