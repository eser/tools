import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import {
  getNestedField,
  resolveExpressions,
  type ExpressionContext,
} from "./pipeline-expressions.ts";

describe("getNestedField", () => {
  it("returns top-level field", () => {
    assertEquals(getNestedField({ a: 1 }, "a"), 1);
  });

  it("returns nested field", () => {
    assertEquals(getNestedField({ a: { b: { c: 42 } } }, "a.b.c"), 42);
  });

  it("returns undefined for missing path", () => {
    assertEquals(getNestedField({ a: 1 }, "b"), undefined);
  });

  it("returns undefined when traversing null", () => {
    assertEquals(getNestedField({ a: null }, "a.b"), undefined);
  });
});

describe("resolveExpressions", () => {
  const context: ExpressionContext = {
    stepOutputs: [
      { platform: "twitter", author: { name: "Alice" }, count: 5 },
      { data: "<svg/>", mimeType: "image/svg+xml" },
    ],
    variables: {
      "my-var": "hello",
      "num": 42,
    },
  };

  it("resolves full step output expression", () => {
    const result = resolveExpressions("${{ steps.0.output }}", context);
    assertEquals(result, { platform: "twitter", author: { name: "Alice" }, count: 5 });
  });

  it("resolves step output field expression", () => {
    assertEquals(resolveExpressions("${{ steps.0.output.platform }}", context), "twitter");
  });

  it("resolves nested step output field", () => {
    assertEquals(resolveExpressions("${{ steps.0.output.author.name }}", context), "Alice");
  });

  it("resolves variable expression", () => {
    assertEquals(resolveExpressions("${{ variables.my-var }}", context), "hello");
  });

  it("preserves type for full expression (number)", () => {
    assertEquals(resolveExpressions("${{ steps.0.output.count }}", context), 5);
  });

  it("preserves type for full expression (object)", () => {
    assertEquals(resolveExpressions("${{ steps.0.output.author }}", context), { name: "Alice" });
  });

  it("interpolates inline expressions as strings", () => {
    assertEquals(
      resolveExpressions("Format: ${{ steps.1.output.mimeType }}", context),
      "Format: image/svg+xml",
    );
  });

  it("interpolates multiple inline expressions", () => {
    assertEquals(
      resolveExpressions("${{ steps.0.output.platform }} - ${{ variables.my-var }}", context),
      "twitter - hello",
    );
  });

  it("returns undefined for out-of-range step index", () => {
    assertEquals(resolveExpressions("${{ steps.5.output }}", context), undefined);
  });

  it("returns undefined for unknown variable", () => {
    assertEquals(resolveExpressions("${{ variables.unknown }}", context), undefined);
  });

  it("passes through plain strings", () => {
    assertEquals(resolveExpressions("hello world", context), "hello world");
  });

  it("passes through non-string values", () => {
    assertEquals(resolveExpressions(42, context), 42);
    assertEquals(resolveExpressions(true, context), true);
    assertEquals(resolveExpressions(null, context), null);
  });

  it("resolves expressions in nested objects", () => {
    const input = {
      url: "https://example.com",
      platform: "${{ steps.0.output.platform }}",
      nested: { value: "${{ variables.my-var }}" },
    };
    assertEquals(resolveExpressions(input, context), {
      url: "https://example.com",
      platform: "twitter",
      nested: { value: "hello" },
    });
  });

  it("resolves expressions in arrays", () => {
    const input = ["${{ steps.0.output.platform }}", "literal"];
    assertEquals(resolveExpressions(input, context), ["twitter", "literal"]);
  });

  it("handles whitespace in expressions", () => {
    assertEquals(resolveExpressions("${{   steps.0.output.platform   }}", context), "twitter");
  });
});
