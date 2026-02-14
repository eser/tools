export interface RawUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface RawComment {
  author: RawUser;
  content: string;
  timestamp?: string;
  depth: number;
}

export interface RawSocialPost {
  platform: "twitter" | "reddit";
  author: RawUser;
  content: string;
  timestamp?: string;
  media: Array<{ type: "image" | "video" | "link"; url: string }>;
  comments: RawComment[];
  totalCommentsFound: number;
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
