import satori from "satori";
import type { PostMetrics, ThemeRenderer, ThemeRenderInput } from "./types.ts";
import { loadAdditionalAsset, loadFonts } from "./fonts.ts";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function MetricsBar(props: { metrics: PostMetrics; fontSize?: number }) {
  const { metrics, fontSize = 13 } = props;
  const items: Array<{ icon: string; count: number }> = [
    { icon: "\uD83D\uDCAC", count: metrics.replies },
    { icon: "\uD83D\uDD01", count: metrics.retweets },
    { icon: "\u2764\uFE0F", count: metrics.likes },
    { icon: "\uD83D\uDD16", count: metrics.bookmarks },
    { icon: "\uD83D\uDCC8", count: metrics.views },
  ];

  return (
    <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: `${fontSize}px` }}>{item.icon}</span>
          <span style={{ fontSize: `${fontSize}px`, color: "#71767b" }}>{formatCount(item.count)}</span>
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

function TweetCard(props: { input: ThemeRenderInput }) {
  const { post, comments, showMetrics } = props.input;
  const images = post.media.filter((m) => m.type === "image");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        backgroundColor: "#15202b",
        color: "#e7e9ea",
        fontFamily: "Nunito Sans, sans-serif",
        padding: "20px",
        borderRadius: "16px",
      }}
    >
      {/* Main tweet */}
      <div style={{ display: "flex", gap: "12px" }}>
        <img
          src={post.author.anonymizedAvatarUrl}
          width={48}
          height={48}
          style={{ borderRadius: "50%" }}
        />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "15px" }}>
              {post.author.anonymizedName}
            </span>
            <span style={{ color: "#71767b", fontSize: "15px" }}>
              @{post.author.anonymizedName.toLowerCase()}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "4px 0 0 0" }}>
            {post.content.split("\n").filter((l) => l.length > 0).map((line, i) => (
              <p key={i} style={{ fontSize: "15px", lineHeight: 1.5, margin: 0 }}>{line}</p>
            ))}
          </div>
          {images.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "12px" }}>
              {images.map((m, i) => (
                <img
                  key={i}
                  src={m.url}
                  style={{ borderRadius: "12px", maxWidth: "100%" }}
                  width={images.length === 1 ? 520 : 254}
                />
              ))}
            </div>
          )}
          {post.quotedPost !== undefined && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: "12px",
                border: "1px solid #2f3336",
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <img
                  src={post.quotedPost.author.anonymizedAvatarUrl}
                  width={20}
                  height={20}
                  style={{ borderRadius: "50%" }}
                />
                <span style={{ fontWeight: 700, fontSize: "13px" }}>
                  {post.quotedPost.author.anonymizedName}
                </span>
                <span style={{ color: "#71767b", fontSize: "13px" }}>
                  @{post.quotedPost.author.anonymizedName.toLowerCase()}
                </span>
                {post.quotedPost.timestamp !== undefined && (
                  <span style={{ color: "#71767b", fontSize: "11px" }}>
                    {new Date(post.quotedPost.timestamp).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "6px 0 0 0" }}>
                {post.quotedPost.content.split("\n").filter((l) => l.length > 0).map((line, i) => (
                  <p key={i} style={{ fontSize: "13px", lineHeight: 1.4, margin: 0 }}>{line}</p>
                ))}
              </div>
            </div>
          )}
          {post.timestamp !== undefined && (
            <span style={{ color: "#71767b", fontSize: "13px", marginTop: "8px" }}>
              {new Date(post.timestamp).toLocaleString()}
            </span>
          )}
          {showMetrics && post.metrics !== undefined && (
            <MetricsBar metrics={post.metrics} />
          )}
        </div>
      </div>

      {/* Replies */}
      {comments.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "16px",
            borderTop: "1px solid #2f3336",
            paddingTop: "12px",
            gap: "12px",
          }}
        >
          {sortByTimestamp(comments).map((comment, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "10px",
                marginLeft: `${Math.min(comment.depth, 4) * 24}px`,
                paddingLeft: comment.depth > 0 ? "12px" : "0",
                borderLeft: comment.depth > 0 ? "2px solid #2f3336" : "none",
              }}
            >
              <img
                src={comment.author.anonymizedAvatarUrl}
                width={comment.depth > 0 ? 24 : 32}
                height={comment.depth > 0 ? 24 : 32}
                style={{ borderRadius: "50%" }}
              />
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: "13px" }}>
                    {comment.author.anonymizedName}
                  </span>
                  {comment.timestamp !== undefined && (
                    <span style={{ color: "#71767b", fontSize: "11px" }}>
                      {new Date(comment.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "2px 0 0 0" }}>
                  {comment.content.split("\n").filter((l) => l.length > 0).map((line, j) => (
                    <p key={j} style={{ fontSize: "13px", lineHeight: 1.4, margin: 0, color: "#d6d9db" }}>{line}</p>
                  ))}
                </div>
                {showMetrics && comment.metrics !== undefined && (
                  <MetricsBar metrics={comment.metrics} fontSize={11} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export class TwitterThemeRenderer implements ThemeRenderer {
  platform = "twitter" as const;

  async render(input: ThemeRenderInput): Promise<string> {
    const fonts = await loadFonts();
    const svg = await satori(<TweetCard input={input} />, {
      width: 600,
      height: undefined,
      fonts,
      loadAdditionalAsset,
    });
    return svg;
  }
}
