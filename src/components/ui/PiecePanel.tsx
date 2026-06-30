import { useStore } from "../../store/store";
import type {
  Gate,
  Gatehouse,
  MaterialRef,
  Moat,
  PatternId,
  Piece,
  Tower,
  WallRun,
} from "../../store/schema";
import { PATTERN_IDS } from "../../materials/patterns";
import { snapRotation } from "../../geometry/grid";

function NumberField({
  label,
  value,
  min,
  step,
  unit = "m",
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  unit?: string;
  onCommit: (v: number) => void;
}) {
  return (
    <label className="panel__field">
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        min={Number.isFinite(min) ? min : undefined}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= min) onCommit(v);
        }}
      />
      <span className="panel__unit">{unit}</span>
    </label>
  );
}

/** Rotation about Y, snapped to 15° steps on commit (the schema's rotation grid). */
function RotationField({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (deg: number) => void;
}) {
  return (
    <label className="panel__field">
      <span>Rotation</span>
      <input
        type="number"
        aria-label="Rotation"
        step={15}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onCommit(snapRotation(v));
        }}
      />
      <span className="panel__unit">°</span>
    </label>
  );
}

// Sensible default two-tone palettes when switching into a pattern fill.
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
              onChange={(e) => onChange({ ...material, colorA: e.target.value })}
            />
          </label>
          <label className="panel__field">
            <span>Color B</span>
            <input
              type="color"
              aria-label="Color B"
              value={material.colorB}
              onChange={(e) => onChange({ ...material, colorB: e.target.value })}
            />
          </label>
        </>
      )}
    </div>
  );
}

/** The shared crenellations toggle + (when on) the merlon-size field. */
function CrenellationFields({
  crenellated,
  merlonSize,
  onToggle,
  onMerlonSize,
}: {
  crenellated: boolean;
  merlonSize: number;
  onToggle: (v: boolean) => void;
  onMerlonSize: (v: number) => void;
}) {
  return (
    <>
      <label className="panel__field panel__field--check">
        <span>Crenellated</span>
        <input
          type="checkbox"
          aria-label="Crenellated"
          checked={crenellated}
          onChange={(e) => onToggle(e.target.checked)}
        />
      </label>
      {crenellated && (
        <NumberField
          label="Merlon size"
          value={merlonSize}
          min={0.1}
          step={0.1}
          onCommit={onMerlonSize}
        />
      )}
    </>
  );
}

