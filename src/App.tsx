import { useEffect } from "react";
import { Scene } from "./components/preview/Scene";
import { installE2EAccessor } from "./store/testAccessor";

export function App() {
  useEffect(() => {
    installE2EAccessor();
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Castle Builder</h1>
      </header>
      <div className="app__body">
        <main className="app__viewport">
          <Scene />
        </main>
      </div>
    </div>
  );
}
