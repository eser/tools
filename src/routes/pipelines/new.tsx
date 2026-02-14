import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { listTools, runPipeline, savePipeline } from "@/server/functions.ts";
import { PipelineBuilder } from "@/components/pipeline-builder.tsx";
import { ToolOutput } from "@/components/tool-output.tsx";

export const Route = createFileRoute("/pipelines/new")({
  loader: () => listTools(),
  component: NewPipelinePage,
});

function NewPipelinePage() {
  const tools = Route.useLoaderData();
  const navigate = useNavigate();
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

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">New Pipeline</h1>
        <p className="text-muted-foreground">
          Chain tools together — each step's output can feed into the next step's input.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">Steps</h2>
          <PipelineBuilder
            tools={tools}
            onRun={handleRun}
            onSave={handleSave}
            loading={loading}
            saving={saving}
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
