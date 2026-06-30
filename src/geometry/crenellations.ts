// The shared crenellation (merlon teeth) helper — ONE source of merlon geometry
// for every piece that can be crenellated (tower, gatehouse, wall run), so the
// merlon logic is never copied per-piece (the "one helper, not three copies"
// discipline). Pure + unit-tested; no hooks, no THREE.
//
// A helper takes a top-edge outline (a circle radius, or a rectangle's
// half-extents) plus the merlon tooth size and the center-Y the teeth sit at,
// and returns the teeth as neutral boxes in LOCAL space (the piece's own frame,
// the piece's forward = +Z). Each builder wraps these into its own part type.

import type { Vec3 } from "../store/schema";

/** A single merlon tooth: a cube box in the piece's local space. */
export interface MerlonBox {
  position: Vec3; // center of the tooth in local space
  size: Vec3; // full extents (a cube of the merlon size)
  rotationY: number; // radians about local Y (round teeth face outward; rect = 0)
}

/**
 * How many merlon teeth fit along an edge/perimeter of the given length. Merlons
 * and crenels (gaps) alternate at roughly equal width, so one merlon "slot" is
 * about two tooth-widths of edge.
 */
export function merlonCount(perimeter: number, merlonSize: number, min: number): number {
  if (merlonSize <= 0) return min;
  return Math.max(min, Math.floor(perimeter / (2 * merlonSize)));
}

/**
 * Teeth around a ROUND top edge: distributed evenly around a circle of `radius`,
 * each sitting on the rim and facing outward. `topY` is the tooth center height.
 */
export function roundCrenellations(
  radius: number,
  topY: number,
  merlonSize: number,
  min = 4,
): MerlonBox[] {
  const perimeter = 2 * Math.PI * radius;
  const n = merlonCount(perimeter, merlonSize, min);
  const s = merlonSize;
  const teeth: MerlonBox[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2;
    teeth.push({
      position: { x: Math.cos(theta) * radius, y: topY, z: Math.sin(theta) * radius },
      size: { x: s, y: s, z: s },
      rotationY: theta, // face outward
    });
  }
  return teeth;
}

/**
 * Teeth around a RECTANGULAR top edge: distributed evenly along all four top
 * edges of a rectangle with half-extents `halfX` (along local X) and `halfZ`
 * (along local Z). `topY` is the tooth center height. Used by square towers,
 * gatehouses, and wall runs alike — one rectangle-edge implementation.
 */
export function rectCrenellations(
  halfX: number,
  halfZ: number,
  topY: number,
  merlonSize: number,
  min = 1,
): MerlonBox[] {
  const s = merlonSize;
  const cube = { x: s, y: s, z: s };
  const lenX = 2 * halfX; // length of the two edges that run along X (at z = ±halfZ)
  const lenZ = 2 * halfZ; // length of the two edges that run along Z (at x = ±halfX)
  const nX = merlonCount(lenX, s, min);
  const nZ = merlonCount(lenZ, s, min);
  const teeth: MerlonBox[] = [];
  for (let i = 0; i < nX; i++) {
    const d = -halfX + ((i + 0.5) / nX) * lenX; // along the X edges
    teeth.push({ position: { x: d, y: topY, z: halfZ }, size: cube, rotationY: 0 });
    teeth.push({ position: { x: d, y: topY, z: -halfZ }, size: cube, rotationY: 0 });
  }
  for (let i = 0; i < nZ; i++) {
    const d = -halfZ + ((i + 0.5) / nZ) * lenZ; // along the Z edges
    teeth.push({ position: { x: halfX, y: topY, z: d }, size: cube, rotationY: 0 });
    teeth.push({ position: { x: -halfX, y: topY, z: d }, size: cube, rotationY: 0 });
  }
  return teeth;
}
