// Pure roof geometry (schema v3, phase 2H) — the roof is a per-piece RENDER
// PARAMETER drawn by each host, exactly like crenellations: a pure helper returns
// the roof's parts in the host's LOCAL space (y up from the piece's underside),
// and the host's mesh maps each part to a mesh whose material flows through the
// shared materialRefToThreeMaterial helper (so patterns work on roofs for free).
//
// Because a roof is derived FRESH from the piece every render (no stored roof
// object, no identity, no reconciliation), it moves / resizes / rides / deletes
// with the host automatically — there is NO floating-roof problem and NO
// auto-detection / mass-decomposition system (the prior project's failed Phase
// 5.1 stays dead). Pure + unit-tested; no hooks, no THREE.
//
// Shapes per host:
//   • Round tower   → a CONE sized to the tower radius, height = roofPitch.
//   • Square tower  → a PYRAMID over the square top footprint, height = roofPitch.
//   • Gatehouse     → a PYRAMID over the width × depth top footprint.
//   • Wall run      → a gabled cover (two pitched SLOPES meeting at a ridge along
//                     the wall's length), on POSTS down both sides (an open
//                     covered wall-walk) — the ridge length reuses wallRunLength.
//   • Ramp          → a pitched cover SLOPE parallel to the incline (reusing the
//                     ramp's rise/run), on POSTS — an open covered stair/ramp.
//
// Posts: ALWAYS present for the wall-walk + ramp covers; OPTIONAL for tower /
// gatehouse via `raisedOnPosts` (default flush on the crown). Posts use the roof
// material (they render alongside the roof parts with the same roofMaterial).
//
// Roofs COEXIST with crenellations: a crenellated + roofed host draws both — the
// teeth around the rim (the builder's merlons) and the roof rising from within /
// above (posts lift it clear of the parapet when raised). Neither hides the other,
// because the two are independent part sets.

import type { Gatehouse, Piece, Ramp, Tower, Vec3, WallRun } from "../store/schema";
import { wallRunLength } from "./wallRunFootprint";

/** Square post cross-section (meters). */
export const ROOF_POST_SIZE = 0.35;
/** Walkable clearance the posts lift a cover above the host's top (meters). */
export const ROOF_POST_CLEARANCE = 1.2;
/** Target spacing between post pairs along a wall-walk / ramp cover (meters). */
export const ROOF_POST_SPACING = 3;
/** Thickness of a pitched cover slab (meters). */
export const ROOF_COVER_THICKNESS = 0.3;
/** Radial segments for a round tower's cone roof. */
export const CONE_RADIAL_SEGMENTS = 48;

/**
 * A roof part in the host's LOCAL space. `position` is the part's CENTER (for the
 * cone/pyramid this is the geometric center; the renderer's ConeGeometry is
 * centered too). All heights route through the piece's own dimensions, never a
 * literal ground-y (the host group is already seated at its support height).
 */
export type RoofPart =
  | { role: "cone"; position: Vec3; radius: number; height: number; radialSegments: number }
  | { role: "pyramid"; position: Vec3; halfX: number; halfZ: number; height: number }
  // An inclined flat slab (a gable side, or the ramp cover). `size` = full extents
  // (x, thickness, slant length); `rotationX` pitches it about local X.
  | { role: "slope"; position: Vec3; size: Vec3; rotationX: number }
  // A vertical support post (box).
  | { role: "post"; position: Vec3; size: Vec3 };

/**
 * The height of the posts that lift a raised/covered roof clear of the top. A
 * crenellated host adds its merlon height so the roof clears the parapet teeth.
 */
export function roofPostHeight(crenellated: boolean, merlonSize: number): number {
  return ROOF_POST_CLEARANCE + (crenellated ? merlonSize : 0);
}

/** Evenly spaced positions from -half..+half (or 0..len) along an edge. */
function evenlySpaced(count: number, from: number, to: number): number[] {
  if (count <= 1) return [(from + to) / 2];
  const step = (to - from) / (count - 1);
  return Array.from({ length: count }, (_, i) => from + i * step);
}

/** Number of post PAIRS along a cover of the given length (posts at both ends). */
function postPairs(length: number): number {
  return Math.max(2, Math.round(length / ROOF_POST_SPACING) + 1);
}

/** The cone (round tower) or pyramid (square tower / gatehouse) roof cap. */
function capPart(profile: "round" | "square", halfX: number, halfZ: number, eaveY: number, pitch: number): RoofPart {
  const position = { x: 0, y: eaveY + pitch / 2, z: 0 };
  if (profile === "round") {
    return { role: "cone", position, radius: halfX, height: pitch, radialSegments: CONE_RADIAL_SEGMENTS };
  }
  return { role: "pyramid", position, halfX, halfZ, height: pitch };
}

/** Four corner posts around a rectangular/round crown, from the crown up to eaveY. */
function cornerPosts(profile: "round" | "square", halfX: number, halfZ: number, crownY: number, postH: number): RoofPart[] {
  const inset = ROOF_POST_SIZE / 2;
  // Round: sit posts on the rim at the 45° diagonals; square/rect: near the corners.
  const px = profile === "round" ? halfX * Math.SQRT1_2 : Math.max(inset, halfX - inset);
  const pz = profile === "round" ? halfZ * Math.SQRT1_2 : Math.max(inset, halfZ - inset);
  const posts: RoofPart[] = [];
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      posts.push({
        role: "post",
        position: { x: sx * px, y: crownY + postH / 2, z: sz * pz },
        size: { x: ROOF_POST_SIZE, y: postH, z: ROOF_POST_SIZE },
      });
    }
  }
  return posts;
}

