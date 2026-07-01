// Phase 2F — the flag data model (slice 2Fa: pure types only, no rendering here).
//
// A FlagDesign is an ordered LAYER STACK drawn back-to-front (index 0 first,
// underneath). This is "Approach A" — a procedural heraldic composition of a
// field, optional stripe bands, and preset charges (symbols). It is deliberately
// SEPARATE from the phase-1 `Design`/`Piece` schema (`src/store/schema.ts`),
// which is untouched this slice; the flag *piece* and its schema bump arrive in
// 2Fb. Field names here are load-bearing — later slices (editor, library,
// placement) depend on them, so keep them exactly as written.

import type { SymbolId } from "./symbols/ids";

// The background layer's fill: either one solid color, or a heraldic division
// with one color per resulting section.
export type FieldFill =
  | { kind: "solid"; color: string } // hex
  | {
      kind: "division";
      // perPale: vertical split (2). perFess: horizontal split (2).
      // perBend: diagonal split (2). quarterly: four quarters (4).
      division: "perPale" | "perFess" | "perBend" | "quarterly";
      colors: string[]; // one color per resulting section (2 or 4)
    };

// One layer of the stack. Drawn in array order, back-to-front.
export type FlagLayer =
  | { kind: "field"; fill: FieldFill }
  | {
      kind: "stripes";
      orientation: "horizontal" | "vertical" | "diagonal";
      count: number;
      colors: string[]; // per-band; bands cycle through this list
    }
  | {
      kind: "charge";
      symbolId: SymbolId;
      x: number; // 0..1 normalized position within the flag rect
      y: number; // 0..1 normalized
      scale: number; // 1 ≈ the charge spans the flag height (see chargeTransform)
      color: string; // hex
      rotation?: number; // degrees, optional (default 0)
    };

export interface FlagDesign {
  aspect: number; // width : height ratio (e.g. 1.5) — a flag is a rectangle
  layers: FlagLayer[]; // ordered back-to-front
}

// Default aspect for a new flag (a common flag proportion).
export const DEFAULT_FLAG_ASPECT = 1.5;
