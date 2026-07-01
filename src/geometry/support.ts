// Support-height resolution — the single rule for "what does a newly placed
// piece seat on at this anchor?" (CLAUDE.md: "A piece seats at the support
// height under its anchor. That support is the ground (groundHeightAt) or, via
// face-attach, the top of the piece below ... it never assumes 0").
//
// This is the pure core of face-attach: given the placement anchor and the
// existing pieces, it returns the base to STORE on the new piece. It routes
// vertical placement through groundHeightAt (over empty ground) or the hit
// surface's top (over a piece), NEVER a hardcoded value. It reuses the SAME
// footprint helpers the renderers use, so the hit-test can't drift from a mesh.

import type { Piece, Vec2 } from "../store/schema";
import { groundHeightAt } from "./ground";
import { pieceFootprintContains, shouldCenterSnap } from "./footprintOverlap";

/**
 * The three placement modes (a persisted UI pref, NOT part of the Design). They
 * are mutually exclusive — a moved piece resolves its support through ONE of them:
 *
 *  • "normal"          — the default face-attach rule (ground or a piece top).
 *  • "groundOnly"      — ignore face-attach entirely; always seat on the ground
 *                        (a moved piece never climbs onto other pieces).
 *  • "centerOnSupport" — snap the moved piece's anchor (XZ) onto a support's
 *                        center as soon as the piece is "mostly there" (>50%
 *                        footprint overlap, or aligned centers), not only when
 *                        the anchor is over the support. Height comes from that
 *                        support's top (the piece will land centered on it).
 */
export type PlacementMode = "normal" | "groundOnly" | "centerOnSupport";

export interface SupportResult {
  /** The base to store on the new piece (worldY underside = groundHeightAt + base). */
  base: number;
  /** True when seated on top of an existing piece; false when on the ground. */
  onSurface: boolean;
  /** The id of the piece seated upon, if any. */
  surfaceId: string | null;
  /**
   * For "centerOnSupport" when the moved piece latches to a support: that
   * support's anchor (its own footprint center source of truth) to snap the
   * moved piece's XZ to. Null/absent in every other case (normal, ground, or no
   * latch).
   */
  center?: Vec2 | null;
}

/** World Y of a piece's top face (the surface a piece placed on it seats upon). */
function pieceTopWorldY(piece: Piece): number | null {
  switch (piece.kind) {
    case "tower":
    case "gatehouse":
    case "wallRun":
      // Each carries a height; its anchor seats at groundHeightAt + base.
      return groundHeightAt(piece.position.x, piece.position.y) + piece.base + piece.height;
    default:
      return null;
  }
}

/**
 * Resolve the support under `anchor` against the existing pieces. If the anchor
 * lies over one or more piece footprints, the new piece seats on the HIGHEST
 * top; otherwise it seats on the ground.
 *
 * `mode` (default "normal") makes this the SINGLE mode-aware support path used by
 * both placement and the move/drag path — never a duplicate:
 *  • "groundOnly"      short-circuits to the ground (no surface hits considered).
 *  • "centerOnSupport" latches the moved piece onto a support as soon as it is
 *    "mostly there" (>50% footprint overlap or aligned centers — see
 *    `shouldCenterSnap`), reporting that support's center in `center` and rising
 *    to ITS top (the piece will land centered on it). Needs `moving` (the piece
 *    being dragged) to measure overlap; without it, falls back to the anchor-over
 *    -footprint rule for backward compatibility.
 */
export function resolveSupportAt(
  anchor: Vec2,
  pieces: Piece[],
  mode: PlacementMode = "normal",
  moving?: Piece,
): SupportResult {
  const groundY = groundHeightAt(anchor.x, anchor.y);

  // Ground-only: ignore face-attach entirely — always seat on the ground. Base
  // is the ground-relative underside (0), routed through the ground-height rule.
  if (mode === "groundOnly") {
    return { base: groundY - groundY, onSurface: false, surfaceId: null, center: null };
  }

  // Generic face-attach support: the highest STACKABLE piece whose footprint the
  // anchor lies over (ground otherwise). Used by "normal", by centerOnSupport's
  // no-latch fallback, and — captured as surfaceCenter — by the backward-compat
  // (no `moving`) centerOnSupport path.
  let bestTop = groundY;
  let surfaceId: string | null = null;
  let surfaceCenter: Vec2 | null = null;
  for (const piece of pieces) {
    const top = pieceTopWorldY(piece);
    if (top === null) continue;
    if (!pieceFootprintContains(piece, anchor)) continue;
    if (top > bestTop) {
      bestTop = top;
      surfaceId = piece.id;
      surfaceCenter = { ...piece.position };
    }
  }

  // Eager center-on-support (the move/drag path, where `moving` is known): the
  // piece latches onto the highest STACKABLE support it is "mostly on" — >50%
  // footprint overlap OR aligned centers (`shouldCenterSnap`) — even if the live
  // anchor is not yet over it, reporting that support's center and rising to ITS
  // top (the piece will land centered on it on drop). Below that threshold it is
  // plain face-attach with NO centering — so a center is reported ONLY when the
  // 50%/aligned rule fires, never merely because the anchor grazed a footprint.
  if (mode === "centerOnSupport" && moving) {
    let snapTop = -Infinity;
    let snapId: string | null = null;
    let snapCenter: Vec2 | null = null;
    for (const piece of pieces) {
      const top = pieceTopWorldY(piece);
      if (top === null) continue; // only stackable surfaces
      if (!shouldCenterSnap(moving, piece)) continue;
      if (top > snapTop) {
        snapTop = top;
        snapId = piece.id;
        snapCenter = { ...piece.position };
      }
    }
    if (snapCenter) {
      return { base: snapTop - groundY, onSurface: true, surfaceId: snapId, center: snapCenter };
    }
    // No latch → plain face-attach at the live anchor, no centering.
    return { base: bestTop - groundY, onSurface: surfaceId !== null, surfaceId, center: null };
  }

  return {
    base: bestTop - groundY, // 0 over ground; the surface top (rel. ground) over a piece
    onSurface: surfaceId !== null,
    surfaceId,
    // Backward-compat: with no `moving`, centerOnSupport reports the anchor-over
    // -footprint center (the older rule). normal/others never report a center.
    center: mode === "centerOnSupport" ? surfaceCenter : null,
  };
}
