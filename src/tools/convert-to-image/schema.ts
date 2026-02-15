import { z } from "zod";

export const ConvertToImageInputSchema = z.object({
  svg: z.string().describe("SVG content string"),
  format: z.enum(["png", "jpg"]).default("png").describe("Output image format"),
  multiplier: z.enum(["1x", "2x", "4x", "8x", "16x"]).default("4x").describe("Resolution multiplier — renders at NxN pixel density while keeping the same visual dimensions"),
  width: z.number().int().min(1).max(4096).optional().describe("Output width in pixels"),
  height: z.number().int().min(1).max(4096).optional().describe("Output height in pixels"),
  quality: z.number().int().min(1).max(100).default(85).describe("JPEG quality (1–100, ignored for PNG)"),
});

export const ConvertToImageOutputSchema = z.object({
  data: z.string().describe("Base64-encoded image data"),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
});

export type ConvertToImageInput = z.infer<typeof ConvertToImageInputSchema>;
export type ConvertToImageOutput = z.infer<typeof ConvertToImageOutputSchema>;