export function towerRoof(t: Tower): RoofPart[] {
  if (!t.roofed) return [];
  const posted = t.raisedOnPosts;
  const postH = posted ? roofPostHeight(t.crenellated, t.merlonSize) : 0;
  const eaveY = t.height + postH;
  const parts: RoofPart[] = [];
  if (posted) parts.push(...cornerPosts(t.profile, t.radius, t.radius, t.height, postH));
  parts.push(capPart(t.profile, t.radius, t.radius, eaveY, t.roofPitch));
  return parts;
}

export function gatehouseRoof(g: Gatehouse): RoofPart[] {
  if (!g.roofed) return [];
  const posted = g.raisedOnPosts;
  const postH = posted ? roofPostHeight(g.crenellated, g.merlonSize) : 0;
  const eaveY = g.height + postH;
  const hx = g.width / 2;
  const hz = g.depth / 2;
  const parts: RoofPart[] = [];
  if (posted) parts.push(...cornerPosts("square", hx, hz, g.height, postH));
  // A gatehouse is always a rectangular (pyramid) cap.
  parts.push(capPart("square", hx, hz, eaveY, g.roofPitch));
  return parts;
}

export function wallRunRoof(w: WallRun): RoofPart[] {
  if (!w.roofed) return [];
  const length = wallRunLength(w);
  if (length <= 0) return []; // degenerate wall — nothing to cover
  const postH = roofPostHeight(w.crenellated, w.merlonSize); // always posted
  const eaveY = w.height + postH;
  const halfSpan = w.thickness / 2; // across the wall thickness (local Z)
  const pitch = w.roofPitch;
  const angle = Math.atan2(pitch, halfSpan);
  const slant = Math.hypot(pitch, halfSpan);
  const parts: RoofPart[] = [];

  // Gable: two pitched slopes meeting at the ridge (local X, at z=0). The +Z
  // slope tilts so its ridge edge is up; the -Z slope mirrors it.
  const coverY = eaveY + pitch / 2;
  parts.push({
    role: "slope",
    position: { x: 0, y: coverY, z: halfSpan / 2 },
    size: { x: length, y: ROOF_COVER_THICKNESS, z: slant },
    rotationX: angle,
  });
  parts.push({
    role: "slope",
    position: { x: 0, y: coverY, z: -halfSpan / 2 },
    size: { x: length, y: ROOF_COVER_THICKNESS, z: slant },
    rotationX: -angle,
  });

  // Posts down both sides, from the wall crown up to the eave.
  const pairs = postPairs(length);
  for (const x of evenlySpaced(pairs, -length / 2, length / 2)) {
    for (const z of [halfSpan, -halfSpan]) {
      parts.push({
        role: "post",
        position: { x, y: w.height + postH / 2, z },
        size: { x: ROOF_POST_SIZE, y: postH, z: ROOF_POST_SIZE },
      });
    }
  }
  return parts;
}

export function rampRoof(r: Ramp): RoofPart[] {
  if (!r.roofed) return [];
  if (r.rise <= 0 && r.run <= 0) return []; // degenerate
  const clearance = ROOF_POST_CLEARANCE; // always posted
  // Parallel the ramp's incline: the cover uses the SAME angle the ramp slab uses
  // (buildRamp pitches its slab by -atan2(rise, run)), lifted by the clearance.
  const angle = Math.atan2(r.rise, r.run);
  const length = Math.hypot(r.rise, r.run);
  const parts: RoofPart[] = [];
  parts.push({
    role: "slope",
    position: { x: 0, y: r.rise / 2 + clearance, z: r.run / 2 },
    size: { x: r.width, y: ROOF_COVER_THICKNESS, z: length },
    rotationX: -angle,
  });

  // Posts up the sides, following the incline surface, from the ramp up to the cover.
  const pairs = postPairs(r.run);
  const px = Math.max(ROOF_POST_SIZE / 2, r.width / 2 - ROOF_POST_SIZE / 2);
  for (const z of evenlySpaced(pairs, 0, r.run)) {
    const surfaceY = r.run > 0 ? (z / r.run) * r.rise : 0; // the incline height at z
    for (const x of [px, -px]) {
      parts.push({
        role: "post",
        position: { x, y: surfaceY + clearance / 2, z },
        size: { x: ROOF_POST_SIZE, y: clearance, z: ROOF_POST_SIZE },
      });
    }
  }
  return parts;
}

/**
 * The roof parts for ANY piece — the single dispatch used by the host meshes. A
 * non-host (gate / flag / moat) or an unroofed host returns [] (nothing drawn).
 */
export function roofParts(piece: Piece): RoofPart[] {
  switch (piece.kind) {
    case "tower":
      return towerRoof(piece);
    case "gatehouse":
      return gatehouseRoof(piece);
    case "wallRun":
      return wallRunRoof(piece);
    case "ramp":
      return rampRoof(piece);
    default:
      return []; // gate / flag / moat are never roofed
  }
}
