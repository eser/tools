import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { toolOk, toolFail } from "./types.ts";
import type { ToolResult } from "./types.ts";

describe("toolOk", () => {
  it("wraps a string value", () => {
    const result = toolOk("hello");
    assertEquals(result.ok, true);
    assertEquals(result.ok && result.value, "hello");
  });

  it("wraps a number value", () => {
    const result = toolOk(42);
    assertEquals(result.ok, true);
    assertEquals(result.ok && result.value, 42);
  });

  it("wraps an object value", () => {
    const result = toolOk({ a: 1 });
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value, { a: 1 });
    }
  });

  it("wraps null", () => {
    const result = toolOk(null);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value, null);
    }
  });

  it("wraps an array", () => {
    const result = toolOk([1, 2]);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value, [1, 2]);
    }
  });
});

describe("toolFail", () => {
  it("returns an error result with the given message", () => {
    const result: ToolResult<string> = toolFail("something went wrong");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error, "something went wrong");
    }
  });

  it("ok is false on failure", () => {
    const result = toolFail("err");
    assertEquals(result.ok, false);
  });
});
