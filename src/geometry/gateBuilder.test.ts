import { describe, expect, it } from "vitest";
import { buildGate, gateBarCount, GATE_BAR } from "./gateBuilder";
import { gateFootprint, GATE_THICKNESS } from "./gateFootprint";
import { rectFootprintContains } from "./rectFootprint";
import type { Gate } from "../store/schema";

function gate(over: Partial<Gate> = {}): Gate {
  return {
    id: "gate",
    kind: "gate",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    width: 2.4,
    height: 3.2,
    material: { kind: "solid", color: "#6b4a2b" },
    ...over,
  };
}

describe("buildGate — portcullis grid", () => {
  it("emits vertical bars spanning the full height and horizontal bars the full width", () => {
    const parts = buildGate(gate({ width: 2.4, height: 3.2 }));
    const vertical = parts.filter((p) => p.size.y > p.size.x); // tall bars
    const horizontal = parts.filter((p) => p.size.x > p.size.y); // wide bars
    expect(vertical.length).toBe(gateBarCount(2.4));
    expect(horizontal.length).toBe(gateBarCount(3.2));

    for (const v of vertical) {
      expect(v.size.x).toBeCloseTo(GATE_BAR, 6);
      expect(v.size.y).toBeCloseTo(3.2, 6); // full height
      expect(v.position.y).toBeCloseTo(3.2 / 2, 6); // centered vertically
    }
    for (const h of horizontal) {
      expect(h.size.x).toBeCloseTo(2.4, 6); // full width
      expect(h.size.y).toBeCloseTo(GATE_BAR, 6);
    }
  });

  it("keeps every bar within the width × height extent and at the thin depth", () => {
    const g = gate({ width: 3, height: 4 });
    const parts = buildGate(g);
    for (const p of parts) {
      expect(p.size.z).toBeCloseTo(GATE_THICKNESS, 6);
      // x within ±width/2, y within [0, height].
      expect(Math.abs(p.position.x) + p.size.x / 2).toBeLessThanOrEqual(g.width / 2 + 1e-6);
      expect(p.position.y - p.size.y / 2).toBeGreaterThanOrEqual(-1e-6);
      expect(p.position.y + p.size.y / 2).toBeLessThanOrEqual(g.height + 1e-6);
    }
  });

  it("a wider gate yields more vertical bars", () => {
    expect(gateBarCount(6)).toBeGreaterThan(gateBarCount(2));
  });
});

describe("gateFootprint", () => {
  it("is the oriented half-extents of width × GATE_THICKNESS at the anchor", () => {
    const fp = gateFootprint(gate({ position: { x: 4, y: -1 }, width: 2.4, rotation: 90 }));
    expect(fp.center).toEqual({ x: 4, y: -1 });
    expect(fp.halfX).toBeCloseTo(1.2, 6);
    expect(fp.halfZ).toBeCloseTo(GATE_THICKNESS / 2, 6);
    expect(fp.rotation).toBe(90);
  });

  it("hit-test: a point on the slab is inside; one well past the thin depth is outside", () => {
    const fp = gateFootprint(gate({ width: 2.4 }));
    expect(rectFootprintContains(fp, { x: 0, y: 0 })).toBe(true);
    expect(rectFootprintContains(fp, { x: 1.0, y: 0 })).toBe(true); // within width
    expect(rectFootprintContains(fp, { x: 0, y: 1 })).toBe(false); // past thin depth
    expect(rectFootprintContains(fp, { x: 2, y: 0 })).toBe(false); // past width
  });
});
