import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getToolMeta, executeTool } from "@/server/functions.ts";
import { ToolForm } from "@/components/tool-form.tsx";
import { ToolOutput } from "@/components/tool-output.tsx";
import { Badge } from "@/components/ui/badge.tsx";

export const Route = createFileRoute("/tools/$toolId")({
  loader: ({ params }) => getToolMeta({ data: { toolId: params.toolId } }),
  component: ToolPage,
});

function ToolPage() {
  const toolMeta = Route.useLoaderData();
  const [output, setOutput] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (input: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const result = await executeTool({
        data: { toolId: toolMeta.id, input },
      });
      setOutput(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="mb-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground no-underline">
          &larr; All Tools
        </Link>
        <div className="flex items-center gap-3 mt-4">
          <h1 className="text-3xl font-bold">{toolMeta.name}</h1>
          <Badge variant="secondary">{toolMeta.category}</Badge>
        </div>
        <p className="text-muted-foreground mt-2">{toolMeta.description}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">Input</h2>
          <ToolForm
            jsonSchema={toolMeta.inputSchema}
            onSubmit={handleSubmit}
            loading={loading}
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-4">Output</h2>
          <ToolOutput data={output} error={error} />
        </div>
      </div>
    </div>
  );
}
