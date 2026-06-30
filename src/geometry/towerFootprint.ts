// The pure tower-footprint helper — the SINGLE source of truth for a tower's
// horizontal extent. Both rendering (sizing the mesh, framing) and picking/snap
// (the hit-test) derive from this one function, so the two paths can never drift.

import type { Tower, Vec2 } from "../store/schema";

export interface TowerFootprint {
  profile: "round" | "square";
  center: Vec2; // world XZ anchor
  /** round: circle radius; square: half-extent of the side. */
  radius: number;
  /** degrees about world Y (only meaningful for square). */
  rotation: number;
}

export function towerFootprint(tower: Tower): TowerFootprint {
  return {
    profile: tower.profile,
    center: { x: tower.position.x, y: tower.position.y },
    radius: tower.radius,
    rotation: tower.rotation,
  };
}

/**
 * Rotate an XZ vector about the origin by `degrees`.
 * Uses the same Y-up convention as the renderer's group rotation so hit-testing
 * and rendering agree (one source of truth).
 */
function rotateXZ(v: Vec2, degrees: number): Vec2 {
  const a = (degrees * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.y * s, y: -v.x * s + v.y * c };
}

/** Is a world XZ point inside the tower's footprint? */
export function footprintContains(fp: TowerFootprint, point: Vec2): boolean {
  const rel = { x: point.x - fp.center.x, y: point.y - fp.center.y };
  if (fp.profile === "round") {
    return rel.x * rel.x + rel.y * rel.y <= fp.radius * fp.radius;
  }
  // Square: undo the piece's rotation, then test against the axis-aligned box.
  const local = rotateXZ(rel, -fp.rotation);
  return Math.abs(local.x) <= fp.radius && Math.abs(local.y) <= fp.radius;
}

/**
 * Axis-aligned (world) bounding half-extents of the footprint — handy for camera
 * framing and broad-phase picking. For a rotated square this is the AABB of the
 * rotated box.
 */
export function footprintAABBHalfExtents(fp: TowerFootprint): Vec2 {
  if (fp.profile === "round") {
    return { x: fp.radius, y: fp.radius };
  }
  const a = (fp.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const half = fp.radius;
  return { x: half * (c + s), y: half * (c + s) };
}
