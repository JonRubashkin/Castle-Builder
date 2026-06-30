import { useStore } from "../../store/store";
import type { MaterialRef, PatternId, Tower } from "../../store/schema";
import { PATTERN_IDS } from "../../materials/patterns";

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

// Sensible default two-tone palettes when switching a tower into a pattern fill.
const PATTERN_DEFAULTS: Record<PatternId, { colorA: string; colorB: string }> = {
  stone: { colorA: "#9a958c", colorB: "#5b564e" },
  brick: { colorA: "#9b4b3b", colorB: "#6e3328" },
  thatch: { colorA: "#c8a24b", colorB: "#7c5a23" },
  water: { colorA: "#2f6f9f", colorB: "#1b4a6b" },
};

type FillOption = "solid" | PatternId;

function MaterialControl({
  material,
  onChange,
}: {
  material: MaterialRef;
  onChange: (m: MaterialRef) => void;
}) {
  const fill: FillOption = material.kind === "solid" ? "solid" : material.pattern;

  const selectFill = (next: FillOption) => {
    if (next === "solid") {
      const seed = material.kind === "solid" ? material.color : material.colorA;
      onChange({ kind: "solid", color: seed });
    } else {
      const def = PATTERN_DEFAULTS[next];
      // Preserve the user's colors when already on a pattern; else seed defaults.
      if (material.kind === "pattern") {
        onChange({ kind: "pattern", pattern: next, colorA: material.colorA, colorB: material.colorB });
      } else {
        onChange({ kind: "pattern", pattern: next, ...def });
      }
    }
  };

  return (
    <div className="panel__material">
      <label className="panel__field">
        <span>Fill</span>
        <select
          aria-label="Fill"
          value={fill}
          onChange={(e) => selectFill(e.target.value as FillOption)}
        >
          <option value="solid">Solid</option>
          {PATTERN_IDS.map((id) => (
            <option key={id} value={id}>
              {id[0].toUpperCase() + id.slice(1)}
            </option>
          ))}
        </select>
      </label>

      {material.kind === "solid" ? (
        <label className="panel__field">
          <span>Color</span>
          <input
            type="color"
            aria-label="Color"
            value={material.color}
            onChange={(e) => onChange({ kind: "solid", color: e.target.value })}
          />
        </label>
      ) : (
        <>
          <label className="panel__field">
            <span>Color A</span>
            <input
              type="color"
              aria-label="Color A"
              value={material.colorA}
              onChange={(e) =>
                onChange({ ...material, colorA: e.target.value })
              }
            />
          </label>
          <label className="panel__field">
            <span>Color B</span>
            <input
              type="color"
              aria-label="Color B"
              value={material.colorB}
              onChange={(e) =>
                onChange({ ...material, colorB: e.target.value })
              }
            />
          </label>
        </>
      )}
    </div>
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

      <label className="panel__field panel__field--check">
        <span>Crenellated</span>
        <input
          type="checkbox"
          aria-label="Crenellated"
          checked={tower.crenellated}
          onChange={(e) =>
            updatePiece(tower.id, { crenellated: e.target.checked })
          }
        />
      </label>

      {tower.crenellated && (
        <NumberField
          label="Merlon size"
          value={tower.merlonSize}
          min={0.1}
          step={0.1}
          onCommit={(v) => updatePiece(tower.id, { merlonSize: v })}
        />
      )}

      <MaterialControl
        material={tower.material}
        onChange={(m) => updatePiece(tower.id, { material: m })}
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
