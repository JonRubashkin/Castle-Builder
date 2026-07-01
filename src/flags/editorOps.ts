// Pure working-copy operations for the flag editor (phase 2Fc). The editor holds
// a WORKING COPY of a flag's FlagDesign in local state and mutates it through
// these functions; only "Apply" commits the result to the store (ONE coalesced,
// undoable edit — see the store's updateFlagDesign). Everything here is a pure
// function returning a NEW FlagDesign (immutable), so it is trivially
// unit-testable and safe to drive React state with (no in-place mutation).

import { divisionSectionCount } from "./layout";
import { SYMBOL_IDS } from "./symbols/ids";
import type { FieldFill, FlagDesign, FlagLayer } from "./types";

/** The three addable layer kinds (the FlagLayer discriminants). */
export type LayerKind = FlagLayer["kind"]; // "field" | "stripes" | "charge"

// --- default layers (sensible starting values when a layer is added) ---------

export function defaultFieldLayer(): Extract<FlagLayer, { kind: "field" }> {
  return { kind: "field", fill: { kind: "solid", color: "#3a6ea5" } };
}

export function defaultStripesLayer(): Extract<FlagLayer, { kind: "stripes" }> {
  return {
    kind: "stripes",
    orientation: "horizontal",
    count: 3,
    colors: ["#c1121f", "#ffffff", "#003049"],
  };
}

export function defaultChargeLayer(): Extract<FlagLayer, { kind: "charge" }> {
  return {
    kind: "charge",
    symbolId: SYMBOL_IDS[0],
    x: 0.5,
    y: 0.5,
    scale: 0.6,
    color: "#ffd60a",
    rotation: 0,
  };
}

export function defaultLayer(kind: LayerKind): FlagLayer {
  switch (kind) {
    case "field":
      return defaultFieldLayer();
    case "stripes":
      return defaultStripesLayer();
    case "charge":
      return defaultChargeLayer();
  }
}

// --- layer-list ops (add / remove / reorder / edit) --------------------------

/** Append a new default layer of `kind` (on TOP — layers draw back-to-front, so
 *  the last element is drawn last / frontmost). Multiple fields are allowed. */
export function addLayer(design: FlagDesign, kind: LayerKind): FlagDesign {
  return { ...design, layers: [...design.layers, defaultLayer(kind)] };
}

export function removeLayer(design: FlagDesign, index: number): FlagDesign {
  if (index < 0 || index >= design.layers.length) return design;
  return { ...design, layers: design.layers.filter((_, i) => i !== index) };
}

/** Move the layer at `index` by `delta` (±1 for the up/down controls), clamped —
 *  an out-of-range move is a no-op. `delta` is the shift in ARRAY (draw) order. */
export function moveLayer(design: FlagDesign, index: number, delta: number): FlagDesign {
  const target = index + delta;
  if (
    index < 0 ||
    index >= design.layers.length ||
    target < 0 ||
    target >= design.layers.length
  ) {
    return design;
  }
  const layers = [...design.layers];
  const [item] = layers.splice(index, 1);
  layers.splice(target, 0, item!);
  return { ...design, layers };
}

/** Replace the layer at `index` with `layer`. */
export function updateLayer(
  design: FlagDesign,
  index: number,
  layer: FlagLayer,
): FlagDesign {
  if (index < 0 || index >= design.layers.length) return design;
  return { ...design, layers: design.layers.map((l, i) => (i === index ? layer : l)) };
}

/** Set the flag aspect (width : height); the cloth reshapes from this on Apply. */
export function setAspect(design: FlagDesign, aspect: number): FlagDesign {
  return { ...design, aspect };
}

// --- color-array helpers (kept pure so the per-layer controls stay simple) ---

/** Resize a colors array to length `n`, keeping existing entries and cycling the
 *  existing palette (or `fill`) for any new slots. Used when a division/stripe
 *  count changes so there is always exactly one color per section/band. */
export function resizeColors(colors: string[], n: number, fill = "#888888"): string[] {
  const count = Math.max(0, Math.floor(n));
  const out = colors.slice(0, count);
  while (out.length < count) {
    out.push(colors.length > 0 ? colors[out.length % colors.length]! : fill);
  }
  return out;
}

/** The number of colors a field fill needs: 1 for solid, else the division's
 *  section count. Keeps the field editor's color inputs in sync with the fill. */
export function fieldColorCount(fill: FieldFill): number {
  return fill.kind === "solid" ? 1 : divisionSectionCount(fill.division);
}
