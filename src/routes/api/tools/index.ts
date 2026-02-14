import { createFileRoute } from "@tanstack/react-router";
import { registry } from "@/tools/registry.ts";

export const Route = createFileRoute("/api/tools/")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(registry.list());
      },
    },
  },
});
