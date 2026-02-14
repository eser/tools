import type { AnonymizedUser } from "../schema.ts";

export interface ThemeRenderInput {
  platform: "twitter" | "reddit";
  post: {
    author: AnonymizedUser;
    content: string;
    timestamp?: string;
    media: Array<{ type: "image" | "video" | "link"; url: string }>;
    quotedPost?: {
      author: AnonymizedUser;
      content: string;
      timestamp?: string;
    };
  };
  comments: Array<{
    author: AnonymizedUser;
    content: string;
    timestamp?: string;
    depth: number;
  }>;
}

export interface ThemeRenderer {
  platform: "twitter" | "reddit";
  render(input: ThemeRenderInput): Promise<string>;
}
