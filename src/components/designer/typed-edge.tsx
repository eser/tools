import { createContext, memo, useCallback, useContext } from "react";
import {
  BaseEdge,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import type {
  ToolNode as ToolNodeType,
  TypedEdge as TypedEdgeType,
} from "@/lib/graph-types.ts";
import { PORT_COLORS } from "@/lib/graph-types.ts";

// ---------------------------------------------------------------
// Link mode context
// ---------------------------------------------------------------

export type LinkMode = "bezier" | "straight" | "step";

export const LinkModeContext = createContext<LinkMode>("bezier");

const PATH_FN = {
  bezier: getBezierPath,
  straight: getStraightPath,
  step: getSmoothStepPath,
} as const;

// ---------------------------------------------------------------
// Edge component
// ---------------------------------------------------------------

export const TypedEdge = memo(function TypedEdge(
  props: EdgeProps<TypedEdgeType>,
) {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props;

  const linkMode = useContext(LinkModeContext);
  const { setEdges, setNodes } = useReactFlow<ToolNodeType, TypedEdgeType>();

  const onDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      setEdges((eds) => eds.filter((edge) => edge.id !== id));

      // Clean up connectedInputs on target and connectedOutputs on source
      const targetPortKey = data?.targetPortKey;
      const sourcePortKey = data?.sourcePortKey;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === target && targetPortKey) {
            const connectedInputs = new Set(n.data.connectedInputs);
            connectedInputs.delete(targetPortKey);
            return { ...n, data: { ...n.data, connectedInputs } };
          }
          if (n.id === source && sourcePortKey) {
            const connectedOutputs = new Set(n.data.connectedOutputs);
            connectedOutputs.delete(sourcePortKey);
            return { ...n, data: { ...n.data, connectedOutputs } };
          }
          return n;
        }),
      );
    },
    [id, source, target, data?.targetPortKey, data?.sourcePortKey, setEdges, setNodes],
  );

  const getPath = PATH_FN[linkMode];
  const [edgePath, centerX, centerY] = getPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const strokeColor = PORT_COLORS[data?.sourcePortType ?? "unknown"];

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 2.5 : 1.5,
        }}
      />
      {selected && (
        <g
          onMouseDown={onDelete}
          style={{ cursor: "pointer" }}
        >
          <circle cx={centerX} cy={centerY} r={10} fill="#dc2626" />
          <line
            x1={centerX - 4}
            y1={centerY - 4}
            x2={centerX + 4}
            y2={centerY + 4}
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <line
            x1={centerX + 4}
            y1={centerY - 4}
            x2={centerX - 4}
            y2={centerY + 4}
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      )}
    </>
  );
});
