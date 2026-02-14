import type { RawComment, RawSocialPost, RawUser, SocialAdapter } from "./types.ts";

interface RedditThing<T> {
  kind: string;
  data: T;
}

interface RedditListing<T> {
  children: Array<RedditThing<T>>;
}

interface RedditPost {
  id: string;
  author: string;
  author_fullname?: string;
  selftext: string;
  title: string;
  created_utc: number;
  subreddit: string;
  url_overridden_by_dest?: string;
  is_video: boolean;
  post_hint?: string;
  preview?: {
    images: Array<{ source: { url: string } }>;
  };
  num_comments: number;
}

interface RedditComment {
  id: string;
  author: string;
  author_fullname?: string;
  body: string;
  created_utc: number;
  depth: number;
  replies?: RedditThing<RedditListing<RedditComment>> | "";
}

function parseRedditUser(
  author: string,
  authorFullname?: string,
): RawUser {
  return {
    id: authorFullname ?? author,
    username: author,
    displayName: author,
    avatarUrl: undefined,
  };
}

function flattenComments(
  children: Array<RedditThing<RedditComment>>,
  maxComments: number,
  collected: RawComment[] = [],
): RawComment[] {
  for (const child of children) {
    if (collected.length >= maxComments) break;
    if (child.kind !== "t1") continue;

    const comment = child.data;
    if (comment.author === "[deleted]" || comment.author === "AutoModerator") {
      continue;
    }

    collected.push({
      author: parseRedditUser(comment.author, comment.author_fullname),
      content: comment.body,
      timestamp: new Date(comment.created_utc * 1000).toISOString(),
      depth: comment.depth,
    });

    if (
      comment.replies !== undefined &&
      comment.replies !== "" &&
      typeof comment.replies === "object"
    ) {
      flattenComments(comment.replies.data.children, maxComments, collected);
    }
  }

  return collected;
}

export class RedditAdapter implements SocialAdapter {
  platform = "reddit" as const;

  canHandle(url: string): boolean {
    return /reddit\.com\/r\/\w+\/comments\//.test(url);
  }

  async fetchPost(
    url: string,
    options: { includeComments: boolean; maxComments: number },
    _env: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<RawSocialPost> {
    // Normalize URL and append .json
    const cleanUrl = url.split("?")[0].replace(/\/$/, "");
    const jsonUrl = `${cleanUrl}.json`;

    const response = await fetch(jsonUrl, {
      signal,
      headers: {
        "User-Agent": "eser-tools/0.1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as [
      RedditThing<RedditListing<RedditPost>>,
      RedditThing<RedditListing<RedditComment>>,
    ];

    const postData = data[0].data.children[0].data;

    const media: RawSocialPost["media"] = [];
    if (postData.post_hint === "image" && postData.url_overridden_by_dest !== undefined) {
      media.push({ type: "image", url: postData.url_overridden_by_dest });
    } else if (postData.is_video) {
      media.push({
        type: "video",
        url: postData.url_overridden_by_dest ?? url,
      });
    } else if (
      postData.url_overridden_by_dest !== undefined &&
      !postData.url_overridden_by_dest.includes("reddit.com")
    ) {
      media.push({ type: "link", url: postData.url_overridden_by_dest });
    }

    let comments: RawComment[] = [];
    if (options.includeComments && data.length > 1) {
      comments = flattenComments(
        data[1].data.children,
        options.maxComments,
      );
    }

    // Content is title + selftext for Reddit
    const content = postData.selftext.length > 0
      ? `${postData.title}\n\n${postData.selftext}`
      : postData.title;

    return {
      platform: "reddit",
      author: parseRedditUser(postData.author, postData.author_fullname),
      content,
      timestamp: new Date(postData.created_utc * 1000).toISOString(),
      media,
      comments,
      totalCommentsFound: postData.num_comments,
    };
  }
}
