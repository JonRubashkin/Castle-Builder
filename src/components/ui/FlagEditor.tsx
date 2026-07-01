// The flag design editor (phase 2Fc) — a modal that edits a selected flag's
// EMBEDDED FlagDesign. It operates on a WORKING COPY in local state: every control
// (and the drag-on-preview) mutates the working design through the pure editorOps,
// the live preview re-renders it via the SAME 2Fa renderFlag the world cloth uses
// (so preview and placed flag can't drift), and only Apply commits — as ONE
// coalesced, undoable store edit (updateFlagDesign). Cancel / Esc / backdrop
// discard the working copy, leaving the flag unchanged.

import { useEffect, useRef, useState } from "react";
import type { Flag } from "../../store/schema";
import { useStore } from "../../store/store";
import { renderFlag } from "../../flags/renderFlag";
import { chargeTransform } from "../../flags/layout";
import { getSymbol } from "../../flags/symbols";
import { SYMBOL_IDS } from "../../flags/symbols/ids";
import type {
  FieldFill,
  FlagDesign,
  FlagLayer,
} from "../../flags/types";
import {
  addLayer,
  fieldColorCount,
  moveLayer,
  removeLayer,
  resizeColors,
  setAspect,
  updateLayer,
  type LayerKind,
} from "../../flags/editorOps";
import {
  chargeAtPoint,
  previewPixelToFlagCoord,
} from "../../flags/editorPicking";

const PREVIEW_HEIGHT = 220; // px — the preview canvas's intrinsic height

// --- small shared controls ---------------------------------------------------

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flag-editor__field">
      <span>{label}</span>
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flag-editor__field">
      <span>
        {label} <em>{value.toFixed(2)}</em>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

// --- per-layer editors -------------------------------------------------------

function FieldLayerEditor({
  fill,
  onChange,
}: {
  fill: FieldFill;
  onChange: (fill: FieldFill) => void;
}) {
  const colors = fill.kind === "solid" ? [fill.color] : fill.colors;

  const selectKind = (kind: "solid" | "division") => {
    if (kind === "solid") {
      onChange({ kind: "solid", color: colors[0] ?? "#3a6ea5" });
    } else {
      const next: FieldFill = { kind: "division", division: "perPale", colors: [] };
      onChange({ ...next, colors: resizeColors(colors, fieldColorCount(next)) });
    }
  };

  const selectDivision = (division: Extract<FieldFill, { kind: "division" }>["division"]) => {
    const next: FieldFill = { kind: "division", division, colors: [] };
    onChange({ ...next, colors: resizeColors(colors, fieldColorCount(next)) });
  };

  const setColor = (i: number, color: string) => {
    if (fill.kind === "solid") {
      onChange({ kind: "solid", color });
    } else {
      const nextColors = fill.colors.slice();
      nextColors[i] = color;
      onChange({ ...fill, colors: nextColors });
    }
  };

  return (
    <div className="flag-editor__layer-controls">
      <label className="flag-editor__field">
        <span>Field</span>
        <select
          aria-label="Field fill"
          value={fill.kind}
          onChange={(e) => selectKind(e.target.value as "solid" | "division")}
        >
          <option value="solid">Solid</option>
          <option value="division">Division</option>
        </select>
      </label>

      {fill.kind === "division" && (
        <label className="flag-editor__field">
          <span>Division</span>
          <select
            aria-label="Division"
            value={fill.division}
            onChange={(e) =>
              selectDivision(
                e.target.value as Extract<FieldFill, { kind: "division" }>["division"],
              )
            }
          >
            <option value="perPale">Per pale (vertical)</option>
            <option value="perFess">Per fess (horizontal)</option>
            <option value="perBend">Per bend (diagonal)</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </label>
      )}

      <div className="flag-editor__colors">
        {colors.map((c, i) => (
          <ColorField
            key={i}
            label={colors.length > 1 ? `Section ${i + 1}` : "Color"}
            value={c}
            onChange={(v) => setColor(i, v)}
          />
        ))}
      </div>
    </div>
  );
}

