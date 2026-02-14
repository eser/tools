import satori from "satori";
import type { ThemeRenderer, ThemeRenderInput } from "./types.ts";

function TweetCard(props: { input: ThemeRenderInput }) {
  const { post, comments } = props.input;
  const maxPreviewComments = Math.min(comments.length, 3);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        backgroundColor: "#15202b",
        color: "#e7e9ea",
        fontFamily: "sans-serif",
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
          <p style={{ fontSize: "15px", lineHeight: 1.5, margin: "4px 0 0 0" }}>
            {post.content}
          </p>
          {post.timestamp !== undefined && (
            <span style={{ color: "#71767b", fontSize: "13px", marginTop: "8px" }}>
              {new Date(post.timestamp).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Replies */}
      {maxPreviewComments > 0 && (
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
          {comments.slice(0, maxPreviewComments).map((comment, i) => (
            <div key={i} style={{ display: "flex", gap: "10px" }}>
              <img
                src={comment.author.anonymizedAvatarUrl}
                width={32}
                height={32}
                style={{ borderRadius: "50%" }}
              />
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: "13px" }}>
                  {comment.author.anonymizedName}
                </span>
                <p
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.4,
                    margin: "2px 0 0 0",
                    color: "#d6d9db",
                  }}
                >
                  {comment.content.length > 200
                    ? `${comment.content.slice(0, 200)}...`
                    : comment.content}
                </p>
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
    const svg = await satori(<TweetCard input={input} />, {
      width: 600,
      height: undefined,
      fonts: [],
    });
    return svg;
  }
}
