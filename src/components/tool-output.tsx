import { CopyButton } from "@/components/copy-button.tsx";
import {
  getImagePreview,
  ImagePreviewCard,
} from "@/components/output-preview.tsx";

interface ToolOutputProps {
  data: unknown;
  error: string | null;
}

export function ToolOutput(props: ToolOutputProps) {
  const { data, error } = props;

  if (error !== null) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
        <p className="text-sm font-medium text-destructive">Error</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (data === null || data === undefined) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-8 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Execute the tool to see results here.
        </p>
      </div>
    );
  }

  const image = getImagePreview(data);

  return (
    <div className="space-y-4">
      {/* Image / SVG preview with copy & click-to-expand */}
      {image && (
        <ImagePreviewCard
          image={image}
          output={data}
          label={image.mimeType === "image/svg+xml" ? "SVG Preview" : "Image Preview"}
        />
      )}

      {/* JSON output */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2 bg-muted text-xs font-medium border-b border-border flex items-center justify-between">
          JSON Output
          <CopyButton text={JSON.stringify(data, null, 2)} className="h-6 text-xs" />
        </div>
        <pre className="p-4 text-xs overflow-auto max-h-96 font-mono">
          {JSON.stringify(
            data,
            (_, v) => {
              // Truncate long strings (SVG, base64) in JSON view
              if (typeof v === "string" && v.length > 200) {
                return `${v.slice(0, 200)}... (${v.length} chars)`;
              }
              return v;
            },
            2,
          )}
        </pre>
      </div>
    </div>
  );
}
