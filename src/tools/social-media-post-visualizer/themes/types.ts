export interface PostMetrics {
  replies: number;
  retweets: number;
  likes: number;
  bookmarks: number;
  views: number;
}

export interface VisualizerUser {
  displayName: string;
  username: string;
  avatarUrl?: string;
}

export interface ThemeRenderInput {
  platform: "twitter" | "reddit";
  showMetrics: boolean;
  post: {
    author: VisualizerUser;
    content: string;
    timestamp?: string;
    media: Array<{ type: "image" | "video" | "link"; url: string }>;
    quotedPost?: {
      author: VisualizerUser;
      content: string;
      timestamp?: string;
    };
    metrics?: PostMetrics;
  };
  comments: Array<{
    author: VisualizerUser;
    content: string;
    timestamp?: string;
    depth: number;
    metrics?: PostMetrics;
  }>;
}

export interface ThemeRenderer {
  platform: "twitter" | "reddit";
  render(input: ThemeRenderInput): Promise<string>;
}
