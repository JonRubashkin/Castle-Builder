// The shared oriented-rectangle footprint — the SINGLE source of truth for the
// horizontal extent of rectangular pieces (gatehouse and wall run). Both
// rendering (group center + rotation + box dimensions) and picking/snap (the
// hit-test) derive from one RectFootprint per piece, so the two paths never
// drift. Round towers keep their own circle footprint; everything rectangular
// shares this.
//
// Rotation convention (must match the renderer): a piece is drawn as a group
// rotated by `[0, -deg2rad(rotation), 0]`, so a LOCAL point (lx, lz) maps to
//   worldX = lx·cos r − lz·sin r
//   worldZ = lx·sin r + lz·cos r      (r = rotation in radians)
// The containment test below is the exact inverse of that map — derived for a
// general (non-square) rectangle, so halfX ≠ halfZ is handled correctly.

import type { Vec2 } from "../store/schema";

export interface RectFootprint {
  center: Vec2; // world XZ center of the rectangle
  halfX: number; // half-extent along the piece's local X
  halfZ: number; // half-extent along the piece's local Z
  rotation: number; // degrees about world Y (same sense as PieceBase.rotation)
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Is a world XZ point inside the oriented rectangle? */
export function rectFootprintContains(fp: RectFootprint, point: Vec2): boolean {
  const relX = point.x - fp.center.x;
  const relZ = point.y - fp.center.y;
  const r = deg2rad(fp.rotation);
  const c = Math.cos(r);
  const s = Math.sin(r);
  // Inverse of the render rotation: world → local.
  const lx = relX * c + relZ * s;
  const lz = -relX * s + relZ * c;
  return Math.abs(lx) <= fp.halfX && Math.abs(lz) <= fp.halfZ;
}

/**
 * Axis-aligned (world) bounding half-extents of the oriented rectangle — handy
 * for camera framing and broad-phase picking.
 */
export function rectFootprintAABBHalfExtents(fp: RectFootprint): Vec2 {
  const r = deg2rad(fp.rotation);
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return {
    x: fp.halfX * c + fp.halfZ * s,
    y: fp.halfX * s + fp.halfZ * c,
  };
}
