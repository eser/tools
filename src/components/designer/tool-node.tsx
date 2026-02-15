import { memo, useState, useCallback, useEffect } from "react";
import {
  Handle,
  Position,
  NodeResizeControl,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CheckIcon,
  XIcon,
  LoaderIcon,
  EyeOffIcon,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { ToolNode as ToolNodeType, PortDef } from "@/lib/graph-types.ts";
import {
  PORT_COLORS,
  CATEGORY_COLORS,
  inputHandleId,
  outputHandleId,
} from "@/lib/graph-types.ts";
import { getFieldControl } from "@/lib/json-schema.ts";
import { PortContextMenu } from "./context-menus.tsx";
import { OutputThumbnail } from "@/components/output-preview.tsx";

export const ToolNode = memo(function ToolNode({
  id,
  data,
  selected,
}: NodeProps<ToolNodeType>) {
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(data.toolName);

  // Enter rename mode when triggered externally (e.g. context menu)
  useEffect(() => {
    if (data.renaming) {
      setEditName(data.toolName);
      setEditing(true);
      updateNodeData(id, { renaming: false });
    }
  }, [data.renaming, data.toolName, id, updateNodeData]);

  const categoryColor = data.customColor
    ?? CATEGORY_COLORS[data.category]
    ?? CATEGORY_COLORS.Utility;

  // Port context menu for widget-to-input conversion
  const [portMenu, setPortMenu] = useState<{
    portKey: string;
    x: number;
    y: number;
    mode: "to-input" | "to-widget";
  } | null>(null);

  const convertToInput = useCallback(
    (portKey: string) => {
      const next = new Set(data.convertedToInput);
      next.add(portKey);
      updateNodeData(id, { convertedToInput: next });
      setPortMenu(null);
    },
    [id, data.convertedToInput, updateNodeData],
  );

  const convertToWidget = useCallback(
    (portKey: string) => {
      const next = new Set(data.convertedToInput);
      next.delete(portKey);
      updateNodeData(id, { convertedToInput: next });
      setPortMenu(null);
    },
    [id, data.convertedToInput, updateNodeData],
  );

  const updateInputValue = useCallback(
    (key: string, value: unknown) => {
      updateNodeData(id, {
        inputValues: { ...data.inputValues, [key]: value },
      });
    },
    [id, data.inputValues, updateNodeData],
  );

  const commitRename = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== data.toolName) {
      updateNodeData(id, { toolName: trimmed });
    }
    setEditing(false);
  }, [id, editName, data.toolName, updateNodeData]);

  return (
    <div
      className={cn(
        "min-w-[220px] rounded-lg bg-card text-card-foreground shadow-lg border border-border",
        data.bypassed && "opacity-50",
        selected && "ring-2 ring-primary/50",
        data.executionState === "running" &&
          "ring-2 ring-amber-400/70 animate-pulse",
        data.executionState === "completed" && "ring-2 ring-emerald-500/60",
        data.executionState === "error" && "ring-2 ring-red-500/60",
      )}
    >
      {/* Resize handle (bottom-right corner) */}
      {selected && !data.bypassed && (
        <NodeResizeControl
          minWidth={220}
          maxWidth={500}
          className="!bg-transparent !border-none"
        >
          <svg
            className="absolute bottom-0.5 right-0.5 text-muted-foreground"
            width="8"
            height="8"
            viewBox="0 0 8 8"
          >
            <path d="M8 8L0 8L8 0" fill="currentColor" />
          </svg>
        </NodeResizeControl>
      )}

      {/* Title bar */}
      <div
        className="flex items-center gap-1.5 rounded-t-lg px-2.5 py-1.5 text-xs font-semibold text-white"
        style={{ backgroundColor: data.bypassed ? "#52525b" : categoryColor }}
      >
        <button
          type="button"
          className="nodrag flex items-center justify-center rounded hover:bg-white/20"
          onClick={() => updateNodeData(id, { collapsed: !data.collapsed })}
        >
          {data.collapsed ? (
            <ChevronRightIcon className="size-3.5" />
          ) : (
            <ChevronDownIcon className="size-3.5" />
          )}
        </button>

        {editing ? (
          <input
            className="nodrag flex-1 bg-transparent border-b border-white/40 outline-none text-xs text-white min-w-0"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
          />
        ) : (
          <span
            className="flex-1 truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditName(data.toolName);
              setEditing(true);
            }}
          >
            {data.toolName}
          </span>
        )}

        {data.bypassed && (
          <EyeOffIcon className="size-3.5 text-zinc-400" />
        )}
        {data.executionState === "completed" && !data.bypassed && (
          <CheckIcon className="size-3.5 text-emerald-200" />
        )}
        {data.executionState === "error" && !data.bypassed && (
          <XIcon className="size-3.5 text-red-200" />
        )}
        {data.executionState === "running" && !data.bypassed && (
          <LoaderIcon className="size-3.5 animate-spin text-amber-200" />
        )}
      </div>

      {/* Running progress bar */}
      {data.executionState === "running" && !data.bypassed && (
        <div className="h-0.5 w-full overflow-hidden bg-muted">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-amber-400" />
        </div>
      )}

      {/* Port rows — two independent columns */}
      {!data.collapsed && (
        <div className="flex gap-2 py-2">
          {/* Left column: input ports */}
          <div className="flex-1 min-w-0 space-y-0.5">
            {data.inputPorts.map((port) => {
              const isConnected = data.connectedInputs.has(port.key);
              const isConvertedToInput = data.convertedToInput.has(port.key);
              const showWidget = !isConnected && !isConvertedToInput;

              return (
                <div
                  key={port.key}
                  className={showWidget ? "mb-2" : undefined}
                  onContextMenu={(e) => {
                    if (isConnected) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setPortMenu({
                      portKey: port.key,
                      x: e.clientX,
                      y: e.clientY,
                      mode: isConvertedToInput ? "to-widget" : "to-input",
                    });
                  }}
                >
                  <div className="relative flex items-center gap-1.5 pl-2">
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={inputHandleId(port.key)}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        border: `2px solid ${PORT_COLORS[port.dataType]}`,
                        backgroundColor: isConnected
                          ? PORT_COLORS[port.dataType]
                          : "transparent",
                      }}
                    />
                    <span className="truncate text-[10px] text-muted-foreground">
                      {port.label}
                      {port.required && (
                        <span className="ml-0.5 text-red-400">*</span>
                      )}
                    </span>
                  </div>
                  {showWidget && (
                    <InlineWidget
                      port={port}
                      value={data.inputValues[port.key]}
                      onChange={(v) => updateInputValue(port.key, v)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Right column: output ports */}
          <div className="flex-1 min-w-0 space-y-0.5">
            {data.outputPorts.map((port) => (
              <div
                key={port.key}
                className="relative flex items-center gap-1.5 justify-end pr-2 h-[22px]"
              >
                <span className="truncate text-[10px] text-zinc-400">
                  {port.label}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={outputHandleId(port.key)}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: `2px solid ${PORT_COLORS[port.dataType]}`,
                    backgroundColor: data.connectedOutputs.has(port.key)
                      ? PORT_COLORS[port.dataType]
                      : "transparent",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed: still need handles so edges don't break */}
      {data.collapsed && (
        <div className="h-0">
          {data.inputPorts.map((port) => (
            <Handle
              key={port.key}
              type="target"
              position={Position.Left}
              id={inputHandleId(port.key)}
              style={{ visibility: "hidden" }}
            />
          ))}
          {data.outputPorts.map((port) => (
            <Handle
              key={port.key}
              type="source"
              position={Position.Right}
              id={outputHandleId(port.key)}
              style={{ visibility: "hidden" }}
            />
          ))}
        </div>
      )}

      {/* Output preview after execution */}
      {data.outputPreview != null && data.executionState === "completed" && !data.bypassed && (
        <OutputThumbnail output={data.outputPreview} />
      )}

      {/* Bypass strip */}
      {data.bypassed && (
        <div className="rounded-b-lg bg-muted/60 px-2.5 py-1 text-[10px] text-muted-foreground text-center font-medium">
          BYPASSED
        </div>
      )}

      {/* Error strip */}
      {data.executionState === "error" && data.errorMessage != null && !data.bypassed && (
        <div className="w-0 min-w-full rounded-b-lg bg-red-950/60 px-2.5 py-1 text-[10px] text-red-300 leading-tight" style={{ overflowWrap: "anywhere" }}>
          {data.errorMessage}
        </div>
      )}

      {/* Port conversion context menu */}
      {portMenu && (
        <PortContextMenu
          position={{ x: portMenu.x, y: portMenu.y }}
          open
          onClose={() => setPortMenu(null)}
          mode={portMenu.mode}
          onConvert={() => {
            if (portMenu.mode === "to-input") {
              convertToInput(portMenu.portKey);
            } else {
              convertToWidget(portMenu.portKey);
            }
          }}
        />
      )}
    </div>
  );
});

// ---------------------------------------------------------------
// Inline widget for unconnected inputs
// ---------------------------------------------------------------

const widgetInputClassName =
  "nodrag nopan h-6 w-full rounded bg-muted px-1.5 text-[10px] text-foreground outline-none border border-border focus:border-ring";

function InlineWidget({
  port,
  value,
  onChange,
}: {
  port: PortDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const control = getFieldControl(port.key, port.schema);

  switch (control) {
    case "text":
    case "url":
      return (
        <input
          type={control === "url" ? "url" : "text"}
          className={cn(widgetInputClassName, "ml-4 mt-0.5")}
          placeholder={port.schema.description ?? port.key}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return (
        <input
          type="number"
          className={cn(widgetInputClassName, "ml-4 mt-0.5")}
          placeholder={port.schema.description ?? port.key}
          value={value != null ? String(value) : ""}
          min={port.schema.minimum}
          max={port.schema.maximum}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? undefined : Number(v));
          }}
        />
      );

    case "checkbox":
      return (
        <label className="nodrag nopan ml-4 mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-border bg-muted size-3"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {value ? "true" : "false"}
        </label>
      );

    case "select":
      return (
        <select
          className={cn(widgetInputClassName, "ml-4 mt-0.5 appearance-none cursor-pointer")}
          value={(value as string) ?? port.schema.default as string ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— select —</option>
          {port.schema.enum?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    default:
      // textarea, json, file — too complex for inline
      return (
        <div className="ml-4 mt-0.5 rounded bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground italic">
          Edit in Inspector
        </div>
      );
  }
}
