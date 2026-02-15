import type { Node, Edge } from "@xyflow/react";
import type { JsonSchema, JsonSchemaProperty } from "./json-schema.ts";

export type PortDataType = "string" | "number" | "boolean" | "object" | "array" | "unknown";

export interface PortDef {
  key: string;
  label: string;
  dataType: PortDataType;
  description?: string;
  required: boolean;
  schema: JsonSchemaProperty;
}

export type NodeExecutionState = "idle" | "running" | "completed" | "error";

export interface ToolNodeData extends Record<string, unknown> {
  toolId: string;
  toolName: string;
  category: string;
  description: string;
  inputPorts: PortDef[];
  outputPorts: PortDef[];
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  inputValues: Record<string, unknown>;
  connectedInputs: Set<string>;
  connectedOutputs: Set<string>;
  executionState: NodeExecutionState;
  errorMessage?: string;
  durationMs?: number;
  collapsed: boolean;
  bypassed: boolean;
  convertedToInput: Set<string>;
  customColor?: string;
  renaming?: boolean;
  outputPreview?: unknown;
}

export interface TypedEdgeData extends Record<string, unknown> {
  sourcePortType: PortDataType;
  sourcePortKey: string;
  targetPortKey: string;
}

export type ToolNode = Node<ToolNodeData, "tool">;
export type TypedEdge = Edge<TypedEdgeData>;

export const PORT_COLORS: Record<PortDataType, string> = {
  string: "#4ade80",
  number: "#60a5fa",
  boolean: "#f87171",
  object: "#c084fc",
  array: "#fb923c",
  unknown: "#a1a1aa",
};

export const CATEGORY_COLORS: Record<string, string> = {
  "Social Media": "#3b82f6",
  Privacy: "#a855f7",
  Rendering: "#f97316",
  Utility: "#6b7280",
};

export function schemaTypeToPortType(prop: JsonSchemaProperty): PortDataType {
  switch (prop.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    case "array":
      return "array";
    default:
      return "unknown";
  }
}

// Handle ID helpers — ensure unique IDs when input/output share a port name
export const INPUT_HANDLE_PREFIX = "in:";
export const OUTPUT_HANDLE_PREFIX = "out:";
export function inputHandleId(key: string): string { return `${INPUT_HANDLE_PREFIX}${key}`; }
export function outputHandleId(key: string): string { return `${OUTPUT_HANDLE_PREFIX}${key}`; }
export function parseHandleId(handleId: string): { kind: "input" | "output"; key: string } | null {
  if (handleId.startsWith(INPUT_HANDLE_PREFIX)) return { kind: "input", key: handleId.slice(INPUT_HANDLE_PREFIX.length) };
  if (handleId.startsWith(OUTPUT_HANDLE_PREFIX)) return { kind: "output", key: handleId.slice(OUTPUT_HANDLE_PREFIX.length) };
  return null;
}

export function getInputPorts(inputSchema: JsonSchema): PortDef[] {
  const properties = inputSchema.properties ?? {};
  const required = new Set(inputSchema.required ?? []);

  return Object.entries(properties).map(([key, prop]) => ({
    key,
    label: key,
    dataType: schemaTypeToPortType(prop),
    description: prop.description,
    required: required.has(key),
    schema: prop,
  }));
}

export function getOutputPorts(outputSchema: JsonSchema): PortDef[] {
  const properties = outputSchema.properties ?? {};
  const required = new Set(outputSchema.required ?? []);

  return Object.entries(properties).map(([key, prop]) => ({
    key,
    label: key,
    dataType: schemaTypeToPortType(prop),
    description: prop.description,
    required: required.has(key),
    schema: prop,
  }));
}
