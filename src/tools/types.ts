import type { z } from "zod";

/**
 * Defines a tool that can be executed through any interface (REST, CLI, Web UI).
 * All tools implement this interface for uniform discovery and execution.
 */
export interface ToolDefinition<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> {
  id: string;
  name: string;
  description: string;
  category: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  execute: (
    input: z.infer<TInput>,
    context: ToolContext,
  ) => Promise<ToolResult<z.infer<TOutput>>>;
}

export interface ToolContext {
  signal?: AbortSignal;
  env: Record<string, string | undefined>;
  onProgress?: (progress: ToolProgress) => void;
}

export interface ToolProgress {
  percent?: number;
  message: string;
}

export type ToolResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function toolOk<T>(value: T): ToolResult<T> {
  return { ok: true, value };
}

export function toolFail<T>(error: string): ToolResult<T> {
  return { ok: false, error };
}

/**
 * Serializable pipeline definition — can be sent via REST, CLI, or built in the UI.
 */
export interface PipelineDefinition {
  steps: PipelineStep[];
}

export interface PipelineStep {
  toolId: string;
  /** Direct input values */
  input?: Record<string, unknown>;
  /** Map fields from previous step outputs */
  inputMapping?: Record<string, InputMapping>;
  /** When true, execution is skipped and input is passed through as output */
  bypass?: boolean;
}

export interface InputMapping {
  /** Index of the step to read output from */
  fromStep: number;
  /** Dot-separated field path into the step's output (omit for entire output) */
  field?: string;
}

export interface PipelineStepResult {
  toolId: string;
  output: unknown;
  durationMs: number;
}

export interface PipelineResult {
  steps: PipelineStepResult[];
  totalDurationMs: number;
}
