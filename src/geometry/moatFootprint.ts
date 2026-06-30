// The pure moat-footprint helpers — the SINGLE source of truth for a moat's
// horizontal extent, one helper per shape. Both rendering (the ring/strip
// geometry dimensions, the group center + orientation) and picking/snap (the
// hit-test) derive from these, so the two paths can never drift.
//
// A moat lies FLAT at the ground. Ring: an annulus between innerRadius and
// outerRadius about the anchor — its hit-test is "inside the outer circle AND
// outside the inner circle". Segment: an oriented length × width rectangle from
// `position` to `end` (reuses the shared RectFootprint, exactly like a wall run).

import type { Moat, Vec2 } from "../store/schema";
import type { RectFootprint } from "./rectFootprint";

export interface RingFootprint {
  center: Vec2;
  innerRadius: number;
  outerRadius: number;
}

/** Ring footprint about the moat anchor. Falls back to defaults if a radius is
 *  missing (a ring moat always carries both, but stay defensive). */
export function moatRingFootprint(m: Moat): RingFootprint {
  return {
    center: { x: m.position.x, y: m.position.y },
    innerRadius: m.innerRadius ?? 0,
    outerRadius: m.outerRadius ?? 0,
  };
}

/** Hit-test: a point lies on the ring iff it is inside the outer circle AND
 *  outside the inner circle (the hole reads as the dry land the moat surrounds). */
export function ringFootprintContains(fp: RingFootprint, point: Vec2): boolean {
  const dx = point.x - fp.center.x;
  const dy = point.y - fp.center.y;
  const d2 = dx * dx + dy * dy;
  const lo = Math.min(fp.innerRadius, fp.outerRadius);
  const hi = Math.max(fp.innerRadius, fp.outerRadius);
  return d2 <= hi * hi && d2 >= lo * lo;
}

/** Length of a segment moat (distance between its endpoints), in meters. */
export function moatSegmentLength(m: Moat): number {
  const ex = m.end?.x ?? m.position.x;
  const ey = m.end?.y ?? m.position.y;
  return Math.hypot(ex - m.position.x, ey - m.position.y);
}

/** Midpoint of a segment moat (its render/footprint center). */
export function moatSegmentCenter(m: Moat): Vec2 {
  const ex = m.end?.x ?? m.position.x;
  const ey = m.end?.y ?? m.position.y;
  return { x: (m.position.x + ex) / 2, y: (m.position.y + ey) / 2 };
}

/** Rotation (degrees about world Y) that aligns local +X with position→end. */
export function moatSegmentRotationDeg(m: Moat): number {
  const ex = m.end?.x ?? m.position.x;
  const ey = m.end?.y ?? m.position.y;
  return (Math.atan2(ey - m.position.y, ex - m.position.x) * 180) / Math.PI;
}

export function moatSegmentFootprint(m: Moat): RectFootprint {
  return {
    center: moatSegmentCenter(m),
    halfX: moatSegmentLength(m) / 2, // along the strip's length
    halfZ: (m.width ?? 0) / 2, // across the strip's width
    rotation: moatSegmentRotationDeg(m),
  };
}
