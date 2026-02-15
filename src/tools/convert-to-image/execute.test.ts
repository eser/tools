import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { execute } from "./execute.ts";
import type { ToolContext } from "../types.ts";

const ctx: ToolContext = { env: {} };

describe("convert-to-image execute", () => {
  describe("PNG format", () => {
    it("renders SVG to PNG and returns base64", async () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>`;
      const result = await execute({ svg, format: "png", quality: 85 }, ctx);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.value.mimeType, "image/png");
        assertEquals(typeof result.value.data, "string");
        assertEquals(result.value.data.length > 0, true);
        assertEquals(typeof result.value.sizeBytes, "number");
        assertEquals(result.value.sizeBytes > 0, true);
      }
    });

    it("produces larger output with 2x multiplier", async () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>`;
      const base = await execute({ svg, format: "png", multiplier: "1x", quality: 85 }, ctx);
      const scaled = await execute({ svg, format: "png", multiplier: "2x", quality: 85 }, ctx);

      assertEquals(base.ok, true);
      assertEquals(scaled.ok, true);
      if (base.ok && scaled.ok) {
        assertEquals(scaled.value.sizeBytes > base.value.sizeBytes, true);
      }
    });

    it("uses default format of png", async () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"><rect width="5" height="5" fill="blue"/></svg>`;
      const result = await execute({ svg, quality: 85 } as any, ctx);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.value.mimeType, "image/png");
      }
    });
  });
});
