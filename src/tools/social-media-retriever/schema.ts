import { z } from "zod";

export const RawUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
});

export const RawCommentSchema = z.object({
  author: RawUserSchema,
  content: z.string(),
  timestamp: z.string().optional(),
  depth: z.number().int().default(0),
});

export const RawQuotedPostSchema = z.object({
  author: RawUserSchema,
  content: z.string(),
  timestamp: z.string().optional(),
});

export const RawSocialPostSchema = z.object({
  platform: z.enum(["twitter", "reddit"]),
  author: RawUserSchema,
  content: z.string(),
  timestamp: z.string().optional(),
  media: z.array(
    z.object({
      type: z.enum(["image", "video", "link"]),
      url: z.string(),
    }),
  ),
  quotedPost: RawQuotedPostSchema.optional(),
  comments: z.array(RawCommentSchema),
  totalCommentsFound: z.number().int(),
});

export const RetrieverInputSchema = z.object({
  url: z.string().url().describe("URL of the social media post"),
  platform: z
    .enum(["twitter", "reddit"])
    .optional()
    .describe("Platform (auto-detected from URL if omitted)"),
  includeComments: z
    .boolean()
    .default(true)
    .describe("Include comments and replies"),
  maxComments: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(50)
    .describe("Maximum number of comments to fetch"),
});

export type RetrieverInput = z.infer<typeof RetrieverInputSchema>;
export type RawSocialPost = z.infer<typeof RawSocialPostSchema>;
