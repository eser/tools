import { z } from "zod";
import { RawSocialPostSchema } from "../social-media-post-retriever/schema.ts";

export const VisualizerInputSchema = RawSocialPostSchema.describe(
  "Social media post data to visualize as a themed SVG preview",
);

export const VisualizerOutputSchema = z.object({
  id: z.string().describe("Post identifier (passed through from input)"),
  metadata: z.object({
    commentsRendered: z.number().int(),
  }),
  svg: z.string().describe("Themed SVG preview of the social media post"),
  mimeType: z.string().describe("MIME type of the output"),
});

export type VisualizerInput = z.infer<typeof VisualizerInputSchema>;
export type VisualizerOutput = z.infer<typeof VisualizerOutputSchema>;
