// Support-height resolution — the single rule for "what does a newly placed
// piece seat on at this anchor?" (CLAUDE.md: "A piece seats at the support
// height under its anchor. That support is the ground (groundHeightAt) or, via
// face-attach, the top of the piece below ... it never assumes 0").
//
// This is the pure core of face-attach: given the placement anchor and the
// existing pieces, it returns the base to STORE on the new piece. It routes
// vertical placement through groundHeightAt (over empty ground) or the hit
// surface's top (over a piece), NEVER a hardcoded value. It reuses the SAME
// footprint helper the renderer uses, so the hit-test can't drift from the mesh.

import type { Piece, Vec2 } from "../store/schema";
import { groundHeightAt } from "./ground";
import { footprintContains, towerFootprint } from "./towerFootprint";

export interface SupportResult {
  /** The base to store on the new piece (worldY underside = groundHeightAt + base). */
  base: number;
  /** True when seated on top of an existing piece; false when on the ground. */
  onSurface: boolean;
  /** The id of the piece seated upon, if any. */
  surfaceId: string | null;
}

/** World Y of a tower's top face (its support surface for a piece placed on it). */
function pieceTopWorldY(piece: Extract<Piece, { kind: "tower" }>): number {
  return groundHeightAt(piece.position.x, piece.position.y) + piece.base + piece.height;
}

/**
 * Resolve the support under `anchor` against the existing pieces. If the anchor
 * lies over one or more piece footprints, the new piece seats on the HIGHEST
 * top; otherwise it seats on the ground. Phase 1b stacks towers only.
 */
export function resolveSupportAt(anchor: Vec2, pieces: Piece[]): SupportResult {
  const groundY = groundHeightAt(anchor.x, anchor.y);
  let bestTop = groundY;
  let surfaceId: string | null = null;

  for (const piece of pieces) {
    if (piece.kind !== "tower") continue; // only towers exist / stack in 1b
    if (!footprintContains(towerFootprint(piece), anchor)) continue;
    const top = pieceTopWorldY(piece);
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
