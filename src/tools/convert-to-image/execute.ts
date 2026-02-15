import type { ToolContext, ToolResult } from "../types.ts";
import { toolFail, toolOk } from "../types.ts";
import type { ConvertToImageInput, ConvertToImageOutput } from "./schema.ts";

// Module names as variables to prevent Vite from scanning the dynamic imports
const RESVG_MODULE = "@resvg/resvg-js";
const SHARP_MODULE = "sharp";

export async function execute(
  input: ConvertToImageInput,
  _context: ToolContext,
): Promise<ToolResult<ConvertToImageOutput>> {
  try {
    const format = input.format ?? "png";

    // Step 1: Render SVG to PNG via resvg
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

    const multiplier = parseInt((input.multiplier ?? "1x").replace("x", ""), 10);

    const opts: Record<string, unknown> = {};
    if (input.width !== undefined) {
      opts.fitTo = { mode: "width", value: input.width * multiplier };
    } else if (input.height !== undefined) {
      opts.fitTo = { mode: "height", value: input.height * multiplier };
    } else if (multiplier > 1) {
      opts.fitTo = { mode: "zoom", value: multiplier };
    }

    const resvg = new ResvgClass(input.svg, opts);
    const pngData = resvg.render();
    const pngRaw = pngData.asPng();

    // Embed pHYs chunk so the PNG displays at original SVG dimensions.
    // 72 DPI * multiplier, converted to pixels-per-metre.
    const pngBuffer = multiplier > 1
      ? setPngDpi(pngRaw, 72 * multiplier)
      : pngRaw;

    // Step 2: If format is PNG, we're done
    if (format === "png") {
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
    }

    // Step 3: Convert PNG to JPEG via sharp
    let sharp: unknown;
    try {
      const mod = await import(/* @vite-ignore */ SHARP_MODULE);
      sharp = mod.default ?? mod;
    } catch {
      return toolFail(
        "JPEG conversion requires sharp. Install it with: deno add npm:sharp",
      );
    }

    const sharpFn = sharp as (input: Uint8Array) => {
      jpeg(opts: { quality: number }): { toBuffer(): Promise<Buffer> };
    };

    const jpegBuffer = await sharpFn(pngBuffer)
      .jpeg({ quality: input.quality })
      .toBuffer();

    const base64 = btoa(
      Array.from(new Uint8Array(jpegBuffer))
        .map((b) => String.fromCharCode(b))
        .join(""),
    );

    return toolOk({
      data: base64,
      mimeType: "image/jpeg",
      sizeBytes: jpegBuffer.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolFail(`Image conversion failed: ${message}`);
  }
}

/**
 * Insert or replace a pHYs chunk in a PNG so that viewers display
 * the image at the intended logical size (DPI-aware).
 */
function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254); // pixels per metre

  // Build the 9-byte pHYs data: 4 bytes X ppm, 4 bytes Y ppm, 1 byte unit (1 = metre)
  const phys = new Uint8Array(9);
  const view = new DataView(phys.buffer);
  view.setUint32(0, ppm);
  view.setUint32(4, ppm);
  phys[8] = 1;

  // CRC covers chunk type + data
  const typeBytes = new Uint8Array([0x70, 0x48, 0x59, 0x73]); // "pHYs"
  const crcInput = new Uint8Array(4 + 9);
  crcInput.set(typeBytes, 0);
  crcInput.set(phys, 4);
  const crc = crc32(crcInput);

  // Full chunk: length(4) + type(4) + data(9) + crc(4) = 21 bytes
  const chunk = new Uint8Array(21);
  const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, 9); // data length
  chunk.set(typeBytes, 4);
  chunk.set(phys, 8);
  chunkView.setUint32(17, crc);

  // Insert pHYs right after the IHDR chunk (PNG signature 8 bytes + IHDR chunk 25 bytes = offset 33)
  const insertAt = 33;
  const out = new Uint8Array(png.length + 21);
  out.set(png.subarray(0, insertAt), 0);
  out.set(chunk, insertAt);
  out.set(png.subarray(insertAt), insertAt + 21);
  return out;
}

/** CRC-32 for PNG chunk integrity. */
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
