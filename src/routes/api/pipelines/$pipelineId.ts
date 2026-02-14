import { createFileRoute } from "@tanstack/react-router";
import { pipelineStore } from "@/tools/pipeline-store/mod.ts";

export const Route = createFileRoute("/api/pipelines/$pipelineId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const result = await pipelineStore.get(params.pipelineId);
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 404 });
        }
        return Response.json(result.value);
      },
      DELETE: async ({ params }) => {
        const result = await pipelineStore.remove(params.pipelineId);
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 404 });
        }
        return Response.json(result.value);
      },
    },
  },
});
