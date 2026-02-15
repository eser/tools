import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils.ts";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  PlayIcon,
  SaveIcon,
  FolderOpenIcon,
  LayoutGridIcon,
  MaximizeIcon,
  SplineIcon,
  MinusIcon,
  ArrowRightIcon,
  SearchIcon,
} from "lucide-react";
import { listSavedPipelines } from "@/server/functions.ts";
import type { SavedPipelineSummary } from "@/tools/pipeline-store/schema.ts";
import type { LinkMode } from "./typed-edge.tsx";

export interface PipelineMeta {
  name: string;
  slug: string;
  description: string;
}

interface DesignerToolbarProps {
  pipelineMeta: PipelineMeta;
  onMetaChange: (meta: PipelineMeta) => void;
  onRun: () => void;
  onSave: () => void;
  onLoad: (pipelineId: string) => void;
  onAutoLayout: () => void;
  onFitView: () => void;
  loading: boolean;
  saving: boolean;
  linkMode: LinkMode;
  onLinkModeChange: (mode: LinkMode) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

// ---------------------------------------------------------------
// Auto-growing input using the hidden-span trick
// ---------------------------------------------------------------

function AutoGrowInput(props: React.ComponentProps<typeof Input>) {
  const { value, placeholder, className, ...rest } = props;
  const display = (value as string) || placeholder || "";

  return (
    <div className="relative inline-grid items-center">
      {/* Invisible sizer — determines width */}
      <span
        className={cn(
          "invisible whitespace-pre col-start-1 row-start-1 px-3",
          className,
        )}
      >
        {display}
        {/* Extra space so the cursor doesn't bump against the edge */}
        {"\u200B"}
      </span>
      <Input
        value={value}
        placeholder={placeholder}
        className={cn("col-start-1 row-start-1 w-full min-w-16", className)}
        {...rest}
      />
    </div>
  );
}

// ---------------------------------------------------------------
// Pipeline load popover
// ---------------------------------------------------------------

function LoadPopover({
  anchorRef,
  onSelect,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [pipelines, setPipelines] = useState<SavedPipelineSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch pipelines on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    listSavedPipelines()
      .then((list) => {
        if (!cancelled) setPipelines(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Auto-focus search
  useEffect(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = pipelines.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  });

  // Position below anchor, aligned to right edge
  const rect = anchorRef.current?.getBoundingClientRect();
  const top = (rect?.bottom ?? 0) + 4;
  const right = window.innerWidth - (rect?.right ?? 0);

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] w-72 rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
      style={{ top, right }}
    >
      {/* Search */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
        <SearchIcon className="size-3.5 text-muted-foreground shrink-0" />
        <input
          ref={searchRef}
          type="text"
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          placeholder="Search pipelines..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="max-h-64 overflow-y-auto">
        {loadingList && (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
            Loading...
          </div>
        )}
        {!loadingList && filtered.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
            {pipelines.length === 0
              ? "No saved pipelines"
              : "No matches"}
          </div>
        )}
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border/50 last:border-b-0"
            onClick={() => {
              onSelect(p.id);
              onClose();
            }}
          >
            <div className="text-xs font-medium text-foreground truncate">
              {p.name}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {p.id}
              {p.description ? ` — ${p.description}` : ""}
            </div>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------

export function DesignerToolbar({
  pipelineMeta,
  onMetaChange,
  onRun,
  onSave,
  onLoad,
  onAutoLayout,
  onFitView,
  loading,
  saving,
  linkMode,
  onLinkModeChange,
}: DesignerToolbarProps) {
  const [loadOpen, setLoadOpen] = useState(false);
  const loadBtnRef = useRef<HTMLButtonElement>(null);

  const handleLoadSelect = useCallback(
    (pipelineId: string) => {
      onLoad(pipelineId);
    },
    [onLoad],
  );

  return (
    <div className="flex items-center justify-between px-4 py-2 h-11 bg-card border-b border-border">
      {/* Left: pipeline name + slug */}
      <div className="flex items-center gap-2">
        <AutoGrowInput
          value={pipelineMeta.name}
          onChange={(e) => {
            const name = e.target.value;
            onMetaChange({
              ...pipelineMeta,
              name,
              slug: slugify(name),
            });
          }}
          placeholder="Pipeline name"
          className="h-7 max-w-56 text-xs"
        />
        <AutoGrowInput
          value={pipelineMeta.slug}
          onChange={(e) =>
            onMetaChange({ ...pipelineMeta, slug: e.target.value })
          }
          placeholder="slug"
          className="h-7 max-w-44 text-xs font-mono"
        />
      </div>

      {/* Center: link mode */}
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5">
        {([
          { mode: "bezier" as LinkMode, icon: SplineIcon, title: "Spline" },
          { mode: "straight" as LinkMode, icon: MinusIcon, title: "Straight" },
          { mode: "step" as LinkMode, icon: ArrowRightIcon, title: "Linear" },
        ]).map(({ mode, icon: Icon, title }) => (
          <button
            key={mode}
            type="button"
            title={title}
            className={`rounded px-1.5 py-1 ${linkMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => onLinkModeChange(mode)}
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>

      {/* Right: action buttons — Fit View, Auto Layout, Load, Save, Run */}
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon-sm" onClick={onFitView} title="Fit view">
          <MaximizeIcon className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onAutoLayout} title="Auto layout">
          <LayoutGridIcon className="size-3.5" />
        </Button>

        <div className="w-px h-5 bg-border" />

        <Button
          ref={loadBtnRef}
          variant="outline"
          size="sm"
          onClick={() => setLoadOpen((v) => !v)}
          title="Load pipeline"
        >
          <FolderOpenIcon className="size-3.5" />
          Load
        </Button>
        {loadOpen && (
          <LoadPopover
            anchorRef={loadBtnRef}
            onSelect={handleLoadSelect}
            onClose={() => setLoadOpen(false)}
          />
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={saving}
        >
          <SaveIcon className="size-3.5" />
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onRun}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <PlayIcon className="size-3.5" />
          {loading ? "Running..." : "Run"}
        </Button>
      </div>
    </div>
  );
}
