import { describe, expect, it } from "vitest";
import { chargeAtPoint, previewPixelToFlagCoord } from "./editorPicking";
import type { FlagDesign, FlagLayer } from "./types";

describe("previewPixelToFlagCoord", () => {
  it("maps a pixel to a normalized coord when the box matches the flag aspect", () => {
    // 300×200 box, aspect 1.5 → no letterboxing.
    const c = previewPixelToFlagCoord(150, 100, { width: 300, height: 200 }, 1.5);
    expect(c.x).toBeCloseTo(0.5, 6);
    expect(c.y).toBeCloseTo(0.5, 6);
    const tl = previewPixelToFlagCoord(0, 0, { width: 300, height: 200 }, 1.5);
    expect(tl.x).toBeCloseTo(0, 6);
    expect(tl.y).toBeCloseTo(0, 6);
  });

  it("accounts for letterboxing when the box is taller than the flag", () => {
    // 300×300 box, aspect 1.5 → flag is 300×200, centered with a 50px band top/bottom.
    const c = previewPixelToFlagCoord(150, 150, { width: 300, height: 300 }, 1.5);
    expect(c.x).toBeCloseTo(0.5, 6);
    expect(c.y).toBeCloseTo(0.5, 6); // (150 − 50) / 200
    const top = previewPixelToFlagCoord(150, 50, { width: 300, height: 300 }, 1.5);
    expect(top.y).toBeCloseTo(0, 6); // top edge of the letterboxed flag
  });

  it("clamps out-of-bounds pixels to [0,1]", () => {
    const c = previewPixelToFlagCoord(-40, 999, { width: 300, height: 200 }, 1.5);
    expect(c.x).toBe(0);
    expect(c.y).toBe(1);
  });
});

function chargeLayer(over: Partial<Extract<FlagLayer, { kind: "charge" }>>): FlagLayer {
  return {
    kind: "charge",
    symbolId: "star",
    x: 0.5,
    y: 0.5,
    scale: 0.5,
    color: "#fff",
    ...over,
  };
}

describe("chargeAtPoint", () => {
  it("hits a charge at its own center and misses far away", () => {
    const design: FlagDesign = {
      aspect: 1.5,
      layers: [
        { kind: "field", fill: { kind: "solid", color: "#000" } },
        chargeLayer({ x: 0.5, y: 0.5, scale: 0.4 }),
      ],
    };
    // The center of a charge is always inside its own extent.
    expect(chargeAtPoint(design, 0.5, 0.5)).toBe(1);
    // A far corner is outside a modestly scaled charge.
    expect(chargeAtPoint(design, 0.02, 0.98)).toBeNull();
  });

  it("returns null when there are no charge layers", () => {
    const design: FlagDesign = {
      aspect: 1.5,
      layers: [{ kind: "field", fill: { kind: "solid", color: "#000" } }],
    };
    expect(chargeAtPoint(design, 0.5, 0.5)).toBeNull();
  });

  it("returns the TOPMOST charge on overlap (later index wins)", () => {
    const design: FlagDesign = {
      aspect: 1.5,
      layers: [
        chargeLayer({ x: 0.5, y: 0.5, scale: 0.6 }), // index 0 (under)
        chargeLayer({ x: 0.5, y: 0.5, scale: 0.6 }), // index 1 (on top)
      ],
    };
    expect(chargeAtPoint(design, 0.5, 0.5)).toBe(1);
  });
});
