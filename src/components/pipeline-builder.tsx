import { useState, useEffect, useImperativeHandle, type Ref } from "react";
import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select.tsx";
import { SchemaForm } from "@/components/schema-form.tsx";
import { CopyButton } from "@/components/copy-button.tsx";
import type { JsonSchema, JsonSchemaProperty } from "@/lib/json-schema.ts";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

interface PipelineStepState {
  toolId: string;
  inputJson: string;
}

interface InitialPipeline {
  id: string;
  name: string;
  description: string;
  steps: Array<{
    toolId: string;
    input?: Record<string, unknown>;
    inputMapping?: Record<string, { fromStep: number; field?: string }>;
  }>;
}

export interface PipelineBuilderHandle {
  run: () => void;
  save: () => void;
}

interface PipelineBuilderProps {
  tools: ToolInfo[];
  onRun: (definition: unknown) => void;
  onSave?: (data: { id: string; name: string; description: string; steps: unknown[] }) => void;
  onDelete?: (id: string) => void;
  loading: boolean;
  saving?: boolean;
  initialPipeline?: InitialPipeline | null;
  ref?: Ref<PipelineBuilderHandle>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function stepsToDefinition(steps: PipelineStepState[]) {
  return steps.map((step) => {
    const result: Record<string, unknown> = { toolId: step.toolId };
    try {
      const input = JSON.parse(step.inputJson);
      if (Object.keys(input).length > 0) result.input = input;
    } catch { /* skip */ }
    return result;
  });
}

/** Convert legacy inputMapping to expression values in input */
function migrateInputMapping(
  input: Record<string, unknown> | undefined,
  inputMapping: Record<string, { fromStep: number; field?: string }> | undefined,
): string {
  const merged: Record<string, unknown> = { ...input };
  if (inputMapping !== undefined) {
    for (const [key, mapping] of Object.entries(inputMapping)) {
      const fieldPath = mapping.field !== undefined ? `.${mapping.field}` : "";
      merged[key] = `\${{ steps.${mapping.fromStep}.output${fieldPath} }}`;
    }
  }
  return JSON.stringify(merged, null, 2);
}

function StepOutputSchema(props: { schema: unknown; stepIndex: number }) {
  const [expanded, setExpanded] = useState(false);
  const jsonSchema = props.schema as JsonSchema | null;

  if (jsonSchema === null || jsonSchema === undefined || jsonSchema.properties === undefined) {
    return null;
  }

  const properties = jsonSchema.properties;

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDownIcon className="size-3" />
          : <ChevronRightIcon className="size-3" />}
        Output Fields
      </button>
      {expanded && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
          {Object.entries(properties).map(([key, prop]) => {
            const p = prop as JsonSchemaProperty;
            const expr = `\${{ steps.${props.stepIndex}.output.${key} }}`;
            return (
              <div key={key} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <code className="text-xs font-mono truncate">{key}</code>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {p.type ?? "unknown"}
                  </Badge>
                </div>
                <CopyButton text={expr} className="h-5 text-[10px] shrink-0" />
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground pt-1">
            Copy a reference and paste it into an input field in expression mode.
          </p>
        </div>
      )}
    </div>
  );
}

export function PipelineBuilder(props: PipelineBuilderProps) {
  const { tools, onRun, onSave, onDelete, loading, saving, initialPipeline, ref } = props;

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      slugManuallyEdited: false,
      steps: [] as PipelineStepState[],
    },
  });

  useEffect(() => {
    if (initialPipeline === null || initialPipeline === undefined) return;
    form.setFieldValue("name", initialPipeline.name);
    form.setFieldValue("slug", initialPipeline.id);
    form.setFieldValue("description", initialPipeline.description);
    form.setFieldValue("slugManuallyEdited", true);
    form.setFieldValue(
      "steps",
      initialPipeline.steps.map((s) => ({
        toolId: s.toolId,
        inputJson: migrateInputMapping(s.input, s.inputMapping),
      })),
    );
  }, [initialPipeline]);

  const handleRun = () => {
    const steps = form.getFieldValue("steps");
    onRun({ steps: stepsToDefinition(steps) });
  };

  const handleSave = () => {
    const slug = form.getFieldValue("slug");
    const name = form.getFieldValue("name");
    const description = form.getFieldValue("description");
    const steps = form.getFieldValue("steps");
    if (onSave === undefined || slug.length === 0 || name.length === 0) return;
    onSave({ id: slug, name, description, steps: stepsToDefinition(steps) });
  };

  useImperativeHandle(ref, () => ({
    run: handleRun,
    save: handleSave,
  }));

  return (
    <div className="space-y-4">
      {/* Metadata section */}
      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="pipeline-name">Pipeline Name</Label>
                  <Input
                    id="pipeline-name"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                      if (!form.getFieldValue("slugManuallyEdited")) {
                        form.setFieldValue("slug", slugify(e.target.value));
                      }
                    }}
                    placeholder="My Pipeline"
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="slug">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="pipeline-slug">
                    Slug (ID)
                    <Badge variant="secondary" className="ml-2 text-[10px]">auto</Badge>
                  </Label>
                  <Input
                    id="pipeline-slug"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                      form.setFieldValue("slugManuallyEdited", true);
                    }}
                    placeholder="my-pipeline"
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </form.Field>
          </div>
          <form.Field name="description">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="pipeline-desc">Description</Label>
                <Input
                  id="pipeline-desc"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <Separator />

      {/* Steps */}
      <form.Field name="steps">
        {(stepsField) => {
          const steps = stepsField.state.value;

          const addStep = () => {
            stepsField.handleChange([
              ...steps,
              { toolId: tools[0]?.id ?? "", inputJson: "{}" },
            ]);
          };

          const removeStep = (index: number) => {
            stepsField.handleChange(steps.filter((_, i) => i !== index));
          };

          const updateStep = (index: number, updates: Partial<PipelineStepState>) => {
            stepsField.handleChange(
              steps.map((step, i) => (i === index ? { ...step, ...updates } : step)),
            );
          };

          const moveStep = (index: number, direction: "up" | "down") => {
            const newIndex = direction === "up" ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= steps.length) return;
            const copy = [...steps];
            [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
            stepsField.handleChange(copy);
          };

          return (
            <>
              {steps.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No steps added yet. Add a tool step to start building your pipeline.
                  </p>
                </div>
              )}

              {steps.map((step, index) => {
                const selectedTool = tools.find((t) => t.id === step.toolId);

                return (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Step {index + 1}</CardTitle>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => moveStep(index, "up")} disabled={index === 0}>
                            ↑
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => moveStep(index, "down")} disabled={index === steps.length - 1}>
                            ↓
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => removeStep(index)} className="text-destructive">
                            ×
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Tool</Label>
                        <Select value={step.toolId} onValueChange={(val) => updateStep(index, { toolId: val, inputJson: "{}" })}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a tool">
                              {(val) => tools.find((t) => t.id === val)?.name ?? "Select a tool"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {tools.map((tool) => (
                              <SelectItem key={tool.id} value={tool.id}>
                                {tool.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Input</Label>
                        <SchemaForm
                          schema={(selectedTool?.inputSchema as JsonSchema) ?? null}
                          value={step.inputJson}
                          onChange={(json) => updateStep(index, { inputJson: json })}
                          enableExpressions={index > 0}
                        />
                      </div>

                      {selectedTool?.outputSchema !== undefined && (
                        <StepOutputSchema
                          schema={selectedTool.outputSchema}
                          stepIndex={index}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              <div className="flex gap-3">
                <Button variant="outline" onClick={addStep} className="flex-1">
                  + Add Step
                </Button>
              </div>

              {steps.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Pipeline Definition (read-only)</Label>
                      <CopyButton text={JSON.stringify({ steps: stepsToDefinition(steps) }, null, 2)} className="h-6 text-xs" />
                    </div>
                    <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-auto max-h-48">
                      {JSON.stringify({ steps: stepsToDefinition(steps) }, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </>
          );
        }}
      </form.Field>
    </div>
  );
}
