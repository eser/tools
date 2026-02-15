import { z } from "zod";

export const SaveFileInputSchema = z.object({
  data: z.string().describe("Content to save (text or base64-encoded binary)"),
  mimeType: z.string().describe("MIME type — determines text vs binary handling"),
  folder: z.string().describe("Target folder (absolute path or relative to output directory)"),
  filename: z.string().min(1).describe("File name with extension — supports {id} placeholder"),
  id: z.string().optional().describe("Identifier substituted into {id} placeholders in filename"),
});

export const SaveFileOutputSchema = z.object({
  path: z.string().describe("Absolute path of saved file"),
  sizeBytes: z.number().int(),
});

export type SaveFileInput = z.infer<typeof SaveFileInputSchema>;
export type SaveFileOutput = z.infer<typeof SaveFileOutputSchema>;
