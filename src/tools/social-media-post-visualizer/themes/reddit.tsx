import satori from "satori";
import type { PostMetrics, ThemeRenderer, ThemeRenderInput } from "./types.ts";
import { loadAdditionalAsset, loadFonts } from "./fonts.ts";

function avatar(url: string | undefined, size: number) {
  if (url !== undefined) {
    return <img src={url} width={size} height={size} style={{ borderRadius: "50%" }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#343536", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: Math.round(size * 0.45), color: "#818384" }}>?</span>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function RedditMetricsBar(props: { metrics: PostMetrics; fontSize?: number }) {
  const { metrics, fontSize = 11 } = props;
  // Reddit shows upvotes, comments — we'll adapt the available fields
  const items: Array<{ label: string; count: number }> = [
    { label: "\u2B06\uFE0F", count: metrics.likes },
    { label: "\uD83D\uDCAC", count: metrics.replies },
    { label: "\uD83D\uDD01", count: metrics.retweets },
    { label: "\uD83D\uDD16", count: metrics.bookmarks },
  ];

  return (
    <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <span style={{ fontSize: `${fontSize}px` }}>{item.label}</span>
          <span style={{ fontSize: `${fontSize}px`, color: "#818384" }}>{formatCount(item.count)}</span>
        </div>
      ))}
    </div>
  );
}

function sortByTimestamp<T extends { timestamp?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.timestamp === undefined || b.timestamp === undefined) return 0;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
}

function RedditPostCard(props: { input: ThemeRenderInput }) {
  const { post, comments, showMetrics } = props.input;
  const images = post.media.filter((m) => m.type === "image");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        backgroundColor: "#1a1a1b",
        color: "#d7dadc",
        fontFamily: "Nunito Sans, sans-serif",
        borderRadius: "8px",
        border: "1px solid #343536",
      }}
    >
      {/* Post header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 16px 0 16px",
        }}
      >
        {avatar(post.author.avatarUrl, 24)}
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#818384" }}>
          Posted by u/{post.author.username}
        </span>
        {post.timestamp !== undefined && (
          <span style={{ fontSize: "12px", color: "#818384" }}>
            {new Date(post.timestamp).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Post content */}
      <div style={{ padding: "8px 16px 16px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {post.content.split("\n").filter((l) => l.length > 0).map((line, i) => (
          <p key={i} style={{ fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{line}</p>
        ))}
        {showMetrics && post.metrics !== undefined && (
          <RedditMetricsBar metrics={post.metrics} fontSize={12} />
        )}
      </div>

      {/* Media */}
      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "0 16px 16px 16px" }}>
          {images.map((m, i) => (
            <img
              key={i}
              src={m.url}
              style={{ borderRadius: "8px", maxWidth: "100%" }}
              width={images.length === 1 ? 568 : 278}
            />
          ))}
        </div>
      )}

      {/* Comments */}
      {comments.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderTop: "1px solid #343536",
            padding: "12px 16px",
            gap: "12px",
            backgroundColor: "#161617",
          }}
        >
          {sortByTimestamp(comments).map((comment, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "8px",
                paddingLeft: `${Math.min(comment.depth, 3) * 16}px`,
                borderLeft: comment.depth > 0 ? "2px solid #343536" : "none",
              }}
            >
              {avatar(comment.author.avatarUrl, 20)}
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#818384" }}>
                    u/{comment.author.username}
                  </span>
                  {comment.timestamp !== undefined && (
                    <span style={{ fontSize: "10px", color: "#818384" }}>
                      {new Date(comment.timestamp).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "2px 0 0 0" }}>
                  {comment.content.split("\n").filter((l) => l.length > 0).map((line, j) => (
                    <p key={j} style={{ fontSize: "12px", lineHeight: 1.4, margin: 0 }}>{line}</p>
                  ))}
                </div>
                {showMetrics && comment.metrics !== undefined && (
                  <RedditMetricsBar metrics={comment.metrics} fontSize={10} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export class RedditThemeRenderer implements ThemeRenderer {
  platform = "reddit" as const;

  async render(input: ThemeRenderInput): Promise<string> {
    const fonts = await loadFonts();
    const svg = await satori(<RedditPostCard input={input} />, {
      width: 600,
      height: undefined,
      fonts,
      loadAdditionalAsset,
    });
    return svg;
  }
}
