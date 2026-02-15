import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import {
  topologicalSort,
  graphToPipeline,
  pipelineToGraph,
  parseExpression,
  autoLayoutPositions,
} from "./graph-pipeline.ts";
import type { ToolNode, TypedEdge } from "./graph-types.ts";
import { inputHandleId, outputHandleId } from "./graph-types.ts";
import type { PipelineDefinition } from "../tools/types.ts";

// -------------------------------------------------------------------
// Helpers to build test fixtures
// -------------------------------------------------------------------

function makeNode(id: string, toolId: string, pos = { x: 0, y: 0 }, overrides?: Partial<ToolNode["data"]>): ToolNode {
  return {
    id,
    type: "tool",
    position: pos,
    data: {
      toolId,
      toolName: toolId,
      category: "Utility",
      description: "",
      inputPorts: [],
      outputPorts: [],
      inputSchema: { type: "object", properties: {} },
      outputSchema: { type: "object", properties: {} },
      inputValues: {},
      connectedInputs: new Set<string>(),
      connectedOutputs: new Set<string>(),
      executionState: "idle",
      collapsed: false,
      bypassed: false,
      convertedToInput: new Set<string>(),
      ...overrides,
    },
  };
}

function makeEdge(id: string, source: string, target: string, sourcePortKey: string, targetPortKey: string): TypedEdge {
  return {
    id,
    source,
    target,
    sourceHandle: outputHandleId(sourcePortKey),
    targetHandle: inputHandleId(targetPortKey),
    data: {
      sourcePortType: "string",
      sourcePortKey,
      targetPortKey,
    },
  };
}

const MOCK_TOOLS = [
  {
    id: "tool-a",
    name: "Tool A",
    description: "First tool",
    category: "Utility",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
    outputSchema: {
      type: "object",
      properties: { platform: { type: "string" }, text: { type: "string" } },
    },
  },
  {
    id: "tool-b",
    name: "Tool B",
    description: "Second tool",
    category: "Privacy",
    inputSchema: {
      type: "object",
      properties: { content: { type: "string" }, mode: { type: "string" } },
      required: ["content"],
    },
    outputSchema: {
      type: "object",
      properties: { result: { type: "string" } },
    },
  },
  {
    id: "tool-c",
    name: "Tool C",
    description: "Third tool",
    category: "Rendering",
    inputSchema: {
      type: "object",
      properties: { data: { type: "object" } },
    },
    outputSchema: {
      type: "object",
      properties: { svg: { type: "string" } },
    },
  },
];

// -------------------------------------------------------------------
// topologicalSort
// -------------------------------------------------------------------

describe("topologicalSort", () => {
  it("sorts a linear chain A -> B -> C", () => {
    const nodes = [
      makeNode("a", "tool-a", { x: 0, y: 0 }),
      makeNode("b", "tool-b", { x: 400, y: 0 }),
      makeNode("c", "tool-c", { x: 800, y: 0 }),
    ];
    const edges = [
      makeEdge("e1", "a", "b", "platform", "content"),
      makeEdge("e2", "b", "c", "result", "data"),
    ];
    assertEquals(topologicalSort(nodes, edges), ["a", "b", "c"]);
  });

  it("sorts a diamond A -> B, A -> C, B -> D, C -> D", () => {
    const nodes = [
      makeNode("a", "tool-a", { x: 0, y: 0 }),
      makeNode("b", "tool-b", { x: 400, y: -100 }),
      makeNode("c", "tool-c", { x: 400, y: 100 }),
      makeNode("d", "tool-a", { x: 800, y: 0 }),
    ];
    const edges = [
      makeEdge("e1", "a", "b", "platform", "content"),
      makeEdge("e2", "a", "c", "text", "data"),
      makeEdge("e3", "b", "d", "result", "url"),
      makeEdge("e4", "c", "d", "svg", "url"),
    ];
    const sorted = topologicalSort(nodes, edges);
    assertEquals(sorted[0], "a");
    assertEquals(sorted[sorted.length - 1], "d");
    // b and c can be in either order but b is above c (y=-100 < y=100), both at x=400
    assertEquals(sorted.indexOf("b") < sorted.indexOf("d"), true);
    assertEquals(sorted.indexOf("c") < sorted.indexOf("d"), true);
  });

  it("handles disconnected nodes sorted by position", () => {
    const nodes = [
      makeNode("c", "tool-c", { x: 800, y: 0 }),
      makeNode("a", "tool-a", { x: 0, y: 0 }),
      makeNode("b", "tool-b", { x: 400, y: 0 }),
    ];
    const sorted = topologicalSort(nodes, []);
    assertEquals(sorted, ["a", "b", "c"]);
  });

  it("throws on cycle", () => {
    const nodes = [
      makeNode("a", "tool-a", { x: 0, y: 0 }),
      makeNode("b", "tool-b", { x: 400, y: 0 }),
    ];
    const edges = [
      makeEdge("e1", "a", "b", "platform", "content"),
      makeEdge("e2", "b", "a", "result", "url"),
    ];
    assertThrows(() => topologicalSort(nodes, edges), Error, "Cycle detected");
  });

  it("handles a single node", () => {
    const nodes = [makeNode("only", "tool-a")];
    assertEquals(topologicalSort(nodes, []), ["only"]);
  });

  it("handles empty graph", () => {
    assertEquals(topologicalSort([], []), []);
  });
});

