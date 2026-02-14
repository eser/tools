import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { RetrieverInputSchema, RawSocialPostSchema } from "./schema.ts";

describe("RetrieverInputSchema", () => {
  it("accepts a minimal valid input", () => {
    const result = RetrieverInputSchema.safeParse({
      url: "https://reddit.com/r/test/comments/abc/title",
    });
    assertEquals(result.success, true);
  });

  it("applies default values for includeComments and maxComments", () => {
    const parsed = RetrieverInputSchema.parse({
      url: "https://reddit.com/r/test/comments/abc/title",
    });
    assertEquals(parsed.includeComments, true);
    assertEquals(parsed.maxComments, 50);
  });

  it("accepts explicit platform", () => {
    const result = RetrieverInputSchema.safeParse({
      url: "https://x.com/user/status/123",
      platform: "twitter",
    });
    assertEquals(result.success, true);
  });

  it("rejects invalid URL", () => {
    const result = RetrieverInputSchema.safeParse({
      url: "not-a-url",
    });
    assertEquals(result.success, false);
  });

  it("rejects unsupported platform", () => {
    const result = RetrieverInputSchema.safeParse({
      url: "https://example.com",
      platform: "facebook",
    });
    assertEquals(result.success, false);
  });

  it("rejects maxComments above 500", () => {
    const result = RetrieverInputSchema.safeParse({
      url: "https://example.com",
      maxComments: 501,
    });
    assertEquals(result.success, false);
  });

  it("rejects maxComments below 1", () => {
    const result = RetrieverInputSchema.safeParse({
      url: "https://example.com",
      maxComments: 0,
    });
    assertEquals(result.success, false);
  });
});

describe("RawSocialPostSchema", () => {
  it("accepts a valid raw social post", () => {
    const result = RawSocialPostSchema.safeParse({
      platform: "reddit",
      author: { id: "1", username: "user", displayName: "User" },
      content: "Hello world",
      media: [],
      comments: [],
      totalCommentsFound: 0,
    });
    assertEquals(result.success, true);
  });

  it("accepts a post with media and comments", () => {
    const result = RawSocialPostSchema.safeParse({
      platform: "twitter",
      author: { id: "1", username: "user", displayName: "User" },
      content: "Check this out",
      timestamp: "2026-01-01T00:00:00Z",
      media: [{ type: "image", url: "https://example.com/img.png" }],
      comments: [
        {
          author: { id: "2", username: "commenter", displayName: "Commenter" },
          content: "Nice!",
          depth: 0,
        },
      ],
      totalCommentsFound: 1,
    });
    assertEquals(result.success, true);
  });

  it("rejects unsupported platform", () => {
    const result = RawSocialPostSchema.safeParse({
      platform: "mastodon",
      author: { id: "1", username: "user", displayName: "User" },
      content: "Hello",
      media: [],
      comments: [],
      totalCommentsFound: 0,
    });
    assertEquals(result.success, false);
  });
});
