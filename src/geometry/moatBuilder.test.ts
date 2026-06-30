import { describe, expect, it } from "vitest";
import { buildMoat, MOAT_RING_SEGMENTS } from "./moatBuilder";
import {
  moatRingFootprint,
  ringFootprintContains,
  moatSegmentFootprint,
  moatSegmentLength,
} from "./moatFootprint";
import { rectFootprintContains } from "./rectFootprint";
import type { Moat } from "../store/schema";

function ring(over: Partial<Moat> = {}): Moat {
  return {
    id: "ring",
    kind: "moat",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    shape: "ring",
    outerRadius: 9,
    innerRadius: 6,
    material: { kind: "pattern", pattern: "water", colorA: "#2f6f9f", colorB: "#1b4a6b" },
    ...over,
  };
}

function segment(over: Partial<Moat> = {}): Moat {
  return {
    id: "seg",
    kind: "moat",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    shape: "segment",
    end: { x: 10, y: 0 },
    width: 3,
    material: { kind: "pattern", pattern: "water", colorA: "#2f6f9f", colorB: "#1b4a6b" },
    ...over,
  };
}

describe("buildMoat", () => {
  it("ring → an annulus with the stored radii and smooth segments", () => {
    const geo = buildMoat(ring({ outerRadius: 9, innerRadius: 6 }));
    expect(geo).toEqual({
      shape: "ring",
      innerRadius: 6,
      outerRadius: 9,
      segments: MOAT_RING_SEGMENTS,
    });
  });

  it("segment → a strip of the endpoint distance × width", () => {
    const geo = buildMoat(segment({ end: { x: 8, y: 6 }, width: 3 }));
    expect(geo.shape).toBe("segment");
    if (geo.shape === "segment") {
      expect(geo.length).toBeCloseTo(10, 6); // 3-4-5 → 8,6 = 10
      expect(geo.width).toBe(3);
    }
  });
});

describe("moatRingFootprint + ringFootprintContains", () => {
  it("center + radii come from the piece", () => {
    const fp = moatRingFootprint(ring({ position: { x: 2, y: -3 }, outerRadius: 9, innerRadius: 6 }));
    expect(fp.center).toEqual({ x: 2, y: -3 });
    expect(fp.innerRadius).toBe(6);
    expect(fp.outerRadius).toBe(9);
  });

  it("hit-test: inside the outer ring AND outside the inner ring", () => {
    const fp = moatRingFootprint(ring({ outerRadius: 9, innerRadius: 6 }));
    // On the band (radius 7.5) → inside.
    expect(ringFootprintContains(fp, { x: 7.5, y: 0 })).toBe(true);
    // In the central hole (radius 3) → outside (dry land).
    expect(ringFootprintContains(fp, { x: 3, y: 0 })).toBe(false);
    // Beyond the outer radius (radius 10) → outside.
    expect(ringFootprintContains(fp, { x: 10, y: 0 })).toBe(false);
    // On the boundaries (inner/outer) → inside (inclusive).
    expect(ringFootprintContains(fp, { x: 6, y: 0 })).toBe(true);
    expect(ringFootprintContains(fp, { x: 9, y: 0 })).toBe(true);
  });
});

describe("moatSegmentFootprint", () => {
  it("is the oriented length × width rectangle from position to end", () => {
    const fp = moatSegmentFootprint(segment({ position: { x: 0, y: 0 }, end: { x: 10, y: 0 }, width: 3 }));
    expect(fp.center).toEqual({ x: 5, y: 0 });
    expect(fp.halfX).toBeCloseTo(5, 6);
    expect(fp.halfZ).toBeCloseTo(1.5, 6);
    expect(fp.rotation).toBeCloseTo(0, 6);
    expect(moatSegmentLength(segment({ end: { x: 0, y: 4 } }))).toBeCloseTo(4, 6);
  });

  it("hit-test: a point on the strip is inside; one past the width is outside", () => {
    const fp = moatSegmentFootprint(segment({ position: { x: 0, y: 0 }, end: { x: 10, y: 0 }, width: 3 }));
    expect(rectFootprintContains(fp, { x: 5, y: 0 })).toBe(true); // center
    expect(rectFootprintContains(fp, { x: 5, y: 1 })).toBe(true); // within half-width 1.5
    expect(rectFootprintContains(fp, { x: 5, y: 2 })).toBe(false); // past half-width
    expect(rectFootprintContains(fp, { x: 11, y: 0 })).toBe(false); // past the length
  });

  it("respects a rotated (diagonal) strip's oriented rectangle", () => {
    const fp = moatSegmentFootprint(segment({ position: { x: 0, y: 0 }, end: { x: 0, y: 10 }, width: 3 }));
    expect(fp.center).toEqual({ x: 0, y: 5 });
    // Along the strip (on its centerline) → inside.
    expect(rectFootprintContains(fp, { x: 0, y: 5 })).toBe(true);
    // Off to the side within the width → inside.
    expect(rectFootprintContains(fp, { x: 1, y: 5 })).toBe(true);
    // Off past the width → outside.
    expect(rectFootprintContains(fp, { x: 2, y: 5 })).toBe(false);
  });
});
