import { env } from "@/config.ts";
import { Command } from "@eser/shell/args";
import { z } from "zod";
import { registry } from "../tools/registry.ts";
import { executePipeline } from "../tools/pipeline.ts";
import type { PipelineDefinition, ToolContext } from "../tools/types.ts";
import { pipelineStore } from "../tools/pipeline-store/mod.ts";
import type { SavePipelineInput } from "../tools/pipeline-store/mod.ts";

function createContext(): ToolContext {
  return {
    env,
    onProgress: (p) => {
      const prefix = p.percent !== undefined ? `[${p.percent}%]` : "[...]";
      Deno.stderr.writeSync(new TextEncoder().encode(`\r${prefix} ${p.message}`));
    },
  };
}

function readJsonFlag(ctx: { flags: Record<string, unknown> }): unknown | undefined {
  const inputFlag = ctx.flags["input"] as string | undefined;
  const fileFlag = ctx.flags["file"] as string | undefined;

  if (fileFlag !== undefined) {
    const content = Deno.readTextFileSync(fileFlag);
    return JSON.parse(content);
  }
  if (inputFlag !== undefined) {
    return JSON.parse(inputFlag);
  }
  return undefined;
}

const jsonInputFlags = [
  { name: "input", short: "i", type: "string" as const, description: "JSON string" },
  { name: "file", short: "f", type: "string" as const, description: "JSON file path" },
];

