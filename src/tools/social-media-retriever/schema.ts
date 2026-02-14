import { z } from "zod";

export const RawUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
});

export const PostMetricsSchema = z.object({
  replies: z.number().int(),
  retweets: z.number().int(),
  likes: z.number().int(),
  bookmarks: z.number().int(),
  views: z.number().int(),
});

export const RawCommentSchema = z.object({
  author: RawUserSchema,
  content: z.string(),
  timestamp: z.string().optional(),
  depth: z.number().int().default(0),
  metrics: PostMetricsSchema.optional(),
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
  metrics: PostMetricsSchema.optional(),
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
  includeMetrics: z
    .boolean()
    .default(false)
    .describe("Include interaction metrics (likes, retweets, replies, views, bookmarks)"),
});

export type RetrieverInput = z.infer<typeof RetrieverInputSchema>;
export type RawSocialPost = z.infer<typeof RawSocialPostSchema>;
