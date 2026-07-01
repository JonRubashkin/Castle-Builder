import type { SymbolDef } from "./types";

// An eagle displayed (wings spread, symmetric about x=50): a central body and
// splayed tail, two outstretched wings, and a head with a hooked beak turned to
// dexter/left. Bold and near-symmetric.
export const eagle: SymbolDef = {
  id: "eagle",
  label: "Eagle",
  viewBox: [100, 100],
  paths: [
    // Left wing.
    "M46,30 C30,22 16,26 8,38 C18,36 26,38 34,42 C22,42 14,48 10,58 " +
      "C22,52 34,52 44,50 C44,42 44,36 46,30 Z",
    // Right wing (mirror of the left).
    "M54,30 C70,22 84,26 92,38 C82,36 74,38 66,42 C78,42 86,48 90,58 " +
      "C78,52 66,52 56,50 C56,42 56,36 54,30 Z",
    // Body + splayed tail.
    "M44,28 C44,24 46,20 50,20 C54,20 56,24 56,28 C56,44 54,58 58,74 " +
      "L50,66 L42,74 C46,58 44,44 44,28 Z",
    // Head + hooked beak (turned left).
    "M46,22 C46,15 54,15 54,22 L58,17 L53,24 " +
      "C52,26 48,26 47,24 L42,18 Z",
  ],
};
