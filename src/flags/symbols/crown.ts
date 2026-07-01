import type { SymbolDef } from "./types";

// A three-point crown: a banded base, three tines rising to points, and a ball
// atop each tine.
export const crown: SymbolDef = {
  id: "crown",
  label: "Crown",
  viewBox: [100, 100],
  paths: [
    // Band + tines (one outline: base bar with three peaks and two valleys).
    "M18,66 L28,34 L42,56 L50,28 L58,56 L72,34 L82,66 " +
      "L82,80 L18,80 Z",
    // Balls on the three tine tips (circles via two arcs each).
    "M23,34 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0 Z",
    "M45,28 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0 Z",
    "M67,34 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0 Z",
  ],
};
