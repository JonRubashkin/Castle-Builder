// Delete-drop (riding cleanup) — when a piece is deleted, the pieces that were
// riding on it must not be left floating. Each orphaned DIRECT rider re-seats onto
// whatever support is now beneath it (the next piece's top if one is there, else
// the ground) via the existing resolveSupportAt (never a literal ground-y). Each
// orphaned rider carries its OWN transitive riders down by the same vertical
// delta, so a sub-stack falls as a rigid unit.
//
// This deliberately REUSES the 2G riding geometry (ridersOf / allRidersOf /
// resolveSupportAt) — there is NO second notion of "resting on". Pure + tested:
// it returns a NEW pieces array (the input is untouched), so the store can drop it
// straight into a single undoable commit.

import type { Piece } from "../store/schema";
import { allRidersOf, ridersOf, RIDER_BASE_TOLERANCE } from "./riders";
import { resolveSupportAt } from "./support";

/**
 * Remove `deletedId` from `pieces` and re-seat its orphaned riders.
 *
 * Worked examples (both hold):
 *  • A-on-B-on-C (C on ground). Delete C → B re-seats to the ground and A stays on
 *    B (the B+A sub-stack drops together).
 *  • Delete the middle B (in A-on-B-on-C) → A re-seats onto C's top (the support
 *    now beneath it), not the ground.
 */
export function dropRidersAfterDelete(pieces: Piece[], deletedId: string): Piece[] {
  const target = pieces.find((p) => p.id === deletedId);
  // Nothing to do (unknown id) — return a fresh copy for a consistent contract.
  if (!target) return pieces.map((p) => ({ ...p }));

  // The DIRECT riders resting on the deleted piece's top, captured from the
  // pre-deletion geometry (the same rule face-attach / riding use).
  const directRiders = ridersOf(target, pieces);

  // Work on shallow clones so we can adjust `base` without mutating the input.
  let next: Piece[] = pieces
    .filter((p) => p.id !== deletedId)
    .map((p) => ({ ...p }));

  for (const rider of directRiders) {
    const current = next.find((p) => p.id === rider.id);
    if (!current) continue;
    // This rider carries its own transitive sub-stack down rigidly. Compute the
    // sub-stack from the current (target-removed) geometry, and exclude it (plus
    // the rider itself) from the support search so the rider can't seat on its
    // own stack.
    const sub = allRidersOf(current, next);
    const moveIds = new Set<string>([current.id, ...sub.map((r) => r.id)]);
    const others = next.filter((p) => !moveIds.has(p.id));
    // Re-seat onto whatever support is now beneath the rider's anchor: the next
    // piece's top, else the ground — always through resolveSupportAt.
    const support = resolveSupportAt(current.position, others);
    const delta = support.base - current.base;
    if (Math.abs(delta) > RIDER_BASE_TOLERANCE) {
      next = next.map((p) =>
        moveIds.has(p.id) ? { ...p, base: p.base + delta } : p,
      );
    }
  }

  return next;
}
