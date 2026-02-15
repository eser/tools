import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";
import { CopyButton, type ImageInfo } from "@/components/copy-button.tsx";

// ---------------------------------------------------------------
// Detect image content from tool output
// ---------------------------------------------------------------

export interface ImagePreview {
  /** Data-URI suitable for <img src> */
  src: string;
  alt: string;
  /** Raw content (SVG source or base64 binary) */
  rawData: string;
  mimeType: string;
}

export function getImagePreview(output: unknown): ImagePreview | null {
  if (output == null || typeof output !== "object") return null;
  const obj = output as Record<string, unknown>;

  // Vector-renderer style: { data: string, mimeType: "image/svg+xml" | "image/png" }
  if (typeof obj.data === "string" && typeof obj.mimeType === "string") {
    if (obj.mimeType === "image/svg+xml") {
      return {
        src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(obj.data)}`,
        alt: "SVG output",
        rawData: obj.data,
        mimeType: obj.mimeType,
      };
    }
    if ((obj.mimeType as string).startsWith("image/")) {
      return {
        src: `data:${obj.mimeType};base64,${obj.data}`,
        alt: "Image output",
        rawData: obj.data,
        mimeType: obj.mimeType as string,
      };
    }
  }

  // Social-media-anonymizer style: { svg: string, ... }
  if (typeof obj.svg === "string" && obj.svg.trim().startsWith("<")) {
    return {
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(obj.svg)}`,
      alt: "SVG preview",
      rawData: obj.svg,
      mimeType: "image/svg+xml",
    };
  }

  return null;
}

/** Extract a plain-text representation of the output. */
export function getTextPreview(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (typeof output === "number" || typeof output === "boolean")
    return String(output);
  return null;
}

/** Convert an ImagePreview to the ImageInfo shape used by CopyButton. */
export function toImageInfo(img: ImagePreview): ImageInfo {
  return { rawData: img.rawData, mimeType: img.mimeType };
}

// ---------------------------------------------------------------
// Fullscreen preview modal (portaled to body)
// ---------------------------------------------------------------

export function FullscreenPreview({
  output,
  onClose,
}: {
  output: unknown;
  onClose: () => void;
}) {
  const image = getImagePreview(output);

  let text: string | null = null;
  if (!image) {
    text = getTextPreview(output);
    if (!text && output != null && typeof output === "object") {
      text = JSON.stringify(output, null, 2);
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-end gap-1 px-3 py-2 border-b border-zinc-800">
          <CopyButton
            iconOnly
            image={image ? toImageInfo(image) : undefined}
            text={!image ? (text ?? undefined) : undefined}
          />
          <button
            type="button"
            className="rounded p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            onClick={onClose}
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Content */}
        {image && (
          <div className="overflow-auto p-4">
            <img
              src={image.src}
              alt={image.alt}
              className="max-w-none"
              draggable={false}
            />
          </div>
        )}
        {text && (
          <textarea
            readOnly
            className="flex-1 min-w-[60vw] min-h-[60vh] resize-none bg-transparent p-4 text-sm font-mono text-zinc-300 leading-relaxed outline-none border-none whitespace-pre"
            value={text}
            autoFocus
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------
// Clickable image preview card (for pipelines / tool pages)
// ---------------------------------------------------------------

export function ImagePreviewCard({
  image,
  output,
  label,
}: {
  image: ImagePreview;
  output: unknown;
  label: string;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2 bg-muted text-xs font-medium border-b border-border flex items-center justify-between">
          {label}
          <CopyButton
            image={toImageInfo(image)}
            className="h-6 text-xs"
          />
        </div>
        <div
          className="p-4 flex justify-center cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setFullscreen(true)}
          title="Click to expand"
        >
          <img
            src={image.src}
            alt={image.alt}
            className="max-w-full"
            draggable={false}
          />
        </div>
      </div>
      {fullscreen && (
        <FullscreenPreview
          output={output}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------
// Clickable output thumbnail (compact, for designer nodes)
// ---------------------------------------------------------------

const thumbnailWrapperClassName =
  "nodrag nopan mx-2 mb-2 mt-1 overflow-hidden rounded border border-zinc-700/50 bg-zinc-950 cursor-pointer hover:border-zinc-600 transition-colors";

export function OutputThumbnail({ output }: { output: unknown }) {
  const [fullscreen, setFullscreen] = useState(false);
  const open = useCallback(() => setFullscreen(true), []);

  const image = getImagePreview(output);
  if (image) {
    return (
      <>
        <div
          className={thumbnailWrapperClassName}
          style={{ contain: "inline-size" }}
          onClick={open}
        >
          <img
            src={image.src}
            alt={image.alt}
            className="w-full max-h-[200px] object-contain"
            draggable={false}
          />
        </div>
        {fullscreen && (
          <FullscreenPreview
            output={output}
            onClose={() => setFullscreen(false)}
          />
        )}
      </>
    );
  }

  const text = getTextPreview(output);
  if (text) {
    return (
      <>
        <div
          className={thumbnailWrapperClassName}
          style={{ contain: "inline-size" }}
          onClick={open}
        >
          <div className="px-2 py-1.5 text-[10px] font-mono text-zinc-500 leading-tight max-h-[80px] overflow-hidden">
            {text.slice(0, 200)}
          </div>
        </div>
        {fullscreen && (
          <FullscreenPreview
            output={output}
            onClose={() => setFullscreen(false)}
          />
        )}
      </>
    );
  }

  if (output != null && typeof output === "object") {
    const json = JSON.stringify(output, null, 2);
    return (
      <>
        <div
          className={thumbnailWrapperClassName}
          style={{ contain: "inline-size" }}
          onClick={open}
        >
          <div className="px-2 py-1.5 text-[10px] font-mono text-zinc-500 leading-tight max-h-[80px] overflow-hidden">
            {json.slice(0, 200)}
          </div>
        </div>
        {fullscreen && (
          <FullscreenPreview
            output={output}
            onClose={() => setFullscreen(false)}
          />
        )}
      </>
    );
  }

  return null;
}
