import type { SymbolDef } from "./types";

// A classic five-pointed star: 10 alternating outer (r=48) / inner (r=19) points
// around center (50,50), first point straight up.
export const star: SymbolDef = {
  id: "star",
  label: "Star",
  viewBox: [100, 100],
  paths: [
    "M50,2 L61.17,34.63 L95.65,35.17 L68.07,55.87 L78.21,88.83 " +
      "L50,69 L21.79,88.83 L31.93,55.87 L4.35,35.17 L38.83,34.63 Z",
  ],
};
