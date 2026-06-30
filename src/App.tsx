import { useEffect } from "react";
import { Scene } from "./components/preview/Scene";
import { Toolbar } from "./components/ui/Toolbar";
import { PiecePanel } from "./components/ui/PiecePanel";
import { FileBar } from "./components/ui/FileBar";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useAutosave } from "./hooks/useAutosave";
import { installE2EAccessor } from "./store/testAccessor";

export function App() {
  useKeyboardShortcuts();
  useAutosave();

  useEffect(() => {
    installE2EAccessor();
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Castle Builder</h1>
        <Toolbar />
      </header>
      <div className="app__body">
        <main className="app__viewport">
          <Scene />
        </main>
        <PiecePanel />
      </div>
      <FileBar />
    </div>
  );
}
