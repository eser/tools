import { z } from "zod";
import { RawSocialPostSchema } from "../social-media-post-retriever/schema.ts";

export const AnonymizerInputSchema = RawSocialPostSchema.extend({
  anonymizeMentions: z
    .boolean()
    .default(false)
    .describe("Replace @mentions in content with anonymized handles"),
}).describe("Raw social post data from the Social Media Post Retriever");

export type AnonymizerInput = z.infer<typeof AnonymizerInputSchema>;
