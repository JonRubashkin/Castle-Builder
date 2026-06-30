// The pure gate-footprint helper — the SINGLE source of truth for a gate's
// horizontal extent. The gate is a thin timber slab (a portcullis grid) standing
// on its underside; its footprint is the oriented width × thickness rectangle
// that BOTH the renderer (the bar layout's overall extent, the group center +
// rotation) and picking/snap (the hit-test) use, so the two paths never drift.
//
// `GATE_THICKNESS` is the slab depth (along the gate's local Z); width runs along
// local X. The builder and this footprint share it so the mesh and hit-test agree.

import type { Gate } from "../store/schema";
import type { RectFootprint } from "./rectFootprint";

/** Depth of the gate slab (along its local Z), in meters. */
export const GATE_THICKNESS = 0.3;

export function gateFootprint(g: Gate): RectFootprint {
  return {
    center: { x: g.position.x, y: g.position.y },
    halfX: g.width / 2, // width runs along local X (its facing)
    halfZ: GATE_THICKNESS / 2, // the thin slab depth
    rotation: g.rotation,
  };
}
