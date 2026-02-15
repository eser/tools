import type { PostMetrics, RawComment, RawSocialPost, RawUser, SocialAdapter } from "./types.ts";

function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/);
  return match !== null ? match[1] : null;
}

function upgradeAvatarUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  // Twitter returns _normal (48x48) by default; upgrade to _400x400
  return url.replace(/_normal\./, "_400x400.");
}

function extractMetrics(pm: Record<string, number> | undefined): PostMetrics | undefined {
  if (pm === undefined) return undefined;
  return {
    replies: pm.reply_count ?? 0,
    retweets: pm.retweet_count ?? 0,
    likes: pm.like_count ?? 0,
    bookmarks: pm.bookmark_count ?? 0,
    views: pm.impression_count ?? 0,
  };
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
          "The X API requires pay-per-use credits. " +
          "Set the token in your .env file to use the Twitter adapter.",
      );
    }

    const tweetId = extractTweetId(url);
    if (tweetId === null) {
      throw new Error(`Could not extract tweet ID from URL: ${url}`);
    }

    // Fetch tweet with author expansion
    const tweetUrl = new URL(`https://api.x.com/2/tweets/${tweetId}`);
    tweetUrl.searchParams.set("expansions", "author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id");
    tweetUrl.searchParams.set("tweet.fields", "created_at,text,note_tweet,conversation_id,public_metrics,referenced_tweets");
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
          avatarUrl: upgradeAvatarUrl(user.profile_image_url),
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

    // Extract quoted tweet if present
    let quotedPost: { author: RawUser; content: string; timestamp?: string } | undefined;
    const quotedRef = tweet.referenced_tweets?.find(
      (r: { type: string; id: string }) => r.type === "quoted",
    );
    if (quotedRef !== undefined && tweetData.includes?.tweets !== undefined) {
      const quotedTweet = tweetData.includes.tweets.find(
        (t: { id: string }) => t.id === quotedRef.id,
      );
      if (quotedTweet !== undefined) {
        const quotedAuthor = users[quotedTweet.author_id] ?? {
          id: quotedTweet.author_id,
          username: "unknown",
          displayName: "Unknown",
        };
        quotedPost = {
          author: quotedAuthor,
          content: quotedTweet.note_tweet?.text ?? quotedTweet.text,
          timestamp: quotedTweet.created_at,
        };
      }
    }

    // Fetch replies if requested using full-archive search
    let comments: RawComment[] = [];
    if (options.includeComments) {
      const conversationId = tweet.conversation_id ?? tweetId;
      const searchUrl = new URL("https://api.x.com/2/tweets/search/all");
      searchUrl.searchParams.set("query", `conversation_id:${conversationId}`);
      searchUrl.searchParams.set("max_results", String(Math.min(options.maxComments, 100)));
      searchUrl.searchParams.set("expansions", "author_id");
      searchUrl.searchParams.set("tweet.fields", "created_at,text,note_tweet,in_reply_to_user_id,referenced_tweets,public_metrics");
      searchUrl.searchParams.set("user.fields", "name,username,profile_image_url");

      // Full-archive search requires start_time for older tweets
      if (tweet.created_at !== undefined) {
        searchUrl.searchParams.set("start_time", tweet.created_at);
      }

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
              avatarUrl: upgradeAvatarUrl(user.profile_image_url),
            };
          }
        }

        if (searchData.data !== undefined) {
          // Build parent map from referenced_tweets
          const parentMap: Record<string, string> = {};
          for (const reply of searchData.data) {
            const repliedTo = reply.referenced_tweets?.find(
              (r: { type: string; id: string }) => r.type === "replied_to",
            );
            if (repliedTo !== undefined) {
              parentMap[reply.id] = repliedTo.id;
            }
          }

          // Check if a tweet is a descendant of the fetched tweet
          const isDescendant = (id: string): boolean => {
            if (id === tweetId) return true;
            const parentId = parentMap[id];
            if (parentId === undefined) return false;
            return isDescendant(parentId);
          };

          // Calculate depth relative to the fetched tweet (direct reply = 0)
          const depthCache: Record<string, number> = { [tweetId]: -1 };
          const getDepth = (id: string): number => {
            if (depthCache[id] !== undefined) return depthCache[id];
            const parentId = parentMap[id];
            if (parentId === undefined) {
              depthCache[id] = 0;
              return 0;
            }
            const depth = getDepth(parentId) + 1;
            depthCache[id] = depth;
            return depth;
          };

          // Only include tweets that are descendants of the fetched tweet
          const descendants = searchData.data.filter(
            (reply: { id: string }) => reply.id !== tweetId && isDescendant(reply.id),
          );

          comments = descendants
            .slice(0, options.maxComments)
            .map((reply: { id: string; author_id: string; text: string; note_tweet?: { text: string }; created_at?: string; public_metrics?: Record<string, number> }) => ({
              author: users[reply.author_id] ?? {
                id: reply.author_id,
                username: "unknown",
                displayName: "Unknown",
              },
              content: reply.note_tweet?.text ?? reply.text,
              timestamp: reply.created_at,
              depth: getDepth(reply.id),
              metrics: extractMetrics(reply.public_metrics),
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
      id: `twitter-${tweetId}`,
      platform: "twitter",
      author,
      content: tweet.note_tweet?.text ?? tweet.text,
      timestamp: tweet.created_at,
      media,
      quotedPost,
      metrics: extractMetrics(tweet.public_metrics),
      comments,
    };
  }
}
