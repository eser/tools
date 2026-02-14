import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { executePipeline } from "./pipeline.ts";
import type { PipelineDefinition, ToolContext } from "./types.ts";

const ctx: ToolContext = { env: {} };

describe("executePipeline", () => {
  it("executes a single-step pipeline with vector-renderer", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "vector-renderer",
          input: { svg: "<svg/>", format: "svg" },
        },
      ],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.steps.length, 1);
      assertEquals(result.value.steps[0].toolId, "vector-renderer");
      const output = result.value.steps[0].output as { data: string; mimeType: string };
      assertEquals(output.data, "<svg/>");
      assertEquals(output.mimeType, "image/svg+xml");
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
          toolId: "vector-renderer",
          input: { format: "svg" }, // missing required 'svg' field
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
          toolId: "vector-renderer",
          input: { svg: "<svg/>", format: "svg" },
        },
      ],
    };

    await executePipeline(definition, progressCtx);
    assertEquals(progressMessages.length >= 2, true);
    assertEquals(progressMessages[progressMessages.length - 1], "Pipeline complete");
  });

  it("chains two steps with input mapping", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "vector-renderer",
          input: { svg: "<svg><circle r='10'/></svg>", format: "svg" },
        },
        {
          toolId: "vector-renderer",
          input: { format: "svg" },
          inputMapping: { svg: { fromStep: 0, field: "data" } },
        },
      ],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.steps.length, 2);
      // Second step should receive the SVG from first step's output.data
      const step2Output = result.value.steps[1].output as { data: string };
      assertEquals(step2Output.data, "<svg><circle r='10'/></svg>");
    }
  });

  it("resolves ${{ }} expressions in step input", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "vector-renderer",
          input: { svg: "<svg><circle r='10'/></svg>", format: "svg" },
        },
        {
          toolId: "vector-renderer",
          input: { svg: "${{ steps.0.output.data }}", format: "svg" },
        },
      ],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.steps.length, 2);
      const step2Output = result.value.steps[1].output as { data: string };
      assertEquals(step2Output.data, "<svg><circle r='10'/></svg>");
    }
  });

  it("supports variable-set tool and variable expressions", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "vector-renderer",
          input: { svg: "<svg/>", format: "svg" },
        },
        {
          toolId: "variable-set",
          input: { name: "my-format", value: "${{ steps.0.output.mimeType }}" },
        },
        {
          toolId: "variable-set",
          input: { name: "my-svg", value: "${{ steps.0.output.data }}" },
        },
      ],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.steps.length, 3);
      const varOutput1 = result.value.steps[1].output as { name: string; value: unknown };
      assertEquals(varOutput1.name, "my-format");
      assertEquals(varOutput1.value, "image/svg+xml");
      const varOutput2 = result.value.steps[2].output as { name: string; value: unknown };
      assertEquals(varOutput2.name, "my-svg");
      assertEquals(varOutput2.value, "<svg/>");
    }
  });

  it("uses variables set by variable-set in later steps", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "variable-set",
          input: { name: "my-svg", value: "<svg><rect/></svg>" },
        },
        {
          toolId: "vector-renderer",
          input: { svg: "${{ variables.my-svg }}", format: "svg" },
        },
      ],
    };

    const result = await executePipeline(definition, ctx);
    assertEquals(result.ok, true);
    if (result.ok) {
      const step2Output = result.value.steps[1].output as { data: string };
      assertEquals(step2Output.data, "<svg><rect/></svg>");
    }
  });

  it("records duration for each step", async () => {
    const definition: PipelineDefinition = {
      steps: [
        {
          toolId: "vector-renderer",
          input: { svg: "<svg/>", format: "svg" },
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
