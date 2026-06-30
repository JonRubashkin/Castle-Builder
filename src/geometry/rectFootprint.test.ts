import { describe, expect, it } from "vitest";
import {
  rectFootprintAABBHalfExtents,
  rectFootprintContains,
  type RectFootprint,
} from "./rectFootprint";

const fp = (over: Partial<RectFootprint> = {}): RectFootprint => ({
  center: { x: 0, y: 0 },
  halfX: 2,
  halfZ: 1,
  rotation: 0,
  ...over,
});

describe("rectFootprintContains — unrotated", () => {
  it("includes points inside the half-extents, excludes points outside", () => {
    const f = fp();
    expect(rectFootprintContains(f, { x: 0, y: 0 })).toBe(true);
    expect(rectFootprintContains(f, { x: 1.9, y: 0.9 })).toBe(true);
    expect(rectFootprintContains(f, { x: 2.1, y: 0 })).toBe(false); // beyond halfX
    expect(rectFootprintContains(f, { x: 0, y: 1.1 })).toBe(false); // beyond halfZ
  });
});

describe("rectFootprintContains — rotated (the non-square sign convention)", () => {
  it("a 90° rotation swaps which world axis the long/short extents run along", () => {
    // halfX=2 (long, local X), halfZ=1 (short, local Z); rotate 90° so local +X
    // points along world +Z. So the long extent now runs along world Z.
    const f = fp({ rotation: 90 });
    // Along world Z: reaches ±2 (the long extent).
    expect(rectFootprintContains(f, { x: 0, y: 1.9 })).toBe(true);
    expect(rectFootprintContains(f, { x: 0, y: 2.1 })).toBe(false);
    // Along world X: only ±1 (the short extent).
    expect(rectFootprintContains(f, { x: 1.5, y: 0 })).toBe(false);
    expect(rectFootprintContains(f, { x: 0.9, y: 0 })).toBe(true);
  });

  it("respects a center offset", () => {
    const f = fp({ center: { x: 10, y: -5 } });
    expect(rectFootprintContains(f, { x: 10, y: -5 })).toBe(true);
    expect(rectFootprintContains(f, { x: 12.5, y: -5 })).toBe(false);
  });
});

describe("rectFootprintAABBHalfExtents", () => {
  it("equals the half-extents when unrotated", () => {
    expect(rectFootprintAABBHalfExtents(fp())).toEqual({ x: 2, y: 1 });
  });
  it("swaps extents under a 90° rotation", () => {
    const aabb = rectFootprintAABBHalfExtents(fp({ rotation: 90 }));
    expect(aabb.x).toBeCloseTo(1, 6);
    expect(aabb.y).toBeCloseTo(2, 6);
  });
});
