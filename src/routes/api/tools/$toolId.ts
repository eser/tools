import { env } from "@/config.ts";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { registry } from "@/tools/registry.ts";
import type { ToolContext } from "@/tools/types.ts";

export const Route = createFileRoute("/api/tools/$toolId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const tool = registry.get(params.toolId);
        if (tool === undefined) {
          return Response.json({ error: "Tool not found" }, { status: 404 });
        }
        return Response.json({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          category: tool.category,
          inputSchema: z.toJSONSchema(tool.inputSchema),
          outputSchema: z.toJSONSchema(tool.outputSchema),
        });
      },
      POST: async ({ request, params }) => {
        const tool = registry.get(params.toolId);
        if (tool === undefined) {
          return Response.json({ error: "Tool not found" }, { status: 404 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid JSON body" },
            { status: 400 },
          );
        }

        const parsed = tool.inputSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Validation failed", details: parsed.error.message },
            { status: 400 },
          );
        }

        const context: ToolContext = { env };

        const result = await tool.execute(parsed.data, context);

        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 500 });
        }

        return Response.json(result.value);
      },
    },
  },
});
