import { useEffect } from "react";
import { useStore } from "../store/store";
import { recordPointerDown } from "../components/preview/interaction";

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Global keyboard + pointer wiring: undo/redo, delete, escape, and recording the
 * pointer-down position used to tell a clean click from an orbit drag.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const store = useStore.getState();

      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        store.redo();
        return;
      }
      if (e.key === "Escape") {
        // While "Place on top" is armed, Esc cancels the action and leaves the
        // selection unchanged (it does NOT deselect).
        if (store.placeOnTopArmed) {
          store.cancelPlaceOnTop();
          return;
        }
        store.cancelTransient();
        store.selectPiece(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (isTextEntry(e.target)) return; // don't hijack panel inputs
        const id = store.selectedId;
        if (id) {
          e.preventDefault();
          store.deletePiece(id);
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      recordPointerDown(e.clientX, e.clientY);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);
}
