import { describe, expect, it } from "vitest";
import {
  DEFAULT_FLAG_ALONG_INSET,
  DEFAULT_FLAG_ALONG_SPACING,
  flagPositionsAlong,
  isFlagAlongHost,
} from "./flagAlong";
import { flatTopWorldY } from "./support";
import type { Gatehouse, Moat, Ramp, Tower, WallRun } from "../store/schema";

function wall(overrides: Partial<WallRun> = {}): WallRun {
  return {
    id: "w",
    kind: "wallRun",
    position: { x: 0, y: 0 },
    end: { x: 12, y: 0 },
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

describe("isFlagAlongHost — the supported host set", () => {
  it("supports wall runs and gatehouses", () => {
    expect(isFlagAlongHost(wall())).toBe(true);
    expect(isFlagAlongHost(gatehouse())).toBe(true);
  });

  it("does NOT support towers, ramps, moats (deferred / not hosts)", () => {
    const tower: Tower = {
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
    };
    const ramp: Ramp = {
      id: "r",
      kind: "ramp",
      position: { x: 0, y: 0 },
      base: 0,
      rotation: 0,
      rise: 4,
      run: 6,
      width: 2,
      style: "ramp",
      material: { kind: "solid", color: "#999" },
    };
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
    expect(isFlagAlongHost(tower)).toBe(false);
    expect(isFlagAlongHost(ramp)).toBe(false);
    expect(isFlagAlongHost(moat)).toBe(false);
    expect(flagPositionsAlong(tower)).toEqual([]);
    expect(flagPositionsAlong(ramp)).toEqual([]);
    expect(flagPositionsAlong(moat)).toEqual([]);
  });
});

describe("flagPositionsAlong — a wall run (default spacing/inset)", () => {
  const w = wall({ position: { x: 0, y: 0 }, end: { x: 12, y: 0 }, height: 4 });

  it("places floor(usable/spacing)+1 flags with default spacing", () => {
    // length 12, inset 1 → usable 10; spacing 4 → floor(10/4)+1 = 3 flags.
    expect(DEFAULT_FLAG_ALONG_SPACING).toBe(4);
    expect(DEFAULT_FLAG_ALONG_INSET).toBe(1);
    const flags = flagPositionsAlong(w);
    expect(flags).toHaveLength(3);
    // From inset 1 to inset 11 (usable 10), 3 points → x = 1, 6, 11.
    expect(flags.map((f) => f.position.x)).toEqual([1, 6, 11]);
    // All on the wall's top edge line (z = 0 here).
    for (const f of flags) expect(f.position.y).toBeCloseTo(0, 6);
  });

  it("endpoints are inset from the wall ends (never at the raw corners)", () => {
    const flags = flagPositionsAlong(w, { spacing: 5, inset: 2 });
    // usable = 12 - 4 = 8; floor(8/5)+1 = 2 flags → x = 2 and 10 (inset from ends).
    expect(flags.map((f) => f.position.x)).toEqual([2, 10]);
    expect(flags[0].position.x).toBeGreaterThanOrEqual(2);
    expect(flags[flags.length - 1].position.x).toBeLessThanOrEqual(10);
  });

  it("respects an explicit count (evenly spaced, inset endpoints inclusive)", () => {
    const flags = flagPositionsAlong(w, { count: 5, inset: 1 });
    // usable 10, 5 points from x=1..11 step 2.5.
    expect(flags.map((f) => f.position.x)).toEqual([1, 3.5, 6, 8.5, 11]);
  });

  it("base = the wall's flat top via the shared helper (never a literal)", () => {
    const top = flatTopWorldY(w);
    expect(top).not.toBeNull();
    for (const f of flagPositionsAlong(w)) {
      expect(f.base).toBeCloseTo(top as number, 6);
    }
    // Concretely: base 0 + height 4 (flat phase, ground = 0).
    expect(flagPositionsAlong(w)[0].base).toBeCloseTo(4, 6);
  });

  it("a single flag lands at the edge midpoint", () => {
    const flags = flagPositionsAlong(w, { count: 1 });
    expect(flags).toHaveLength(1);
    expect(flags[0].position.x).toBeCloseTo(6, 6); // midpoint of 0..12
  });

  it("positions lie on a rotated (diagonal) wall's edge", () => {
    const diag = wall({ position: { x: 0, y: 0 }, end: { x: 6, y: 8 } }); // length 10
    const flags = flagPositionsAlong(diag, { count: 3, inset: 0 });
    // 3 points from (0,0) to (6,8): the midpoint is (3,4), on the segment.
    expect(flags[1].position.x).toBeCloseTo(3, 6);
    expect(flags[1].position.y).toBeCloseTo(4, 6);
    // Every point satisfies the line y = (8/6) x.
    for (const f of flags) {
      expect(f.position.y).toBeCloseTo((8 / 6) * f.position.x, 6);
    }
  });
});

describe("flagPositionsAlong — a gatehouse top", () => {
  it("places flags along the top's width edge (local X), based at the top", () => {
    const g = gatehouse({ position: { x: 10, y: 5 }, width: 8, height: 6, rotation: 0 });
    const flags = flagPositionsAlong(g, { count: 2, inset: 1 });
    // Width 8 centered at x=10 → edge from x=6 to x=14; inset 1 → x=7 and x=13.
    expect(flags.map((f) => f.position.x)).toEqual([7, 13]);
    for (const f of flags) expect(f.position.y).toBeCloseTo(5, 6); // centered on depth
    const top = flatTopWorldY(g) as number;
    for (const f of flags) expect(f.base).toBeCloseTo(top, 6);
  });

  it("follows the gatehouse rotation (edge runs along local X)", () => {
    const g = gatehouse({ position: { x: 0, y: 0 }, width: 8, rotation: 90 });
    // At 90°, local +X maps to world (cos90, sin90) = (0, 1) → the edge runs along Z.
    const flags = flagPositionsAlong(g, { count: 2, inset: 0 });
    expect(flags[0].position.x).toBeCloseTo(0, 6);
    expect(flags[1].position.x).toBeCloseTo(0, 6);
    // Endpoints at ±half along Z.
    const zs = flags.map((f) => f.position.y).sort((p, q) => p - q);
    expect(zs[0]).toBeCloseTo(-4, 6);
    expect(zs[1]).toBeCloseTo(4, 6);
  });
});

describe("flagPositionsAlong — degenerate guards", () => {
  it("returns [] for a zero-length wall", () => {
    expect(flagPositionsAlong(wall({ end: { x: 0, y: 0 } }))).toEqual([]);
  });

  it("caps an extreme count", () => {
    const flags = flagPositionsAlong(wall(), { count: 10000 });
    expect(flags.length).toBeLessThanOrEqual(50);
  });
});