// -------------------------------------------------------------------
// parseExpression
// -------------------------------------------------------------------

describe("parseExpression", () => {
  it("parses step output expression", () => {
    const result = parseExpression("${{ steps.2.output.platform }}");
    assertEquals(result, { kind: "step", stepIndex: 2, field: "platform" });
  });

  it("parses variable expression", () => {
    const result = parseExpression("${{ variables.api-key }}");
    assertEquals(result, { kind: "variable", name: "api-key" });
  });

  it("returns null for plain string", () => {
    assertEquals(parseExpression("hello world"), null);
  });

  it("returns null for non-string", () => {
    assertEquals(parseExpression(42), null);
    assertEquals(parseExpression(null), null);
  });

  it("parses nested field path", () => {
    const result = parseExpression("${{ steps.0.output.author.name }}");
    assertEquals(result, { kind: "step", stepIndex: 0, field: "author.name" });
  });
});

// -------------------------------------------------------------------
// graphToPipeline
// -------------------------------------------------------------------

describe("graphToPipeline", () => {
  it("converts a 2-step chain with expressions", () => {
    const nodeA = makeNode("n1", "tool-a", { x: 0, y: 0 }, {
      inputValues: { url: "https://example.com" },
      connectedInputs: new Set<string>(),
      connectedOutputs: new Set<string>(),
    });
    const nodeB = makeNode("n2", "tool-b", { x: 400, y: 0 }, {
      inputValues: { mode: "strict" },
      connectedInputs: new Set<string>(["content"]),
      connectedOutputs: new Set<string>(),
    });
    const edge = makeEdge("e1", "n1", "n2", "platform", "content");

    const result = graphToPipeline([nodeA, nodeB], [edge], MOCK_TOOLS);

    assertEquals(result.definition.steps.length, 2);
    assertEquals(result.definition.steps[0].toolId, "tool-a");
    assertEquals(result.definition.steps[0].input, { url: "https://example.com" });
    assertEquals(result.definition.steps[1].toolId, "tool-b");
    assertEquals(result.definition.steps[1].input, {
      mode: "strict",
      content: "${{ steps.0.output.platform }}",
    });
    assertEquals(result.nodeToStepIndex.get("n1"), 0);
    assertEquals(result.nodeToStepIndex.get("n2"), 1);
  });

  it("handles mixed literal and connected inputs", () => {
    const nodeA = makeNode("a", "tool-a", { x: 0, y: 0 }, {
      inputValues: { url: "https://test.com" },
    });
    const nodeB = makeNode("b", "tool-b", { x: 400, y: 0 }, {
      inputValues: { content: "should-be-ignored", mode: "auto" },
      connectedInputs: new Set<string>(["content"]),
      connectedOutputs: new Set<string>(),
    });
    const edge = makeEdge("e1", "a", "b", "text", "content");

    const result = graphToPipeline([nodeA, nodeB], [edge], MOCK_TOOLS);

    // content should come from edge expression, not literal value
    assertEquals(result.definition.steps[1].input, {
      mode: "auto",
      content: "${{ steps.0.output.text }}",
    });
  });

  it("sets bypass flag for bypassed nodes", () => {
    const nodeA = makeNode("a", "tool-a", { x: 0, y: 0 }, {
      inputValues: { url: "https://a.com" },
      bypassed: true,
    });

    const result = graphToPipeline([nodeA], [], MOCK_TOOLS);

    assertEquals(result.definition.steps[0].bypass, true);
  });

  it("omits bypass flag for non-bypassed nodes", () => {
    const nodeA = makeNode("a", "tool-a", { x: 0, y: 0 }, {
      inputValues: { url: "https://a.com" },
    });

    const result = graphToPipeline([nodeA], [], MOCK_TOOLS);

    assertEquals(result.definition.steps[0].bypass, undefined);
  });

  it("handles disconnected nodes", () => {
    const nodeA = makeNode("a", "tool-a", { x: 0, y: 0 }, {
      inputValues: { url: "https://a.com" },
    });
    const nodeB = makeNode("b", "tool-b", { x: 400, y: 0 }, {
      inputValues: { content: "hello" },
    });

    const result = graphToPipeline([nodeA, nodeB], [], MOCK_TOOLS);

    assertEquals(result.definition.steps.length, 2);
    assertEquals(result.definition.steps[0].input, { url: "https://a.com" });
    assertEquals(result.definition.steps[1].input, { content: "hello" });
  });
});

