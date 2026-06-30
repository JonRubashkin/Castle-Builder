// The pure gatehouse-footprint helper — the SINGLE source of truth for a
// gatehouse's horizontal extent. Both rendering (the box mass dimensions, the
// group center + rotation) and picking/snap (the hit-test) derive from this one
// oriented rectangle, so the two paths can never drift.

import type { Gatehouse } from "../store/schema";
import type { RectFootprint } from "./rectFootprint";

export function gatehouseFootprint(g: Gatehouse): RectFootprint {
  return {
    center: { x: g.position.x, y: g.position.y },
    halfX: g.width / 2, // width runs along local X (its facing)
    halfZ: g.depth / 2, // depth runs along local Z
    rotation: g.rotation,
  };
}
