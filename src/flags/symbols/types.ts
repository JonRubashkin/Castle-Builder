// A symbol (charge) definition: pure data the renderer draws at a given
// position / scale / color. Each symbol is one or more SVG path `d` strings over
// a nominal viewBox (its own local coordinate box, origin top-left). The renderer
// centers the viewBox on the charge's normalized position and scales it (see
// chargeTransform in ../layout.ts). Keep silhouettes SIMPLE and BOLD — they must
// read as their subject at flag scale.

import type { SymbolId } from "./ids";

export interface SymbolDef {
  id: SymbolId;
  label: string; // human-facing name (for the library UI in a later slice)
  viewBox: readonly [number, number]; // [width, height] of the symbol's local box
  paths: readonly string[]; // one or more SVG path `d` strings, filled with color
}
