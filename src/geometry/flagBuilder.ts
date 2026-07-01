// The pure flag builder (phase 2Fb) — returns the flag's geometry in LOCAL space
// (y up from the piece's underside; the piece's own forward = +Z), composed of a
// thin POLE/staff cylinder standing on the underside and a CLOTH rectangle
// attached near the pole top, flying out along local +X (the hoist edge is at the
// pole). Pure + unit-tested; no hooks, no THREE.
//
// The cloth is a flat rectangle here — clothWidth × (clothWidth / aspect); the
// renderer adds a subtle STATIC curve so it doesn't read as flat cardboard (no
// animation/waving — deferred). The cloth carries no material of its own: the
// FlagMesh skins it with the 2Fa renderFlag texture of the embedded design.

import type { Flag, Vec3 } from "../store/schema";

/** Radius of the thin pole/staff, in meters. */
export const POLE_RADIUS = 0.06;
/** Radial segment count for the pole cylinder (a thin staff needs few). */
export const POLE_RADIAL_SEGMENTS = 12;

export interface FlagPolePart {
  radius: number;
  height: number;
  position: Vec3; // center in local space
}

export interface FlagClothPart {
  width: number; // along local X (the hoist→fly span)
  height: number; // along local Y (derived from the design aspect)
  position: Vec3; // center in local space
}

export interface FlagParts {
  pole: FlagPolePart;
  cloth: FlagClothPart;
}

/**
 * The cloth's height, derived from its long edge and the embedded design's aspect
 * (width : height). A degenerate aspect is guarded so the height stays finite and
 * positive (the renderer/tests never divide by zero).
 */
export function flagClothHeight(clothWidth: number, aspect: number): number {
  const a = aspect > 0 ? aspect : 1;
  return clothWidth / a;
}

export function buildFlag(flag: Flag): FlagParts {
  const clothHeight = flagClothHeight(flag.clothWidth, flag.design.aspect);
  return {
    pole: {
      radius: POLE_RADIUS,
      height: flag.poleHeight,
      // Cylinder centered at half its height so its underside sits at y=0.
      position: { x: 0, y: flag.poleHeight / 2, z: 0 },
    },
    cloth: {
      width: flag.clothWidth,
      height: clothHeight,
      // Flies out along +X from the pole (hoist at x=0, fly edge at x=clothWidth),
      // with its TOP edge at the pole top (y = poleHeight).
      position: {
        x: flag.clothWidth / 2,
        y: flag.poleHeight - clothHeight / 2,
        z: 0,
      },
    },
  };
}
