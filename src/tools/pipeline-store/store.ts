import { getAppCacheDir } from "@eser/cache/xdg";
import { toolFail, toolOk } from "../types.ts";
import type { ToolResult } from "../types.ts";
import { SavedPipelineSchema, SavePipelineInputSchema } from "./schema.ts";
import type { SavedPipeline, SavedPipelineSummary, SavePipelineInput } from "./schema.ts";

function getPipelinesDir(): string {
  const envDir = typeof Deno !== "undefined" ? Deno.env.get("TOOLS_PIPELINES_DIR") : undefined;
  if (envDir !== undefined) {
    return envDir;
  }
  return `${getAppCacheDir({ name: "tools", org: "eser" })}/pipelines`;
}

async function ensureDir(): Promise<string> {
  const dir = getPipelinesDir();
  await Deno.mkdir(dir, { recursive: true });
  return dir;
}

function filePath(dir: string, id: string): string {
  return `${dir}/${id}.json`;
}

async function list(): Promise<ToolResult<SavedPipelineSummary[]>> {
  try {
    const dir = getPipelinesDir();
    const summaries: SavedPipelineSummary[] = [];

    try {
      for await (const entry of Deno.readDir(dir)) {
        if (!entry.isFile || !entry.name.endsWith(".json")) {
          continue;
        }
        try {
          const content = await Deno.readTextFile(`${dir}/${entry.name}`);
          const parsed = SavedPipelineSchema.parse(JSON.parse(content));
          const { steps: _, ...summary } = parsed;
          summaries.push(summary);
        } catch {
          // skip malformed files
        }
      }
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return toolOk([]);
      }
      throw err;
    }

    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return toolOk(summaries);
  } catch (err) {
    return toolFail(`Failed to list pipelines: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function get(id: string): Promise<ToolResult<SavedPipeline>> {
  try {
    const dir = getPipelinesDir();
    const path = filePath(dir, id);

    let content: string;
    try {
      content = await Deno.readTextFile(path);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return toolFail(`Pipeline not found: ${id}`);
      }
      throw err;
    }

    const parsed = SavedPipelineSchema.parse(JSON.parse(content));
    return toolOk(parsed);
  } catch (err) {
    if ((err as ToolResult<never>).ok === false) {
      return err as ToolResult<SavedPipeline>;
    }
    return toolFail(`Failed to get pipeline: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function save(input: SavePipelineInput): Promise<ToolResult<SavedPipeline>> {
  try {
    const validated = SavePipelineInputSchema.parse(input);
    const dir = await ensureDir();
    const path = filePath(dir, validated.id);
    const now = new Date().toISOString();

    let createdAt = now;
    try {
      const existing = await Deno.readTextFile(path);
      const parsed = SavedPipelineSchema.parse(JSON.parse(existing));
      createdAt = parsed.createdAt;
    } catch {
      // new pipeline
    }

    const saved: SavedPipeline = {
      ...validated,
      createdAt,
      updatedAt: now,
    };

    await Deno.writeTextFile(path, JSON.stringify(saved, null, 2));
    return toolOk(saved);
  } catch (err) {
    return toolFail(`Failed to save pipeline: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function remove(id: string): Promise<ToolResult<{ deleted: true; id: string }>> {
  try {
    const dir = getPipelinesDir();
    const path = filePath(dir, id);

    try {
      await Deno.remove(path);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return toolFail(`Pipeline not found: ${id}`);
      }
      throw err;
    }

    return toolOk({ deleted: true, id });
  } catch (err) {
    if ((err as ToolResult<never>).ok === false) {
      return err as ToolResult<{ deleted: true; id: string }>;
    }
    return toolFail(`Failed to delete pipeline: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export const pipelineStore = { list, get, save, remove };
