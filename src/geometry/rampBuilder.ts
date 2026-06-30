// The pure ramp/stair builder — the heart of the ramp piece, and the most-tested
// helper in phase 1. It is the analog of the prior project's `computeStair`: given
// the connection's dimensions (rise, run, width, style) it returns geometry parts
// in LOCAL space (the piece's underside at y=0, climbing along +Z), with NO hooks
// and NO THREE. The renderer maps each part to a mesh whose material flows through
// the shared materialRefToThreeMaterial helper.
//
//   • style "ramp"  → a single inclined slab from (y=0, z=0) up to (y=rise, z=run),
//     `width` across local X, pitched about local X so its low end sits at the
//     underside and its high end at `rise`.
//   • style "stair" → solid stepped blocks. The step count comes from a target
//     riser (STAIR_RISER_TARGET): steps = round(rise / target) (≥1). The ACTUAL
//     riser is rise / steps and the tread depth is run / steps. One box per step,
//     each a solid block from the underside (y=0) up to its tread top, so the
//     blocks read as a staircase silhouette.
//
// Degenerate inputs (zero/negative rise or run) yield no parts — the caller's
// fallback/clamps guarantee a sane piece, and a guard here keeps the math safe.
//
// This builder also carries the pure two-point CONNECTION helper
// (resolveRampConnection): the ramp is the only piece placed by connecting a
// bottom point to a top surface, computing its own params to literally span them.

import type { Vec2 } from "../store/schema";

/** Target riser height (meters); the stair's step count derives from this. */
export const STAIR_RISER_TARGET = 0.18;

/** Thickness of the inclined ramp slab (meters), measured across the incline. */
export const RAMP_SLAB_THICKNESS = 0.4;

/** Minimum horizontal run when two clicked points are (near) coincident (meters). */
export const MIN_RAMP_RUN = 0.5;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RampPart {
  /** "slab" = the inclined ramp plate; "step" = a stair block. */
  role: "slab" | "step";
  position: Vec3; // center in local space (y up from the underside)
  size: Vec3; // full extents: x = width, y = thickness/height, z = length/tread
  rotationX: number; // pitch about LOCAL X (radians); the slab's incline, 0 for steps
}

/** The four dimensions the builder needs (a structural subset of a Ramp piece). */
export interface RampDims {
  rise: number;
  run: number;
  width: number;
  style: "ramp" | "stair";
}

export interface StairLayout {
  steps: number; // number of steps (≥1 for a valid rise)
  riser: number; // ACTUAL riser height = rise / steps
  tread: number; // tread depth = run / steps
}

/**
 * Stair step layout for a given rise/run. Step count tracks the rise (more rise →
 * more steps) at ~STAIR_RISER_TARGET per step; the actual riser is rise / steps so
 * the steps land exactly on `rise`. Degenerate rise/run yields zero steps.
 */
export function computeStair(rise: number, run: number): StairLayout {
  if (rise <= 0 || run <= 0) return { steps: 0, riser: 0, tread: 0 };
  const steps = Math.max(1, Math.round(rise / STAIR_RISER_TARGET));
  return { steps, riser: rise / steps, tread: run / steps };
}

export function buildRamp(d: RampDims): RampPart[] {
  // Guard degenerate inputs: nothing to build for a non-positive rise or run.
  if (d.rise <= 0 || d.run <= 0) return [];

  if (d.style === "stair") {
    const { steps, riser, tread } = computeStair(d.rise, d.run);
    const parts: RampPart[] = [];
    for (let i = 0; i < steps; i++) {
      // Step i is a solid block from the underside (y=0) up to its tread top
      // ((i+1)·riser), spanning tread depth along +Z from i·tread.
      const topY = (i + 1) * riser;
      parts.push({
        role: "step",
        position: { x: 0, y: topY / 2, z: i * tread + tread / 2 },
        size: { x: d.width, y: topY, z: tread },
        rotationX: 0,
      });
    }
    return parts;
  }

  // Ramp: a single inclined slab. Its centerline runs from (y=0, z=0) to
  // (y=rise, z=run); the slab is that segment given thickness, pitched about
  // local X. Pitching by -angle lifts the +Z end up to `rise` (see math below).
  const angle = Math.atan2(d.rise, d.run);
  const length = Math.hypot(d.rise, d.run);
  return [
    {
      role: "slab",
      position: { x: 0, y: d.rise / 2, z: d.run / 2 },
      size: { x: d.width, y: RAMP_SLAB_THICKNESS, z: length },
      rotationX: -angle,
    },
  ];
}

// ---------------------------------------------------------------------------
// Two-point connection (the ramp's defining placement): bottom point + top hit →
// the ramp's stored { position, base, rotation, rise, run }. Literal connection —
// it does EXACTLY this math; it does not adjust the angle for a "nice" slope, so a
// steep result is honest feedback. Degenerate cases are clamped, never rejected.
// ---------------------------------------------------------------------------

import { snapHorizontalVec2, snapRotation } from "./grid";

export interface RampConnectionBottom {
  point: Vec2; // world XZ of the bottom click (grid-snapped by the caller or here)
  base: number; // the base to STORE (ground-relative support, via resolveSupportAt)
  height: number; // WORLD Y of the bottom support (groundHeightAt + base)
}

export interface RampConnectionTop {
  point: Vec2; // world XZ of the top click
  height: number; // WORLD Y of the top surface (the piece top the ray is over)
}

export interface RampConnection {
  position: Vec2;
  base: number;
  rotation: number;
  rise: number;
  run: number;
}

/**
 * Heading (degrees about world Y, SNAPPED to 15°) so the ramp's LOCAL +Z (its
 * climb direction) points from `from` toward `to` once rendered with rotation
 * [0, -deg2rad(rot), 0]. Derivation: local +Z maps to world (−sin rot, cos rot);
 * matching that to the from→to direction gives rot = atan2(−dx, dz). Shared by the
 * connection helper and the empty-top fallback so both aim the ramp identically.
 */
export function rampRotationToward(from: Vec2, to: Vec2): number {
  const dx = to.x - from.x;
  const dz = to.y - from.y;
  return snapRotation((Math.atan2(-dx, dz) * 180) / Math.PI);
}

export function resolveRampConnection(
  bottom: RampConnectionBottom,
  top: RampConnectionTop,
): RampConnection {
  const position = snapHorizontalVec2(bottom.point);
  // rise = top − bottom world heights; clamp a top-below-bottom case to 0 (never
  // negative). run = the literal horizontal distance between the clicks, floored
  // to a minimum so a (near) vertical connection still has a usable footprint.
  const rise = Math.max(0, top.height - bottom.height);
  const dist = Math.hypot(top.point.x - bottom.point.x, top.point.y - bottom.point.y);
  const run = Math.max(MIN_RAMP_RUN, dist);
  // rotation snapped to 15° (consistent with other pieces) — the ramp then points
  // APPROXIMATELY at the top; the panel tunes after. Heading uses the raw clicks.
  const rotation = rampRotationToward(bottom.point, top.point);
  return { position, base: bottom.base, rotation, rise, run };
}
