import { describe, expect, it } from "vitest";
import { buildTower, merlonCount, type TowerPart } from "./towerBuilder";
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
    roofed: false,
    roofPitch: 3,
    roofMaterial: { kind: "solid", color: "#7c3b2a" },
    raisedOnPosts: false,
    ...overrides,
  };
}

const merlons = (parts: TowerPart[]) => parts.filter((p) => p.role === "merlon");
const shafts = (parts: TowerPart[]) => parts.filter((p) => p.role === "shaft");

describe("buildTower — shaft", () => {
  it("round tower is a single cylinder shaft centered at H/2", () => {
    const parts = buildTower(tower({ profile: "round", radius: 2, height: 8 }));
    expect(parts).toHaveLength(1);
    const shaft = parts[0];
    expect(shaft.role).toBe("shaft");
    expect(shaft.shape).toBe("cylinder");
    if (shaft.shape === "cylinder") {
      expect(shaft.radius).toBe(2);
      expect(shaft.height).toBe(8);
      expect(shaft.position.y).toBe(4);
    }
  });

  it("square tower is a single box shaft of side 2·half", () => {
    const parts = buildTower(tower({ profile: "square", radius: 1.5, height: 6 }));
    expect(parts).toHaveLength(1);
    const shaft = parts[0];
    expect(shaft.shape).toBe("box");
    if (shaft.shape === "box") {
      expect(shaft.size).toEqual({ x: 3, y: 6, z: 3 });
      expect(shaft.position.y).toBe(3);
    }
  });
});

describe("buildTower — crenellations toggle", () => {
  it("adds NO teeth when not crenellated (round & square)", () => {
    expect(merlons(buildTower(tower({ crenellated: false })))).toHaveLength(0);
    expect(
      merlons(buildTower(tower({ profile: "square", crenellated: false }))),
    ).toHaveLength(0);
  });

  it("adds teeth when crenellated (round)", () => {
    const parts = buildTower(tower({ profile: "round", crenellated: true }));
    expect(shafts(parts)).toHaveLength(1);
    expect(merlons(parts).length).toBeGreaterThan(0);
  });

  it("adds teeth when crenellated (square)", () => {
    const parts = buildTower(tower({ profile: "square", crenellated: true }));
    expect(shafts(parts)).toHaveLength(1);
    expect(merlons(parts).length).toBeGreaterThan(0);
  });
});

describe("buildTower — teeth size and placement track params", () => {
  it("each tooth has the merlonSize as its box size and sits on the top edge", () => {
    const height = 8;
    const merlonSize = 0.5;
    const parts = buildTower(
      tower({ profile: "round", height, merlonSize, crenellated: true }),
    );
    for (const m of merlons(parts)) {
      expect(m.shape).toBe("box");
      if (m.shape === "box") {
        expect(m.size).toEqual({ x: merlonSize, y: merlonSize, z: merlonSize });
        // top edge: shaft top (= height) + half a tooth.
        expect(m.position.y).toBeCloseTo(height + merlonSize / 2, 6);
      }
    }
  });

  it("a SMALLER merlonSize yields MORE teeth (round)", () => {
    const big = merlons(
      buildTower(tower({ profile: "round", radius: 3, merlonSize: 1.0, crenellated: true })),
    ).length;
    const small = merlons(
      buildTower(tower({ profile: "round", radius: 3, merlonSize: 0.3, crenellated: true })),
    ).length;
    expect(small).toBeGreaterThan(big);
  });

  it("a LARGER radius yields MORE teeth (round)", () => {
    const narrow = merlons(
      buildTower(tower({ profile: "round", radius: 1, merlonSize: 0.4, crenellated: true })),
    ).length;
    const wide = merlons(
      buildTower(tower({ profile: "round", radius: 4, merlonSize: 0.4, crenellated: true })),
    ).length;
    expect(wide).toBeGreaterThan(narrow);
  });

  it("teeth are placed around the rim at radius distance (round)", () => {
    const radius = 2.5;
    const parts = buildTower(
      tower({ profile: "round", radius, merlonSize: 0.5, crenellated: true }),
    );
    for (const m of merlons(parts)) {
      const r = Math.hypot(m.position.x, m.position.z);
      expect(r).toBeCloseTo(radius, 6);
    }
  });
});

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
