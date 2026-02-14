import { env } from "@/config.ts";
import { createFileRoute } from "@tanstack/react-router";
import { executePipeline } from "@/tools/pipeline.ts";
import type { PipelineDefinition, ToolContext } from "@/tools/types.ts";

export const Route = createFileRoute("/api/pipelines/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const definition = body as PipelineDefinition;

        if (definition.steps === undefined || !Array.isArray(definition.steps)) {
          return Response.json({ error: "Body must have a 'steps' array" }, { status: 400 });
        }

        const context: ToolContext = { env };

        const result = await executePipeline(definition, context);

        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 500 });
        }

        return Response.json(result.value);
      },
    },
  },
});
