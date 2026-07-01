import { describe, expect, it } from "vitest";
import {
  CENTER_ALIGN_TOLERANCE,
  footprintOverlapFraction,
  pieceFootprintContains,
  shouldCenterSnap,
} from "./footprintOverlap";
import type { Gatehouse, Moat, Tower } from "../store/schema";

function tower(overrides: Partial<Tower> = {}): Tower {
  return {
    id: "t",
    kind: "tower",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    profile: "round",
    radius: 2,
    height: 8,
    crenellated: false,
    merlonSize: 0.6,
    material: { kind: "solid", color: "#999" },
    ...overrides,
  };
}

function gatehouse(overrides: Partial<Gatehouse> = {}): Gatehouse {
  return {
    id: "g",
    kind: "gatehouse",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    width: 6,
    depth: 4,
    height: 6,
    crenellated: false,
    merlonSize: 0.6,
    material: { kind: "solid", color: "#999" },
    ...overrides,
  };
}

describe("pieceFootprintContains", () => {
  it("matches the round tower circle test", () => {
    const t = tower({ radius: 2 });
    expect(pieceFootprintContains(t, { x: 0, y: 0 })).toBe(true);
    expect(pieceFootprintContains(t, { x: 1.9, y: 0 })).toBe(true);
    expect(pieceFootprintContains(t, { x: 2.1, y: 0 })).toBe(false);
  });

  it("is false for non-stackable kinds (gate/ramp/moat are not surfaces)", () => {
    const moat: Moat = {
      id: "m",
      kind: "moat",
      position: { x: 0, y: 0 },
      base: 0,
      rotation: 0,
      shape: "ring",
      outerRadius: 9,
      innerRadius: 6,
      material: { kind: "pattern", pattern: "water", colorA: "#2f6f9f", colorB: "#1b4a6b" },
    };
    expect(pieceFootprintContains(moat, { x: 0, y: 0 })).toBe(false);
  });
});

describe("footprintOverlapFraction — fraction of the moved piece within a support", () => {
  it("fully inside → ~1.0 (a small tower entirely over a big one)", () => {
    const small = tower({ id: "small", radius: 1, position: { x: 0, y: 0 } });
    const big = tower({ id: "big", radius: 5, position: { x: 0, y: 0 } });
    expect(footprintOverlapFraction(small, big)).toBeCloseTo(1, 5);
  });

  it("fully outside → 0", () => {
    const a = tower({ id: "a", radius: 1, position: { x: 0, y: 0 } });
    const b = tower({ id: "b", radius: 1, position: { x: 20, y: 0 } });
    expect(footprintOverlapFraction(a, b)).toBe(0);
  });

  it("two identical towers whose centers coincide → ~1.0", () => {
    const a = tower({ id: "a", radius: 2, position: { x: 0, y: 0 } });
    const b = tower({ id: "b", radius: 2, position: { x: 0, y: 0 } });
    expect(footprintOverlapFraction(a, b)).toBeCloseTo(1, 5);
  });

  it("identical towers offset by one radius → well under 50% (edge-crossing)", () => {
    // Two radius-2 disks with centers 2 apart overlap ~39% of one disk.
    const a = tower({ id: "a", radius: 2, position: { x: 0, y: 0 } });
    const b = tower({ id: "b", radius: 2, position: { x: 2, y: 0 } });
    const f = footprintOverlapFraction(a, b);
    expect(f).toBeGreaterThan(0.3);
    expect(f).toBeLessThan(0.5);
  });

  it("a moat (no footprint) as the moved piece → 0", () => {
    const moat: Moat = {
      id: "m",
      kind: "moat",
      position: { x: 0, y: 0 },
      base: 0,
      rotation: 0,
      shape: "ring",
      outerRadius: 9,
      innerRadius: 6,
      material: { kind: "pattern", pattern: "water", colorA: "#2f6f9f", colorB: "#1b4a6b" },
    };
    expect(footprintOverlapFraction(moat, tower())).toBe(0);
  });
});

describe("shouldCenterSnap — >50% overlap OR aligned centers", () => {
  it("latches when the moved piece is more than 50% within a support", () => {
    const support = tower({ id: "s", radius: 4, position: { x: 0, y: 0 } });
    // A radius-2 tower centered 2m off: most of it still sits inside the radius-4 disk.
    const moving = tower({ id: "m", radius: 2, position: { x: 2, y: 0 } });
    expect(footprintOverlapFraction(moving, support)).toBeGreaterThan(0.5);
    expect(shouldCenterSnap(moving, support)).toBe(true);
  });

  it("does NOT latch when barely overlapping and centers apart", () => {
    const support = tower({ id: "s", radius: 2, position: { x: 0, y: 0 } });
    const moving = tower({ id: "m", radius: 2, position: { x: 3.5, y: 0 } });
    expect(shouldCenterSnap(moving, support)).toBe(false);
  });

  it("latches on aligned centers even when overlap is under 50% (big piece, small support)", () => {
    // A big moving piece can never be >50% within a tiny support, but aligned
    // centers must still latch it on.
    const support = tower({ id: "s", radius: 0.5, position: { x: 0, y: 0 } });
    const moving = gatehouse({ id: "m", width: 10, depth: 10, position: { x: 0, y: 0 } });
    expect(footprintOverlapFraction(moving, support)).toBeLessThan(0.5);
    expect(shouldCenterSnap(moving, support)).toBe(true);
  });

  it("aligned-centers latch respects the tolerance", () => {
    const support = tower({ id: "s", radius: 0.5, position: { x: 0, y: 0 } });
    // Just inside the alignment tolerance → latches on alignment.
    const near = gatehouse({
      id: "near",
      width: 10,
      depth: 10,
      position: { x: CENTER_ALIGN_TOLERANCE * 0.5, y: 0 },
    });
    expect(shouldCenterSnap(near, support)).toBe(true);
    // Well beyond the tolerance and <50% overlap → no latch.
    const far = gatehouse({ id: "far", width: 10, depth: 10, position: { x: 5, y: 0 } });
    expect(shouldCenterSnap(far, support)).toBe(false);
  });
});
