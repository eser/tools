import { createFileRoute } from "@tanstack/react-router";
import { pipelineStore, SavePipelineInputSchema } from "@/tools/pipeline-store/mod.ts";

export const Route = createFileRoute("/api/pipelines/")({
  server: {
    handlers: {
      GET: async () => {
        const result = await pipelineStore.list();
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 500 });
        }
        return Response.json(result.value);
      },
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = SavePipelineInputSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Validation failed", details: parsed.error.message },
            { status: 400 },
          );
        }

        const result = await pipelineStore.save(parsed.data);
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 500 });
        }
        return Response.json(result.value, { status: 201 });
      },
    },
  },
});
