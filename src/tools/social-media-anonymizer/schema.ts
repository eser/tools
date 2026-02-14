import { z } from "zod";
import { RawSocialPostSchema } from "../social-media-retriever/schema.ts";

export const AnonymizedUserSchema = z.object({
  anonymizedId: z.string(),
  anonymizedName: z.string(),
  anonymizedAvatarUrl: z.string(),
});

export const AnonymizedCommentSchema = z.object({
  author: AnonymizedUserSchema,
  content: z.string(),
  timestamp: z.string().optional(),
  depth: z.number().int().default(0),
});

export const AnonymizerInputSchema = RawSocialPostSchema.describe(
  "Raw social post data from the Social Media Retriever",
);

export const AnonymizerOutputSchema = z.object({
  platform: z.enum(["twitter", "reddit"]),
  post: z.object({
    author: AnonymizedUserSchema,
    content: z.string(),
    timestamp: z.string().optional(),
    media: z.array(
      z.object({
        type: z.enum(["image", "video", "link"]),
        url: z.string(),
      }),
    ),
  }),
  comments: z.array(AnonymizedCommentSchema),
  metadata: z.object({
    totalCommentsFound: z.number().int(),
    commentsReturned: z.number().int(),
    uniqueUsersAnonymized: z.number().int(),
  }),
  svg: z.string().describe("Themed SVG preview of the anonymized post"),
});

export type AnonymizerInput = z.infer<typeof AnonymizerInputSchema>;
export type AnonymizerOutput = z.infer<typeof AnonymizerOutputSchema>;
export type AnonymizedUser = z.infer<typeof AnonymizedUserSchema>;