function StripesLayerEditor({
  layer,
  onChange,
}: {
  layer: Extract<FlagLayer, { kind: "stripes" }>;
  onChange: (layer: FlagLayer) => void;
}) {
  const setCount = (count: number) => {
    const n = Math.max(1, Math.min(24, Math.floor(count)));
    onChange({ ...layer, count: n, colors: resizeColors(layer.colors, n) });
  };
  const setColor = (i: number, color: string) => {
    const colors = layer.colors.slice();
    colors[i] = color;
    onChange({ ...layer, colors });
  };

  return (
    <div className="flag-editor__layer-controls">
      <label className="flag-editor__field">
        <span>Orientation</span>
        <select
          aria-label="Orientation"
          value={layer.orientation}
          onChange={(e) =>
            onChange({
              ...layer,
              orientation: e.target.value as typeof layer.orientation,
            })
          }
        >
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
          <option value="diagonal">Diagonal</option>
        </select>
      </label>

      <label className="flag-editor__field">
        <span>Count</span>
        <input
          type="number"
          aria-label="Stripe count"
          min={1}
          max={24}
          step={1}
          value={layer.count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
      </label>

      <div className="flag-editor__colors">
        {resizeColors(layer.colors, layer.count).map((c, i) => (
          <ColorField
            key={i}
            label={`Band ${i + 1}`}
            value={c}
            onChange={(v) => setColor(i, v)}
          />
        ))}
      </div>
    </div>
  );
}

function ChargeLayerEditor({
  layer,
  onChange,
}: {
  layer: Extract<FlagLayer, { kind: "charge" }>;
  onChange: (layer: FlagLayer) => void;
}) {
  return (
    <div className="flag-editor__layer-controls">
      <label className="flag-editor__field">
        <span>Symbol</span>
        <select
          aria-label="Symbol"
          value={layer.symbolId}
          onChange={(e) =>
            onChange({ ...layer, symbolId: e.target.value as typeof layer.symbolId })
          }
        >
          {SYMBOL_IDS.map((id) => (
            <option key={id} value={id}>
              {getSymbol(id).label}
            </option>
          ))}
        </select>
      </label>

      {/* X/Y are the SAME normalized values the drag-on-preview edits — one source
          of truth, so dragging moves these and these move the charge on preview. */}
      <RangeField
        label="Charge X"
        value={layer.x}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => onChange({ ...layer, x: v })}
      />
      <RangeField
        label="Charge Y"
        value={layer.y}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => onChange({ ...layer, y: v })}
      />
      <RangeField
        label="Scale"
        value={layer.scale}
        min={0.05}
        max={1.5}
        step={0.05}
        onChange={(v) => onChange({ ...layer, scale: v })}
      />
      <ColorField
        label="Charge color"
        value={layer.color}
        onChange={(v) => onChange({ ...layer, color: v })}
      />
      <label className="flag-editor__field">
        <span>Rotation</span>
        <input
          type="number"
          aria-label="Charge rotation"
          step={15}
          value={layer.rotation ?? 0}
          onChange={(e) =>
            onChange({ ...layer, rotation: Number(e.target.value) || 0 })
          }
        />
        <span className="flag-editor__unit">°</span>
      </label>
    </div>
  );
}

function layerSummary(layer: FlagLayer): string {
  switch (layer.kind) {
    case "field":
      return layer.fill.kind === "solid"
        ? "Field · solid"
        : `Field · ${layer.fill.division}`;
    case "stripes":
      return `Stripes · ${layer.orientation} ×${layer.count}`;
    case "charge":
      return `Charge · ${getSymbol(layer.symbolId).label}`;
  }
}

// --- the modal ---------------------------------------------------------------

