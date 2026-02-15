import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils.ts";

export interface RerouteNodeData extends Record<string, unknown> {
  _reroute: true;
}

export type RerouteNode = Node<RerouteNodeData, "reroute">;

export const RerouteNode = memo(function RerouteNode({
  selected,
}: NodeProps<RerouteNode>) {
  return (
    <div
      className={cn(
        "size-4 rounded-full bg-zinc-400 dark:bg-zinc-600 border-2 border-zinc-300 dark:border-zinc-500",
        selected && "ring-2 ring-primary/50 border-zinc-500 dark:border-zinc-400",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 8,
          height: 8,
          background: "var(--color-muted-foreground)",
          border: "none",
          left: -4,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 8,
          height: 8,
          background: "var(--color-muted-foreground)",
          border: "none",
          right: -4,
        }}
      />
    </div>
  );
});
