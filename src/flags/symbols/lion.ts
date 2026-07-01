import type { SymbolDef } from "./types";

// A lion rampant (rearing, in profile facing dexter/left): a spiky maned head, an
// upright S-curved body, raised fore-paws, hind legs, and a curling tufted tail.
// Bold and simplified — it should read as a heraldic lion, not an anatomy study.
export const lion: SymbolDef = {
  id: "lion",
  label: "Lion",
  viewBox: [100, 100],
  paths: [
    // Maned head: a spiky ring of mane around the face (upper right).
    "M66,8 l6,4 l7,-2 l2,7 l6,3 l-3,7 l3,6 l-6,4 l-1,7 l-7,-1 " +
      "l-5,5 l-5,-5 l-7,1 l-1,-7 l-6,-4 l3,-6 l-3,-7 l6,-3 l2,-7 l7,2 Z",
    // Upright body + hind legs.
    "M60,34 C50,42 46,54 48,66 L44,86 L52,86 L54,68 " +
      "C56,60 58,56 62,54 C60,64 62,74 66,86 L74,86 L72,66 " +
      "C72,54 70,44 66,38 Z",
    // Raised fore-paws reaching left.
    "M52,44 C40,40 30,42 24,48 C30,50 36,50 42,52 C46,50 50,48 52,44 Z",
    // Curling tufted tail (upper right).
    "M72,50 C86,44 88,28 80,20 C86,30 82,40 76,44 C82,42 84,36 82,32 " +
      "L78,34 C80,40 76,46 72,50 Z",
  ],
};
