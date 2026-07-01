import { describe, expect, it } from "vitest";
import {
  chargeAtPoint,
  flagContainRect,
  previewBoxSize,
  previewPixelToFlagCoord,
} from "./editorPicking";
import type { FlagDesign, FlagLayer } from "./types";

describe("previewBoxSize — the 2Fe fixed-width preview layout", () => {
  it("keeps the width fixed and derives height = width / aspect (within the clamp)", () => {
    // 300 wide, aspect 1.5 → height 200 (unclamped).
    const box = previewBoxSize(1.5, 300, 120, 320);
    expect(box.width).toBe(300);
    expect(box.height).toBeCloseTo(200, 6);
  });

  it("a squarer flag (smaller aspect) is TALLER; a wider flag is SHORTER — width unchanged", () => {
    const square = previewBoxSize(1, 300, 120, 320); // 300/1 = 300
    const wide = previewBoxSize(2, 300, 120, 320); // 300/2 = 150
    expect(square.width).toBe(300);
    expect(wide.width).toBe(300); // width never changes
    expect(square.height).toBeGreaterThan(wide.height);
    expect(square.height).toBeCloseTo(300, 6);
    expect(wide.height).toBeCloseTo(150, 6);
  });

  it("clamps an extreme tall aspect to maxHeight and an extreme wide aspect to minHeight", () => {
    // aspect 0.5 → ideal 600, clamped to 320 (max).
    expect(previewBoxSize(0.5, 300, 120, 320).height).toBe(320);
    // aspect 3 → ideal 100, clamped to 120 (min).
    expect(previewBoxSize(3, 300, 120, 320).height).toBe(120);
  });

  it("guards a degenerate aspect (≤ 0) without dividing by zero", () => {
    const box = previewBoxSize(0, 300, 120, 320);
    expect(box.width).toBe(300);
    expect(box.height).toBe(300); // treated as aspect 1
  });
});

describe("flagContainRect — the shared letterbox fit", () => {
  it("fills the box exactly when the box matches the flag aspect", () => {
    const r = flagContainRect({ width: 300, height: 200 }, 1.5);
    expect(r.dispW).toBeCloseTo(300, 6);
    expect(r.dispH).toBeCloseTo(200, 6);
    expect(r.offsetX).toBeCloseTo(0, 6);
    expect(r.offsetY).toBeCloseTo(0, 6);
  });

  it("pillarboxes (bars left/right) a squarer flag in a wider box", () => {
    // aspect 1.5 in a 300×120 box (box aspect 2.5 > 1.5) → limited by height.
    const r = flagContainRect({ width: 300, height: 120 }, 1.5);
    expect(r.dispH).toBeCloseTo(120, 6);
    expect(r.dispW).toBeCloseTo(180, 6); // 120 * 1.5
    expect(r.offsetX).toBeCloseTo(60, 6); // (300 − 180) / 2
    expect(r.offsetY).toBeCloseTo(0, 6);
  });

  it("letterboxes (bars top/bottom) a wider flag in a taller box", () => {
    // aspect 3 in a 300×300 box (box aspect 1 < 3) → limited by width.
    const r = flagContainRect({ width: 300, height: 300 }, 3);
    expect(r.dispW).toBeCloseTo(300, 6);
    expect(r.dispH).toBeCloseTo(100, 6); // 300 / 3
    expect(r.offsetY).toBeCloseTo(100, 6); // (300 − 100) / 2
  });
});

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
