import { getAppCacheDir } from "@eser/cache/xdg";
import type { ToolContext, ToolResult } from "../types.ts";
import { toolFail, toolOk } from "../types.ts";
import type { SaveFileInput, SaveFileOutput } from "./schema.ts";

const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_MIME_EXACT = [
  "image/svg+xml",
  "application/json",
  "application/xml",
  "application/xhtml+xml",
  "application/javascript",
];

function isTextMime(mimeType: string): boolean {
  if (TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) return true;
  if (TEXT_MIME_EXACT.includes(mimeType)) return true;
  return false;
}

function getOutputBaseDir(): string {
  const envDir = typeof Deno !== "undefined"
    ? Deno.env.get("TOOLS_OUTPUT_DIR")
    : undefined;
  if (envDir !== undefined) return envDir;
  return `${getAppCacheDir({ name: "tools", org: "eser" })}/output`;
}

function resolveFolder(folder: string): string {
  // Absolute path: use directly
  if (folder.startsWith("/")) return folder;
  // Relative path: join with base output directory
  const base = getOutputBaseDir();
  return `${base}/${folder}`;
}

export async function execute(
  input: SaveFileInput,
  _context: ToolContext,
): Promise<ToolResult<SaveFileOutput>> {
  try {
    const dir = resolveFolder(input.folder);
    await Deno.mkdir(dir, { recursive: true });

    const filename = input.id !== undefined
      ? input.filename.replaceAll("{id}", input.id)
      : input.filename;
    const fullPath = `${dir}/${filename}`;

    if (isTextMime(input.mimeType)) {
      await Deno.writeTextFile(fullPath, input.data);
      const sizeBytes = new TextEncoder().encode(input.data).length;
      return toolOk({ path: fullPath, sizeBytes });
    }

    // Binary: decode base64 and write
    const byteString = atob(input.data);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      bytes[i] = byteString.charCodeAt(i);
    }

    await Deno.writeFile(fullPath, bytes);
    return toolOk({ path: fullPath, sizeBytes: bytes.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolFail(`Failed to save file: ${message}`);
  }
}
