import satori from "satori";
import type { ThemeRenderer, ThemeRenderInput } from "./types.ts";

function RedditPostCard(props: { input: ThemeRenderInput }) {
  const { post, comments } = props.input;
  const maxPreviewComments = Math.min(comments.length, 3);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        backgroundColor: "#1a1a1b",
        color: "#d7dadc",
        fontFamily: "sans-serif",
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
        <img
          src={post.author.anonymizedAvatarUrl}
          width={24}
          height={24}
          style={{ borderRadius: "50%" }}
        />
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#818384" }}>
          Posted by u/{post.author.anonymizedName.toLowerCase()}
        </span>
        {post.timestamp !== undefined && (
          <span style={{ fontSize: "12px", color: "#818384" }}>
            {new Date(post.timestamp).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Post content */}
      <div style={{ padding: "8px 16px 16px 16px", display: "flex", flexDirection: "column" }}>
        <p style={{ fontSize: "14px", lineHeight: 1.6, margin: 0 }}>
          {post.content}
        </p>
      </div>

      {/* Comments */}
      {maxPreviewComments > 0 && (
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
          {comments.slice(0, maxPreviewComments).map((comment, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "8px",
                paddingLeft: `${Math.min(comment.depth, 3) * 16}px`,
                borderLeft: comment.depth > 0 ? "2px solid #343536" : "none",
              }}
            >
              <img
                src={comment.author.anonymizedAvatarUrl}
                width={20}
                height={20}
                style={{ borderRadius: "50%" }}
              />
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#818384" }}>
                  u/{comment.author.anonymizedName.toLowerCase()}
                </span>
                <p
                  style={{
                    fontSize: "12px",
                    lineHeight: 1.4,
                    margin: "2px 0 0 0",
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

export class RedditThemeRenderer implements ThemeRenderer {
  platform = "reddit" as const;

  async render(input: ThemeRenderInput): Promise<string> {
    const svg = await satori(<RedditPostCard input={input} />, {
      width: 600,
      height: undefined,
      fonts: [],
    });
    return svg;
  }
}
