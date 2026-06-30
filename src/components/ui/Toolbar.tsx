import { useStore, type Tool } from "../../store/store";

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "select", label: "Select", hint: "Pick, move, and edit pieces" },
  { id: "tower", label: "Tower", hint: "Click the ground to place a tower" },
];

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const canUndo = useStore((s) => s.history.past.length > 0);
  const canRedo = useStore((s) => s.history.future.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

  return (
    <div className="toolbar" role="toolbar" aria-label="Tools">
      <div className="toolbar__group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tool === t.id ? "toolbar__btn is-active" : "toolbar__btn"}
            aria-pressed={tool === t.id}
            title={t.hint}
            data-tool={t.id}
            onClick={() => setTool(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="toolbar__group">
        <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
      </div>
    </div>
  );
}
