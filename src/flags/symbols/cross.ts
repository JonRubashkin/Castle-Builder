import type { SymbolDef } from "./types";

// A bold heraldic cross (a plus with even arms) filling the viewBox.
export const cross: SymbolDef = {
  id: "cross",
  label: "Cross",
  viewBox: [100, 100],
  paths: [
    "M42,8 H58 V42 H92 V58 H58 V92 H42 V58 H8 V42 H42 Z",
  ],
};
