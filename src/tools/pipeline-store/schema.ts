import { z } from "zod";

const RESERVED_SLUGS = ["new", "run"];

export const PipelineStepSchema = z.object({
  toolId: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
  inputMapping: z
    .record(
      z.string(),
      z.object({
        fromStep: z.number().int(),
        field: z.string().optional(),
      }),
    )
    .optional(),
  bypass: z.boolean().optional(),
});

export const PipelineDefinitionSchema = z.object({
  steps: z.array(PipelineStepSchema),
});

export const PipelineSlugSchema = z
  .string()
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Must be lowercase alphanumeric with hyphens")
  .min(1)
  .max(64)
  .refine((v) => !RESERVED_SLUGS.includes(v), "This ID is reserved");

export const NodeLayoutSchema = z.object({
  id: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const GraphLayoutSchema = z.object({
  nodes: z.array(NodeLayoutSchema),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
});

export const SavedPipelineSchema = z.object({
  id: PipelineSlugSchema,
  name: z.string().min(1).max(128),
  description: z.string().max(1024).default(""),
  steps: z.array(PipelineStepSchema).min(1),
  layout: GraphLayoutSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SavePipelineInputSchema = z.object({
  id: PipelineSlugSchema,
  name: z.string().min(1).max(128),
  description: z.string().max(1024).default(""),
  steps: z.array(PipelineStepSchema).min(1),
  layout: GraphLayoutSchema.optional(),
});

export type PipelineStep = z.infer<typeof PipelineStepSchema>;
export type SavedPipeline = z.infer<typeof SavedPipelineSchema>;
export type SavePipelineInput = z.infer<typeof SavePipelineInputSchema>;
export type SavedPipelineSummary = Omit<SavedPipeline, "steps">;
export type NodeLayout = z.infer<typeof NodeLayoutSchema>;
export type GraphLayout = z.infer<typeof GraphLayoutSchema>;
