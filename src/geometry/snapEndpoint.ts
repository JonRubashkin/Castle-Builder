// Endpoint snapping — a pure helper that lets a wall run's endpoints latch onto a
// nearby piece anchor so curtain walls connect cleanly to corner masses. It is
// the single source of truth for "where does this wall endpoint land?", called by
// BOTH the placement path (each wall click) and the endpoint-handle editing path
// (one helper, never two copies), exactly the prior project's snap pattern.
//
// CONVENIENCE ONLY — this introduces NO attachment relationship. It just returns a
// point to STORE; the wall stays two plain points. Nothing rides along if the
// anchor (the tower/gatehouse) is later moved. It also doesn't change the existing
// wall↔tower OVERLAP (the tower mass still hides the seam); snapping merely lands
// the endpoint on the tower's center cleanly.

import type { Piece, Vec2 } from "../store/schema";
import { snapHorizontalVec2 } from "./grid";

/** How close (meters) a wall endpoint must be to a piece anchor to snap to it. */
export const WALL_SNAP_TOLERANCE = 0.5;

export interface EndpointSnap {
  /** The resolved endpoint: a piece anchor when snapped, else the 0.1 m grid. */
  point: Vec2;
  /** True when the endpoint latched onto a piece anchor. */
  snapped: boolean;
  /** The id of the anchor piece, if snapped (purely informational — no link). */
  anchorId: string | null;
}

/**
 * The snap-target anchor for a piece, or null if it is not a snap target. Curtain
 * walls connect to the masses with a single center anchor — towers and gatehouses.
 * Wall runs, gates, ramps, and moats are not snap targets in this phase.
 */
function snapAnchor(piece: Piece): Vec2 | null {
  if (piece.kind === "tower" || piece.kind === "gatehouse") return piece.position;
  return null;
}

/**
 * Snap a candidate wall endpoint to the NEAREST piece anchor within
 * WALL_SNAP_TOLERANCE (nearest wins when several are in range); otherwise fall
 * back to the 0.1 m horizontal grid. The returned point is what gets stored.
 */
export function snapEndpoint(candidate: Vec2, pieces: Piece[]): EndpointSnap {
  let best: { point: Vec2; id: string; dist: number } | null = null;
  for (const piece of pieces) {
    const anchor = snapAnchor(piece);
    if (!anchor) continue;
    const dist = Math.hypot(anchor.x - candidate.x, anchor.y - candidate.y);
    if (dist <= WALL_SNAP_TOLERANCE && (best === null || dist < best.dist)) {
      best = { point: anchor, id: piece.id, dist };
    }
  }
  if (best) return { point: { ...best.point }, snapped: true, anchorId: best.id };
  return { point: snapHorizontalVec2(candidate), snapped: false, anchorId: null };
}
