import type { SymbolDef } from "./types";

// A stylized fleur-de-lis, symmetric about x=50: a central petal, two outward-
// curling side petals, a lower body, and the characteristic horizontal band.
// Composed of several sub-paths (they union visually into one bold silhouette).
export const fleurDeLis: SymbolDef = {
  id: "fleurDeLis",
  label: "Fleur-de-lis",
  viewBox: [100, 100],
  paths: [
    // Central petal (a pointed teardrop from the top).
    "M50,4 C56,22 62,30 58,44 C55,52 50,52 50,52 C50,52 45,52 42,44 C38,30 44,22 50,4 Z",
    // Right curl.
    "M56,40 C74,30 82,44 74,58 C70,64 62,62 58,54 C64,54 68,50 66,44 C64,40 60,40 56,40 Z",
    // Left curl (mirror of the right).
    "M44,40 C26,30 18,44 26,58 C30,64 38,62 42,54 C36,54 32,50 34,44 C36,40 40,40 44,40 Z",
    // Lower body flaring to the base.
    "M42,52 C42,66 40,76 36,88 L64,88 C60,76 58,66 58,52 C54,58 46,58 42,52 Z",
    // The binding band.
    "M34,60 H66 V70 H34 Z",
  ],
};
