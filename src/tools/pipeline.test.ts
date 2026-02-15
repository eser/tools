import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { executePipeline } from "./pipeline.ts";
import type { PipelineDefinition, ToolContext } from "./types.ts";

const ctx: ToolContext = { env: {} };
const SIMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>`;

describe("executePipeline", () => {
  it("executes a single-step pipeline with convert-to-image", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "convert-to-image",
          input: { svg: SIMPLE_SVG, format: "png" },
        },
      ],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.steps.length, 1);
      assertEquals(result.value.steps[0].toolId, "convert-to-image");
      const output = result.value.steps[0].output as { data: string; mimeType: string; sizeBytes: number };
      assertEquals(output.mimeType, "image/png");
      assertEquals(typeof output.data, "string");
      assertEquals(output.data.length > 0, true);
      assertEquals(output.sizeBytes > 0, true);
    }
  });

  it("returns error for unknown tool id", async () => {
    const definition: PipelineDefinition = {
      steps: [{ toolId: "nonexistent-tool", input: {} }],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.includes("not found"), true);
    }
  });

  it("returns error for invalid input", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "convert-to-image",
          input: { format: "png" }, // missing required 'svg' field
        },
      ],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.includes("invalid input"), true);
    }
  });

  it("reports progress during execution", async () => {
    const progressMessages: string[] = [];
    const progressCtx: ToolContext = {
      env: {},
      onProgress: (p) => progressMessages.push(p.message),
    };

    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "convert-to-image",
          input: { svg: SIMPLE_SVG, format: "png" },
        },
      ],
    };

    await executePipeline(definition, progressCtx);
    assertEquals(progressMessages.length >= 2, true);
    assertEquals(progressMessages[progressMessages.length - 1], "Pipeline complete");
  });

  it("chains two steps using variable-set and expressions", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "variable-set",
          input: { name: "my-svg", value: SIMPLE_SVG },
        },
        {
          toolId: "convert-to-image",
          input: { svg: "${{ variables.my-svg }}", format: "png" },
        },
      ],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.steps.length, 2);
      const output = result.value.steps[1].output as { data: string; mimeType: string };
      assertEquals(output.mimeType, "image/png");
      assertEquals(output.data.length > 0, true);
    }
  });

  it("resolves ${{ }} expressions in step input", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "convert-to-image",
          input: { svg: SIMPLE_SVG, format: "png" },
        },
        {
          toolId: "variable-set",
          input: { name: "img-type", value: "${{ steps.0.output.mimeType }}" },
        },
      ],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.steps.length, 2);
      const varOutput = result.value.steps[1].output as { name: string; value: unknown };
      assertEquals(varOutput.name, "img-type");
      assertEquals(varOutput.value, "image/png");
    }
  });

  it("supports variable-set tool and variable expressions", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "convert-to-image",
          input: { svg: SIMPLE_SVG, format: "png" },
        },
        {
          toolId: "variable-set",
          input: { name: "my-format", value: "${{ steps.0.output.mimeType }}" },
        },
        {
          toolId: "variable-set",
          input: { name: "my-size", value: "${{ steps.0.output.sizeBytes }}" },
        },
      ],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.steps.length, 3);
      const varOutput1 = result.value.steps[1].output as { name: string; value: unknown };
      assertEquals(varOutput1.name, "my-format");
      assertEquals(varOutput1.value, "image/png");
      const varOutput2 = result.value.steps[2].output as { name: string; value: unknown };
      assertEquals(varOutput2.name, "my-size");
      assertEquals(typeof varOutput2.value, "number");
    }
  });

  it("uses variables set by variable-set in later steps", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "variable-set",
          input: { name: "my-svg", value: SIMPLE_SVG },
        },
        {
          toolId: "convert-to-image",
          input: { svg: "${{ variables.my-svg }}", format: "png" },
        },
      ],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, true);
    if (result.ok) {
      const step2Output = result.value.steps[1].output as { data: string; mimeType: string };
      assertEquals(step2Output.mimeType, "image/png");
      assertEquals(step2Output.data.length > 0, true);
    }
  });

  it("records duration for each step", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "convert-to-image",
          input: { svg: SIMPLE_SVG, format: "png" },
        },
      ],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(typeof result.value.steps[0].durationMs, "number");
      assertEquals(result.value.steps[0].durationMs >= 0, true);
      assertEquals(typeof result.value.totalDurationMs, "number");
    }
  });
});
