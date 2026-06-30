import { describe, expect, it } from "vitest";
import { buildWallRun } from "./wallRunBuilder";
import {
  wallRunCenter,
  wallRunFootprint,
  wallRunLength,
  wallRunRotationDeg,
} from "./wallRunFootprint";
import { rectFootprintContains } from "./rectFootprint";
import type { WallRun } from "../store/schema";
import type { BoxPart } from "./parts";

function wall(over: Partial<WallRun> = {}): WallRun {
  return {
    id: "w",
    kind: "wallRun",
    position: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    base: 0,
    rotation: 0,
    height: 4,
    thickness: 0.6,
    crenellated: false,
    merlonSize: 0.6,
    material: { kind: "solid", color: "#999" },
    ...over,
  };
}

const mass = (parts: BoxPart[]) => parts.filter((p) => p.role === "mass");
const merlons = (parts: BoxPart[]) => parts.filter((p) => p.role === "merlon");

describe("wallRunLength / center / rotation", () => {
  it("length is the distance between endpoints", () => {
    expect(wallRunLength(wall({ position: { x: 0, y: 0 }, end: { x: 3, y: 4 } }))).toBe(5);
  });
  it("center is the midpoint", () => {
    expect(wallRunCenter(wall({ position: { x: 2, y: 2 }, end: { x: 6, y: 10 } }))).toEqual({
      x: 4,
      y: 6,
    });
  });
  it("rotation aligns local +X with start→end (0° along +X, 90° along +Z)", () => {
    expect(wallRunRotationDeg(wall({ end: { x: 10, y: 0 } }))).toBeCloseTo(0, 6);
    expect(wallRunRotationDeg(wall({ end: { x: 0, y: 10 } }))).toBeCloseTo(90, 6);
  });
});

describe("buildWallRun — mass", () => {
  it("is a single box of length × height × thickness centered at H/2", () => {
    const parts = buildWallRun(
      wall({ position: { x: 0, y: 0 }, end: { x: 10, y: 0 }, height: 4, thickness: 0.6 }),
    );
    expect(mass(parts)).toHaveLength(1);
    const m = mass(parts)[0];
    expect(m.size.x).toBeCloseTo(10, 6); // length along local X
    expect(m.size.y).toBe(4);
    expect(m.size.z).toBe(0.6);
    expect(m.position).toEqual({ x: 0, y: 2, z: 0 });
  });

  it("a diagonal wall's box length equals the endpoint distance", () => {
    const parts = buildWallRun(wall({ position: { x: 0, y: 0 }, end: { x: 3, y: 4 } }));
    expect(mass(parts)[0].size.x).toBeCloseTo(5, 6);
  });

  it("adds no teeth when not crenellated", () => {
    expect(merlons(buildWallRun(wall({ crenellated: false })))).toHaveLength(0);
  });

  it("adds teeth sized to merlonSize on the top edge when crenellated", () => {
    const parts = buildWallRun(wall({ crenellated: true, merlonSize: 0.5, height: 4 }));
    const teeth = merlons(parts);
    expect(teeth.length).toBeGreaterThan(0);
    for (const t of teeth) {
      expect(t.size).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
      expect(t.position.y).toBeCloseTo(4 + 0.5 / 2, 6);
    }
  });

  it("a longer wall yields more teeth", () => {
    const shortW = merlons(
      buildWallRun(wall({ end: { x: 4, y: 0 }, crenellated: true, merlonSize: 0.4 })),
    ).length;
    const longW = merlons(
      buildWallRun(wall({ end: { x: 16, y: 0 }, crenellated: true, merlonSize: 0.4 })),
    ).length;
    expect(longW).toBeGreaterThan(shortW);
  });
});

describe("wallRunFootprint — feeds the hit-test", () => {
  it("contains points along the wall and excludes points off its sides", () => {
    const w = wall({ position: { x: 0, y: 0 }, end: { x: 10, y: 0 }, thickness: 0.6 });
    const fp = wallRunFootprint(w);
    expect(fp.halfX).toBeCloseTo(5, 6);
    expect(fp.halfZ).toBeCloseTo(0.3, 6);
    // On the centerline, inside the length.
    expect(rectFootprintContains(fp, { x: 5, y: 0 })).toBe(true);
    // Just off the side (beyond half-thickness).
    expect(rectFootprintContains(fp, { x: 5, y: 0.4 })).toBe(false);
    // Beyond the far end.
    expect(rectFootprintContains(fp, { x: 10.1, y: 0 })).toBe(false);
  });

  it("orients the footprint along a wall running in +Z", () => {
    const w = wall({ position: { x: 0, y: 0 }, end: { x: 0, y: 10 }, thickness: 0.6 });
    const fp = wallRunFootprint(w);
    // Along the wall (world Z) it spans the length; across (world X) the thickness.
    expect(rectFootprintContains(fp, { x: 0, y: 5 })).toBe(true);
    expect(rectFootprintContains(fp, { x: 0.4, y: 5 })).toBe(false);
  });
});
