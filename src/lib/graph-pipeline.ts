import type { Viewport } from "@xyflow/react";
import type { PipelineDefinition, PipelineStep, InputMapping } from "../tools/types.ts";
import type { JsonSchema } from "./json-schema.ts";
import type { ToolNode, TypedEdge, ToolNodeData } from "./graph-types.ts";
import { getInputPorts, getOutputPorts, schemaTypeToPortType, inputHandleId, outputHandleId } from "./graph-types.ts";

// -------------------------------------------------------------------
// Expression helpers
// -------------------------------------------------------------------

const STEP_EXPR_RE = /^\$\{\{\s*steps\.(\d+)\.output\.(.+?)\s*\}\}$/;
const VARIABLE_EXPR_RE = /^\$\{\{\s*variables\.(.+?)\s*\}\}$/;

export interface ParsedStepExpression {
  kind: "step";
  stepIndex: number;
  field: string;
}

export interface ParsedVariableExpression {
  kind: "variable";
  name: string;
}

export type ParsedExpression = ParsedStepExpression | ParsedVariableExpression | null;

export function parseExpression(value: unknown): ParsedExpression {
  if (typeof value !== "string") return null;

  const stepMatch = value.match(STEP_EXPR_RE);
  if (stepMatch) {
    return { kind: "step", stepIndex: parseInt(stepMatch[1], 10), field: stepMatch[2] };
  }

  const varMatch = value.match(VARIABLE_EXPR_RE);
  if (varMatch) {
    return { kind: "variable", name: varMatch[1] };
  }

  return null;
}

// -------------------------------------------------------------------
// Auto-layout
// -------------------------------------------------------------------

const NODE_SPACING_X = 380;
const NODE_START_X = 80;
const NODE_START_Y = 120;

export function autoLayoutPositions(nodeCount: number): Array<{ x: number; y: number }> {
  return Array.from({ length: nodeCount }, (_, i) => ({
    x: NODE_START_X + i * NODE_SPACING_X,
    y: NODE_START_Y,
  }));
}

// -------------------------------------------------------------------
// Topological sort (Kahn's algorithm)
// -------------------------------------------------------------------

export function topologicalSort(nodes: ToolNode[], edges: TypedEdge[]): string[] {
  if (nodes.length === 0) return [];

  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, inDegree.get(edge.target)! + 1);
  }

  // Build position map for tiebreaking (left-to-right, then top-to-bottom)
  const posMap = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    posMap.set(node.id, node.position ?? { x: 0, y: 0 });
  }

  // Initialize queue with zero-indegree nodes, sorted by position
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  queue.sort((a, b) => {
    const pa = posMap.get(a)!;
    const pb = posMap.get(b)!;
    return pa.x !== pb.x ? pa.x - pb.x : pa.y - pb.y;
  });

  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const neighbors = adjacency.get(current)!;
    const released: string[] = [];
    for (const neighbor of neighbors) {
      const newDeg = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) released.push(neighbor);
    }

    // Sort newly released nodes by position for deterministic ordering
    released.sort((a, b) => {
      const pa = posMap.get(a)!;
      const pb = posMap.get(b)!;
      return pa.x !== pb.x ? pa.x - pb.x : pa.y - pb.y;
    });
    queue.push(...released);
  }

  if (sorted.length !== nodeIds.size) {
    throw new Error("Cycle detected in graph");
  }

  return sorted;
}

// -------------------------------------------------------------------
// Graph -> Pipeline
// -------------------------------------------------------------------

export interface GraphToPipelineResult {
  definition: PipelineDefinition;
  nodeToStepIndex: Map<string, number>;
  stepIndexToNode: Map<number, string>;
}

interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  inputSchema: unknown;
  outputSchema: unknown;
}

export function graphToPipeline(
  nodes: ToolNode[],
  edges: TypedEdge[],
  _tools: ToolInfo[],
): GraphToPipelineResult {
  const sortedIds = topologicalSort(nodes, edges);

  const nodeToStepIndex = new Map<string, number>();
  const stepIndexToNode = new Map<number, string>();
  for (let i = 0; i < sortedIds.length; i++) {
    nodeToStepIndex.set(sortedIds[i], i);
    stepIndexToNode.set(i, sortedIds[i]);
  }

  // Build a lookup: targetNodeId -> list of incoming edges
  const incomingEdges = new Map<string, TypedEdge[]>();
  for (const edge of edges) {
    const list = incomingEdges.get(edge.target) ?? [];
    list.push(edge);
    incomingEdges.set(edge.target, list);
  }

  const nodeMap = new Map<string, ToolNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const steps: PipelineStep[] = sortedIds.map((nodeId) => {
    const node = nodeMap.get(nodeId)!;
    const data = node.data;

    const input: Record<string, unknown> = {};

    // Add literal input values
    for (const [key, value] of Object.entries(data.inputValues)) {
      if (!data.connectedInputs.has(key)) {
        input[key] = value;
      }
    }

    // Add expressions from connected edges
    const incoming = incomingEdges.get(nodeId) ?? [];
    for (const edge of incoming) {
      const edgeData = edge.data;
      if (!edgeData) continue;

      const sourceStepIdx = nodeToStepIndex.get(edge.source);
      if (sourceStepIdx === undefined) continue;

      input[edgeData.targetPortKey] =
        `\${{ steps.${sourceStepIdx}.output.${edgeData.sourcePortKey} }}`;
    }

    const step: PipelineStep = {
      toolId: data.toolId,
      input,
      ...(data.bypassed ? { bypass: true } : {}),
    };

    return step;
  });

  return {
    definition: { steps },
    nodeToStepIndex,
    stepIndexToNode,
  };
}

