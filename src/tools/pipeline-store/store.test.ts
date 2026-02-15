/// <reference lib="deno.ns" />
import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { assertEquals, assertNotEquals } from "@std/assert";
import { pipelineStore } from "./store.ts";

let testDir: string;

beforeEach(async () => {
  testDir = await Deno.makeTempDir({ prefix: "tools-pipeline-test-" });
  Deno.env.set("TOOLS_PIPELINES_DIR", testDir);
});

afterEach(async () => {
  Deno.env.delete("TOOLS_PIPELINES_DIR");
  await Deno.remove(testDir, { recursive: true }).catch(() => {});
});

describe("pipelineStore.list", () => {
  it("returns empty array when no pipelines exist", async () => {
    const result = await pipelineStore.list();
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value, []);
    }
  });

  it("returns saved pipelines sorted by updatedAt descending", async () => {
    await pipelineStore.save({
      id: "older",
      name: "Older",
      description: "",
      steps: [{ toolId: "convert-to-image" }],
    });

    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));

    await pipelineStore.save({
      id: "newer",
      name: "Newer",
      description: "",
      steps: [{ toolId: "convert-to-image" }],
    });

    const result = await pipelineStore.list();
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.length, 2);
      assertEquals(result.value[0].id, "newer");
      assertEquals(result.value[1].id, "older");
    }
  });
});

describe("pipelineStore.save", () => {
  it("creates a new pipeline with timestamps", async () => {
    const result = await pipelineStore.save({
      id: "test-save",
      name: "Test Save",
      description: "A test",
      steps: [{ toolId: "convert-to-image", input: { svg: "<svg/>" } }],
    });

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.id, "test-save");
      assertEquals(result.value.name, "Test Save");
      assertEquals(result.value.createdAt, result.value.updatedAt);
    }
  });

  it("preserves createdAt on update", async () => {
    const first = await pipelineStore.save({
      id: "test-update",
      name: "First",
      description: "",
      steps: [{ toolId: "convert-to-image" }],
    });

    await new Promise((r) => setTimeout(r, 10));

    const second = await pipelineStore.save({
      id: "test-update",
      name: "Updated",
      description: "",
      steps: [{ toolId: "convert-to-image" }],
    });

    assertEquals(first.ok, true);
    assertEquals(second.ok, true);
    if (first.ok && second.ok) {
      assertEquals(second.value.createdAt, first.value.createdAt);
      assertNotEquals(second.value.updatedAt, first.value.updatedAt);
      assertEquals(second.value.name, "Updated");
    }
  });
});

describe("pipelineStore.get", () => {
  it("retrieves a saved pipeline", async () => {
    await pipelineStore.save({
      id: "test-get",
      name: "Get Test",
      description: "desc",
      steps: [{ toolId: "convert-to-image", input: { svg: "<svg/>" } }],
    });

    const result = await pipelineStore.get("test-get");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.id, "test-get");
      assertEquals(result.value.name, "Get Test");
      assertEquals(result.value.steps.length, 1);
    }
  });

  it("returns error for non-existent pipeline", async () => {
    const result = await pipelineStore.get("does-not-exist");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.includes("not found"), true);
    }
  });
});

describe("pipelineStore.remove", () => {
  it("deletes a saved pipeline", async () => {
    await pipelineStore.save({
      id: "test-delete",
      name: "Delete Me",
      description: "",
      steps: [{ toolId: "convert-to-image" }],
    });

    const deleteResult = await pipelineStore.remove("test-delete");
    assertEquals(deleteResult.ok, true);

    const getResult = await pipelineStore.get("test-delete");
    assertEquals(getResult.ok, false);
  });

  it("returns error when deleting non-existent pipeline", async () => {
    const result = await pipelineStore.remove("ghost");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.includes("not found"), true);
    }
  });
});
