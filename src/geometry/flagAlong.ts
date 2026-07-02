// The pure auto-place-along helper (phase 2Fe) — the SINGLE source of truth for
// "where do the flags go when placed along a host piece?" Given a host with a flat
// top EDGE (a wall run, or a gatehouse top), it returns evenly-spaced flag anchor
// positions along that top plus the base height (the host's flat top), so the
// store action just materializes independent Flag pieces at these spots.
//
// Supported hosts (stated deliberately):
//   • wallRun   — flags spaced along the wall's LENGTH (its two endpoints).
//   • gatehouse — flags spaced along the top's WIDTH edge (local X, the facing),
//                 centered on the depth — the same "line" logic as a wall.
// DEFERRED hosts: a TOWER (a round/point top has no natural "along" line — place a
//   single flag by hand), and gate/ramp/moat/flag (not hosts). This keeps the set
//   to pieces with a clear straight top edge.
//
// Generate-once, NOT auto-maintained: the caller creates ordinary independent Flag
// pieces from these positions. Nothing here (or in the store) links the flags to
// the host — resizing/moving the host later does not re-space or move them (the
// project's generate-once-and-explicit caution). It is pure + unit-tested.

import type { Piece, Vec2 } from "../store/schema";
import { flatTopWorldY } from "./support";
import { groundHeightAt } from "./ground";

/** Default target spacing between flags, in meters (used when no count is given). */
export const DEFAULT_FLAG_ALONG_SPACING = 4;
/** Default inset from each end of the host's top edge, in meters. */
export const DEFAULT_FLAG_ALONG_INSET = 1;
/** Hard cap on generated flags, so an extreme length/spacing can't spam pieces. */
export const MAX_FLAGS_ALONG = 50;

export interface FlagAlongOptions {
  /** Explicit flag count (takes precedence over spacing when given, ≥ 1). */
  count?: number;
  /** Target spacing in meters (used when `count` is undefined). */
  spacing?: number;
  /** Inset from each end of the top edge, in meters. */
  inset?: number;
}

export interface FlagPlacement {
  /** World XZ anchor for the flag's pole (on the host's top edge). */
  position: Vec2;
  /** World Y of the flag's underside — the host's flat top (via flatTopWorldY),
   *  expressed relative to the ground under the anchor (never a literal). */
  base: number;
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

/** The host's top EDGE as a segment [a, b] in world XZ, or null if unsupported. */
function topEdge(piece: Piece): { a: Vec2; b: Vec2 } | null {
  switch (piece.kind) {
    case "wallRun":
      // The wall's two endpoints ARE its top edge.
      return { a: { ...piece.position }, b: { ...piece.end } };
    case "gatehouse": {
      // A row across the top along local X (the width/facing), centered on depth.
      // Local +X maps to world (cos r, sin r) — the renderer's rotation convention.
      const r = deg2rad(piece.rotation);
      const half = piece.width / 2;
      const dx = Math.cos(r) * half;
      const dz = Math.sin(r) * half;
      const c = piece.position;
      return {
        a: { x: c.x - dx, y: c.y - dz },
        b: { x: c.x + dx, y: c.y + dz },
      };
    }
    default:
      return null; // tower (round/point top) + gate/ramp/moat/flag are not hosts
  }
}

/** Is this piece a supported auto-place-along HOST? (wall run / gatehouse.) */
export function isFlagAlongHost(piece: Piece): boolean {
  return topEdge(piece) !== null;
}

/** How many flags to place given the usable edge length and the options. */
function resolveCount(usableLength: number, opts: FlagAlongOptions): number {
  if (opts.count !== undefined) {
    return Math.max(1, Math.min(MAX_FLAGS_ALONG, Math.floor(opts.count)));
  }
  const spacing = opts.spacing && opts.spacing > 0 ? opts.spacing : DEFAULT_FLAG_ALONG_SPACING;
  if (usableLength <= 0) return 1;
  // floor(usable/spacing)+1 evenly-spaced points ≈ `spacing` apart (endpoints
  // land AT the insets), a minimum of one flag.
  const n = Math.floor(usableLength / spacing) + 1;
  return Math.max(1, Math.min(MAX_FLAGS_ALONG, n));
}

/**
 * Evenly-spaced flag placements along a host piece's top edge.
 *
 *  • The edge is inset from BOTH ends by `inset` (default 1 m); flags are placed
 *    from the first inset point to the last, inclusive.
 *  • `count` (if given) sets the number of flags exactly; otherwise it derives
 *    from `spacing` (default 4 m). A single flag lands at the edge's midpoint.
 *  • `base` is the host's flat top via the shared `flatTopWorldY` (never a literal
 *    ground-y), so raised terrain stays additive.
 *
 * Returns [] for an unsupported host or a degenerate (too-short) edge.
 */
export function flagPositionsAlong(
  piece: Piece,
  opts: FlagAlongOptions = {},
): FlagPlacement[] {
  const edge = topEdge(piece);
  if (!edge) return [];
  const top = flatTopWorldY(piece);
  if (top === null) return [];

  const inset = opts.inset !== undefined ? Math.max(0, opts.inset) : DEFAULT_FLAG_ALONG_INSET;
  const { a, b } = edge;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0) return [];

  // Clamp the inset so it can't cross past the midpoint (a very short edge just
  // collapses to a single centered flag).
  const clampedInset = Math.min(inset, length / 2);
  const usableLength = length - 2 * clampedInset;
  const ux = dx / length;
  const uy = dy / length;

  // The inset endpoints along the edge.
  const startX = a.x + ux * clampedInset;
  const startY = a.y + uy * clampedInset;

  const count = resolveCount(usableLength, opts);

  const placements: FlagPlacement[] = [];
  for (let i = 0; i < count; i++) {
    // One flag → the midpoint; N flags → from the start inset to the end inset.
    const t = count === 1 ? 0.5 : i / (count - 1);
    const px = startX + ux * usableLength * t;
    const py = startY + uy * usableLength * t;
    placements.push({
      position: { x: px, y: py },
      base: top - groundHeightAt(px, py),
    });
  }
  return placements;
}