// -------------------------------------------------------------------
// pipelineToGraph
// -------------------------------------------------------------------

describe("pipelineToGraph", () => {
  it("creates edges from expression strings", () => {
    const definition: PipelineDefinition = {
      steps: [
        { toolId: "tool-a", input: { url: "https://example.com" } },
        { toolId: "tool-b", input: { content: "${{ steps.0.output.platform }}", mode: "auto" } },
      ],
    };

    const result = pipelineToGraph(definition, MOCK_TOOLS);

    assertEquals(result.nodes.length, 2);
    assertEquals(result.edges.length, 1);
    assertEquals(result.edges[0].source, "step-0");
    assertEquals(result.edges[0].target, "step-1");
    assertEquals(result.edges[0].data!.sourcePortKey, "platform");
    assertEquals(result.edges[0].data!.targetPortKey, "content");
    // content should be in connectedInputs, not inputValues
    assertEquals(result.nodes[1].data.connectedInputs.has("content"), true);
    assertEquals(result.nodes[1].data.inputValues.mode, "auto");
    assertEquals(result.nodes[1].data.inputValues.content, undefined);
  });

  it("creates edges from legacy inputMapping", () => {
    const definition: PipelineDefinition = {
      steps: [
        { toolId: "tool-a", input: { url: "https://example.com" } },
        {
          toolId: "tool-b",
          input: { mode: "strict" },
          inputMapping: { content: { fromStep: 0, field: "platform" } },
        },
      ],
    };

    const result = pipelineToGraph(definition, MOCK_TOOLS);

    assertEquals(result.edges.length, 1);
    assertEquals(result.edges[0].data!.sourcePortKey, "platform");
    assertEquals(result.edges[0].data!.targetPortKey, "content");
    assertEquals(result.nodes[1].data.connectedInputs.has("content"), true);
  });

  it("applies auto-layout positions", () => {
    const definition: PipelineDefinition = {
      steps: [
        { toolId: "tool-a", input: {} },
        { toolId: "tool-b", input: {} },
        { toolId: "tool-c", input: {} },
      ],
    };

    const result = pipelineToGraph(definition, MOCK_TOOLS);

    assertEquals(result.nodes[0].position, { x: 80, y: 120 });
    assertEquals(result.nodes[1].position, { x: 460, y: 120 });
    assertEquals(result.nodes[2].position, { x: 840, y: 120 });
  });

  it("uses custom layout positions when provided", () => {
    const definition: PipelineDefinition = {
      steps: [{ toolId: "tool-a", input: {} }],
    };

    const result = pipelineToGraph(definition, MOCK_TOOLS, {
      positions: { "step-0": { x: 100, y: 200 } },
      viewport: { x: 10, y: 20, zoom: 1.5 },
    });

    assertEquals(result.nodes[0].position, { x: 100, y: 200 });
    assertEquals(result.viewport, { x: 10, y: 20, zoom: 1.5 });
  });

  it("initializes new node data fields", () => {
    const definition: PipelineDefinition = {
      steps: [{ toolId: "tool-a", input: {} }],
    };

    const result = pipelineToGraph(definition, MOCK_TOOLS);
    const node = result.nodes[0];

    assertEquals(node.data.bypassed, false);
    assertEquals(node.data.convertedToInput.size, 0);
    assertEquals(node.data.customColor, undefined);
  });

  it("restores bypass flag from pipeline step", () => {
    const definition: PipelineDefinition = {
      steps: [{ toolId: "tool-a", input: {}, bypass: true }],
    };

    const result = pipelineToGraph(definition, MOCK_TOOLS);

    assertEquals(result.nodes[0].data.bypassed, true);
  });

  it("populates port definitions from tool schemas", () => {
    const definition: PipelineDefinition = {
      steps: [{ toolId: "tool-a", input: {} }],
    };

    const result = pipelineToGraph(definition, MOCK_TOOLS);

    const node = result.nodes[0];
    assertEquals(node.data.inputPorts.length, 1);
    assertEquals(node.data.inputPorts[0].key, "url");
    assertEquals(node.data.inputPorts[0].dataType, "string");
    assertEquals(node.data.inputPorts[0].required, true);
    assertEquals(node.data.outputPorts.length, 2);
    assertEquals(node.data.outputPorts.map((p) => p.key).sort(), ["platform", "text"]);
  });
});

