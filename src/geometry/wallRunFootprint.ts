// The pure wall-run footprint helper — the SINGLE source of truth for a wall
// run's horizontal extent. A wall run is a two-point horizontal piece; this
// derives the oriented length × thickness rectangle that BOTH the renderer (the
// box mass dimensions, the group center + orientation) and picking/snap (the
// hit-test) use, so the two paths can never drift.
//
// The wall's local +X runs from `position` (start) toward `end`; local Z is the
// thickness direction. `rotation` (degrees) is chosen so the renderer's group
// rotation `[0, -deg2rad(rotation), 0]` maps local +X onto the start→end
// direction (see rectFootprint.ts for the convention).

import type { Vec2, WallRun } from "../store/schema";
import type { RectFootprint } from "./rectFootprint";

/** Length of the wall (distance between its two endpoints), in meters. */
export function wallRunLength(w: WallRun): number {
  return Math.hypot(w.end.x - w.position.x, w.end.y - w.position.y);
}

/** Midpoint of the wall's two endpoints (its render/footprint center). */
export function wallRunCenter(w: WallRun): Vec2 {
  return {
    x: (w.position.x + w.end.x) / 2,
    y: (w.position.y + w.end.y) / 2,
  };
}

/** Rotation (degrees about world Y) that aligns local +X with start→end. */
export function wallRunRotationDeg(w: WallRun): number {
  const dx = w.end.x - w.position.x;
  const dz = w.end.y - w.position.y;
  return (Math.atan2(dz, dx) * 180) / Math.PI;
}

export function wallRunFootprint(w: WallRun): RectFootprint {
  return {
    center: wallRunCenter(w),
    halfX: wallRunLength(w) / 2, // along the wall's length
    halfZ: w.thickness / 2, // across the wall's thickness
    rotation: wallRunRotationDeg(w),
  };
}
