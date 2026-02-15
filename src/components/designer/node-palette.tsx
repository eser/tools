import { useState } from "react";
import { Input } from "@/components/ui/input.tsx";
import { CATEGORY_COLORS } from "@/lib/graph-types.ts";
import { SearchIcon, GripVerticalIcon } from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface PaletteTool {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface NodePaletteProps {
  tools: PaletteTool[];
}

export function NodePalette({ tools }: NodePaletteProps) {
  const [search, setSearch] = useState("");

  const query = search.toLowerCase().trim();
  const filtered = query === ""
    ? tools
    : tools.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query),
      );

  const grouped = new Map<string, PaletteTool[]>();
  for (const tool of filtered) {
    const list = grouped.get(tool.category) ?? [];
    list.push(tool);
    grouped.set(tool.category, list);
  }

  return (
    <div className="w-56 border-r border-border bg-background flex flex-col h-full">
      <div className="p-3">
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools..."
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No tools match your search.
          </p>
        ) : (
          Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category} className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: CATEGORY_COLORS[category] ?? "#6b7280",
                  }}
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {category}
                </span>
              </div>

              <div className="space-y-1">
                {items.map((tool) => (
                  <div
                    key={tool.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/pipeline-tool",
                        tool.id,
                      );
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md",
                      "text-xs text-foreground cursor-grab active:cursor-grabbing",
                      "hover:bg-muted transition-colors",
                    )}
                    title={tool.description}
                  >
                    <GripVerticalIcon className="size-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{tool.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
