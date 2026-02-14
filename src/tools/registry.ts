import { z } from "zod";
import type { ToolDefinition } from "./types.ts";
import { tools as registeredTools } from "./_registry.gen.ts";

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool "${tool.id}" is already registered`);
    }
    this.tools.set(tool.id, tool);
  }

  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  list(): Array<{
    id: string;
    name: string;
    description: string;
    category: string;
  }> {
    return this.getAll().map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
    }));
  }

  listWithSchemas(): Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    inputSchema: unknown;
    outputSchema: unknown;
  }> {
    return this.getAll().map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      inputSchema: z.toJSONSchema(t.inputSchema),
      outputSchema: z.toJSONSchema(t.outputSchema),
    }));
  }
}

export const registry = new ToolRegistry();

for (const tool of registeredTools) {
  registry.register(tool);
}
