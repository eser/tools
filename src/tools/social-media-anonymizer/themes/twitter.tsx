import satori from "satori";
import type { ThemeRenderer, ThemeRenderInput } from "./types.ts";
import { loadAdditionalAsset, loadFonts } from "./fonts.ts";

function TweetCard(props: { input: ThemeRenderInput }) {
  const { post, comments } = props.input;
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
          {comments.map((comment, i) => (
            <div key={i} style={{ display: "flex", gap: "10px" }}>
              <img
                src={comment.author.anonymizedAvatarUrl}
                width={32}
                height={32}
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
