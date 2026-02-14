import { env } from "@/config.ts";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { registry } from "@/tools/registry.ts";
import { executePipeline } from "@/tools/pipeline.ts";
import type { PipelineDefinition, ToolContext } from "@/tools/types.ts";
import { pipelineStore, PipelineStepSchema, PipelineSlugSchema, SavePipelineInputSchema } from "@/tools/pipeline-store/mod.ts";

export const listTools = createServerFn({ method: "GET" }).handler(
  async () => {
    return registry.list();
  },
);

export const getToolMeta = createServerFn({ method: "GET" })
  .inputValidator(z.object({ toolId: z.string() }))
  .handler(async ({ data }) => {
    const tool = registry.get(data.toolId);
    if (tool === undefined) {
      throw new Error(`Tool not found: ${data.toolId}`);
    }
    return {
      id: tool.id,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      inputSchema: z.toJSONSchema(tool.inputSchema),
      outputSchema: z.toJSONSchema(tool.outputSchema),
    };
  });

export const executeTool = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      toolId: z.string(),
      input: z.record(z.string(), z.unknown()),
    }),
  )
  .handler(async ({ data }) => {
    const tool = registry.get(data.toolId);
    if (tool === undefined) {
      throw new Error(`Tool not found: ${data.toolId}`);
    }

    const validated = tool.inputSchema.parse(data.input);

    const context: ToolContext = { env };

    const result = await tool.execute(validated, context);

    if (!result.ok) {
      throw new Error(result.error);
    }

    return result.value;
  });

export const runPipeline = createServerFn({ method: "POST" })
  .inputValidator(z.object({ steps: z.array(PipelineStepSchema) }))
  .handler(async ({ data }) => {
    const definition: PipelineDefinition = data;

    const context: ToolContext = { env };

    const result = await executePipeline(definition, context);

    if (!result.ok) {
      throw new Error(result.error);
    }

    return result.value;
  });

// --- Pipeline persistence ---

export const listSavedPipelines = createServerFn({ method: "GET" }).handler(async () => {
  const result = await pipelineStore.list();
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
});

export const getSavedPipeline = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: PipelineSlugSchema }))
  .handler(async ({ data }) => {
    const result = await pipelineStore.get(data.id);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.value;
  });

export const savePipeline = createServerFn({ method: "POST" })
  .inputValidator(SavePipelineInputSchema)
  .handler(async ({ data }) => {
    const result = await pipelineStore.save(data);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.value;
  });

export const deleteSavedPipeline = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: PipelineSlugSchema }))
  .handler(async ({ data }) => {
    const result = await pipelineStore.remove(data.id);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.value;
  });
