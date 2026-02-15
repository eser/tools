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
  is_gallery?: boolean;
  post_hint?: string;
  preview?: {
    images: Array<{ source: { url: string } }>;
  };
  gallery_data?: {
    items: Array<{ media_id: string; id: number }>;
  };
  media_metadata?: Record<string, {
    status: string;
    e: string;
    m: string;
    s: { u: string; x: number; y: number };
  }>;
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
  avatarUrl?: string,
): RawUser {
  return {
    id: authorFullname ?? author,
    username: author,
    displayName: author,
    avatarUrl,
  };
}

async function fetchAvatars(
  usernames: string[],
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const avatars = new Map<string, string>();
  const unique = [...new Set(usernames)].filter(
    (u) => u !== "[deleted]" && u !== "AutoModerator",
  );

  await Promise.allSettled(
    unique.map(async (username) => {
      try {
        const res = await fetch(
          `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
          { signal, headers: { "User-Agent": "eser-tools/0.1.0" } },
        );
        if (!res.ok) return;
        const json = await res.json() as { data?: { snoovatar_img?: string; icon_img?: string } };
        const snoovatar = json.data?.snoovatar_img;
        const icon = json.data?.icon_img;
        if (snoovatar) {
          avatars.set(username, snoovatar.replaceAll("&amp;", "&"));
        } else if (icon) {
          const cleaned = icon.replaceAll("&amp;", "&");
          const parsed = new URL(cleaned);
          if (parsed.searchParams.has("width")) parsed.searchParams.set("width", "400");
          if (parsed.searchParams.has("height")) parsed.searchParams.set("height", "400");
          avatars.set(username, parsed.toString());
        }
      } catch {
        // ignore individual failures
      }
    }),
  );

  return avatars;
}

function flattenComments(
  children: Array<RedditThing<RedditComment>>,
  maxComments: number,
  avatars: Map<string, string>,
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
      author: parseRedditUser(comment.author, comment.author_fullname, avatars.get(comment.author)),
      content: comment.body,
      timestamp: new Date(comment.created_utc * 1000).toISOString(),
      depth: comment.depth,
    });

    if (
      comment.replies !== undefined &&
      comment.replies !== "" &&
      typeof comment.replies === "object"
    ) {
      flattenComments(comment.replies.data.children, maxComments, avatars, collected);
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
    if (postData.is_gallery && postData.gallery_data !== undefined && postData.media_metadata !== undefined) {
      // Gallery post: extract images in order
      for (const item of postData.gallery_data.items) {
        const meta = postData.media_metadata[item.media_id];
        if (meta !== undefined && meta.status === "valid" && meta.e === "Image") {
          // Reddit HTML-encodes `&` in URLs
          const imageUrl = meta.s.u.replaceAll("&amp;", "&");
          media.push({ type: "image", url: imageUrl });
        }
      }
    } else if (postData.post_hint === "image" && postData.url_overridden_by_dest !== undefined) {
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

    // Collect all usernames for avatar fetching
    const usernames = [postData.author];
    const commentChildren = options.includeComments && data.length > 1
      ? data[1].data.children
      : [];
    function collectUsernames(children: Array<RedditThing<RedditComment>>) {
      for (const child of children) {
        if (child.kind !== "t1") continue;
        const c = child.data;
        if (c.author !== "[deleted]" && c.author !== "AutoModerator") {
          usernames.push(c.author);
        }
        if (c.replies && typeof c.replies === "object") {
          collectUsernames(c.replies.data.children);
        }
      }
    }
    collectUsernames(commentChildren);

    const avatars = await fetchAvatars(usernames, signal);

    let comments: RawComment[] = [];
    if (options.includeComments && data.length > 1) {
      comments = flattenComments(
        data[1].data.children,
        options.maxComments,
        avatars,
      );
    }

    // Content is title + selftext for Reddit
    const content = postData.selftext.length > 0
      ? `${postData.title}\n\n${postData.selftext}`
      : postData.title;

    return {
      id: `reddit-${postData.id}`,
      platform: "reddit",
      author: parseRedditUser(postData.author, postData.author_fullname, avatars.get(postData.author)),
      content,
      timestamp: new Date(postData.created_utc * 1000).toISOString(),
      media,
      comments,
    };
  }
}
