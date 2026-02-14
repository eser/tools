import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { execute } from "./execute.ts";
import type { ToolContext } from "../types.ts";

const ctx: ToolContext = { env: {} };

describe("vector-renderer execute", () => {
  describe("SVG format", () => {
    it("returns the SVG string as-is", async () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>`;
      const result = await execute({ svg, format: "svg" }, ctx);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.value.data, svg);
        assertEquals(result.value.mimeType, "image/svg+xml");
      }
    });

    it("calculates correct byte size for ASCII SVG", async () => {
      const svg = "<svg/>";
      const result = await execute({ svg, format: "svg" }, ctx);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.value.sizeBytes, new TextEncoder().encode(svg).length);
      }
    });

    it("calculates correct byte size for multi-byte SVG", async () => {
      const svg = `<svg><text>Merhaba dünya</text></svg>`;
      const result = await execute({ svg, format: "svg" }, ctx);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.value.sizeBytes, new TextEncoder().encode(svg).length);
      }
    });
  });
});
