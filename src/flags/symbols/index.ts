// The charge (symbol) library — one registry, keyed by SymbolId, derived from the
// SYMBOL_IDS source of truth so the two can never drift. The renderer looks a
// symbol up here and draws its path(s); the (future) library UI iterates the
// same registry.

import type { SymbolId } from "./ids";
import { SYMBOL_IDS } from "./ids";
import type { SymbolDef } from "./types";
import { star } from "./star";
import { cross } from "./cross";
import { fleurDeLis } from "./fleurDeLis";
import { lion } from "./lion";
import { dragon } from "./dragon";
import { eagle } from "./eagle";
import { crown } from "./crown";

export const SYMBOLS: Record<SymbolId, SymbolDef> = {
  star,
  cross,
  fleurDeLis,
  lion,
  dragon,
  eagle,
  crown,
};

export function getSymbol(id: SymbolId): SymbolDef {
  return SYMBOLS[id];
}

// Every symbol definition, in the canonical SYMBOL_IDS order.
export function allSymbols(): SymbolDef[] {
  return SYMBOL_IDS.map((id) => SYMBOLS[id]);
}

export { SYMBOL_IDS, isSymbolId } from "./ids";
export type { SymbolId } from "./ids";
export type { SymbolDef } from "./types";
