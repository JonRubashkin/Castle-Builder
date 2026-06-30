import { describe, expect, it } from "vitest";
import {
  footprintAABBHalfExtents,
  footprintContains,
  towerFootprint,
  type TowerFootprint,
} from "./towerFootprint";
import type { Tower } from "../store/schema";

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

describe("towerFootprint", () => {
  it("derives center/radius/profile from the tower", () => {
    const fp = towerFootprint(tower({ position: { x: 3, y: -4 }, radius: 1.5 }));
    expect(fp).toEqual<TowerFootprint>({
      profile: "round",
      center: { x: 3, y: -4 },
      radius: 1.5,
      rotation: 0,
    });
  });
});

describe("footprintContains (round)", () => {
  const fp = towerFootprint(tower({ radius: 2 }));

  it("includes the center and points within the radius", () => {
    expect(footprintContains(fp, { x: 0, y: 0 })).toBe(true);
    expect(footprintContains(fp, { x: 1.5, y: 0 })).toBe(true);
    expect(footprintContains(fp, { x: 0, y: -2 })).toBe(true); // on the edge
  });

  it("excludes points outside the radius", () => {
    expect(footprintContains(fp, { x: 2.1, y: 0 })).toBe(false);
    expect(footprintContains(fp, { x: 1.5, y: 1.5 })).toBe(false);
  });

  it("is offset by the center", () => {
    const off = towerFootprint(tower({ position: { x: 10, y: 10 }, radius: 1 }));
    expect(footprintContains(off, { x: 10.5, y: 10 })).toBe(true);
    expect(footprintContains(off, { x: 0, y: 0 })).toBe(false);
  });
});

describe("footprintContains (square)", () => {
  it("tests an axis-aligned box at rotation 0", () => {
    const fp = towerFootprint(tower({ profile: "square", radius: 2, rotation: 0 }));
    expect(footprintContains(fp, { x: 1.9, y: 1.9 })).toBe(true);
    expect(footprintContains(fp, { x: 2.1, y: 0 })).toBe(false);
    expect(footprintContains(fp, { x: 0, y: 2.1 })).toBe(false);
  });

  it("respects rotation: a 45° box rejects a former corner", () => {
    const fp = towerFootprint(
      tower({ profile: "square", radius: 2, rotation: 45 }),
    );
    // The unrotated corner (1.9, 1.9) lies outside a 45°-rotated square.
    expect(footprintContains(fp, { x: 1.9, y: 1.9 })).toBe(false);
    // A point along the rotated diagonal (toward a vertex) is inside.
    expect(footprintContains(fp, { x: 2.5, y: 0 })).toBe(true);
  });
});

describe("footprintAABBHalfExtents", () => {
  it("equals the radius for a round footprint", () => {
    const fp = towerFootprint(tower({ radius: 3 }));
    expect(footprintAABBHalfExtents(fp)).toEqual({ x: 3, y: 3 });
  });

  it("grows for a rotated square (AABB of the rotated box)", () => {
    const fp = towerFootprint(
      tower({ profile: "square", radius: 2, rotation: 45 }),
    );
    const ext = footprintAABBHalfExtents(fp);
    expect(ext.x).toBeCloseTo(2 * Math.SQRT2, 6);
    expect(ext.y).toBeCloseTo(2 * Math.SQRT2, 6);
  });
});
