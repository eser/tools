import { useEffect, useRef } from "react";

export interface KeyboardShortcutActions {
  deleteSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;
  undo: () => void;
  redo: () => void;
  selectAll: () => void;
  toggleBypass: () => void;
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function useKeyboardShortcuts(
  actions: KeyboardShortcutActions,
  enabled = true,
): void {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;

      if (
        EDITABLE_TAGS.has(target.tagName) ||
        target.contentEditable === "true"
      ) {
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (key === "delete" || key === "backspace") {
        event.preventDefault();
        actionsRef.current.deleteSelected();
        return;
      }

      if (mod && key === "c") {
        event.preventDefault();
        actionsRef.current.copySelected();
        return;
      }

      if (mod && key === "v") {
        event.preventDefault();
        actionsRef.current.pasteClipboard();
        return;
      }

      if (mod && key === "d") {
        event.preventDefault();
        actionsRef.current.duplicateSelected();
        return;
      }

      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        actionsRef.current.undo();
        return;
      }

      if ((mod && key === "z" && event.shiftKey) || (mod && key === "y")) {
        event.preventDefault();
        actionsRef.current.redo();
        return;
      }

      if (mod && key === "a") {
        event.preventDefault();
        actionsRef.current.selectAll();
        return;
      }

      if (!mod && !event.shiftKey && !event.altKey && key === "m") {
        actionsRef.current.toggleBypass();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled]);
}
