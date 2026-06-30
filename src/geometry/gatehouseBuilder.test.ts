import { describe, expect, it } from "vitest";
import { buildGatehouse } from "./gatehouseBuilder";
import { gatehouseFootprint } from "./gatehouseFootprint";
import type { Gatehouse } from "../store/schema";
import type { BoxPart } from "./parts";

function gatehouse(over: Partial<Gatehouse> = {}): Gatehouse {
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
    ...over,
  };
}

const mass = (parts: BoxPart[]) => parts.filter((p) => p.role === "mass");
const merlons = (parts: BoxPart[]) => parts.filter((p) => p.role === "merlon");

describe("buildGatehouse — mass", () => {
  it("is a single box of width × height × depth centered at H/2", () => {
    const parts = buildGatehouse(gatehouse({ width: 6, depth: 4, height: 6 }));
    expect(mass(parts)).toHaveLength(1);
    const m = mass(parts)[0];
    expect(m.size).toEqual({ x: 6, y: 6, z: 4 });
    expect(m.position).toEqual({ x: 0, y: 3, z: 0 });
  });

  it("adds no teeth when not crenellated", () => {
    expect(merlons(buildGatehouse(gatehouse({ crenellated: false })))).toHaveLength(0);
  });

  it("adds teeth around the top edge when crenellated, sized to merlonSize", () => {
    const merlonSize = 0.5;
    const height = 6;
    const parts = buildGatehouse(gatehouse({ crenellated: true, merlonSize, height }));
    const teeth = merlons(parts);
    expect(teeth.length).toBeGreaterThan(0);
    for (const t of teeth) {
      expect(t.size).toEqual({ x: merlonSize, y: merlonSize, z: merlonSize });
      expect(t.position.y).toBeCloseTo(height + merlonSize / 2, 6);
    }
  });

  it("a wider gatehouse yields more teeth", () => {
    const narrow = merlons(
      buildGatehouse(gatehouse({ width: 4, crenellated: true, merlonSize: 0.4 })),
    ).length;
    const wide = merlons(
      buildGatehouse(gatehouse({ width: 12, crenellated: true, merlonSize: 0.4 })),
    ).length;
    expect(wide).toBeGreaterThan(narrow);
  });
});

describe("gatehouseFootprint", () => {
  it("is the oriented half-extents of width × depth at the anchor", () => {
    const fp = gatehouseFootprint(
      gatehouse({ position: { x: 3, y: -2 }, width: 6, depth: 4, rotation: 30 }),
    );
    expect(fp.center).toEqual({ x: 3, y: -2 });
    expect(fp.halfX).toBe(3);
    expect(fp.halfZ).toBe(2);
    expect(fp.rotation).toBe(30);
  });
});
