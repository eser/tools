/// <reference lib="deno.ns" />
import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { execute } from "./execute.ts";
import type { ToolContext } from "../types.ts";

const ctx: ToolContext = { env: {} };

let testDir: string;

beforeEach(async () => {
  testDir = await Deno.makeTempDir({ prefix: "tools-save-file-test-" });
});

afterEach(async () => {
  await Deno.remove(testDir, { recursive: true }).catch(() => {});
});

describe("save-file execute", () => {
  it("saves text content as UTF-8", async () => {
    const result = await execute(
      {
        data: "<svg><rect/></svg>",
        mimeType: "image/svg+xml",
        folder: testDir,
        filename: "test.svg",
      },
      ctx,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.path, `${testDir}/test.svg`);
      assertEquals(result.value.sizeBytes > 0, true);

      const content = await Deno.readTextFile(result.value.path);
      assertEquals(content, "<svg><rect/></svg>");
    }
  });

  it("saves binary content from base64", async () => {
    // Small PNG: 1x1 red pixel
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    const result = await execute(
      {
        data: pngBase64,
        mimeType: "image/png",
        folder: testDir,
        filename: "pixel.png",
      },
      ctx,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.path, `${testDir}/pixel.png`);
      assertEquals(result.value.sizeBytes > 0, true);

      const bytes = await Deno.readFile(result.value.path);
      assertEquals(bytes.length, result.value.sizeBytes);
    }
  });

  it("creates nested folders automatically", async () => {
    const nestedFolder = `${testDir}/sub/folder`;
    const result = await execute(
      {
        data: "hello world",
        mimeType: "text/plain",
        folder: nestedFolder,
        filename: "hello.txt",
      },
      ctx,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.path, `${nestedFolder}/hello.txt`);
      const content = await Deno.readTextFile(result.value.path);
      assertEquals(content, "hello world");
    }
  });

  it("saves JSON content as text", async () => {
    const json = JSON.stringify({ key: "value" }, null, 2);
    const result = await execute(
      {
        data: json,
        mimeType: "application/json",
        folder: testDir,
        filename: "data.json",
      },
      ctx,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      const content = await Deno.readTextFile(result.value.path);
      assertEquals(content, json);
    }
  });

  it("substitutes {id} placeholder in filename", async () => {
    const result = await execute(
      {
        data: "hello",
        mimeType: "text/plain",
        folder: testDir,
        filename: "tweet_{id}.txt",
        id: "reddit-abc123",
      },
      ctx,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.path, `${testDir}/tweet_reddit-abc123.txt`);
      const content = await Deno.readTextFile(result.value.path);
      assertEquals(content, "hello");
    }
  });

  it("leaves {id} literal when id is not provided", async () => {
    const result = await execute(
      {
        data: "hello",
        mimeType: "text/plain",
        folder: testDir,
        filename: "tweet_{id}.txt",
      },
      ctx,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.value.path, `${testDir}/tweet_{id}.txt`);
    }
  });

  it("uses TOOLS_OUTPUT_DIR for relative paths", async () => {
    const outputDir = `${testDir}/output-base`;
    Deno.env.set("TOOLS_OUTPUT_DIR", outputDir);

    try {
      const result = await execute(
        {
          data: "relative test",
          mimeType: "text/plain",
          folder: "my-files",
          filename: "test.txt",
        },
        ctx,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.value.path, `${outputDir}/my-files/test.txt`);
        const content = await Deno.readTextFile(result.value.path);
        assertEquals(content, "relative test");
      }
    } finally {
      Deno.env.delete("TOOLS_OUTPUT_DIR");
    }
  });
});
