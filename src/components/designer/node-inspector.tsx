import { useMemo } from "react";
import type { ToolNodeData } from "@/lib/graph-types.ts";
import type { JsonSchema } from "@/lib/json-schema.ts";
import { SchemaForm } from "@/components/schema-form.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { CATEGORY_COLORS } from "@/lib/graph-types.ts";
import { XIcon, UnlinkIcon, Link2Icon } from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface NodeInspectorProps {
  nodeId: string;
  data: ToolNodeData;
  /** Port keys that have a stored edge and can be reconnected */
  reconnectableKeys: string[];
  onInputChange: (nodeId: string, values: Record<string, unknown>) => void;
  onDisconnect: (nodeId: string, portKey: string) => void;
  onReconnect: (nodeId: string, portKey: string) => void;
  onClose: () => void;
}

export function NodeInspector({
  nodeId,
  data,
  reconnectableKeys,
  onInputChange,
  onDisconnect,
  onReconnect,
  onClose,
}: NodeInspectorProps) {
  const connectedKeys = Array.from(data.connectedInputs);
  const reconnectableSet = new Set(reconnectableKeys);
  const categoryColor = CATEGORY_COLORS[data.category] ?? "#6b7280";

  // All keys that appear in the wiring section, ordered by input port definition
  const wiringKeys = useMemo(() => {
    const keys = new Set([...connectedKeys, ...reconnectableKeys]);
    // Sort by the input port order from the schema
    const portOrder = data.inputPorts.map((p) => p.key);
    return portOrder.filter((k) => keys.has(k));
  }, [connectedKeys, reconnectableKeys, data.inputPorts]);

  // Filter out connected fields from the schema so they don't appear in the form
  const filteredSchema = useMemo<JsonSchema>(() => {
    if (!data.inputSchema.properties || connectedKeys.length === 0) {
      return data.inputSchema;
    }

    const filtered: Record<string, (typeof data.inputSchema.properties)[string]> = {};
    for (const [key, prop] of Object.entries(data.inputSchema.properties)) {
      if (!data.connectedInputs.has(key)) {
        filtered[key] = prop;
      }
    }

    return {
      ...data.inputSchema,
      properties: filtered,
      required: data.inputSchema.required?.filter(
        (r) => !data.connectedInputs.has(r),
      ),
    };
  }, [data.inputSchema, data.connectedInputs, connectedKeys.length]);

  const hasUnconnectedFields = Object.keys(filteredSchema.properties ?? {}).length > 0;

  return (
    <div className="w-72 border-l border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-3 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground truncate">
            {data.toolName}
          </h3>
          <Badge
            variant="outline"
            className="mt-1 text-[10px]"
            style={{ borderColor: categoryColor, color: categoryColor }}
          >
            {data.category}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>

      {/* Wiring section: connected + reconnectable inputs */}
      {wiringKeys.length > 0 && (
        <div className="px-3 py-2 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Connected Inputs
          </p>
          <div className="space-y-1">
            {wiringKeys.map((key) => {
              const isConnected = data.connectedInputs.has(key);
              const canReconnect = reconnectableSet.has(key);

              return (
                <div
                  key={key}
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    "px-2 py-1 rounded",
                    isConnected
                      ? "bg-muted text-foreground"
                      : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  <span className="flex-1 truncate">{key}</span>
                  {isConnected ? (
                    <button
                      type="button"
                      title={`Disconnect ${key}`}
                      className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors"
                      onClick={() => onDisconnect(nodeId, key)}
                    >
                      <UnlinkIcon className="size-3" />
                    </button>
                  ) : canReconnect ? (
                    <button
                      type="button"
                      title={`Reconnect ${key}`}
                      className="shrink-0 text-muted-foreground hover:text-emerald-400 transition-colors"
                      onClick={() => onReconnect(nodeId, key)}
                    >
                      <Link2Icon className="size-3" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Form */}
      {hasUnconnectedFields && (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Input Values
          </p>
          <SchemaForm
            schema={filteredSchema}
            value={JSON.stringify(data.inputValues, null, 2)}
            onChange={(json: string) => {
              try {
                const parsed = JSON.parse(json) as Record<string, unknown>;
                onInputChange(nodeId, parsed);
              } catch {
                // Ignore invalid JSON while user is typing
              }
            }}
          />
        </div>
      )}

      {/* Description */}
      {data.description !== "" && (
        <div className="px-3 py-2 border-t border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Description
          </p>
          <p className="text-xs text-muted-foreground">{data.description}</p>
        </div>
      )}
    </div>
  );
}
