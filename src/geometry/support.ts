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
 * The two placement modes (a persisted UI pref, NOT part of the Design). They are
 * mutually exclusive — a moved piece resolves its support through ONE of them:
 *
 *  • "normal"     — the default face-attach rule (ground or a piece top).
 *  • "groundOnly" — ignore face-attach entirely; always seat on the ground
 *                   (a moved piece never climbs onto other pieces).
 */
export type PlacementMode = "normal" | "groundOnly";

export interface SupportResult {
  /** The base to store on the new piece (worldY underside = groundHeightAt + base). */
  base: number;
  /** True when seated on top of an existing piece; false when on the ground. */
  onSurface: boolean;
  /** The id of the piece seated upon, if any. */
  surfaceId: string | null;
}

/**
 * World Y of a piece's FLAT top — the single height formula shared by face-attach
 * (`pieceTopWorldY` below) and the "Place on top" action (`resolvePlaceOnTop`).
 * It routes through groundHeightAt + the stored base + the stored height, NEVER a
 * literal ground-y. Pieces with no flat top return null: a ramp's top is a slope
 * and a moat is flat water, so neither can be seated upon.
 */
export function flatTopWorldY(piece: Piece): number | null {
  switch (piece.kind) {
    case "tower":
    case "gatehouse":
    case "wallRun":
    case "gate":
      return groundHeightAt(piece.position.x, piece.position.y) + piece.base + piece.height;
    default:
      return null; // ramp (slope) / moat (water): no flat top
  }
}

/** Is a world XZ point inside this piece's footprint? The single containment
 *  dispatch shared by support resolution. Only STACKABLE surfaces (tower /
 *  gatehouse / wall run) are footprints a piece can face-attach onto; gate /
 *  ramp / moat are never face-attach surfaces (they return false here). */
function pieceFootprintContains(piece: Piece, point: Vec2): boolean {
  switch (piece.kind) {
    case "tower":
      return footprintContains(towerFootprint(piece), point);
    case "gatehouse":
      return rectFootprintContains(gatehouseFootprint(piece), point);
    case "wallRun":
      return rectFootprintContains(wallRunFootprint(piece), point);
    default:
      return false; // gate / ramp / moat are not face-attach surfaces
  }
}

/** The set of pieces a NEW piece can face-attach onto (ground-raycast placement /
 *  the move-drag path). Distinct from the broader "Place on top" target set,
 *  which also includes the gate — the two share the height formula
 *  (`flatTopWorldY`) but not the surface set. */
function isFaceAttachSurface(piece: Piece): boolean {
  return piece.kind === "tower" || piece.kind === "gatehouse" || piece.kind === "wallRun";
}

/** World Y of a face-attach surface's top, or null for a non-surface piece. */
function pieceTopWorldY(piece: Piece): number | null {
  return isFaceAttachSurface(piece) ? flatTopWorldY(piece) : null;
}

/**
 * Resolve the support under `anchor` against the existing pieces. If the anchor
 * lies over one or more piece footprints, the new piece seats on the HIGHEST
 * top; otherwise it seats on the ground.
 *
 * `mode` (default "normal") makes this the SINGLE mode-aware support path used by
 * both placement and the move/drag path — never a duplicate:
 *  • "groundOnly" short-circuits to the ground (no surface hits considered).
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
    return { base: groundY - groundY, onSurface: false, surfaceId: null };
  }

  // Generic face-attach support: the highest STACKABLE piece whose footprint the
  // anchor lies over (ground otherwise).
  let bestTop = groundY;
  let surfaceId: string | null = null;
  for (const piece of pieces) {
    const top = pieceTopWorldY(piece);
    if (top === null) continue;
    if (!pieceFootprintContains(piece, anchor)) continue;
    if (top > bestTop) {
      bestTop = top;
      surfaceId = piece.id;
    }
  }

  return {
    base: bestTop - groundY, // 0 over ground; the surface top (rel. ground) over a piece
    onSurface: surfaceId !== null,
    surfaceId,
  };
}
