import { useEffect } from "react";
import { Scene } from "./components/preview/Scene";
import { Toolbar } from "./components/ui/Toolbar";
import { PiecePanel } from "./components/ui/PiecePanel";
import { PlacementModeTabs } from "./components/ui/PlacementModeTabs";
import { PlaceOnTopHint } from "./components/ui/PlaceOnTopHint";
import { FileBar } from "./components/ui/FileBar";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useAutosave } from "./hooks/useAutosave";
import { useStore } from "./store/store";
import { installE2EAccessor } from "./store/testAccessor";

/**
 * The editor tree. It is keyed on the store's `bootNonce` (see App) so a
 * "New Castle" reset fully REMOUNTS a clean tree — clearing all component-local
 * transient state (in-progress placement drafts, drag refs) along with the
 * store-level reset, so nothing dangles a reference to a now-gone piece.
 */
function Editor() {
  return (
    <>
      <header className="app__header">
        <h1>Castle Builder</h1>
        <Toolbar />
      </header>
      <div className="app__body">
        <main className="app__viewport">
          <Scene />
          {/* Placement-mode toggle tabs — right side of the viewport, shown only
              while a piece is selected. */}
          <PlacementModeTabs />
          {/* A banner shown while the "Place on top" one-shot is armed. */}
          <PlaceOnTopHint />
        </main>
        <PiecePanel />
      </div>
      <FileBar />
    </>
  );
}

export function App() {
  // App owns the doc-lifecycle hooks (autosave, shortcuts, the e2e accessor) and
  // stays mounted across a reset; only the Editor subtree remounts on bootNonce.
  // Keeping useAutosave mounted is deliberate: remounting it would re-run its
  // load-from-storage on every reset and could race the old design back in.
  const bootNonce = useStore((s) => s.bootNonce);
  useKeyboardShortcuts();
  useAutosave();

  useEffect(() => {
    installE2EAccessor();
  }, []);

  return (
    <div className="app">
      <Editor key={bootNonce} />
    </div>
  );
}
