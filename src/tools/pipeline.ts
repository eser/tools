import type {
  InputMapping,
  PipelineDefinition,
  PipelineResult,
  ToolContext,
  ToolResult,
} from "./types.ts";
import { registry } from "./registry.ts";

function getNestedField(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function resolveInputMappings(
  mappings: Record<string, InputMapping>,
  stepOutputs: unknown[],
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, mapping] of Object.entries(mappings)) {
    const stepOutput = stepOutputs[mapping.fromStep];
    if (stepOutput === undefined) {
      throw new Error(
        `Input mapping references step ${mapping.fromStep} which has no output`,
      );
    }
    resolved[key] = mapping.field !== undefined
      ? getNestedField(stepOutput, mapping.field)
      : stepOutput;
  }

  return resolved;
}

export async function executePipeline(
  definition: PipelineDefinition,
  context: ToolContext,
): Promise<ToolResult<PipelineResult>> {
  const stepOutputs: unknown[] = [];
  const stepResults: PipelineResult["steps"] = [];
  const totalStart = Date.now();

  for (let i = 0; i < definition.steps.length; i++) {
    const step = definition.steps[i];
    const tool = registry.get(step.toolId);

    if (tool === undefined) {
      return {
        ok: false,
        error: `Step ${i}: tool "${step.toolId}" not found`,
      };
    }

    // Build input: start with explicit input, overlay mapped values
    let input: Record<string, unknown> = { ...step.input };

    if (step.inputMapping !== undefined) {
      const mapped = resolveInputMappings(step.inputMapping, stepOutputs);
      input = { ...input, ...mapped };
    }

    context.onProgress?.({
      message: `Step ${i + 1}/${definition.steps.length}: ${tool.name}`,
      percent: Math.round((i / definition.steps.length) * 100),
    });

    const stepStart = Date.now();
    const validated = tool.inputSchema.safeParse(input);

    if (!validated.success) {
      return {
        ok: false,
        error: `Step ${i} (${step.toolId}): invalid input — ${validated.error.message}`,
      };
    }

    const result = await tool.execute(validated.data, context);

    if (!result.ok) {
      return {
        ok: false,
        error: `Step ${i} (${step.toolId}): ${result.error}`,
      };
    }

    const durationMs = Date.now() - stepStart;
    stepOutputs.push(result.value);
    stepResults.push({
      toolId: step.toolId,
      output: result.value,
      durationMs,
    });
  }

  context.onProgress?.({ message: "Pipeline complete", percent: 100 });

  return {
    ok: true,
    value: {
      steps: stepResults,
      totalDurationMs: Date.now() - totalStart,
    },
  };
}
