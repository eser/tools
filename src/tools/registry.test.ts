import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { registry } from "./registry.ts";

describe("ToolRegistry", () => {
  it("lists all registered tools", () => {
    const tools = registry.list();
    assertEquals(tools.length >= 4, true);
    const ids = tools.map((t) => t.id);
    assertEquals(ids.includes("social-media-post-retriever"), true);
    assertEquals(ids.includes("social-media-post-anonymizer"), true);
    assertEquals(ids.includes("social-media-post-visualizer"), true);
    assertEquals(ids.includes("convert-to-image"), true);
  });

  it("gets a tool by id", () => {
    const tool = registry.get("convert-to-image");
    assertEquals(tool !== undefined, true);
    assertEquals(tool!.id, "convert-to-image");
    assertEquals(tool!.name.length > 0, true);
  });

  it("returns undefined for unknown tool id", () => {
    const tool = registry.get("nonexistent-tool");
    assertEquals(tool, undefined);
  });

  it("returns all tools via getAll", () => {
    const tools = registry.getAll();
    assertEquals(tools.length >= 3, true);
    for (const tool of tools) {
      assertEquals(typeof tool.id, "string");
      assertEquals(typeof tool.name, "string");
      assertEquals(typeof tool.execute, "function");
    }
  });

  it("list returns summary objects without execute function", () => {
    const tools = registry.list();
    for (const tool of tools) {
      assertEquals(typeof tool.id, "string");
      assertEquals(typeof tool.name, "string");
      assertEquals(typeof tool.description, "string");
      assertEquals(typeof tool.category, "string");
      assertEquals("execute" in tool, false);
    }
  });
});
