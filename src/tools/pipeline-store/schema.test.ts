import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import {
  PipelineSlugSchema,
  PipelineStepSchema,
  SavePipelineInputSchema,
  SavedPipelineSchema,
} from "./schema.ts";

describe("PipelineSlugSchema", () => {
  const validSlugs = [
    { name: "simple lowercase", input: "my-pipeline" },
    { name: "single character", input: "a" },
    { name: "numbers only", input: "123" },
    { name: "mixed alphanumeric", input: "my-pipeline-2" },
    { name: "max realistic length", input: "a".repeat(64) },
  ];

  for (const { name, input } of validSlugs) {
    it(`accepts valid slug: ${name}`, () => {
      const result = PipelineSlugSchema.safeParse(input);
      assertEquals(result.success, true);
    });
  }

  const invalidSlugs = [
    { name: "uppercase letters", input: "MyPipeline" },
    { name: "starts with hyphen", input: "-pipeline" },
    { name: "ends with hyphen", input: "pipeline-" },
    { name: "contains spaces", input: "my pipeline" },
    { name: "empty string", input: "" },
    { name: "exceeds max length", input: "a".repeat(65) },
  ];

  for (const { name, input } of invalidSlugs) {
    it(`rejects invalid slug: ${name}`, () => {
      const result = PipelineSlugSchema.safeParse(input);
      assertEquals(result.success, false);
    });
  }

  const reservedSlugs = [
    { name: "reserved word 'new'", input: "new" },
    { name: "reserved word 'run'", input: "run" },
  ];

  for (const { name, input } of reservedSlugs) {
    it(`rejects ${name}`, () => {
      const result = PipelineSlugSchema.safeParse(input);
      assertEquals(result.success, false);
    });
  }
});

describe("PipelineStepSchema", () => {
  it("accepts a minimal step with toolId only", () => {
    const result = PipelineStepSchema.safeParse({ toolId: "vector-renderer" });
    assertEquals(result.success, true);
  });

  it("accepts a step with input", () => {
    const result = PipelineStepSchema.safeParse({
      toolId: "vector-renderer",
      input: { svg: "<svg/>", format: "svg" },
    });
    assertEquals(result.success, true);
  });

  it("accepts a step with inputMapping", () => {
    const result = PipelineStepSchema.safeParse({
      toolId: "vector-renderer",
      inputMapping: { svg: { fromStep: 0, field: "data" } },
    });
    assertEquals(result.success, true);
  });

  it("rejects a step without toolId", () => {
    const result = PipelineStepSchema.safeParse({});
    assertEquals(result.success, false);
  });
});

describe("SavePipelineInputSchema", () => {
  it("accepts valid input", () => {
    const result = SavePipelineInputSchema.safeParse({
      id: "test-pipeline",
      name: "Test Pipeline",
      description: "A test pipeline",
      steps: [{ toolId: "vector-renderer", input: { svg: "<svg/>" } }],
    });
    assertEquals(result.success, true);
  });

  it("defaults description to empty string", () => {
    const result = SavePipelineInputSchema.parse({
      id: "test",
      name: "Test",
      steps: [{ toolId: "vector-renderer" }],
    });
    assertEquals(result.description, "");
  });

  it("rejects empty steps array", () => {
    const result = SavePipelineInputSchema.safeParse({
      id: "test",
      name: "Test",
      steps: [],
    });
    assertEquals(result.success, false);
  });

  it("rejects missing name", () => {
    const result = SavePipelineInputSchema.safeParse({
      id: "test",
      steps: [{ toolId: "x" }],
    });
    assertEquals(result.success, false);
  });
});

describe("SavedPipelineSchema", () => {
  it("accepts a full saved pipeline", () => {
    const result = SavedPipelineSchema.safeParse({
      id: "test",
      name: "Test",
      description: "",
      steps: [{ toolId: "vector-renderer" }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    assertEquals(result.success, true);
  });

  it("rejects without timestamps", () => {
    const result = SavedPipelineSchema.safeParse({
      id: "test",
      name: "Test",
      description: "",
      steps: [{ toolId: "vector-renderer" }],
    });
    assertEquals(result.success, false);
  });
});
