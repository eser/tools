import type { ToolContext, ToolResult } from "../types.ts";
import { toolFail, toolOk } from "../types.ts";
import type { VectorRendererInput, VectorRendererOutput } from "./schema.ts";

// Module name as variable to prevent Vite from scanning the dynamic import
const RESVG_MODULE = "@resvg/resvg-js";

export async function execute(
  input: VectorRendererInput,
  _context: ToolContext,
): Promise<ToolResult<VectorRendererOutput>> {
  try {
    if (input.format === "svg") {
      return toolOk({
        data: input.svg,
        mimeType: "image/svg+xml",
        sizeBytes: new TextEncoder().encode(input.svg).length,
      });
    }

    // PNG rendering via resvg (server-only, loaded at runtime)
    let Resvg: unknown;
    try {
      const mod = await import(/* @vite-ignore */ RESVG_MODULE);
      Resvg = mod.Resvg;
    } catch {
      return toolFail(
        "PNG rendering requires @resvg/resvg-js. Install it with: deno add npm:@resvg/resvg-js",
      );
    }

    const ResvgClass = Resvg as new (
      svg: string,
      opts: Record<string, unknown>,
    ) => { render(): { asPng(): Uint8Array } };

    const opts: Record<string, unknown> = {};
    if (input.width !== undefined) {
      opts.fitTo = { mode: "width", value: input.width };
    } else if (input.height !== undefined) {
      opts.fitTo = { mode: "height", value: input.height };
    }

    const resvg = new ResvgClass(input.svg, opts);
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    const base64 = btoa(
      Array.from(pngBuffer)
        .map((b) => String.fromCharCode(b))
        .join(""),
    );

    return toolOk({
      data: base64,
      mimeType: "image/png",
      sizeBytes: pngBuffer.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolFail(`Rendering failed: ${message}`);
  }
}
