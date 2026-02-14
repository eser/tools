import { z } from "zod";

export const VectorRendererInputSchema = z.object({
  svg: z.string().describe("SVG content string"),
  format: z.enum(["svg", "png"]).default("png").describe("Output format"),
  width: z.number().int().min(1).max(4096).optional().describe("Output width in pixels"),
  height: z.number().int().min(1).max(4096).optional().describe("Output height in pixels"),
});

export const VectorRendererOutputSchema = z.object({
  data: z.string().describe("SVG string or base64-encoded PNG"),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
});

export type VectorRendererInput = z.infer<typeof VectorRendererInputSchema>;
export type VectorRendererOutput = z.infer<typeof VectorRendererOutputSchema>;
