import { CopyButton } from "@/components/copy-button.tsx";

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

  // Check if output has an SVG field
  const dataObj = data as Record<string, unknown>;
  const hasSvg = typeof dataObj.svg === "string" && dataObj.svg.length > 0;

  // Check if output has base64 image data
  const hasImage =
    typeof dataObj.data === "string" &&
    dataObj.mimeType === "image/png";

  return (
    <div className="space-y-4">
      {/* SVG preview */}
      {hasSvg && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 bg-muted text-xs font-medium border-b border-border">
            SVG Preview
          </div>
          <div
            className="p-4 flex justify-center"
            dangerouslySetInnerHTML={{ __html: dataObj.svg as string }}
          />
        </div>
      )}

      {/* Base64 image preview */}
      {hasImage && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 bg-muted text-xs font-medium border-b border-border">
            PNG Preview
          </div>
          <div className="p-4 flex justify-center">
            <img
              src={`data:image/png;base64,${dataObj.data as string}`}
              alt="Rendered output"
              className="max-w-full"
            />
          </div>
        </div>
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
