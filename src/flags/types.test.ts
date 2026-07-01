// The FlagDesign is a plain-data document — it must survive a JSON round-trip
// unchanged, so Export/Import (a later slice) works for free. This also pins the
// field names the rest of the flag system depends on.

import { describe, expect, it } from "vitest";
import type { FlagDesign } from "./types";

describe("FlagDesign JSON round-trip", () => {
  it("round-trips a busy design (division + stripes + charges) unchanged", () => {
    const design: FlagDesign = {
      aspect: 1.5,
      layers: [
        {
          kind: "field",
          fill: {
            kind: "division",
            division: "quarterly",
            colors: ["#c1121f", "#fefee3", "#003049", "#fcbf49"],
          },
        },
        {
          kind: "stripes",
          orientation: "diagonal",
          count: 5,
          colors: ["#ffffff", "#1d3557"],
        },
        {
          kind: "charge",
          symbolId: "lion",
          x: 0.5,
          y: 0.5,
          scale: 0.6,
          color: "#ffd60a",
          rotation: 15,
        },
        {
          kind: "charge",
          symbolId: "star",
          x: 0.25,
          y: 0.25,
          scale: 0.2,
          color: "#ffffff",
        },
      ],
    };

    const clone: FlagDesign = JSON.parse(JSON.stringify(design));
    expect(clone).toEqual(design);
  });

  it("round-trips a plain solid field", () => {
    const design: FlagDesign = {
      aspect: 2,
      layers: [{ kind: "field", fill: { kind: "solid", color: "#2a9d8f" } }],
    };
    expect(JSON.parse(JSON.stringify(design))).toEqual(design);
  });
});
