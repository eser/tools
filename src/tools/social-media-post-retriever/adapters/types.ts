export interface RawUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface PostMetrics {
  replies: number;
  retweets: number;
  likes: number;
  bookmarks: number;
  views: number;
}

export interface RawComment {
  author: RawUser;
  content: string;
  timestamp?: string;
  depth: number;
  metrics?: PostMetrics;
}

export interface RawQuotedPost {
  author: RawUser;
  content: string;
  timestamp?: string;
}

export interface RawSocialPost {
  id: string;
  platform: "twitter" | "reddit";
  author: RawUser;
  content: string;
  timestamp?: string;
  media: Array<{ type: "image" | "video" | "link"; url: string }>;
  quotedPost?: RawQuotedPost;
  metrics?: PostMetrics;
  comments: RawComment[];
}

export interface SocialAdapter {
  platform: "twitter" | "reddit";
  canHandle(url: string): boolean;
  fetchPost(
    url: string,
    options: { includeComments: boolean; maxComments: number },
    env: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<RawSocialPost>;
}
