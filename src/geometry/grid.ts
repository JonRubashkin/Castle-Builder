// Pure grid-snapping helpers. All lengths are meters. These are the single source
// of truth for snapping; React and the store call them rather than inlining math.

import type { Vec2 } from "../store/schema";

/** Horizontal grid increment (piece anchors, wall endpoints). */
export const HORIZONTAL_GRID = 0.1;

/** Vertical grid increment (a piece's stored base when placed in empty air). */
export const VERTICAL_GRID = 0.5;

/** Rotation snap increment, in degrees. */
export const ROTATION_STEP = 15;

function snapTo(value: number, increment: number): number {
  // Round-half-up to the nearest increment; avoid -0 and floating dust.
  const snapped = Math.round(value / increment) * increment;
  const cleaned = Number(snapped.toFixed(6));
  return cleaned === 0 ? 0 : cleaned;
}

/** Snap a single horizontal coordinate to the 0.1 m grid. */
export function snapHorizontal(value: number): number {
  return snapTo(value, HORIZONTAL_GRID);
}

/** Snap a world XZ point to the horizontal grid. */
export function snapHorizontalVec2(point: Vec2): Vec2 {
  return { x: snapHorizontal(point.x), y: snapHorizontal(point.y) };
}

/** Snap a vertical (base) coordinate to the 0.5 m grid. */
export function snapVertical(value: number): number {
  return snapTo(value, VERTICAL_GRID);
}

/** Snap a rotation (degrees) to the 15° grid, normalized to [0, 360). */
export function snapRotation(degrees: number): number {
  const snapped = snapTo(degrees, ROTATION_STEP);
  const normalized = ((snapped % 360) + 360) % 360;
  return normalized === 0 ? 0 : normalized;
}
