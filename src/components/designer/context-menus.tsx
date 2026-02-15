import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";
import {
  CopyIcon,
  Trash2Icon,
  EyeOffIcon,
  EyeIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  PencilIcon,
  MousePointerClickIcon,
  MaximizeIcon,
  LayoutGridIcon,
  ScissorsIcon,
  PaletteIcon,
  CheckIcon,
  XIcon,
  PlugIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

// ---------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------

const popupClassName =
  "bg-popover text-popover-foreground min-w-32 rounded-md p-1 shadow-md ring-1 ring-foreground/10 z-50 overflow-hidden";

const itemClassName =
  "focus:bg-accent focus:text-accent-foreground gap-2 rounded-sm px-2 py-1.5 text-sm relative flex cursor-default items-center outline-hidden select-none [&_svg]:size-4 [&_svg]:shrink-0";

const destructiveClassName = "text-destructive focus:bg-destructive/10";

const separatorClassName = "bg-border -mx-1 my-1 h-px";

// ---------------------------------------------------------------
// Virtual anchor helper
// ---------------------------------------------------------------

function virtualAnchor(x: number, y: number) {
  return {
    getBoundingClientRect: () => ({
      x,
      y,
      width: 0,
      height: 0,
      top: y,
      right: x,
      bottom: y,
      left: x,
      toJSON: () => ({}),
    }),
  };
}

// ---------------------------------------------------------------
// Color presets for node coloring
// ---------------------------------------------------------------

const COLOR_PRESETS = [
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Yellow", value: "#eab308" },
  { label: "Green", value: "#22c55e" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Purple", value: "#a855f7" },
  { label: "Pink", value: "#ec4899" },
  { label: "Cyan", value: "#06b6d4" },
];

// ---------------------------------------------------------------
// 1. CanvasContextMenu
// ---------------------------------------------------------------

interface CanvasContextMenuProps {
  position: { x: number; y: number };
  open: boolean;
  onClose: () => void;
  onSelectAll: () => void;
  onFitView: () => void;
  onAutoLayout: () => void;
  onClear: () => void;
}

export function CanvasContextMenu({
  position,
  open,
  onClose,
  onSelectAll,
  onFitView,
  onAutoLayout,
  onClear,
}: CanvasContextMenuProps) {
  return (
    <MenuPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      modal={false}
    >
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner
          anchor={virtualAnchor(position.x, position.y)}
          className="isolate z-50"
        >
          <MenuPrimitive.Popup className={popupClassName}>
            <MenuPrimitive.Item className={itemClassName} onClick={onSelectAll}>
              <MousePointerClickIcon className="size-4" />
              Select All
            </MenuPrimitive.Item>

            <MenuPrimitive.Separator className={separatorClassName} />

            <MenuPrimitive.Item className={itemClassName} onClick={onFitView}>
              <MaximizeIcon className="size-4" />
              Fit View
            </MenuPrimitive.Item>

            <MenuPrimitive.Item
              className={itemClassName}
              onClick={onAutoLayout}
            >
              <LayoutGridIcon className="size-4" />
              Auto Layout
            </MenuPrimitive.Item>

            <MenuPrimitive.Separator className={separatorClassName} />

            <MenuPrimitive.Item
              className={cn(itemClassName, destructiveClassName)}
              onClick={onClear}
            >
              <Trash2Icon className="size-4" />
              Clear Canvas
            </MenuPrimitive.Item>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

// ---------------------------------------------------------------
// 2. NodeContextMenu
// ---------------------------------------------------------------

interface NodeContextMenuProps {
  position: { x: number; y: number };
  open: boolean;
  onClose: () => void;
  nodeId: string;
  isBypassed: boolean;
  isCollapsed: boolean;
  customColor?: string;
  onClone: () => void;
  onDelete: () => void;
  onToggleBypass: () => void;
  onToggleCollapse: () => void;
  onSetColor: (color: string | undefined) => void;
  onRename: () => void;
}

export function NodeContextMenu({
  position,
  open,
  onClose,
  nodeId: _nodeId,
  isBypassed,
  isCollapsed,
  customColor,
  onClone,
  onDelete,
  onToggleBypass,
  onToggleCollapse,
  onSetColor,
  onRename,
}: NodeContextMenuProps) {
  return (
    <MenuPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      modal={false}
    >
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner
          anchor={virtualAnchor(position.x, position.y)}
          className="isolate z-50"
        >
          <MenuPrimitive.Popup className={popupClassName}>
            <MenuPrimitive.Item className={itemClassName} onClick={onClone}>
              <CopyIcon className="size-4" />
              Clone
            </MenuPrimitive.Item>

            <MenuPrimitive.Item
              className={cn(itemClassName, destructiveClassName)}
              onClick={onDelete}
            >
              <Trash2Icon className="size-4" />
              Delete
            </MenuPrimitive.Item>

            <MenuPrimitive.Separator className={separatorClassName} />

            <MenuPrimitive.Item
              className={itemClassName}
              onClick={onToggleBypass}
            >
              {isBypassed ? (
                <EyeIcon className="size-4" />
              ) : (
                <EyeOffIcon className="size-4" />
              )}
              <span className="flex-1">Bypass</span>
              {isBypassed && <CheckIcon className="size-4 ml-auto" />}
            </MenuPrimitive.Item>

            <MenuPrimitive.Item
              className={itemClassName}
              onClick={onToggleCollapse}
            >
              {isCollapsed ? (
                <ChevronRightIcon className="size-4" />
              ) : (
                <ChevronDownIcon className="size-4" />
              )}
              {isCollapsed ? "Expand" : "Collapse"}
            </MenuPrimitive.Item>

            <MenuPrimitive.Separator className={separatorClassName} />

            <MenuPrimitive.Item className={itemClassName} onClick={onRename}>
              <PencilIcon className="size-4" />
              Rename
            </MenuPrimitive.Item>

            <MenuPrimitive.Separator className={separatorClassName} />

            {/* Color picker inline grid */}
            <MenuPrimitive.Group>
              <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
                <PaletteIcon className="size-4 shrink-0" />
                Color
              </div>
              <div className="px-2 pb-1.5 flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.label}
                    className={cn(
                      "size-5 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                      customColor === preset.value
                        ? "border-foreground"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: preset.value }}
                    onClick={() => {
                      onSetColor(preset.value);
                      onClose();
                    }}
                  />
                ))}
                <button
                  type="button"
                  title="Reset"
                  className={cn(
                    "size-5 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 flex items-center justify-center bg-muted",
                    !customColor
                      ? "border-foreground"
                      : "border-transparent",
                  )}
                  onClick={() => {
                    onSetColor(undefined);
                    onClose();
                  }}
                >
                  <XIcon className="size-3 text-muted-foreground" />
                </button>
              </div>
            </MenuPrimitive.Group>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

// ---------------------------------------------------------------
// 3. EdgeContextMenu
// ---------------------------------------------------------------

interface EdgeContextMenuProps {
  position: { x: number; y: number };
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function EdgeContextMenu({
  position,
  open,
  onClose,
  onDelete,
}: EdgeContextMenuProps) {
  return (
    <MenuPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      modal={false}
    >
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner
          anchor={virtualAnchor(position.x, position.y)}
          className="isolate z-50"
        >
          <MenuPrimitive.Popup className={popupClassName}>
            <MenuPrimitive.Item
              className={cn(itemClassName, destructiveClassName)}
              onClick={onDelete}
            >
              <ScissorsIcon className="size-4" />
              Delete Edge
            </MenuPrimitive.Item>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

// ---------------------------------------------------------------
// 4. PortContextMenu (Convert to Input / Convert to Widget)
// ---------------------------------------------------------------

interface PortContextMenuProps {
  position: { x: number; y: number };
  open: boolean;
  onClose: () => void;
  mode: "to-input" | "to-widget";
  onConvert: () => void;
}

export function PortContextMenu({
  position,
  open,
  onClose,
  mode,
  onConvert,
}: PortContextMenuProps) {
  return (
    <MenuPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      modal={false}
    >
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner
          anchor={virtualAnchor(position.x, position.y)}
          className="isolate z-50"
        >
          <MenuPrimitive.Popup className={popupClassName}>
            <MenuPrimitive.Item className={itemClassName} onClick={onConvert}>
              {mode === "to-input" ? (
                <>
                  <PlugIcon className="size-4" />
                  Convert to Input
                </>
              ) : (
                <>
                  <SlidersHorizontalIcon className="size-4" />
                  Convert to Widget
                </>
              )}
            </MenuPrimitive.Item>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