function TowerPanel({ tower }: { tower: Tower }) {
  const updatePiece = useStore((s) => s.updatePiece);
  const deletePiece = useStore((s) => s.deletePiece);
  const radiusLabel = tower.profile === "round" ? "Radius" : "Half-extent";

  return (
    <aside className="panel" aria-label="Tower properties" data-piece-id={tower.id}>
      <h2 className="panel__title">Tower</h2>

      <label className="panel__field">
        <span>Profile</span>
        <select
          value={tower.profile}
          onChange={(e) =>
            updatePiece(tower.id, { profile: e.target.value as Tower["profile"] })
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
      <RotationField
        value={tower.rotation}
        onCommit={(deg) => updatePiece(tower.id, { rotation: deg })}
      />

      <CrenellationFields
        crenellated={tower.crenellated}
        merlonSize={tower.merlonSize}
        onToggle={(v) => updatePiece(tower.id, { crenellated: v })}
        onMerlonSize={(v) => updatePiece(tower.id, { merlonSize: v })}
      />

      <MaterialControl
        material={tower.material}
        onChange={(m) => updatePiece(tower.id, { material: m })}
      />

      <button type="button" className="panel__delete" onClick={() => deletePiece(tower.id)}>
        Delete tower
      </button>
    </aside>
  );
}

function GatehousePanel({ gatehouse }: { gatehouse: Gatehouse }) {
  const updatePiece = useStore((s) => s.updatePiece);
  const deletePiece = useStore((s) => s.deletePiece);

  return (
    <aside
      className="panel"
      aria-label="Gatehouse properties"
      data-piece-id={gatehouse.id}
    >
      <h2 className="panel__title">Gatehouse</h2>

      <NumberField
        label="Width"
        value={gatehouse.width}
        min={0.5}
        step={0.1}
        onCommit={(v) => updatePiece(gatehouse.id, { width: v })}
      />
      <NumberField
        label="Depth"
        value={gatehouse.depth}
        min={0.5}
        step={0.1}
        onCommit={(v) => updatePiece(gatehouse.id, { depth: v })}
      />
      <NumberField
        label="Height"
        value={gatehouse.height}
        min={0.5}
        step={0.5}
        onCommit={(v) => updatePiece(gatehouse.id, { height: v })}
      />
      <RotationField
        value={gatehouse.rotation}
        onCommit={(deg) => updatePiece(gatehouse.id, { rotation: deg })}
      />

      <CrenellationFields
        crenellated={gatehouse.crenellated}
        merlonSize={gatehouse.merlonSize}
        onToggle={(v) => updatePiece(gatehouse.id, { crenellated: v })}
        onMerlonSize={(v) => updatePiece(gatehouse.id, { merlonSize: v })}
      />

      <MaterialControl
        material={gatehouse.material}
        onChange={(m) => updatePiece(gatehouse.id, { material: m })}
      />

      <button
        type="button"
        className="panel__delete"
        onClick={() => deletePiece(gatehouse.id)}
      >
        Delete gatehouse
      </button>
    </aside>
  );
}

function WallRunPanel({ wall }: { wall: WallRun }) {
  const updatePiece = useStore((s) => s.updatePiece);
  const setWallEndpoint = useStore((s) => s.setWallEndpoint);
  const deletePiece = useStore((s) => s.deletePiece);
  const length = Math.hypot(wall.end.x - wall.position.x, wall.end.y - wall.position.y);

  return (
    <aside className="panel" aria-label="Wall properties" data-piece-id={wall.id}>
      <h2 className="panel__title">Wall</h2>
      <p className="panel__hint">Length {length.toFixed(2)} m</p>

      <NumberField
        label="Height"
        value={wall.height}
        min={0.5}
        step={0.5}
        onCommit={(v) => updatePiece(wall.id, { height: v })}
      />
      <NumberField
        label="Thickness"
        value={wall.thickness}
        min={0.1}
        step={0.1}
        onCommit={(v) => updatePiece(wall.id, { thickness: v })}
      />

      {/* Endpoint number fields — the dragging handles are the primary affordance
          (see WallRunMesh); these are the precise/keyboard path. Each routes
          through setWallEndpoint so the base re-resolves at the start anchor. */}
      <NumberField
        label="Start X"
        value={wall.position.x}
        min={-Infinity}
        step={0.1}
        onCommit={(v) => setWallEndpoint(wall.id, "start", { x: v, y: wall.position.y })}
      />
      <NumberField
        label="Start Z"
        value={wall.position.y}
        min={-Infinity}
        step={0.1}
        onCommit={(v) => setWallEndpoint(wall.id, "start", { x: wall.position.x, y: v })}
      />
      <NumberField
        label="End X"
        value={wall.end.x}
        min={-Infinity}
        step={0.1}
        onCommit={(v) => setWallEndpoint(wall.id, "end", { x: v, y: wall.end.y })}
      />
      <NumberField
        label="End Z"
        value={wall.end.y}
        min={-Infinity}
        step={0.1}
        onCommit={(v) => setWallEndpoint(wall.id, "end", { x: wall.end.x, y: v })}
      />

      <CrenellationFields
        crenellated={wall.crenellated}
        merlonSize={wall.merlonSize}
        onToggle={(v) => updatePiece(wall.id, { crenellated: v })}
        onMerlonSize={(v) => updatePiece(wall.id, { merlonSize: v })}
      />

      <MaterialControl
        material={wall.material}
        onChange={(m) => updatePiece(wall.id, { material: m })}
      />

      <button type="button" className="panel__delete" onClick={() => deletePiece(wall.id)}>
        Delete wall
      </button>
    </aside>
  );
}

function GatePanel({ gate }: { gate: Gate }) {
  const updatePiece = useStore((s) => s.updatePiece);
  const deletePiece = useStore((s) => s.deletePiece);

  return (
    <aside className="panel" aria-label="Gate properties" data-piece-id={gate.id}>
      <h2 className="panel__title">Gate</h2>
      <p className="panel__hint">
        A freestanding timber gate. Position it in a gatehouse archway or against
        a wall — it does not cut a real opening.
      </p>

      <NumberField
        label="Width"
        value={gate.width}
        min={0.3}
        step={0.1}
        onCommit={(v) => updatePiece(gate.id, { width: v })}
      />
      <NumberField
        label="Height"
        value={gate.height}
        min={0.5}
        step={0.1}
        onCommit={(v) => updatePiece(gate.id, { height: v })}
      />
      <RotationField
        value={gate.rotation}
        onCommit={(deg) => updatePiece(gate.id, { rotation: deg })}
      />

      <MaterialControl
        material={gate.material}
        onChange={(m) => updatePiece(gate.id, { material: m })}
      />

      <button type="button" className="panel__delete" onClick={() => deletePiece(gate.id)}>
        Delete gate
      </button>
    </aside>
  );
}

function MoatPanel({ moat }: { moat: Moat }) {
  const updatePiece = useStore((s) => s.updatePiece);
  const deletePiece = useStore((s) => s.deletePiece);

  return (
    <aside className="panel" aria-label="Moat properties" data-piece-id={moat.id}>
      <h2 className="panel__title">Moat</h2>
      <p className="panel__hint">
        Opaque water ({moat.shape}), seated flat at the ground.
      </p>

      {moat.shape === "ring" ? (
        <>
          <NumberField
            label="Outer radius"
            value={moat.outerRadius ?? 0}
            min={0.5}
            step={0.1}
            onCommit={(v) => updatePiece(moat.id, { outerRadius: v })}
          />
          <NumberField
            label="Inner radius"
            value={moat.innerRadius ?? 0}
            min={0}
            step={0.1}
            onCommit={(v) => updatePiece(moat.id, { innerRadius: v })}
          />
        </>
      ) : (
        <NumberField
          label="Width"
          value={moat.width ?? 0}
          min={0.2}
          step={0.1}
          onCommit={(v) => updatePiece(moat.id, { width: v })}
        />
      )}

      <MaterialControl
        material={moat.material}
        onChange={(m) => updatePiece(moat.id, { material: m })}
      />

      <button type="button" className="panel__delete" onClick={() => deletePiece(moat.id)}>
        Delete moat
      </button>
    </aside>
  );
}

/** The moat tool's ring/segment sub-mode (default ring), shown when the Moat tool
 *  is active and nothing is selected — the analog of the old project's
 *  wall/room sub-mode. */
function MoatToolOptions() {
  const moatShape = useStore((s) => s.moatShape);
  const setMoatShape = useStore((s) => s.setMoatShape);
  return (
    <aside className="panel" aria-label="Moat tool options">
      <h2 className="panel__title">Moat</h2>
      <p className="panel__hint">
        Choose a shape, then place. Ring: click once. Segment: click a start, then
        an end.
      </p>
      <div className="panel__submode" role="radiogroup" aria-label="Moat shape">
        <button
          type="button"
          className={moatShape === "ring" ? "toolbar__btn is-active" : "toolbar__btn"}
          aria-pressed={moatShape === "ring"}
          data-moat-shape="ring"
          onClick={() => setMoatShape("ring")}
        >
          Ring
        </button>
        <button
          type="button"
          className={moatShape === "segment" ? "toolbar__btn is-active" : "toolbar__btn"}
          aria-pressed={moatShape === "segment"}
          data-moat-shape="segment"
          onClick={() => setMoatShape("segment")}
        >
          Segment
        </button>
      </div>
    </aside>
  );
}

function EmptyPanel() {
  const tool = useStore((s) => s.tool);
  // The Moat tool surfaces its ring/segment sub-mode here when nothing is selected.
  if (tool === "moat") return <MoatToolOptions />;
  return (
    <aside className="panel panel--empty" aria-label="Selection">
      <p className="panel__hint">
        Select a piece to edit it. With a placement tool, click the ground to
        place a piece.
      </p>
    </aside>
  );
}

export function PiecePanel() {
  const piece = useStore((s) =>
    s.design.pieces.find((p) => p.id === s.selectedId),
  ) as Piece | undefined;

  if (!piece) return <EmptyPanel />;
  switch (piece.kind) {
    case "tower":
      return <TowerPanel tower={piece} />;
    case "gatehouse":
      return <GatehousePanel gatehouse={piece} />;
    case "wallRun":
      return <WallRunPanel wall={piece} />;
    case "gate":
      return <GatePanel gate={piece} />;
    case "moat":
      return <MoatPanel moat={piece} />;
    default:
      return <EmptyPanel />;
  }
}
