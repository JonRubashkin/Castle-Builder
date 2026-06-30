// The pure moat builder — a FLAT opaque-water surface, the user's first
// non-box piece. It returns a renderable primitive description (NOT box parts):
// a "ring" annulus or a "segment" strip. The mesh maps this to a ringGeometry or
// a flat plane; the WATER material flows through materialRefToThreeMaterial and
// is ALWAYS opaque (texture + sheen, never alpha). Pure + unit-tested; no hooks,
// no THREE.
//
// Dimensions come from the one moatFootprint helper per shape, so the mesh and
// the hit-test share a single source of truth.

import type { Moat } from "../store/schema";
import {
  moatRingFootprint,
  moatSegmentFootprint,
  moatSegmentLength,
} from "./moatFootprint";

/** Radial segment count for a smooth ring annulus. */
export const MOAT_RING_SEGMENTS = 64;

export type MoatGeometry =
  | { shape: "ring"; innerRadius: number; outerRadius: number; segments: number }
  | { shape: "segment"; length: number; width: number };

export function buildMoat(m: Moat): MoatGeometry {
  if (m.shape === "segment") {
    moatSegmentFootprint(m); // share the footprint's source of truth
    return {
      shape: "segment",
      length: moatSegmentLength(m),
      width: m.width ?? 0,
    };
  }
  const fp = moatRingFootprint(m);
  return {
    shape: "ring",
    innerRadius: fp.innerRadius,
    outerRadius: fp.outerRadius,
    segments: MOAT_RING_SEGMENTS,
  };
}
