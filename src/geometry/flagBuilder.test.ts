import { describe, expect, it } from "vitest";
import { buildFlag, flagClothHeight, POLE_RADIUS } from "./flagBuilder";
import { flagFootprint, FLAG_FOOTPRINT_DEPTH } from "./flagFootprint";
import { rectFootprintContains } from "./rectFootprint";
import { createDefaultFlagDesign, type Flag } from "../store/schema";

function flag(over: Partial<Flag> = {}): Flag {
  return {
    id: "f",
    kind: "flag",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    poleHeight: 6,
    clothWidth: 3, // aspect 1.5 → cloth height 2
    design: createDefaultFlagDesign(),
    ...over,
  };
}

describe("flagClothHeight — derived from the long edge and the design aspect", () => {
  it("is clothWidth / aspect", () => {
    expect(flagClothHeight(3, 1.5)).toBe(2);
    expect(flagClothHeight(2.4, 1.5)).toBeCloseTo(1.6, 6);
  });

  it("guards a degenerate (non-positive) aspect", () => {
    expect(flagClothHeight(3, 0)).toBe(3); // falls back to aspect 1
    expect(flagClothHeight(3, -2)).toBe(3);
  });
});

describe("buildFlag — pole + cloth in local space", () => {
  it("stands a thin pole from the underside up to poleHeight", () => {
    const { pole } = buildFlag(flag({ poleHeight: 6 }));
    expect(pole.radius).toBe(POLE_RADIUS);
    expect(pole.height).toBe(6);
    // Cylinder centered at half height so its underside sits at y=0.
    expect(pole.position).toEqual({ x: 0, y: 3, z: 0 });
  });

  it("attaches the cloth near the pole top, flying out along +X", () => {
    const { cloth } = buildFlag(flag({ poleHeight: 6, clothWidth: 3 }));
    // aspect 1.5 → cloth height 2.
    expect(cloth.width).toBe(3);
    expect(cloth.height).toBe(2);
    // Hoist at x=0, fly edge at x=3 → center x = 1.5.
    expect(cloth.position.x).toBe(1.5);
    expect(cloth.position.z).toBe(0);
    // Top edge at the pole top (y=6) → center y = 6 − height/2 = 5.
    expect(cloth.position.y).toBe(5);
  });

  it("cloth height tracks the embedded design's aspect", () => {
    const wide = buildFlag(
      flag({ clothWidth: 4, design: { aspect: 2, layers: [] } }),
    );
    expect(wide.cloth.height).toBe(2); // 4 / 2
  });
});

describe("flagFootprint — the cloth's oriented rectangle, anchored at the pole", () => {
  it("spans the cloth width starting at the pole anchor", () => {
    const fp = flagFootprint(flag({ position: { x: 0, y: 0 }, clothWidth: 3 }));
    // Center is the pole anchor pushed +clothWidth/2 along local +X.
    expect(fp.center).toEqual({ x: 1.5, y: 0 });
    expect(fp.halfX).toBeCloseTo(1.5, 6); // clothWidth/2
    expect(fp.halfZ).toBeCloseTo(FLAG_FOOTPRINT_DEPTH / 2, 6);
    expect(fp.rotation).toBe(0);
  });

  it("hit-test: the pole base and the cloth span are inside; past the fly edge is outside", () => {
    const fp = flagFootprint(flag({ clothWidth: 3, rotation: 0 }));
    expect(rectFootprintContains(fp, { x: 0, y: 0 })).toBe(true); // at the pole
    expect(rectFootprintContains(fp, { x: 1.5, y: 0 })).toBe(true); // mid-cloth
    expect(rectFootprintContains(fp, { x: 3, y: 0 })).toBe(true); // at the fly edge
    expect(rectFootprintContains(fp, { x: 3.5, y: 0 })).toBe(false); // past the fly edge
  });

  it("respects the heading: a rotated flag's cloth rotates with it", () => {
    const fp = flagFootprint(flag({ position: { x: 0, y: 0 }, clothWidth: 3, rotation: 90 }));
    // local +X now heads +Z (world), so the cloth flies toward +y.
    expect(fp.center.x).toBeCloseTo(0, 6);
    expect(fp.center.y).toBeCloseTo(1.5, 6);
    expect(rectFootprintContains(fp, { x: 0, y: 1.5 })).toBe(true);
    expect(rectFootprintContains(fp, { x: 1.5, y: 0 })).toBe(false);
  });
});
