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
import { footprintContains, towerFootprint } from "./towerFootprint";
import { gatehouseFootprint } from "./gatehouseFootprint";
import { wallRunFootprint } from "./wallRunFootprint";
import { rectFootprintContains } from "./rectFootprint";

/**
 * The three placement modes (a persisted UI pref, NOT part of the Design). They
 * are mutually exclusive — a moved piece resolves its support through ONE of them:
 *
 *  • "normal"          — the default face-attach rule (ground or a piece top).
 *  • "groundOnly"      — ignore face-attach entirely; always seat on the ground
 *                        (a moved piece never climbs onto other pieces).
 *  • "centerOnSupport" — normal face-attach height, but when resting on a piece,
 *                        snap the moved piece's anchor (XZ) to that piece's
 *                        center. Height still comes from face-attach.
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
   * For "centerOnSupport" when resting on a piece: the supporting piece's anchor
   * (its own footprint center source of truth) to snap the moved piece's XZ to.
   * Null/absent in every other case (normal, ground, or not centering).
   */
  center?: Vec2 | null;
}

/** Does `anchor` lie over this piece's footprint? (Same helpers the meshes use.) */
function pieceContainsAnchor(piece: Piece, anchor: Vec2): boolean {
  switch (piece.kind) {
    case "tower":
      return footprintContains(towerFootprint(piece), anchor);
    case "gatehouse":
      return rectFootprintContains(gatehouseFootprint(piece), anchor);
    case "wallRun":
      return rectFootprintContains(wallRunFootprint(piece), anchor);
    default:
      return false; // gate/ramp/moat are not stackable surfaces in this phase
  }
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
 *  • "centerOnSupport" resolves normally, then reports the supporting piece's
 *    center in `center` so the caller can snap the moved piece's XZ onto it.
 */
export function resolveSupportAt(
  anchor: Vec2,
  pieces: Piece[],
  mode: PlacementMode = "normal",
): SupportResult {
  const groundY = groundHeightAt(anchor.x, anchor.y);

  // Ground-only: ignore face-attach entirely — always seat on the ground. Base
  // is the ground-relative underside (0), routed through the ground-height rule.
  if (mode === "groundOnly") {
    return { base: groundY - groundY, onSurface: false, surfaceId: null, center: null };
  }

  let bestTop = groundY;
  let surfaceId: string | null = null;
  // The supporting piece's own anchor (its footprint center source of truth),
  // captured alongside the highest top for the centerOnSupport mode.
  let surfaceCenter: Vec2 | null = null;

  for (const piece of pieces) {
    const top = pieceTopWorldY(piece);
    if (top === null) continue;
    if (!pieceContainsAnchor(piece, anchor)) continue;
    if (top > bestTop) {
      bestTop = top;
      surfaceId = piece.id;
      surfaceCenter = { ...piece.position };
    }
  }

  return {
    base: bestTop - groundY, // 0 over ground; the surface top (rel. ground) over a piece
    onSurface: surfaceId !== null,
    surfaceId,
    // Only centerOnSupport reports a center, and only when actually on a surface.
    center: mode === "centerOnSupport" ? surfaceCenter : null,
  };
}
