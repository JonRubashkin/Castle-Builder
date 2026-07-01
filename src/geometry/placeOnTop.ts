// The pure resolver for the "Place on top" action — a one-shot that seats the
// SELECTED (moving) piece on top of a chosen TARGET piece, centered on it.
//
// It reuses the SAME height logic face-attach uses (`flatTopWorldY` in
// support.ts, never a literal ground-y) and the pieces' OWN stored anchors as the
// centers (the footprint source of truth — never a separately computed center),
// so it can't drift from what the meshes draw.

import type { Piece, Vec2 } from "../store/schema";
import { flatTopWorldY } from "./support";
import { groundHeightAt } from "./ground";

/**
 * Is this piece a valid "Place on top" TARGET? Any piece with a flat top —
 * derived from the shared `flatTopWorldY` so the set can't drift. This EXCLUDES
 * the moat (flat water, not a face-attach surface) and the ramp (its top is a
 * slope), matching the ramp/moat exclusion elsewhere.
 */
export function isPlaceOnTopTarget(piece: Piece): boolean {
  return flatTopWorldY(piece) !== null;
}

/** The center of a piece's footprint from its OWN stored anchors: the midpoint
 *  of a two-point piece (a wall run), else its single anchor. */
function pieceCenter(piece: Piece): Vec2 {
  if ("end" in piece && piece.end) {
    return {
      x: (piece.position.x + piece.end.x) / 2,
      y: (piece.position.y + piece.end.y) / 2,
    };
  }
  return { ...piece.position };
}

export interface PlaceOnTopResult {
  /** The moving piece's new anchor (its start endpoint for a two-point piece). */
  position: Vec2;
  /** The base to store — seated on the target's top (relative to ground). */
  base: number;
  /** The moving piece's new far endpoint, present only for a two-point piece. */
  end?: Vec2;
}

/**
 * Resolve where the moving piece lands when placed on top of the target.
 *
 *  • base   = the target's flat top (via `flatTopWorldY`, the shared face-attach
 *             height logic — never a literal), expressed relative to the ground
 *             under the moving piece's new anchor.
 *  • center = the moving piece's footprint center is shifted onto the target's
 *             center (the target's OWN anchor). A two-point piece (a wall run)
 *             shifts BOTH endpoints rigidly by that same delta so it keeps its
 *             shape and its center lands on the target center.
 *
 * Returns null when the target is invalid (the moat / a ramp — no flat top) or is
 * the moving piece itself. Overhang is allowed: a moving piece larger than the
 * target still centers (it overhangs — the caller does not reject it).
 */
export function resolvePlaceOnTop(moving: Piece, target: Piece): PlaceOnTopResult | null {
  if (moving.id === target.id) return null;
  const targetTop = flatTopWorldY(target);
  if (targetTop === null) return null; // moat / ramp are not valid targets

  const center = pieceCenter(moving);
  const dx = target.position.x - center.x;
  const dy = target.position.y - center.y;
  const position = { x: moving.position.x + dx, y: moving.position.y + dy };
  // Base is stored relative to the ground under the new anchor (flat phase: 0),
  // so the underside sits exactly on the target's top. Routed through
  // groundHeightAt — never a hardcoded 0 — so raised terrain stays additive.
  const base = targetTop - groundHeightAt(position.x, position.y);

  const result: PlaceOnTopResult = { position, base };
  if ("end" in moving && moving.end) {
    result.end = { x: moving.end.x + dx, y: moving.end.y + dy };
  }
  return result;
}
