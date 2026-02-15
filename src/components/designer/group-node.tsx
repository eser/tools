import { memo, useState, useCallback } from "react";
import {
  NodeResizeControl,
  useReactFlow,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { cn } from "@/lib/utils.ts";

export interface GroupNodeData extends Record<string, unknown> {
  label: string;
  color: string;
}

export type GroupNode = Node<GroupNodeData, "group">;

const DEFAULT_COLOR = "#3b82f6";

export const GroupNode = memo(function GroupNode({
  id,
  data,
  selected,
}: NodeProps<GroupNode>) {
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label);

  const commitRename = useCallback(() => {
    const trimmed = editLabel.trim();
    if (trimmed && trimmed !== data.label) {
      updateNodeData(id, { label: trimmed });
    }
    setEditing(false);
  }, [id, editLabel, data.label, updateNodeData]);

  const color = data.color || DEFAULT_COLOR;

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-dashed min-w-[300px] min-h-[200px] w-full h-full",
        selected && "ring-2 ring-primary/50",
      )}
      style={{
        borderColor: `${color}60`,
        backgroundColor: `${color}10`,
      }}
    >
      {selected && (
        <NodeResizeControl
          minWidth={300}
          minHeight={200}
          className="!bg-transparent !border-none"
        >
          <svg
            className="absolute bottom-0.5 right-0.5"
            width="8"
            height="8"
            viewBox="0 0 8 8"
            style={{ color: `${color}80` }}
          >
            <path d="M8 8L0 8L8 0" fill="currentColor" />
          </svg>
        </NodeResizeControl>
      )}

      <div
        className="px-3 py-1.5 text-xs font-semibold rounded-t-lg"
        style={{ color }}
      >
        {editing ? (
          <input
            className="nodrag bg-transparent border-b outline-none text-xs min-w-0 w-full"
            style={{ borderColor: `${color}60`, color }}
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
          />
        ) : (
          <span
            className="cursor-text"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditLabel(data.label);
              setEditing(true);
            }}
          >
            {data.label}
          </span>
        )}
      </div>
    </div>
  );
});
