import { z } from "zod";
import { PostMetricsSchema, RawSocialPostSchema } from "../social-media-retriever/schema.ts";

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
  metrics: PostMetricsSchema.optional(),
});

export const AnonymizerInputSchema = RawSocialPostSchema.extend({
  anonymizeMentions: z
    .boolean()
    .default(false)
    .describe("Replace @mentions in content with anonymized handles"),
}).describe("Raw social post data from the Social Media Retriever");

export const AnonymizedQuotedPostSchema = z.object({
  author: AnonymizedUserSchema,
  content: z.string(),
  timestamp: z.string().optional(),
});

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
    quotedPost: AnonymizedQuotedPostSchema.optional(),
    metrics: PostMetricsSchema.optional(),
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
