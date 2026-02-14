import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { listToolsWithSchemas, runPipeline, savePipeline, getSavedPipeline, deleteSavedPipeline } from "@/server/functions.ts";
import { PipelineBuilder } from "@/components/pipeline-builder.tsx";
import type { PipelineBuilderHandle } from "@/components/pipeline-builder.tsx";
import { ToolOutput } from "@/components/tool-output.tsx";
import { Button } from "@/components/ui/button.tsx";

export const Route = createFileRoute("/pipelines/$pipelineId")({
  loader: async ({ params }) => {
    const [tools, pipeline] = await Promise.all([
      listToolsWithSchemas(),
      getSavedPipeline({ data: { id: params.pipelineId } }),
    ]);
    return { tools, pipeline };
  },
  component: EditPipelinePage,
});

function EditPipelinePage() {
  const { tools, pipeline } = Route.useLoaderData();
  const navigate = useNavigate();
  const builderRef = useRef<PipelineBuilderHandle>(null);
  const [results, setResults] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (definition: unknown) => {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const result = await runPipeline({
        data: definition as { steps: Array<{ toolId: string; input?: Record<string, unknown>; inputMapping?: Record<string, { fromStep: number; field?: string }> }> },
      });
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: { id: string; name: string; description: string; steps: unknown[] }) => {
    setSaving(true);
    try {
      await savePipeline({
        data: {
          id: data.id,
          name: data.name,
          description: data.description,
          steps: data.steps as Array<{ toolId: string; input?: Record<string, unknown>; inputMapping?: Record<string, { fromStep: number; field?: string }> }>,
        },
      });
      navigate({ to: "/pipelines/$pipelineId", params: { pipelineId: data.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pipeline");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSavedPipeline({ data: { id } });
      navigate({ to: "/pipelines" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete pipeline");
    }
  };

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{pipeline.name}</h1>
          {pipeline.description && (
            <p className="text-muted-foreground">{pipeline.description}</p>
          )}
        </div>
        <div className="flex gap-3 shrink-0">
          <Button variant="destructive" onClick={() => handleDelete(pipeline.id)}>
            Delete
          </Button>
          <Button variant="secondary" onClick={() => builderRef.current?.save()} disabled={saving}>
            {saving ? "Saving..." : "Save Pipeline"}
          </Button>
          <Button onClick={() => builderRef.current?.run()} disabled={loading}>
            {loading ? "Running..." : "Run Pipeline"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">Steps</h2>
          <PipelineBuilder
            ref={builderRef}
            tools={tools}
            onRun={handleRun}
            onSave={handleSave}
            onDelete={handleDelete}
            loading={loading}
            saving={saving}
            initialPipeline={pipeline}
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-4">Results</h2>
          {results !== null && error === null ? (
            <PipelineResults data={results} />
          ) : (
            <ToolOutput data={null} error={error} />
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineResults(props: { data: unknown }) {
  const result = props.data as {
    steps: Array<{ toolId: string; output: unknown; durationMs: number }>;
    totalDurationMs: number;
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Total: {result.totalDurationMs}ms across {result.steps.length} steps
      </div>
      {result.steps.map((step, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Step {i + 1}: {step.toolId}
            </span>
            <span className="text-xs text-muted-foreground">{step.durationMs}ms</span>
          </div>
          <ToolOutput data={step.output} error={null} />
        </div>
      ))}
    </div>
  );
}
