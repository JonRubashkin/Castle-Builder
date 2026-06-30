import { describe, expect, it } from "vitest";
import {
  merlonCount,
  rectCrenellations,
  roundCrenellations,
  type MerlonBox,
} from "./crenellations";

const allCubes = (teeth: MerlonBox[], s: number) =>
  teeth.every(
    (t) => t.size.x === s && t.size.y === s && t.size.z === s,
  );

describe("merlonCount", () => {
  it("never drops below the minimum", () => {
    expect(merlonCount(0.1, 1, 4)).toBe(4);
    expect(merlonCount(100, 1000, 1)).toBe(1);
  });
  it("scales with perimeter and inversely with tooth size", () => {
    expect(merlonCount(20, 0.5, 1)).toBeGreaterThan(merlonCount(20, 2, 1));
    expect(merlonCount(40, 1, 1)).toBeGreaterThan(merlonCount(10, 1, 1));
  });
  it("guards against a non-positive tooth size", () => {
    expect(merlonCount(10, 0, 4)).toBe(4);
  });
});

describe("roundCrenellations — round top edge", () => {
  it("places every tooth on the rim at radius distance, at the given top-Y", () => {
    const radius = 2.5;
    const topY = 8.3;
    const teeth = roundCrenellations(radius, topY, 0.5);
    expect(teeth.length).toBeGreaterThan(0);
    for (const t of teeth) {
      expect(Math.hypot(t.position.x, t.position.z)).toBeCloseTo(radius, 6);
      expect(t.position.y).toBeCloseTo(topY, 6);
    }
  });

  it("each tooth is a cube of the merlon size", () => {
    expect(allCubes(roundCrenellations(2, 8, 0.6), 0.6)).toBe(true);
  });

  it("a SMALLER merlon size yields MORE teeth", () => {
    const big = roundCrenellations(3, 8, 1.0).length;
    const small = roundCrenellations(3, 8, 0.3).length;
    expect(small).toBeGreaterThan(big);
  });

  it("a LARGER radius yields MORE teeth", () => {
    const narrow = roundCrenellations(1, 8, 0.4).length;
    const wide = roundCrenellations(4, 8, 0.4).length;
    expect(wide).toBeGreaterThan(narrow);
  });

  it("honors the minimum count", () => {
    expect(roundCrenellations(0.1, 8, 5, 4).length).toBe(4);
  });
});

describe("rectCrenellations — rectangular top edge", () => {
  it("each tooth is a cube of the merlon size, at the given top-Y, axis-aligned", () => {
    const teeth = rectCrenellations(2, 1, 5, 0.5);
    expect(teeth.length).toBeGreaterThan(0);
    expect(allCubes(teeth, 0.5)).toBe(true);
    for (const t of teeth) {
      expect(t.position.y).toBeCloseTo(5, 6);
      expect(t.rotationY).toBe(0);
    }
  });

  it("places teeth along all four edges (at x=±halfX or z=±halfZ)", () => {
    const halfX = 3;
    const halfZ = 1.5;
    const teeth = rectCrenellations(halfX, halfZ, 5, 0.5);
    for (const t of teeth) {
      const onXEdge = Math.abs(Math.abs(t.position.z) - halfZ) < 1e-9;
      const onZEdge = Math.abs(Math.abs(t.position.x) - halfX) < 1e-9;
      expect(onXEdge || onZEdge).toBe(true);
    }
    // All four edges are represented.
    expect(teeth.some((t) => Math.abs(t.position.z - halfZ) < 1e-9)).toBe(true);
    expect(teeth.some((t) => Math.abs(t.position.z + halfZ) < 1e-9)).toBe(true);
    expect(teeth.some((t) => Math.abs(t.position.x - halfX) < 1e-9)).toBe(true);
    expect(teeth.some((t) => Math.abs(t.position.x + halfX) < 1e-9)).toBe(true);
  });

  it("a longer edge yields more teeth on that edge", () => {
    const fewer = rectCrenellations(2, 1, 5, 0.4).length;
    const more = rectCrenellations(6, 1, 5, 0.4).length;
    expect(more).toBeGreaterThan(fewer);
  });

  it("a square (halfX==halfZ) gives equal teeth on every edge", () => {
    const s = 0.5;
    const half = 3;
    const teeth = rectCrenellations(half, half, 5, s);
    // 4 edges, each merlonCount(2*half, s, 1) teeth → total divisible by 4.
    expect(teeth.length % 4).toBe(0);
  });
});
