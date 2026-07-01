import { describe, expect, it } from "vitest";
import { isPlaceOnTopTarget, resolvePlaceOnTop } from "./placeOnTop";
import type { Gate, Gatehouse, Moat, Ramp, Tower, WallRun } from "../store/schema";

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

function wallRun(overrides: Partial<WallRun> = {}): WallRun {
  return {
    id: "w",
    kind: "wallRun",
    position: { x: 0, y: 0 },
    end: { x: 4, y: 0 },
    base: 0,
    rotation: 0,
    height: 4,
    thickness: 0.6,
    crenellated: false,
    merlonSize: 0.6,
    material: { kind: "solid", color: "#999" },
    ...overrides,
  };
}

function gate(overrides: Partial<Gate> = {}): Gate {
  return {
    id: "gate",
    kind: "gate",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    width: 2,
    height: 3,
    material: { kind: "solid", color: "#963" },
    ...overrides,
  };
}

function ramp(overrides: Partial<Ramp> = {}): Ramp {
  return {
    id: "r",
    kind: "ramp",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    rise: 3,
    run: 5,
    width: 2,
    style: "ramp",
    material: { kind: "solid", color: "#999" },
    ...overrides,
  };
}

function moat(overrides: Partial<Moat> = {}): Moat {
  return {
    id: "moat",
    kind: "moat",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    shape: "ring",
    outerRadius: 6,
    innerRadius: 3,
    material: { kind: "pattern", pattern: "water", colorA: "#2f6f9f", colorB: "#1b4a6b" },
    ...overrides,
  };
}

describe("isPlaceOnTopTarget", () => {
  it("accepts pieces with a flat top: tower / gatehouse / wall / gate", () => {
    expect(isPlaceOnTopTarget(tower())).toBe(true);
    expect(isPlaceOnTopTarget(gatehouse())).toBe(true);
    expect(isPlaceOnTopTarget(wallRun())).toBe(true);
    expect(isPlaceOnTopTarget(gate())).toBe(true);
  });

  it("excludes the moat (water) and the ramp (sloped top)", () => {
    expect(isPlaceOnTopTarget(moat())).toBe(false);
    expect(isPlaceOnTopTarget(ramp())).toBe(false);
  });
});

describe("resolvePlaceOnTop", () => {
  it("seats the base on the target's TOP (the surface height, not the ground)", () => {
    const target = tower({ id: "target", position: { x: 3, y: -2 }, base: 0, height: 8 });
    const moving = tower({ id: "moving", position: { x: 40, y: 40 }, base: 0 });
    const r = resolvePlaceOnTop(moving, target)!;
    expect(r).not.toBeNull();
    expect(r.base).toBe(8); // the tower top (base 0 + height 8), explicitly not 0
    expect(r.base).not.toBe(0);
  });

  it("aligns the moving piece's anchor to the target's own center anchor", () => {
    const target = tower({ id: "target", position: { x: 3, y: -2 } });
    const moving = tower({ id: "moving", position: { x: 40, y: 40 } });
    const r = resolvePlaceOnTop(moving, target)!;
    expect(r.position).toEqual({ x: 3, y: -2 });
    expect(r.end).toBeUndefined();
  });

  it("seats on a target with a nonzero base (top = base + height)", () => {
    const target = tower({ id: "target", position: { x: 0, y: 0 }, base: 5, height: 6 });
    const moving = tower({ id: "moving", position: { x: 40, y: 40 } });
    const r = resolvePlaceOnTop(moving, target)!;
    expect(r.base).toBe(11);
  });

  it("recenters BOTH endpoints of a two-point wall onto the target center", () => {
    const target = tower({ id: "target", position: { x: 10, y: 0 }, base: 0, height: 8 });
    const moving = wallRun({ id: "moving", position: { x: 0, y: 0 }, end: { x: 4, y: 0 } });
    const r = resolvePlaceOnTop(moving, target)!;
    // Midpoint of the wall lands on the target center; endpoints shifted rigidly.
    expect(r.position).toEqual({ x: 8, y: 0 });
    expect(r.end).toEqual({ x: 12, y: 0 });
    const midX = (r.position.x + r.end!.x) / 2;
    expect(midX).toBeCloseTo(10, 6);
    expect(r.base).toBe(8);
  });

  it("overhang is allowed: a bigger moving piece still centers without error", () => {
    const target = tower({ id: "target", position: { x: 0, y: 0 }, radius: 1, height: 6 });
    const moving = gatehouse({ id: "moving", position: { x: 30, y: 30 }, width: 12, depth: 10 });
    const r = resolvePlaceOnTop(moving, target)!;
    expect(r.position).toEqual({ x: 0, y: 0 }); // centered despite overhanging
    expect(r.base).toBe(6);
  });

  it("returns null for an invalid target (a moat)", () => {
    const moving = tower({ id: "moving" });
    expect(resolvePlaceOnTop(moving, moat({ id: "target" }))).toBeNull();
  });

  it("returns null for an invalid target (a ramp — sloped top)", () => {
    const moving = tower({ id: "moving" });
    expect(resolvePlaceOnTop(moving, ramp({ id: "target" }))).toBeNull();
  });

  it("returns null when the target is the moving piece itself", () => {
    const p = tower({ id: "same" });
    expect(resolvePlaceOnTop(p, p)).toBeNull();
  });
});