export function FlagEditor({ flag, onClose }: { flag: Flag; onClose: () => void }) {
  const updateFlagDesign = useStore((s) => s.updateFlagDesign);

  // The WORKING COPY — a deep clone of the flag's design, edited entirely in local
  // state until Apply. (Cancel/Esc/backdrop simply drop it.)
  const [design, setDesign] = useState<FlagDesign>(() =>
    structuredClone(flag.design),
  );
  const [selected, setSelected] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<number | null>(null); // index of the charge being dragged

  const apply = () => {
    updateFlagDesign(flag.id, design);
    onClose();
  };

  // Esc / backdrop discard. A capture-phase listener closes the modal BEFORE the
  // app's global Escape handler (which would otherwise deselect the flag), so the
  // flag stays selected and only the modal closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Live preview: draw the working design via the shared renderFlag, then outline
  // the selected charge (a render-only cue; never pixel-tested).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderFlag(design, canvas, PREVIEW_HEIGHT);
    if (selected === null) return;
    const layer = design.layers[selected];
    if (!layer || layer.kind !== "charge") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const t = chargeTransform(layer, canvas.width, canvas.height, getSymbol(layer.symbolId).viewBox);
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(t.left, t.top, t.width, t.height);
    ctx.restore();
  }, [design, selected]);

  // Drag-on-preview: press on a charge grabs it; window move/up follow the cursor
  // and release. The dragged (x,y) writes straight into the working design's
  // charge layer — the SAME value the X/Y sliders edit, so there is no separate
  // drag-state to diverge.
  const coordAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return previewPixelToFlagCoord(
      clientX - rect.left,
      clientY - rect.top,
      { width: rect.width, height: rect.height },
      design.aspect,
    );
  };

  const onPreviewPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = coordAt(e.clientX, e.clientY);
    const hit = chargeAtPoint(design, x, y);
    if (hit !== null) {
      setSelected(hit);
      dragRef.current = hit;
    } else {
      // Empty space deselects the focused charge (never adds anything).
      const cur = selected === null ? null : design.layers[selected];
      if (cur && cur.kind === "charge") setSelected(null);
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const idx = dragRef.current;
      if (idx === null || !canvasRef.current) return;
      const { x, y } = coordAt(e.clientX, e.clientY);
      setDesign((d) => {
        const layer = d.layers[idx];
        if (!layer || layer.kind !== "charge") return d;
        return updateLayer(d, idx, { ...layer, x, y });
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // design.aspect is read inside coordAt; re-bind when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.aspect]);

  const add = (kind: LayerKind) => {
    setDesign((d) => {
      const next = addLayer(d, kind);
      setSelected(next.layers.length - 1); // focus the newly added (topmost) layer
      return next;
    });
  };

  const selectedLayer = selected === null ? undefined : design.layers[selected];

  return (
    <div
      className="modal-backdrop"
      data-testid="flag-editor-backdrop"
      onClick={onClose}
    >
      <div
        className="modal flag-editor"
        role="dialog"
        aria-modal="true"
        aria-label="Flag design editor"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal__title">Edit flag design</h2>

        <div className="flag-editor__body">
          {/* Left: the live preview + aspect. */}
          <div className="flag-editor__preview">
            <canvas
              ref={canvasRef}
              className="flag-editor__canvas"
              style={{ height: PREVIEW_HEIGHT, width: "auto", touchAction: "none" }}
              onPointerDown={onPreviewPointerDown}
            />
            <RangeField
              label="Aspect"
              value={design.aspect}
              min={0.5}
              max={3}
              step={0.1}
              onChange={(v) => setDesign((d) => setAspect(d, v))}
            />
            <p className="flag-editor__hint">
              Drag a charge on the preview to reposition it.
            </p>
          </div>

          {/* Right: the layer list + per-layer controls. */}
          <div className="flag-editor__layers">
            <div className="flag-editor__add">
              <span>Add layer:</span>
              <button type="button" onClick={() => add("field")}>
                Add field
              </button>
              <button type="button" onClick={() => add("stripes")}>
                Add stripes
              </button>
              <button type="button" onClick={() => add("charge")}>
                Add charge
              </button>
            </div>

            <p className="flag-editor__hint">
              Layers draw back → front (bottom row is drawn first; top row is on
              top).
            </p>

            <ul className="flag-editor__list" aria-label="Flag layers">
              {design.layers.map((layer, i) => (
                <li
                  key={i}
                  className={
                    i === selected
                      ? "flag-editor__row is-selected"
                      : "flag-editor__row"
                  }
                >
                  <button
                    type="button"
                    className="flag-editor__row-label"
                    aria-label={`Select layer ${i + 1}`}
                    onClick={() => setSelected(i)}
                  >
                    {layerSummary(layer)}
                  </button>
                  <div className="flag-editor__row-actions">
                    <button
                      type="button"
                      aria-label={`Move layer ${i + 1} up`}
                      disabled={i === design.layers.length - 1}
                      onClick={() =>
                        setDesign((d) => {
                          setSelected(Math.min(i + 1, d.layers.length - 1));
                          return moveLayer(d, i, 1);
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move layer ${i + 1} down`}
                      disabled={i === 0}
                      onClick={() =>
                        setDesign((d) => {
                          setSelected(Math.max(i - 1, 0));
                          return moveLayer(d, i, -1);
                        })
                      }
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove layer ${i + 1}`}
                      onClick={() =>
                        setDesign((d) => {
                          setSelected(null);
                          return removeLayer(d, i);
                        })
                      }
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
              {design.layers.length === 0 && (
                <li className="flag-editor__row flag-editor__row--empty">
                  No layers — add one above.
                </li>
              )}
            </ul>

            {selectedLayer && (
              <div className="flag-editor__editor" aria-label="Layer controls">
                {selectedLayer.kind === "field" && (
                  <FieldLayerEditor
                    fill={selectedLayer.fill}
                    onChange={(fill) =>
                      setDesign((d) => updateLayer(d, selected!, { kind: "field", fill }))
                    }
                  />
                )}
                {selectedLayer.kind === "stripes" && (
                  <StripesLayerEditor
                    layer={selectedLayer}
                    onChange={(layer) => setDesign((d) => updateLayer(d, selected!, layer))}
                  />
                )}
                {selectedLayer.kind === "charge" && (
                  <ChargeLayerEditor
                    layer={selectedLayer}
                    onChange={(layer) => setDesign((d) => updateLayer(d, selected!, layer))}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="modal__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="modal__confirm"
            data-action="flag-editor-apply"
            onClick={apply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
