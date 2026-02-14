import type {
  InputMapping,
  PipelineDefinition,
  PipelineResult,
  ToolContext,
  ToolResult,
} from "./types.ts";
import { registry } from "./registry.ts";
import {
  getNestedField,
  resolveExpressions,
  type ExpressionContext,
} from "./pipeline-expressions.ts";

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
  const variables: Record<string, unknown> = {};
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

    // Build input: resolve expressions, then overlay legacy inputMapping
    const exprContext: ExpressionContext = { stepOutputs, variables };
    let input = resolveExpressions(step.input ?? {}, exprContext) as Record<string, unknown>;

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

    // Accumulate variables from variable-set steps
    if (step.toolId === "variable-set") {
      const output = result.value as { name: string; value: unknown };
      variables[output.name] = output.value;
    }
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
