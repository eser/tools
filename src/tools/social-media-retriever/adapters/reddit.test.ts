import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { RedditAdapter } from "./reddit.ts";

describe("RedditAdapter.canHandle", () => {
  const adapter = new RedditAdapter();

  const validUrls = [
    { name: "standard post URL", url: "https://www.reddit.com/r/typescript/comments/abc123/some_title/" },
    { name: "old reddit URL", url: "https://old.reddit.com/r/deno/comments/xyz789/post_title/" },
    { name: "URL without trailing slash", url: "https://reddit.com/r/programming/comments/def456/title" },
    { name: "URL with query params", url: "https://reddit.com/r/test/comments/123/title?sort=new" },
  ];

  for (const { name, url } of validUrls) {
    it(`handles ${name}`, () => {
      assertEquals(adapter.canHandle(url), true);
    });
  }

  const invalidUrls = [
    { name: "Twitter URL", url: "https://twitter.com/user/status/123" },
    { name: "Reddit homepage", url: "https://reddit.com" },
    { name: "Reddit subreddit listing", url: "https://reddit.com/r/typescript" },
    { name: "random URL", url: "https://example.com/some-page" },
  ];

  for (const { name, url } of invalidUrls) {
    it(`rejects ${name}`, () => {
      assertEquals(adapter.canHandle(url), false);
    });
  }

  it("reports platform as reddit", () => {
    assertEquals(adapter.platform, "reddit");
  });
});
