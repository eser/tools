import type { RawComment, RawSocialPost, RawUser, SocialAdapter } from "./types.ts";

function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/);
  return match !== null ? match[1] : null;
}

export class TwitterAdapter implements SocialAdapter {
  platform = "twitter" as const;

  canHandle(url: string): boolean {
    return /(?:twitter|x)\.com\/\w+\/status\/\d+/.test(url);
  }

  async fetchPost(
    url: string,
    options: { includeComments: boolean; maxComments: number },
    env: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<RawSocialPost> {
    const bearerToken = env["TWITTER_BEARER_TOKEN"];

    if (bearerToken === undefined || bearerToken === "") {
      throw new Error(
        "Twitter/X API requires TWITTER_BEARER_TOKEN environment variable. " +
          "The X API requires paid access ($200/mo Basic tier or pay-per-use credits). " +
          "Set the token in your .env file to use the Twitter adapter.",
      );
    }

    const tweetId = extractTweetId(url);
    if (tweetId === null) {
      throw new Error(`Could not extract tweet ID from URL: ${url}`);
    }

    // Fetch tweet with author expansion
    const tweetUrl = new URL(`https://api.x.com/2/tweets/${tweetId}`);
    tweetUrl.searchParams.set("expansions", "author_id,attachments.media_keys");
    tweetUrl.searchParams.set("tweet.fields", "created_at,text,conversation_id,public_metrics");
    tweetUrl.searchParams.set("user.fields", "name,username,profile_image_url");
    tweetUrl.searchParams.set("media.fields", "type,url,preview_image_url");

    const tweetResponse = await fetch(tweetUrl.toString(), {
      signal,
      headers: { Authorization: `Bearer ${bearerToken}` },
    });

    if (!tweetResponse.ok) {
      const errorBody = await tweetResponse.text();
      throw new Error(`X API returned ${tweetResponse.status}: ${errorBody}`);
    }

    const tweetData = await tweetResponse.json();
    const tweet = tweetData.data;
    const users: Record<string, RawUser> = {};

    if (tweetData.includes?.users !== undefined) {
      for (const user of tweetData.includes.users) {
        users[user.id] = {
          id: user.id,
          username: user.username,
          displayName: user.name,
          avatarUrl: user.profile_image_url,
        };
      }
    }

    const media: RawSocialPost["media"] = [];
    if (tweetData.includes?.media !== undefined) {
      for (const m of tweetData.includes.media) {
        if (m.type === "photo") {
          media.push({ type: "image", url: m.url ?? m.preview_image_url });
        } else if (m.type === "video" || m.type === "animated_gif") {
          media.push({ type: "video", url: m.preview_image_url ?? "" });
        }
      }
    }

    // Fetch replies if requested
    let comments: RawComment[] = [];
    if (options.includeComments) {
      const conversationId = tweet.conversation_id ?? tweetId;
      const searchUrl = new URL("https://api.x.com/2/tweets/search/recent");
      searchUrl.searchParams.set("query", `conversation_id:${conversationId} is:reply`);
      searchUrl.searchParams.set("max_results", String(Math.min(options.maxComments, 100)));
      searchUrl.searchParams.set("expansions", "author_id");
      searchUrl.searchParams.set("tweet.fields", "created_at,text,in_reply_to_user_id");
      searchUrl.searchParams.set("user.fields", "name,username,profile_image_url");

      const searchResponse = await fetch(searchUrl.toString(), {
        signal,
        headers: { Authorization: `Bearer ${bearerToken}` },
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();

        if (searchData.includes?.users !== undefined) {
          for (const user of searchData.includes.users) {
            users[user.id] = {
              id: user.id,
              username: user.username,
              displayName: user.name,
              avatarUrl: user.profile_image_url,
            };
          }
        }

        if (searchData.data !== undefined) {
          comments = searchData.data
            .slice(0, options.maxComments)
            .map((reply: { author_id: string; text: string; created_at?: string }) => ({
              author: users[reply.author_id] ?? {
                id: reply.author_id,
                username: "unknown",
                displayName: "Unknown",
              },
              content: reply.text,
              timestamp: reply.created_at,
              depth: 0,
            }));
        }
      }
    }

    const author = users[tweet.author_id] ?? {
      id: tweet.author_id,
      username: "unknown",
      displayName: "Unknown",
    };

    return {
      platform: "twitter",
      author,
      content: tweet.text,
      timestamp: tweet.created_at,
      media,
      comments,
      totalCommentsFound: tweet.public_metrics?.reply_count ?? 0,
    };
  }
}
