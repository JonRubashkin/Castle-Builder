import { useEffect } from "react";
import { useStore } from "../store/store";
import { loadAutosave, saveAutosave } from "../persistence/storage";

/**
 * Loads the autosaved design on mount, then writes the design back (debounced)
 * whenever it changes. One slot, last-write-wins.
 */
export function useAutosave(): void {
  useEffect(() => {
    const restored = loadAutosave();
    if (restored && restored.pieces.length > 0) {
      useStore.getState().loadDesign(restored);
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSaved = useStore.getState().design;

    const unsubscribe = useStore.subscribe((state) => {
      if (state.design === lastSaved) return;
      lastSaved = state.design;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => saveAutosave(lastSaved), 250);
    });

    // Flush any pending save before the page goes away (reload/close), so the
    // latest design always survives a reload.
    const flush = () => {
      if (timer) clearTimeout(timer);
      saveAutosave(useStore.getState().design);
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
      unsubscribe();
    };
  }, []);
}