// -------------------------------------------------------------------
// autoLayoutPositions
// -------------------------------------------------------------------

describe("autoLayoutPositions", () => {
  it("returns positions with 380px spacing", () => {
    const positions = autoLayoutPositions(3);
    assertEquals(positions.length, 3);
    assertEquals(positions[0], { x: 80, y: 120 });
    assertEquals(positions[1], { x: 460, y: 120 });
    assertEquals(positions[2], { x: 840, y: 120 });
  });

  it("returns empty array for 0 nodes", () => {
    assertEquals(autoLayoutPositions(0), []);
  });
});

// -------------------------------------------------------------------
// Round-trip
// -------------------------------------------------------------------

describe("round-trip graph -> pipeline -> graph", () => {
  it("preserves structure through conversion", () => {
    // Build original graph
    const nodeA = makeNode("n1", "tool-a", { x: 80, y: 120 }, {
      inputValues: { url: "https://example.com" },
      inputPorts: [{ key: "url", label: "url", dataType: "string", required: true, schema: { type: "string" } }],
      outputPorts: [
        { key: "platform", label: "platform", dataType: "string", required: false, schema: { type: "string" } },
        { key: "text", label: "text", dataType: "string", required: false, schema: { type: "string" } },
      ],
    });
    const nodeB = makeNode("n2", "tool-b", { x: 460, y: 120 }, {
      inputValues: { mode: "strict" },
      connectedInputs: new Set<string>(["content"]),
      connectedOutputs: new Set<string>(),
      inputPorts: [
        { key: "content", label: "content", dataType: "string", required: true, schema: { type: "string" } },
        { key: "mode", label: "mode", dataType: "string", required: false, schema: { type: "string" } },
      ],
      outputPorts: [
        { key: "result", label: "result", dataType: "string", required: false, schema: { type: "string" } },
      ],
    });
    const edge = makeEdge("e1", "n1", "n2", "platform", "content");

    // Convert to pipeline
    const { definition } = graphToPipeline([nodeA, nodeB], [edge], MOCK_TOOLS);

    assertEquals(definition.steps.length, 2);
    assertEquals(definition.steps[0].toolId, "tool-a");
    assertEquals(definition.steps[1].toolId, "tool-b");

    // Convert back to graph
    const restored = pipelineToGraph(definition, MOCK_TOOLS);

    assertEquals(restored.nodes.length, 2);
    assertEquals(restored.edges.length, 1);

    // Check the edge connections are preserved
    assertEquals(restored.edges[0].data!.sourcePortKey, "platform");
    assertEquals(restored.edges[0].data!.targetPortKey, "content");

    // Check literal values are preserved
    assertEquals(restored.nodes[0].data.inputValues.url, "https://example.com");
    assertEquals(restored.nodes[1].data.inputValues.mode, "strict");

    // Check connected inputs are marked
    assertEquals(restored.nodes[1].data.connectedInputs.has("content"), true);
  });
});