// -------------------------------------------------------------------
// Pipeline -> Graph
// -------------------------------------------------------------------

export interface PipelineToGraphResult {
  nodes: ToolNode[];
  edges: TypedEdge[];
  viewport: Viewport;
}

export interface LayoutInfo {
  positions: Record<string, { x: number; y: number }>;
  viewport?: Viewport;
}

export function pipelineToGraph(
  definition: PipelineDefinition,
  tools: ToolInfo[],
  layout?: LayoutInfo,
): PipelineToGraphResult {
  const toolMap = new Map<string, ToolInfo>();
  for (const t of tools) {
    toolMap.set(t.id, t);
  }

  const positions = layout?.positions ?? {};
  const autoPositions = autoLayoutPositions(definition.steps.length);

  const nodes: ToolNode[] = [];
  const edges: TypedEdge[] = [];
  const nodeIds: string[] = [];

  for (let i = 0; i < definition.steps.length; i++) {
    const step = definition.steps[i];
    const tool = toolMap.get(step.toolId);
    const nodeId = `step-${i}`;
    nodeIds.push(nodeId);

    const inputSchema = (tool?.inputSchema ?? { type: "object", properties: {} }) as JsonSchema;
    const outputSchema = (tool?.outputSchema ?? { type: "object", properties: {} }) as JsonSchema;

    const inputPorts = getInputPorts(inputSchema);
    const outputPorts = getOutputPorts(outputSchema);

    // Determine which inputs are connected vs literal
    const connectedInputs = new Set<string>();
    const inputValues: Record<string, unknown> = {};

    if (step.input) {
      for (const [key, value] of Object.entries(step.input)) {
        const parsed = parseExpression(value);
        if (parsed && parsed.kind === "step") {
          connectedInputs.add(key);
        } else {
          inputValues[key] = value;
        }
      }
    }

    // Also check legacy inputMapping
    if (step.inputMapping) {
      for (const key of Object.keys(step.inputMapping)) {
        connectedInputs.add(key);
      }
    }

    const pos = positions[nodeId] ?? autoPositions[i] ?? { x: 0, y: 0 };

    const nodeData: ToolNodeData = {
      toolId: step.toolId,
      toolName: tool?.name ?? step.toolId,
      category: tool?.category ?? "Utility",
      description: tool?.description ?? "",
      inputPorts,
      outputPorts,
      inputSchema,
      outputSchema,
      inputValues,
      connectedInputs,
      connectedOutputs: new Set<string>(),
      executionState: "idle",
      collapsed: false,
      bypassed: step.bypass ?? false,
      convertedToInput: new Set<string>(),
    };

    nodes.push({
      id: nodeId,
      type: "tool",
      position: pos,
      data: nodeData,
    });
  }

  // Create edges from expression strings in step.input
  for (let i = 0; i < definition.steps.length; i++) {
    const step = definition.steps[i];
    const targetNodeId = nodeIds[i];

    if (step.input) {
      for (const [key, value] of Object.entries(step.input)) {
        const parsed = parseExpression(value);
        if (parsed && parsed.kind === "step") {
          const sourceNodeId = nodeIds[parsed.stepIndex];
          if (!sourceNodeId) continue;

          // Determine source port type from the source node's output ports
          const sourceNode = nodes.find((n) => n.id === sourceNodeId);
          const sourcePort = sourceNode?.data.outputPorts.find((p) => p.key === parsed.field);
          const sourcePortType = sourcePort?.dataType ?? "unknown";

          edges.push({
            id: `e-${sourceNodeId}-${parsed.field}-${targetNodeId}-${key}`,
            source: sourceNodeId,
            target: targetNodeId,
            sourceHandle: outputHandleId(parsed.field),
            targetHandle: inputHandleId(key),
            type: "typed",
            data: {
              sourcePortType,
              sourcePortKey: parsed.field,
              targetPortKey: key,
            },
          });
        }
      }
    }

    // Legacy inputMapping support
    if (step.inputMapping) {
      for (const [key, mapping] of Object.entries(step.inputMapping)) {
        const sourceNodeId = nodeIds[mapping.fromStep];
        if (!sourceNodeId) continue;

        const field = mapping.field ?? "output";
        const sourceNode = nodes.find((n) => n.id === sourceNodeId);
        const sourcePort = sourceNode?.data.outputPorts.find((p) => p.key === field);
        const sourcePortType = sourcePort?.dataType ?? "unknown";

        edges.push({
          id: `e-${sourceNodeId}-${field}-${targetNodeId}-${key}`,
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle: outputHandleId(field),
          targetHandle: inputHandleId(key),
          type: "typed",
          data: {
            sourcePortType,
            sourcePortKey: field,
            targetPortKey: key,
          },
        });
      }
    }
  }

  // Populate connectedOutputs from created edges
  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (sourceNode && edge.data?.sourcePortKey) {
      sourceNode.data.connectedOutputs.add(edge.data.sourcePortKey);
    }
  }

  const viewport: Viewport = layout?.viewport ?? { x: 0, y: 0, zoom: 1 };

  return { nodes, edges, viewport };
}
