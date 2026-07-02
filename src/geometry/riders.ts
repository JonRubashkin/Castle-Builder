// The pure "riders" helper (phase 2G) — the pieces currently RESTING ON a given
// piece's top, derived FRESH FROM GEOMETRY (no stored parent/child links, no
// relationship graph). When a piece moves or its top height changes, its riders
// must ride with it; this is the single source of truth for "what is resting on
// this piece right now?".
//
// "Resting on X" is defined IDENTICALLY to how face-attach seats a piece: it
// reuses `resolveSupportAt` (the one support rule the placement / move paths
// already use), so there is never a second notion of "resting on". A candidate
// rides `piece` when resolveSupportAt would seat that candidate's anchor on THIS
// piece's top (i.e. the candidate is over piece's footprint AND piece is a
// stackable support surface) AND the candidate's stored base actually matches
// that top (within a tiny tolerance — it is really sitting there, not floating).
//
// Because the test flows entirely through resolveSupportAt, the support-surface
// exclusions come for free and correctly:
//   • A moat / ramp / gate / flag is NOT a support surface, so NOTHING rides one
//     (resolveSupportAt never returns their id as the surface) — in particular
//     "nothing tries to ride a moat".
//   • But a FLAG (or any piece) resting on a tower top IS a valid rider — the
//     exclusion is about being a SUPPORT SURFACE, never about being a rider.

import type { Piece } from "../store/schema";
import { resolveSupportAt } from "./support";

/** How close a candidate's stored base must be to the host's top to count as
 *  "resting on" it (meters). Face-attach seats exactly, so this only absorbs
 *  floating-point noise. */
export const RIDER_BASE_TOLERANCE = 1e-3;

/**
 * The DIRECT riders of `piece`: every other piece currently resting on its top.
 * Reuses `resolveSupportAt` so "can rest on `piece`" means exactly "`piece` is a
 * support surface under the candidate's anchor" — the same geometry face-attach
 * uses. A candidate counts only when its stored base also matches that top.
 */
export function ridersOf(piece: Piece, allPieces: Piece[]): Piece[] {
  return allPieces.filter((candidate) => {
    if (candidate.id === piece.id) return false;
    // Resolve the candidate's anchor against JUST this piece: surfaceId comes
    // back as piece.id only when piece is a stackable surface the anchor is over.
    const support = resolveSupportAt(candidate.position, [piece]);
    if (support.surfaceId !== piece.id) return false;
    return Math.abs(candidate.base - support.base) <= RIDER_BASE_TOLERANCE;
  });
}

/**
 * The TRANSITIVE rider set of `piece`: its riders, their riders, and so on —
 * everything stacked above it. Each piece appears exactly once, and a contrived
 * cycle (a degenerate configuration where A rests on B and B rests on A) is
 * guarded by a visited-set so it terminates instead of looping forever.
 *
 * The set is computed ONCE from the current geometry (BEFORE any movement) so a
 * move/resize can translate each rider exactly once by a single delta, rather
 * than re-evaluating mid-move (which could double-move or cascade incorrectly).
 * The result excludes `piece` itself.
 */
export function allRidersOf(piece: Piece, allPieces: Piece[]): Piece[] {
  const visited = new Set<string>([piece.id]);
  const result: Piece[] = [];
  const stack: Piece[] = [piece];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const rider of ridersOf(current, allPieces)) {
      if (visited.has(rider.id)) continue; // cycle / diamond guard: once each
      visited.add(rider.id);
      result.push(rider);
      stack.push(rider);
    }
  }
  return result;
}
