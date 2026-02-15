import "@xyflow/react/dist/style.css";

// Prevent vertical resize on tool nodes — height is always content-driven
const nodeHeightStyle = document.createElement("style");
nodeHeightStyle.textContent = `.react-flow__node-tool { height: auto !important; }`;
document.head.appendChild(nodeHeightStyle);

import { useState, useCallback, useEffect, useRef, useMemo, type DragEvent } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type OnConnect,
  type NodeTypes,
  type EdgeTypes,
  type IsValidConnection,
  useOnSelectionChange,
  type OnConnectStart,
  type OnConnectEnd,
} from "@xyflow/react";

import { ToolNode } from "./tool-node.tsx";
import { TypedEdge, LinkModeContext, type LinkMode } from "./typed-edge.tsx";
import { RerouteNode } from "./reroute-node.tsx";
import { GroupNode } from "./group-node.tsx";
import { NodePalette } from "./node-palette.tsx";
import { NodeInspector } from "./node-inspector.tsx";
import { DesignerToolbar, type PipelineMeta } from "./designer-toolbar.tsx";
import {
  CanvasContextMenu,
  NodeContextMenu,
  EdgeContextMenu,
} from "./context-menus.tsx";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts.ts";

import type {
  ToolNode as ToolNodeType,
  TypedEdge as TypedEdgeType,
  NodeExecutionState,
} from "@/lib/graph-types.ts";
import { getInputPorts, getOutputPorts, parseHandleId } from "@/lib/graph-types.ts";
import {
  graphToPipeline,
  pipelineToGraph,
  autoLayoutPositions,
  topologicalSort,
} from "@/lib/graph-pipeline.ts";
import { runPipeline, savePipeline, getSavedPipeline } from "@/server/functions.ts";
import { type JsonSchema, getSchemaDefaults } from "@/lib/json-schema.ts";
import type { SavedPipeline } from "@/tools/pipeline-store/schema.ts";

// ---------------------------------------------------------------
// Node/Edge type maps must be defined at module level to
// prevent ReactFlow re-renders on every parent render.
// ---------------------------------------------------------------
const nodeTypes: NodeTypes = { tool: ToolNode, reroute: RerouteNode, group: GroupNode };
const edgeTypes: EdgeTypes = { typed: TypedEdge };

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

interface DesignerCanvasProps {
  tools: ToolInfo[];
  initialPipeline?: SavedPipeline;
  onSaveSuccess?: (id: string) => void;
}

type ContextMenuState =
  | { type: "canvas"; x: number; y: number }
  | { type: "node"; x: number; y: number; nodeId: string }
  | { type: "edge"; x: number; y: number; edgeId: string }
  | null;

interface HistorySnapshot {
  nodes: ToolNodeType[];
  edges: TypedEdgeType[];
}

const MAX_HISTORY = 50;

// ---------------------------------------------------------------
// Inner component (needs ReactFlowProvider as ancestor)
// ---------------------------------------------------------------

let nodeIdCounter = 0;
function nextNodeId(): string {
  nodeIdCounter += 1;
  return `node-${nodeIdCounter}-${Date.now()}`;
}

