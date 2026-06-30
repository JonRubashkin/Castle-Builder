// The pure gate builder — a timber PORTCULLIS GRID (chosen over a flat plank
// door: a lattice of vertical + horizontal bars reads unmistakably as a castle
// gate, and its open grid looks correct standing freestanding in a gatehouse
// archway, where a solid slab would just look like a wall). Returned as box
// parts in LOCAL space: width along local X, height up from the underside (y=0),
// the thin slab depth along local Z. Pure + unit-tested; no hooks, no THREE.
//
// The overall extent (width × GATE_THICKNESS) is the gateFootprint, so the mesh
// and the hit-test share one source of truth; this builder only lays out the bars
// inside that extent.

import type { Gate } from "../store/schema";
import type { BoxPart } from "./parts";
import { GATE_THICKNESS } from "./gateFootprint";

/** Bar thickness (square cross-section), in meters. */
export const GATE_BAR = 0.18;
/** Target spacing between bar centers, in meters (bar counts derive from this). */
const BAR_SPACING = 0.55;

/** How many bars span `extent` at ~BAR_SPACING, with the two edge bars included. */
export function gateBarCount(extent: number): number {
  // At least the two edge bars; add interior bars so spacing ≈ BAR_SPACING.
  return Math.max(2, Math.round(extent / BAR_SPACING) + 1);
}

/** Evenly spaced bar-center coordinates spanning [lo, hi], inset by the bar
 *  half-thickness so no bar pokes past the span ends. */
function spanCenters(lo: number, hi: number, count: number): number[] {
  const a = lo + GATE_BAR / 2;
  const b = hi - GATE_BAR / 2;
  if (count === 1) return [(a + b) / 2];
  const step = (b - a) / (count - 1);
  return Array.from({ length: count }, (_, i) => a + i * step);
}

export function buildGate(g: Gate): BoxPart[] {
  const parts: BoxPart[] = [];
  const depth = GATE_THICKNESS;

  // Vertical bars across the width (centered on the anchor), full height.
  const vCount = gateBarCount(g.width);
  for (const x of spanCenters(-g.width / 2, g.width / 2, vCount)) {
    parts.push({
      role: "mass",
      position: { x, y: g.height / 2, z: 0 },
      size: { x: GATE_BAR, y: g.height, z: depth },
      rotationY: 0,
    });
  }

  // Horizontal bars up the height (from the underside y=0 to the top), full width.
  const hCount = gateBarCount(g.height);
  for (const y of spanCenters(0, g.height, hCount)) {
    parts.push({
      role: "mass",
      position: { x: 0, y, z: 0 },
      size: { x: g.width, y: GATE_BAR, z: depth },
      rotationY: 0,
    });
  }

  return parts;
}
