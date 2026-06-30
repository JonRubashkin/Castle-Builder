import { useStore } from "../../store/store";
import type { Tower } from "../../store/schema";

function NumberField({
  label,
  value,
  min,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  onCommit: (v: number) => void;
}) {
  return (
    <label className="panel__field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= min) onCommit(v);
        }}
      />
      <span className="panel__unit">m</span>
    </label>
  );
}

export function PiecePanel() {
  const selectedId = useStore((s) => s.selectedId);
  const piece = useStore((s) =>
    s.design.pieces.find((p) => p.id === s.selectedId),
  );
  const updatePiece = useStore((s) => s.updatePiece);
  const deletePiece = useStore((s) => s.deletePiece);

  if (!selectedId || !piece || piece.kind !== "tower") {
    return (
      <aside className="panel panel--empty" aria-label="Selection">
        <p className="panel__hint">
          Select a piece to edit it. With the Tower tool, click the ground to
          place a tower.
        </p>
      </aside>
    );
  }

  const tower = piece as Tower;
  const radiusLabel = tower.profile === "round" ? "Radius" : "Half-extent";

  return (
    <aside className="panel" aria-label="Tower properties" data-piece-id={tower.id}>
      <h2 className="panel__title">Tower</h2>

      <label className="panel__field">
        <span>Profile</span>
        <select
          value={tower.profile}
          onChange={(e) =>
            updatePiece(tower.id, {
              profile: e.target.value as Tower["profile"],
            })
          }
        >
          <option value="round">Round</option>
          <option value="square">Square</option>
        </select>
      </label>

      <NumberField
        label={radiusLabel}
        value={tower.radius}
        min={0.2}
        step={0.1}
        onCommit={(v) => updatePiece(tower.id, { radius: v })}
      />
      <NumberField
        label="Height"
        value={tower.height}
        min={0.5}
        step={0.5}
        onCommit={(v) => updatePiece(tower.id, { height: v })}
      />

      <button
        type="button"
        className="panel__delete"
        onClick={() => deletePiece(tower.id)}
      >
        Delete tower
      </button>
    </aside>
  );
}
