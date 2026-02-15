import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button.tsx";
import { CopyIcon, CheckIcon } from "lucide-react";

// ---------------------------------------------------------------
// Image copy helpers (shared across app)
// ---------------------------------------------------------------

export interface ImageInfo {
  rawData: string;
  mimeType: string;
}

/** Copy an image to clipboard: SVG as source text, binary as blob. */
export function copyImageToClipboard(image: ImageInfo): Promise<void> {
  if (image.mimeType === "image/svg+xml") {
    return navigator.clipboard.writeText(image.rawData);
  }

  const byteString = atob(image.rawData);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: image.mimeType });
  return navigator.clipboard.write([
    new ClipboardItem({ [image.mimeType]: blob }),
  ]);
}

// ---------------------------------------------------------------
// CopyButton component
// ---------------------------------------------------------------

interface CopyButtonProps {
  /** Text to copy (used when `image` is not provided). */
  text?: string;
  /** Image to copy as bitmap/SVG source (takes priority over text). */
  image?: ImageInfo;
  className?: string;
  /** Render as a minimal icon-only button (for toolbars / dark UIs). */
  iconOnly?: boolean;
}

export function CopyButton(props: CopyButtonProps) {
  const { text, image, className, iconOnly } = props;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (image) {
      await copyImageToClipboard(image);
    } else {
      await navigator.clipboard.writeText(text ?? "");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text, image]);

  const title = image
    ? image.mimeType === "image/svg+xml"
      ? "Copy SVG source"
      : "Copy image"
    : "Copy to clipboard";

  if (iconOnly) {
    return (
      <button
        type="button"
        className={className ?? "rounded p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"}
        onClick={handleCopy}
        title={title}
      >
        {copied ? (
          <CheckIcon className="size-4 text-emerald-400" />
        ) : (
          <CopyIcon className="size-4" />
        )}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={handleCopy}
      title={title}
    >
      {copied ? (
        <>
          <CheckIcon className="size-3.5 mr-1" />
          Copied!
        </>
      ) : (
        <>
          <CopyIcon className="size-3.5 mr-1" />
          Copy
        </>
      )}
    </Button>
  );
}
