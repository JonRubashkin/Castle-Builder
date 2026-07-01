// Footprint-overlap math for the "center on support" placement mode.
//
// The base center-on-support rule snaps a moved piece onto a support only when
// the moved piece's ANCHOR lies over that support's footprint. This module makes
// the trigger EAGER, per the product decision: a moved piece centers on a support
// as soon as it is "mostly there" — when MORE THAN 50% of the moved piece's
// footprint lies within the support, OR when their centers align. Both tests are
// pure and unit-tested.
//
// Everything here reuses the SAME per-piece footprint helpers the renderers and
// the hit-test use, so the overlap math can never drift from what is drawn:
//  • containment (a point inside a support) → `pieceFootprintContains`, the ONE
//    dispatch also used by `resolveSupportAt`.
//  • the moved piece's area → sampled uniformly across its own footprint.

import type { Piece, Vec2 } from "../store/schema";
import { footprintContains, towerFootprint } from "./towerFootprint";
import { gatehouseFootprint } from "./gatehouseFootprint";
import { wallRunFootprint } from "./wallRunFootprint";
import { gateFootprint } from "./gateFootprint";
import { rampFootprint } from "./rampFootprint";
import { rectFootprintContains } from "./rectFootprint";

/** >50% of the moved piece within a support latches the center snap. */
export const CENTER_SNAP_OVERLAP = 0.5;
/** Anchors this close (meters) count as "centers aligned" — latches regardless
 *  of overlap area, so a large piece still snaps onto a small support. */
export const CENTER_ALIGN_TOLERANCE = 0.2;

/**
 * Is a world XZ point inside this piece's footprint? The SINGLE containment
 * dispatch shared by support resolution and overlap sampling. Only STACKABLE
 * surfaces (tower / gatehouse / wall run) are footprints a piece can seat on;
 * gate / ramp / moat are never surfaces (they return false here).
 */
export function pieceFootprintContains(piece: Piece, point: Vec2): boolean {
  switch (piece.kind) {
    case "tower":
      return footprintContains(towerFootprint(piece), point);
    case "gatehouse":
      return rectFootprintContains(gatehouseFootprint(piece), point);
    case "wallRun":
      return rectFootprintContains(wallRunFootprint(piece), point);
    default:
      return false; // gate / ramp / moat are not stackable surfaces
  }
}

// A normalized footprint for the MOVED piece — just enough to sample its area.
type NormFootprint =
  | { kind: "circle"; center: Vec2; radius: number }
  | { kind: "rect"; center: Vec2; halfX: number; halfZ: number; rotation: number };

/** Normalized footprint of the moved piece (any footprinted kind), or null for
 *  pieces that never center-snap (a moat is inherently ground-only). */
function movingFootprint(piece: Piece): NormFootprint | null {
  switch (piece.kind) {
    case "tower": {
      const fp = towerFootprint(piece);
      return fp.profile === "round"
        ? { kind: "circle", center: fp.center, radius: fp.radius }
        : { kind: "rect", center: fp.center, halfX: fp.radius, halfZ: fp.radius, rotation: fp.rotation };
    }
    case "gatehouse": {
      const fp = gatehouseFootprint(piece);
      return { kind: "rect", center: fp.center, halfX: fp.halfX, halfZ: fp.halfZ, rotation: fp.rotation };
    }
    case "wallRun": {
      const fp = wallRunFootprint(piece);
      return { kind: "rect", center: fp.center, halfX: fp.halfX, halfZ: fp.halfZ, rotation: fp.rotation };
    }
    case "gate": {
      const fp = gateFootprint(piece);
      return { kind: "rect", center: fp.center, halfX: fp.halfX, halfZ: fp.halfZ, rotation: fp.rotation };
    }
    case "ramp": {
      const fp = rampFootprint(piece);
      return { kind: "rect", center: fp.center, halfX: fp.halfX, halfZ: fp.halfZ, rotation: fp.rotation };
    }
    default:
      return null; // moat: ground-only, never center-snaps
  }
}

// Grid resolution for area sampling (odd so the exact center is sampled). A
// 15×15 grid resolves the 50% threshold comfortably for a mouse interaction.
const SAMPLE_GRID = 15;

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

/**
 * Area-uniform sample points across the moved piece's footprint (world XZ). Grid
 * points are laid over the local footprint box and, for a circle, clipped to the
 * disk — so each retained point stands for an equal slice of area and counting
 * how many fall inside a support gives the overlap FRACTION. Points map to world
 * through the same render rotation convention the meshes use.
 */
function footprintSamples(fp: NormFootprint): Vec2[] {
  const pts: Vec2[] = [];
  if (fp.kind === "circle") {
    const r = fp.radius;
    for (let i = 0; i < SAMPLE_GRID; i++) {
      for (let j = 0; j < SAMPLE_GRID; j++) {
        const lx = -r + 2 * r * (i / (SAMPLE_GRID - 1));
        const lz = -r + 2 * r * (j / (SAMPLE_GRID - 1));
        if (lx * lx + lz * lz <= r * r) {
          pts.push({ x: fp.center.x + lx, y: fp.center.y + lz });
        }
      }
    }
  } else {
    const rot = deg2rad(fp.rotation);
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (let i = 0; i < SAMPLE_GRID; i++) {
      for (let j = 0; j < SAMPLE_GRID; j++) {
        const lx = -fp.halfX + 2 * fp.halfX * (i / (SAMPLE_GRID - 1));
        const lz = -fp.halfZ + 2 * fp.halfZ * (j / (SAMPLE_GRID - 1));
        // local → world (render map: worldX = lx·cos − lz·sin, worldZ = lx·sin + lz·cos)
        pts.push({ x: fp.center.x + lx * c - lz * s, y: fp.center.y + lx * s + lz * c });
      }
    }
  }
  return pts;
}

/**
 * Fraction (0..1) of the MOVED piece's footprint that lies within the SUPPORT
 * piece's footprint. Returns 0 when the moved piece has no footprint (a moat) or
 * the support is not a stackable surface.
 */
export function footprintOverlapFraction(moving: Piece, support: Piece): number {
  const fp = movingFootprint(moving);
  if (!fp) return 0;
  const samples = footprintSamples(fp);
  if (samples.length === 0) return 0;
  let inside = 0;
  for (const p of samples) {
    if (pieceFootprintContains(support, p)) inside++;
  }
  return inside / samples.length;
}

/**
 * Should the moved piece center-snap onto this support? True when their anchors
 * ALIGN (within CENTER_ALIGN_TOLERANCE) or MORE THAN CENTER_SNAP_OVERLAP of the
 * moved piece's footprint lies within the support. The anchor test uses each
 * piece's stored `position` — the same "center" the snap resolves to — so the
 * decision and the destination agree.
 */
export function shouldCenterSnap(moving: Piece, support: Piece): boolean {
  const dx = moving.position.x - support.position.x;
  const dy = moving.position.y - support.position.y;
  if (dx * dx + dy * dy <= CENTER_ALIGN_TOLERANCE * CENTER_ALIGN_TOLERANCE) return true;
  return footprintOverlapFraction(moving, support) > CENTER_SNAP_OVERLAP;
}
