// The pure ramp-footprint helper — the SINGLE source of truth for a ramp's
// horizontal extent (a run × width oriented rectangle), feeding BOTH the renderer
// (the material tiling span; the same position/rotation the mesh group uses) and
// picking/snap (the hit-test), so the two paths can never drift.
//
// The ramp's stored `position` is its BOTTOM anchor (where the builder's local
// z=0 sits); the slab/steps climb along local +Z by `run`. So the footprint
// rectangle is NOT centered on the anchor — its center is the anchor pushed half
// the run along the ramp's heading. `rampCenter` derives that offset using the
// exact render rotation convention (group rotation [0, -deg2rad(rotation), 0],
// under which local +Z maps to world (−sin rot, cos rot)).

import type { Ramp, Vec2 } from "../store/schema";
import type { RectFootprint } from "./rectFootprint";

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

/** World XZ center of the ramp's run×width rectangle (the bottom anchor pushed
 *  half the run along the ramp's heading). */
export function rampCenter(r: Ramp): Vec2 {
  const rot = deg2rad(r.rotation);
  const half = r.run / 2;
  // local (0,0,half) → world offset (−sin rot · half, cos rot · half).
  return {
    x: r.position.x - Math.sin(rot) * half,
    y: r.position.y + Math.cos(rot) * half,
  };
}

export function rampFootprint(r: Ramp): RectFootprint {
  return {
    center: rampCenter(r),
    halfX: r.width / 2, // width runs across local X
    halfZ: r.run / 2, // run climbs along local Z
    rotation: r.rotation,
  };
}