function DesignerCanvasInner({
  tools,
  initialPipeline,
  onSaveSuccess,
}: DesignerCanvasProps) {
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<ToolNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<TypedEdgeType>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pipelineMeta, setPipelineMeta] = useState<PipelineMeta>({
    name: "",
    slug: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_results, setResults] = useState<unknown>(null);

  // Link render mode (persisted in localStorage)
  const [linkMode, setLinkMode] = useState<LinkMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("designer-link-mode");
      if (stored === "bezier" || stored === "straight" || stored === "step") return stored;
    }
    return "bezier";
  });
  const handleLinkModeChange = useCallback((mode: LinkMode) => {
    setLinkMode(mode);
    localStorage.setItem("designer-link-mode", mode);
  }, []);

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Clipboard for copy/paste
  const clipboardRef = useRef<{ nodes: ToolNodeType[]; edges: TypedEdgeType[] } | null>(null);

  // Undo/Redo history
  const historyRef = useRef<HistorySnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoingRef = useRef(false);

  const pushHistory = useCallback(() => {
    if (isUndoingRef.current) return;
    const snapshot: HistorySnapshot = {
      nodes: JSON.parse(JSON.stringify(nodes, (_k, v) => v instanceof Set ? [...v] : v)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    // Truncate any future history
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current += 1;
    }
  }, [nodes, edges]);

  // Store removed edges so they can be restored via the inspector
  const disconnectedEdgesRef = useRef<Map<string, TypedEdgeType>>(new Map());

  // ---- Load initial pipeline on mount ----
  useEffect(() => {
    if (!initialPipeline) return;

    setPipelineMeta({
      name: initialPipeline.name,
      slug: initialPipeline.id,
      description: initialPipeline.description,
    });

    const layoutInfo = initialPipeline.layout
      ? {
          positions: Object.fromEntries(
            initialPipeline.layout.nodes.map((n) => [n.id, n.position]),
          ),
          viewport: initialPipeline.layout.viewport,
        }
      : undefined;

    const graph = pipelineToGraph(
      { steps: initialPipeline.steps },
      tools,
      layoutInfo,
    );

    setNodes(graph.nodes);
    setEdges(graph.edges);

    // Fit view after layout paint
    requestAnimationFrame(() => fitView());
  }, [initialPipeline, tools, setNodes, setEdges, fitView]);

  // ---- Connection validation ----
  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      // No self-connections
      if (connection.source === connection.target) return false;

      // No duplicate target handles
      const duplicate = edges.some(
        (e) =>
          e.target === connection.target &&
          e.targetHandle === connection.targetHandle,
      );
      return !duplicate;
    },
    [edges],
  );

  // ---- onConnect ----
  const onConnect = useCallback<OnConnect>(
    (connection) => {
      if (connection.source === connection.target) return;

      // Parse prefixed handle IDs to get raw port keys
      const sourceHandleParsed = connection.sourceHandle ? parseHandleId(connection.sourceHandle) : null;
      const targetHandleParsed = connection.targetHandle ? parseHandleId(connection.targetHandle) : null;
      const sourcePortKey = sourceHandleParsed?.key ?? connection.sourceHandle ?? "";
      const targetPortKey = targetHandleParsed?.key ?? connection.targetHandle ?? "";

      // Find source node to determine port type
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const sourcePort = sourceNode?.data.outputPorts.find(
        (p) => p.key === sourcePortKey,
      );

      const newEdge: TypedEdgeType = {
        id: `e-${connection.source}-${sourcePortKey}-${connection.target}-${targetPortKey}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: "typed",
        data: {
          sourcePortType: sourcePort?.dataType ?? "unknown",
          sourcePortKey,
          targetPortKey,
        },
      };

      setEdges((eds) => [...eds, newEdge]);

      // Mark target input as connected (clear literal) and source output as connected
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === connection.target && targetPortKey) {
            const connectedInputs = new Set(n.data.connectedInputs);
            connectedInputs.add(targetPortKey);
            const inputValues = { ...n.data.inputValues };
            delete inputValues[targetPortKey];
            return {
              ...n,
              data: { ...n.data, connectedInputs, inputValues },
            };
          }
          if (n.id === connection.source && sourcePortKey) {
            const connectedOutputs = new Set(n.data.connectedOutputs);
            connectedOutputs.add(sourcePortKey);
            return {
              ...n,
              data: { ...n.data, connectedOutputs },
            };
          }
          return n;
        }),
      );
    },
    [nodes, setEdges, setNodes],
  );

  // ---- onEdgesDelete ----
  const onEdgesDelete = useCallback(
    (deletedEdges: TypedEdgeType[]) => {
      setNodes((nds) => {
        // Collect all changes needed
        const inputRemovals = new Map<string, Set<string>>();
        const outputRemovals = new Map<string, Set<string>>();

        for (const edge of deletedEdges) {
          if (edge.data?.targetPortKey) {
            const set = inputRemovals.get(edge.target) ?? new Set();
            set.add(edge.data.targetPortKey);
            inputRemovals.set(edge.target, set);
          }
          if (edge.data?.sourcePortKey) {
            const set = outputRemovals.get(edge.source) ?? new Set();
            set.add(edge.data.sourcePortKey);
            outputRemovals.set(edge.source, set);
          }
        }

        return nds.map((n) => {
          const inputKeys = inputRemovals.get(n.id);
          const outputKeys = outputRemovals.get(n.id);
          if (!inputKeys && !outputKeys) return n;

          const connectedInputs = new Set(n.data.connectedInputs);
          const connectedOutputs = new Set(n.data.connectedOutputs);
          if (inputKeys) for (const k of inputKeys) connectedInputs.delete(k);
          if (outputKeys) for (const k of outputKeys) connectedOutputs.delete(k);

          return {
            ...n,
            data: { ...n.data, connectedInputs, connectedOutputs },
          };
        });
      });
    },
    [setNodes],
  );

  // ---- Drag & Drop from palette ----
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();

      const toolId = e.dataTransfer.getData("application/pipeline-tool");
      if (!toolId) return;

      const tool = tools.find((t) => t.id === toolId);
      if (!tool) return;

      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const inputSchema = (tool.inputSchema ?? {
        type: "object",
        properties: {},
      }) as JsonSchema;
      const outputSchema = (tool.outputSchema ?? {
        type: "object",
        properties: {},
      }) as JsonSchema;

      const newNode: ToolNodeType = {
        id: nextNodeId(),
        type: "tool",
        position,
        data: {
          toolId: tool.id,
          toolName: tool.name,
          category: tool.category,
          description: tool.description,
          inputPorts: getInputPorts(inputSchema),
          outputPorts: getOutputPorts(outputSchema),
          inputSchema,
          outputSchema,
          inputValues: getSchemaDefaults(inputSchema),
          connectedInputs: new Set<string>(),
          connectedOutputs: new Set<string>(),
          executionState: "idle",
          collapsed: false,
          bypassed: false,
          convertedToInput: new Set<string>(),
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [tools, screenToFlowPosition, setNodes],
  );

  // ---- Node selection ----
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: ToolNodeType) => {
      setSelectedNodeId(node.id);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // ---- Update node input values (from inspector) ----
  const updateNodeInputValues = useCallback(
    (nodeId: string, values: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          return { ...n, data: { ...n.data, inputValues: values } };
        }),
      );
    },
    [setNodes],
  );

  // ---- Disconnect an input (remove edge but store it for reconnect) ----
  const disconnectInput = useCallback(
    (nodeId: string, portKey: string) => {
      // Find the edge, store it, then remove it
      setEdges((eds) => {
        const edge = eds.find(
          (e) => e.target === nodeId && e.data?.targetPortKey === portKey,
        );
        if (edge) {
          disconnectedEdgesRef.current.set(`${nodeId}:${portKey}`, edge);
        }
        return eds.filter((e) => e !== edge);
      });

      // Remove from connectedInputs
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const connectedInputs = new Set(n.data.connectedInputs);
          connectedInputs.delete(portKey);
          return {
            ...n,
            data: { ...n.data, connectedInputs },
          };
        }),
      );
    },
    [setEdges, setNodes],
  );

  // ---- Reconnect a previously disconnected input ----
  const reconnectInput = useCallback(
    (nodeId: string, portKey: string) => {
      const key = `${nodeId}:${portKey}`;
      const edge = disconnectedEdgesRef.current.get(key);
      if (!edge) return;

      disconnectedEdgesRef.current.delete(key);
      setEdges((eds) => [...eds, edge]);

      // Add back to connectedInputs and clear literal value
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const connectedInputs = new Set(n.data.connectedInputs);
          connectedInputs.add(portKey);
          const inputValues = { ...n.data.inputValues };
          delete inputValues[portKey];
          return {
            ...n,
            data: { ...n.data, connectedInputs, inputValues },
          };
        }),
      );
    },
    [setEdges, setNodes],
  );

  // ---- Run pipeline ----
  const handleRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    // Set all nodes to running
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          executionState: "running" as NodeExecutionState,
          errorMessage: undefined,
          durationMs: undefined,
          outputPreview: undefined,
        },
      })),
    );

    const { definition, nodeToStepIndex } =
      graphToPipeline(nodes, edges, tools);

    try {

      const result = (await runPipeline({ data: definition })) as {
        steps: Array<{
          toolId: string;
          output: unknown;
          durationMs: number;
        }>;
        totalDurationMs: number;
      };

      setResults(result);

      // Update nodes with execution results
      setNodes((nds) =>
        nds.map((n) => {
          const stepIdx = nodeToStepIndex.get(n.id);
          if (stepIdx === undefined) return n;
          const stepResult = result.steps[stepIdx];
          return {
            ...n,
            data: {
              ...n.data,
              executionState: "completed" as NodeExecutionState,
              durationMs: stepResult?.durationMs,
              outputPreview: stepResult?.output,
            },
          };
        }),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      setError(message);

      // Try to identify which step failed from the error message
      const stepMatch = message.match(/^Step (\d+)/);
      const failedStepIdx = stepMatch ? parseInt(stepMatch[1], 10) : undefined;

      // Mark nodes: completed for steps before failure, error for the failing step, idle for the rest
      setNodes((nds) =>
        nds.map((n) => {
          const stepIdx = nodeToStepIndex.get(n.id);
          if (stepIdx === undefined) return n;

          if (failedStepIdx !== undefined && stepIdx < failedStepIdx) {
            return {
              ...n,
              data: {
                ...n.data,
                executionState: "completed" as NodeExecutionState,
                errorMessage: undefined,
              },
            };
          }

          if (failedStepIdx !== undefined && stepIdx === failedStepIdx) {
            return {
              ...n,
              data: {
                ...n.data,
                executionState: "error" as NodeExecutionState,
                errorMessage: message,
              },
            };
          }

          // Steps after the failure: reset to idle
          return {
            ...n,
            data: {
              ...n.data,
              executionState: "idle" as NodeExecutionState,
              errorMessage: undefined,
            },
          };
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [nodes, edges, tools, setNodes]);

  // ---- Save pipeline ----
  const handleSave = useCallback(async () => {
    if (!pipelineMeta.name || !pipelineMeta.slug) {
      setError("Pipeline name and slug are required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { definition } = graphToPipeline(nodes, edges, tools);

      const layout = {
        nodes: nodes.map((n) => ({
          id: n.id,
          position: n.position,
        })),
      };

      await savePipeline({
        data: {
          id: pipelineMeta.slug,
          name: pipelineMeta.name,
          description: pipelineMeta.description,
          steps: definition.steps,
          layout,
        },
      });

      onSaveSuccess?.(pipelineMeta.slug);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save pipeline",
      );
    } finally {
      setSaving(false);
    }
  }, [nodes, edges, tools, pipelineMeta, onSaveSuccess]);

  // ---- Load pipeline ----
  const handleLoad = useCallback(
    async (pipelineId: string) => {
      try {
        const pipeline = await getSavedPipeline({ data: { id: pipelineId } });

        setPipelineMeta({
          name: pipeline.name,
          slug: pipeline.id,
          description: pipeline.description,
        });

        const layoutInfo = pipeline.layout
          ? {
              positions: Object.fromEntries(
                pipeline.layout.nodes.map((n) => [n.id, n.position]),
              ),
              viewport: pipeline.layout.viewport,
            }
          : undefined;

        const graph = pipelineToGraph(
          { steps: pipeline.steps },
          tools,
          layoutInfo,
        );

        setNodes(graph.nodes);
        setEdges(graph.edges);
        setSelectedNodeId(null);
        setResults(null);
        setError(null);

        requestAnimationFrame(() => fitView({ padding: 0.2 }));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load pipeline",
        );
      }
    },
    [tools, setNodes, setEdges, fitView],
  );

  // ---- Auto layout ----
  const handleAutoLayout = useCallback(() => {
    try {
      const sortedIds = topologicalSort(
        nodes as ToolNodeType[],
        edges as TypedEdgeType[],
      );
      const positions = autoLayoutPositions(sortedIds.length);

      setNodes((nds) =>
        nds.map((n) => {
          const idx = sortedIds.indexOf(n.id);
          if (idx === -1) return n;
          return { ...n, position: positions[idx] };
        }),
      );

      requestAnimationFrame(() => fitView({ padding: 0.2 }));
    } catch {
      // Cycle detected — just do a simple left-to-right layout
      const positions = autoLayoutPositions(nodes.length);
      setNodes((nds) =>
        nds.map((n, i) => ({ ...n, position: positions[i] })),
      );
      requestAnimationFrame(() => fitView({ padding: 0.2 }));
    }
  }, [nodes, edges, setNodes, fitView]);

  // ---- Fit view ----
  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2 });
  }, [fitView]);

  // ---- Clear canvas ----
  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setResults(null);
    setError(null);
  }, [setNodes, setEdges]);

  // ---- Action callbacks for context menus & keyboard shortcuts ----

  const deleteSelected = useCallback(() => {
    pushHistory();
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedEdges = edges.filter((e) => e.selected);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    const nodeIds = new Set(selectedNodes.map((n) => n.id));
    // Remove edges connected to deleted nodes too
    const edgesToRemove = new Set([
      ...selectedEdges.map((e) => e.id),
      ...edges.filter((e) => nodeIds.has(e.source) || nodeIds.has(e.target)).map((e) => e.id),
    ]);

    setEdges((eds) => eds.filter((e) => !edgesToRemove.has(e.id)));
    setNodes((nds) => nds.filter((n) => !nodeIds.has(n.id)));
    setSelectedNodeId(null);
  }, [nodes, edges, setNodes, setEdges, pushHistory]);

  const cloneNode = useCallback(
    (nodeId: string) => {
      pushHistory();
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const newNode: ToolNodeType = {
        ...node,
        id: nextNodeId(),
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        selected: false,
        data: {
          ...node.data,
          connectedInputs: new Set<string>(),
          connectedOutputs: new Set<string>(),
          executionState: "idle",
          errorMessage: undefined,
          durationMs: undefined,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes, pushHistory],
  );

  const duplicateSelected = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    for (const node of selected) {
      cloneNode(node.id);
    }
  }, [nodes, cloneNode]);

  const toggleBypassForNode = useCallback(
    (nodeId: string) => {
      pushHistory();
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, bypassed: !n.data.bypassed } }
            : n,
        ),
      );
    },
    [setNodes, pushHistory],
  );

  const toggleBypassSelected = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    pushHistory();
    const nodeIds = new Set(selected.map((n) => n.id));
    setNodes((nds) =>
      nds.map((n) =>
        nodeIds.has(n.id)
          ? { ...n, data: { ...n.data, bypassed: !n.data.bypassed } }
          : n,
      ),
    );
  }, [nodes, setNodes, pushHistory]);

  const toggleCollapseForNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } }
            : n,
        ),
      );
    },
    [setNodes],
  );

  const setNodeColor = useCallback(
    (nodeId: string, color: string | undefined) => {
      pushHistory();
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, customColor: color } }
            : n,
        ),
      );
    },
    [setNodes, pushHistory],
  );

  const renameNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, renaming: true } }
            : n,
        ),
      );
    },
    [setNodes],
  );

  const selectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: true })));
  }, [setNodes, setEdges]);

  const copySelected = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedEdges = edges.filter((e) => e.selected);
    if (selectedNodes.length === 0) return;
    clipboardRef.current = { nodes: selectedNodes, edges: selectedEdges };
  }, [nodes, edges]);

  const pasteClipboard = useCallback(() => {
    if (!clipboardRef.current || clipboardRef.current.nodes.length === 0) return;
    pushHistory();

    const idMap = new Map<string, string>();
    const newNodes: ToolNodeType[] = clipboardRef.current.nodes.map((n) => {
      const newId = nextNodeId();
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 60, y: n.position.y + 60 },
        selected: true,
        data: {
          ...n.data,
          connectedInputs: new Set<string>(),
          connectedOutputs: new Set<string>(),
          executionState: "idle" as const,
          errorMessage: undefined,
          durationMs: undefined,
        },
      };
    });

    // Re-map edges that are internal to the pasted set
    const newEdges: TypedEdgeType[] = clipboardRef.current.edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...e,
        id: `e-paste-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        selected: true,
      }));

    // Deselect existing
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes]);
    setEdges((eds) => [...eds.map((e) => ({ ...e, selected: false })), ...newEdges]);
  }, [setNodes, setEdges, pushHistory]);

  const undo = useCallback(() => {
    if (historyIndexRef.current < 0) return;
    isUndoingRef.current = true;

    // Save current state as a forward snapshot if we're at the top
    if (historyIndexRef.current === historyRef.current.length - 1) {
      const current: HistorySnapshot = {
        nodes: JSON.parse(JSON.stringify(nodes, (_k, v) => v instanceof Set ? [...v] : v)),
        edges: JSON.parse(JSON.stringify(edges)),
      };
      historyRef.current.push(current);
    }

    const snapshot = historyRef.current[historyIndexRef.current];
    historyIndexRef.current -= 1;

    const restoredNodes = JSON.parse(JSON.stringify(snapshot.nodes));
    for (const n of restoredNodes) {
      if (n.data.connectedInputs) n.data.connectedInputs = new Set(n.data.connectedInputs);
      if (n.data.connectedOutputs) n.data.connectedOutputs = new Set(n.data.connectedOutputs);
      if (n.data.convertedToInput) n.data.convertedToInput = new Set(n.data.convertedToInput);
    }

    setNodes(restoredNodes);
    setEdges(snapshot.edges);
    isUndoingRef.current = false;
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 2) return;
    isUndoingRef.current = true;

    historyIndexRef.current += 2;
    const snapshot = historyRef.current[historyIndexRef.current];

    const restoredNodes = JSON.parse(JSON.stringify(snapshot.nodes));
    for (const n of restoredNodes) {
      if (n.data.connectedInputs) n.data.connectedInputs = new Set(n.data.connectedInputs);
      if (n.data.connectedOutputs) n.data.connectedOutputs = new Set(n.data.connectedOutputs);
      if (n.data.convertedToInput) n.data.convertedToInput = new Set(n.data.convertedToInput);
    }

    setNodes(restoredNodes);
    setEdges(snapshot.edges);
    isUndoingRef.current = false;
  }, [setNodes, setEdges]);

  const deleteEdgeById = useCallback(
    (edgeId: string) => {
      pushHistory();
      const edge = edges.find((e) => e.id === edgeId);
      if (edge) {
        onEdgesDelete([edge as TypedEdgeType]);
      }
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [edges, setEdges, onEdgesDelete, pushHistory],
  );

  // ---- Context menu event handlers ----
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setContextMenu({ type: "canvas", x: event.clientX, y: event.clientY });
    },
    [],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: ToolNodeType) => {
      event.preventDefault();
      setContextMenu({ type: "node", x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [],
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: TypedEdgeType) => {
      event.preventDefault();
      setContextMenu({ type: "edge", x: event.clientX, y: event.clientY, edgeId: edge.id });
    },
    [],
  );

  // ---- Keyboard shortcuts ----
  useKeyboardShortcuts({
    deleteSelected,
    copySelected,
    pasteClipboard: pasteClipboard,
    duplicateSelected,
    undo,
    redo,
    selectAll,
    toggleBypass: toggleBypassSelected,
  });

  // ---- Selection tracking for toolbox ----
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  useOnSelectionChange({
    onChange: ({ nodes: selNodes }) => {
      setSelectedNodeIds(selNodes.map((n) => n.id));
    },
  });

  const selectionBounds = useMemo(() => {
    if (selectedNodeIds.length < 2) return null;
    const selNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
    if (selNodes.length < 2) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of selNodes) {
      const w = (n.measured?.width ?? n.width ?? 220);
      const h = (n.measured?.height ?? n.height ?? 60);
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [selectedNodeIds, nodes]);

  // ---- Ctrl+G grouping ----
  useEffect(() => {
    const handleGroupShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.contentEditable === "true") return;

      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "g") {
        event.preventDefault();
        if (selectedNodeIds.length < 2) return;

        pushHistory();
        const selNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of selNodes) {
          const w = (n.measured?.width ?? n.width ?? 220);
          const h = (n.measured?.height ?? n.height ?? 60);
          minX = Math.min(minX, n.position.x);
          minY = Math.min(minY, n.position.y);
          maxX = Math.max(maxX, n.position.x + w);
          maxY = Math.max(maxY, n.position.y + h);
        }

        const padding = 40;
        const groupId = nextNodeId();
        const groupNode = {
          id: groupId,
          type: "group" as const,
          position: { x: minX - padding, y: minY - padding },
          style: { width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 },
          data: { label: "Group", color: "#3b82f6" },
        };

        setNodes((nds) => {
          // Insert group node behind selected nodes, reparent children
          const groupIdx = Math.min(...nds.map((n, i) => selectedNodeIds.includes(n.id) ? i : Infinity));
          const updated = nds.map((n) => {
            if (!selectedNodeIds.includes(n.id)) return n;
            return {
              ...n,
              parentId: groupId,
              position: {
                x: n.position.x - (minX - padding),
                y: n.position.y - (minY - padding),
              },
            };
          });
          updated.splice(groupIdx, 0, groupNode as any);
          return updated;
        });
      }
    };

    document.addEventListener("keydown", handleGroupShortcut);
    return () => document.removeEventListener("keydown", handleGroupShortcut);
  }, [selectedNodeIds, nodes, setNodes, pushHistory]);

  // ---- Connection drag tracking for port highlighting ----
  const [connectingPortType, setConnectingPortType] = useState<string | null>(null);

  const onConnectStart = useCallback<OnConnectStart>(
    (_event, params) => {
      if (!params.handleId) return;
      // Find source node and port to determine type
      const node = nodes.find((n) => n.id === params.nodeId);
      if (!node) return;

      const parsed = parseHandleId(params.handleId);
      if (!parsed) return;

      if (parsed.kind === "output") {
        const port = node.data.outputPorts.find((p) => p.key === parsed.key);
        if (port) setConnectingPortType(port.dataType);
      } else {
        const port = node.data.inputPorts.find((p) => p.key === parsed.key);
        if (port) setConnectingPortType(port.dataType);
      }
    },
    [nodes],
  );

  const onConnectEnd = useCallback<OnConnectEnd>(() => {
    setConnectingPortType(null);
  }, []);

  // ---- Derive selected node ----
  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      <DesignerToolbar
        pipelineMeta={pipelineMeta}
        onMetaChange={setPipelineMeta}
        onRun={handleRun}
        onSave={handleSave}
        onLoad={handleLoad}
        onAutoLayout={handleAutoLayout}
        onFitView={handleFitView}
        loading={loading}
        saving={saving}
        linkMode={linkMode}
        onLinkModeChange={handleLinkModeChange}
      />

      {error && (
        <div className="px-4 py-1.5 text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/50 break-all">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <NodePalette tools={tools} />

        <div className="flex-1 relative">
          <LinkModeContext.Provider value={linkMode}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onEdgesDelete={onEdgesDelete}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: "typed" }}
            isValidConnection={isValidConnection}
            snapToGrid
            snapGrid={[16, 16]}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="var(--color-border)"
              className="!bg-background"
            />
            <MiniMap className="!bg-card !border-border !rounded-lg" />
          </ReactFlow>
          </LinkModeContext.Provider>

          {/* Context menus */}
          {contextMenu?.type === "canvas" && (
            <CanvasContextMenu
              position={{ x: contextMenu.x, y: contextMenu.y }}
              open
              onClose={closeContextMenu}
              onSelectAll={() => { selectAll(); closeContextMenu(); }}
              onFitView={() => { handleFitView(); closeContextMenu(); }}
              onAutoLayout={() => { handleAutoLayout(); closeContextMenu(); }}
              onClear={() => { handleClear(); closeContextMenu(); }}
            />
          )}
          {contextMenu?.type === "node" && (() => {
            const node = nodes.find((n) => n.id === contextMenu.nodeId);
            if (!node) return null;
            return (
              <NodeContextMenu
                position={{ x: contextMenu.x, y: contextMenu.y }}
                open
                onClose={closeContextMenu}
                nodeId={node.id}
                isBypassed={node.data.bypassed}
                isCollapsed={node.data.collapsed}
                customColor={node.data.customColor}
                onClone={() => { cloneNode(node.id); closeContextMenu(); }}
                onDelete={() => {
                  pushHistory();
                  setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id));
                  setNodes((nds) => nds.filter((n) => n.id !== node.id));
                  closeContextMenu();
                }}
                onToggleBypass={() => { toggleBypassForNode(node.id); closeContextMenu(); }}
                onToggleCollapse={() => { toggleCollapseForNode(node.id); closeContextMenu(); }}
                onSetColor={(color) => setNodeColor(node.id, color)}
                onRename={() => { renameNode(node.id); closeContextMenu(); }}
              />
            );
          })()}
          {contextMenu?.type === "edge" && (
            <EdgeContextMenu
              position={{ x: contextMenu.x, y: contextMenu.y }}
              open
              onClose={closeContextMenu}
              onDelete={() => { deleteEdgeById(contextMenu.edgeId); closeContextMenu(); }}
            />
          )}

          {/* Selection toolbox — floating bar above multi-selection */}
          {selectionBounds && selectedNodeIds.length >= 2 && (
            <div
              className="absolute z-40 flex items-center gap-1 rounded-md bg-muted border border-border px-1.5 py-1 shadow-lg"
              style={{
                pointerEvents: "all",
                left: "50%",
                top: 8,
                transform: "translateX(-50%)",
              }}
            >
              <button
                type="button"
                className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-background"
                onClick={deleteSelected}
                title="Delete selected"
              >
                Delete
              </button>
              <button
                type="button"
                className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-background"
                onClick={toggleBypassSelected}
                title="Toggle bypass"
              >
                Bypass
              </button>
              <button
                type="button"
                className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-background"
                onClick={() => {
                  // Trigger Ctrl+G programmatically
                  document.dispatchEvent(new KeyboardEvent("keydown", {
                    key: "g",
                    ctrlKey: true,
                    bubbles: true,
                  }));
                }}
                title="Group (Ctrl+G)"
              >
                Group
              </button>
            </div>
          )}
        </div>

        {selectedNode && (
          <NodeInspector
            nodeId={selectedNode.id}
            data={selectedNode.data}
            reconnectableKeys={Array.from(disconnectedEdgesRef.current.keys())
              .filter((k) => k.startsWith(`${selectedNode.id}:`))
              .map((k) => k.split(":")[1])}
            onInputChange={updateNodeInputValues}
            onDisconnect={disconnectInput}
            onReconnect={reconnectInput}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Public wrapper with ReactFlowProvider
// ---------------------------------------------------------------

export function DesignerCanvas(props: DesignerCanvasProps) {
  return (
    <ReactFlowProvider>
      <DesignerCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