const app = new Command("tools")
  .description("Universal tools platform CLI")
  .version("0.1.0")
  .command(
    new Command("list")
      .description("List all available tools")
      .run(async () => {
        const tools = registry.list();
        console.log("\nAvailable tools:\n");
        for (const tool of tools) {
          console.log(`  ${tool.id}`);
          console.log(`    ${tool.name} [${tool.category}]`);
          console.log(`    ${tool.description}\n`);
        }
      }),
  )
  .command(
    new Command("run")
      .description("Execute a tool")
      .flag(jsonInputFlags[0])
      .flag(jsonInputFlags[1])
      .run(async (ctx) => {
        const toolId = ctx.args[0];
        if (toolId === undefined) {
          return console.error("Usage: tools run <tool-id> --input <json> | --file <path>");
        }

        const tool = registry.get(toolId);
        if (tool === undefined) {
          return console.error(`Tool not found: ${toolId}\nAvailable: ${registry.list().map((t) => t.id).join(", ")}`);
        }

        const rawInput = readJsonFlag(ctx);
        if (rawInput === undefined) {
          return console.error("Provide input via --input <json> or --file <path>");
        }

        const validated = tool.inputSchema.parse(rawInput);
        const result = await tool.execute(validated, createContext());

        Deno.stderr.writeSync(new TextEncoder().encode("\r\x1b[K"));

        if (!result.ok) {
          return console.error(`Error: ${result.error}`);
        }

        console.log(JSON.stringify(result.value, null, 2));
      }),
  )
  .command(
    new Command("pipeline")
      .description("Execute a pipeline definition")
      .flag(jsonInputFlags[0])
      .flag(jsonInputFlags[1])
      .run(async (ctx) => {
        const rawDefinition = readJsonFlag(ctx);
        if (rawDefinition === undefined) {
          return console.error("Provide definition via --input <json> or --file <path>");
        }

        const definition = rawDefinition as PipelineDefinition;
        const result = await executePipeline(definition, createContext());

        Deno.stderr.writeSync(new TextEncoder().encode("\r\x1b[K"));

        if (!result.ok) {
          return console.error(`Pipeline error: ${result.error}`);
        }

        console.log(JSON.stringify(result.value, null, 2));
      }),
  )
  .command(
    new Command("schema")
      .description("Print the JSON Schema for a tool's input")
      .run(async (ctx) => {
        const toolId = ctx.args[0];
        if (toolId === undefined) {
          return console.error("Usage: tools schema <tool-id>");
        }

        const tool = registry.get(toolId);
        if (tool === undefined) {
          return console.error(`Tool not found: ${toolId}`);
        }

        console.log(JSON.stringify(z.toJSONSchema(tool.inputSchema), null, 2));
      }),
  )
  .command(
    new Command("pipelines")
      .description("Manage saved pipelines")
      .command(
        new Command("list")
          .description("List all saved pipelines")
          .run(async () => {
            const result = await pipelineStore.list();
            if (!result.ok) {
              return console.error(`Error: ${result.error}`);
            }
            if (result.value.length === 0) {
              return console.log("\nNo saved pipelines.\n");
            }
            console.log("\nSaved pipelines:\n");
            for (const p of result.value) {
              console.log(`  ${p.id}`);
              console.log(`    ${p.name}${p.description ? ` — ${p.description}` : ""}`);
              console.log(`    Updated: ${p.updatedAt}\n`);
            }
          }),
      )
      .command(
        new Command("get")
          .description("Show a saved pipeline definition")
          .run(async (ctx) => {
            const id = ctx.args[0];
            if (id === undefined) {
              return console.error("Usage: tools pipelines get <pipeline-id>");
            }
            const result = await pipelineStore.get(id);
            if (!result.ok) {
              return console.error(`Error: ${result.error}`);
            }
            console.log(JSON.stringify(result.value, null, 2));
          }),
      )
      .command(
        new Command("save")
          .description("Save a pipeline definition")
          .flag({ name: "id", type: "string", description: "Pipeline slug ID" })
          .flag({ name: "name", short: "n", type: "string", description: "Display name" })
          .flag({ name: "description", short: "d", type: "string", description: "Description" })
          .flag(jsonInputFlags[0])
          .flag(jsonInputFlags[1])
          .run(async (ctx) => {
            const id = ctx.flags["id"] as string | undefined;
            const name = ctx.flags["name"] as string | undefined;
            if (id === undefined || name === undefined) {
              return console.error("Usage: tools pipelines save --id <slug> --name <name> [-d <desc>] -i <json> | -f <path>");
            }

            const stepsData = readJsonFlag(ctx);
            if (stepsData === undefined) {
              return console.error("Provide steps via --input <json> or --file <path>");
            }

            const raw = stepsData as { steps?: unknown[] };
            const steps = raw.steps ?? stepsData;

            const saveInput: SavePipelineInput = {
              id,
              name,
              description: (ctx.flags["description"] as string | undefined) ?? "",
              steps: steps as SavePipelineInput["steps"],
            };

            const result = await pipelineStore.save(saveInput);
            if (!result.ok) {
              return console.error(`Error: ${result.error}`);
            }
            console.log(`Saved pipeline: ${result.value.id}`);
            console.log(JSON.stringify(result.value, null, 2));
          }),
      )
      .command(
        new Command("delete")
          .description("Delete a saved pipeline")
          .run(async (ctx) => {
            const id = ctx.args[0];
            if (id === undefined) {
              return console.error("Usage: tools pipelines delete <pipeline-id>");
            }
            const result = await pipelineStore.remove(id);
            if (!result.ok) {
              return console.error(`Error: ${result.error}`);
            }
            console.log(`Deleted pipeline: ${id}`);
          }),
      )
      .command(
        new Command("run")
          .description("Execute a saved pipeline by ID")
          .run(async (ctx) => {
            const id = ctx.args[0];
            if (id === undefined) {
              return console.error("Usage: tools pipelines run <pipeline-id>");
            }
            const getResult = await pipelineStore.get(id);
            if (!getResult.ok) {
              return console.error(`Error: ${getResult.error}`);
            }
            const pipeline = getResult.value;
            console.error(`Running pipeline: ${pipeline.name}`);
            const result = await executePipeline(pipeline, createContext());
            Deno.stderr.writeSync(new TextEncoder().encode("\r\x1b[K"));
            if (!result.ok) {
              return console.error(`Pipeline error: ${result.error}`);
            }
            console.log(JSON.stringify(result.value, null, 2));
          }),
      ),
  );

await app.parse();
