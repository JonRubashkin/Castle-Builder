// The single runtime source of truth for the charge (symbol) id list — mirroring
// the material system's PATTERN_IDS allowlist pattern. The FlagDesign schema's
// SymbolId type, the SYMBOLS registry, and any future importer allowlist all
// derive from this list, so adding a symbol later is purely additive (a new id
// here is never wrongly rejected downstream).

export const SYMBOL_IDS = [
  "star",
  "cross",
  "fleurDeLis",
  "lion",
  "dragon",
  "eagle",
  "crown",
] as const;

export type SymbolId = (typeof SYMBOL_IDS)[number];

export function isSymbolId(value: string): value is SymbolId {
  return (SYMBOL_IDS as readonly string[]).includes(value);
}
