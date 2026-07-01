import type { SymbolDef } from "./types";

// A dragon in profile facing dexter/left: a horned head with a jaw, a connected
// serpentine body, two clawed legs, a large scalloped bat-wing raised, and a tail
// coiling to a barbed tip on the right. Simplified into bold connected masses so
// it reads as a dragon at flag scale.
export const dragon: SymbolDef = {
  id: "dragon",
  label: "Dragon",
  viewBox: [100, 100],
  paths: [
    // Head + neck + body + coiling tail (one connected silhouette).
    "M6,48 L20,44 C24,38 28,36 34,38 L31,28 L40,37 " +
      "C46,38 51,42 54,50 C64,50 74,54 80,60 " +
      "C92,68 97,55 92,44 L97,39 L86,45 " +
      "C84,55 76,62 66,62 C58,63 51,60 49,55 " +
      "C47,60 45,63 45,67 C38,60 20,55 6,48 Z",
    // Raised scalloped wing.
    "M54,50 L60,18 L67,34 L76,16 L81,36 L91,22 L86,46 " +
      "C74,47 63,48 54,50 Z",
    // Fore leg + hind leg.
    "M49,56 L47,74 L54,74 L56,58 Z",
    "M64,60 L64,78 L71,78 L71,60 Z",
  ],
};
