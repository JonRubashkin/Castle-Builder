import { describe, expect, it } from "vitest";
import { allRidersOf, ridersOf } from "./riders";
import { resolveSupportAt } from "./support";
import type { Flag, Gatehouse, Moat, Piece, Tower } from "../store/schema";
import { DEFAULT_FLAG_ASPECT } from "../flags/types";

let seq = 0;
const id = () => `p-${seq++}`;

function tower(overrides: Partial<Tower> = {}): Tower {
  return {
    id: id(),
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

function gatehouse(overrides: Partial<Gatehouse> = {}): Gatehouse {
  return {
    id: id(),
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
    roofed: false,
    roofPitch: 3,
    roofMaterial: { kind: "solid", color: "#7c3b2a" },
    raisedOnPosts: false,
    ...overrides,
  };
}

function flag(overrides: Partial<Flag> = {}): Flag {
  return {
    id: id(),
    kind: "flag",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    design: { aspect: DEFAULT_FLAG_ASPECT, layers: [] },
    poleHeight: 3,
    clothWidth: 1.5,
    ...overrides,
  };
}

function moat(overrides: Partial<Moat> = {}): Moat {
  return {
    id: id(),
    kind: "moat",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    shape: "ring",
    outerRadius: 6,
    innerRadius: 4,
    material: { kind: "pattern", pattern: "water", colorA: "#2f6f9f", colorB: "#1b4a6b" },
    ...overrides,
  };
}

/** A piece seated exactly on top of `host` at `host`'s anchor. */
function seatOn(host: Tower | Gatehouse, piece: Piece): Piece {
  const top = host.base + host.height;
  return { ...piece, position: { ...host.position }, base: top } as Piece;
}

describe("ridersOf — direct riders resting on a piece's top", () => {
  it("a tower stacked on a tower top is a rider", () => {
    const lower = tower({ position: { x: 0, y: 0 } });
    const upper = seatOn(lower, tower({ position: { x: 0, y: 0 } }));
    const riders = ridersOf(lower, [lower, upper]);
    expect(riders.map((r) => r.id)).toEqual([upper.id]);
  });

  it("a flag on a tower top IS a rider (the exclusion is about surfaces, not riders)", () => {
    const twr = tower();
    const flg = seatOn(twr, flag());
    expect(ridersOf(twr, [twr, flg]).map((r) => r.id)).toEqual([flg.id]);
  });

  it("a piece at the right height but NOT overlapping the footprint is NOT a rider", () => {
    const twr = tower({ radius: 2, position: { x: 0, y: 0 } });
    // Same base as the tower top, but far outside its footprint.
    const off = flag({ position: { x: 100, y: 100 }, base: twr.base + twr.height });
    expect(ridersOf(twr, [twr, off])).toEqual([]);
  });

  it("a piece overlapping but at the WRONG height (not on the top) is NOT a rider", () => {
    const twr = tower({ height: 8 });
    // Overlaps the footprint but its base is at the ground, not the tower top.
    const floating = flag({ position: { x: 0, y: 0 }, base: 0 });
    expect(ridersOf(twr, [twr, floating])).toEqual([]);
    // And one hovering ABOVE the top (base above top) also does not count.
    const hovering = flag({ position: { x: 0, y: 0 }, base: twr.height + 1 });
    expect(ridersOf(twr, [twr, hovering])).toEqual([]);
  });

  it("NOTHING rides a moat (a moat is not a support surface)", () => {
    const m = moat();
    // A flag sitting at the moat's base/footprint still is not a rider of it.
    const flg = flag({ position: { x: 0, y: 0 }, base: 0 });
    expect(ridersOf(m, [m, flg])).toEqual([]);
  });

  it("matches resolveSupportAt exactly: the rider's base equals the resolved support base", () => {
    const twr = tower();
    const flg = seatOn(twr, flag());
    const support = resolveSupportAt(flg.position, [twr]);
    expect(support.surfaceId).toBe(twr.id);
    expect(flg.base).toBeCloseTo(support.base, 9);
    expect(ridersOf(twr, [twr, flg])).toHaveLength(1);
  });
});

describe("allRidersOf — the transitive stack, once each, cycle-safe", () => {
  it("returns the full transitive set from the bottom of a 3-high stack", () => {
    const bottom = tower({ position: { x: 0, y: 0 }, height: 8 });
    const middle = seatOn(bottom, tower({ position: { x: 0, y: 0 }, height: 5 })) as Tower;
    const top = seatOn(middle, flag({ position: { x: 0, y: 0 } }));
    const all = allRidersOf(bottom, [bottom, middle, top]);
    expect(new Set(all.map((r) => r.id))).toEqual(new Set([middle.id, top.id]));
    // The bottom (the query piece) is never in its own rider set.
    expect(all.map((r) => r.id)).not.toContain(bottom.id);
  });

  it("returns each piece exactly once even when a diamond reaches it twice", () => {
    // A wide gatehouse carries two towers, and one flag sits where both towers'
    // tops overlap — the flag is reachable via either branch but must appear once.
    const base = gatehouse({ position: { x: 0, y: 0 }, width: 20, depth: 20, height: 4 });
    const towerTop = base.base + base.height;
    const leftT = tower({ position: { x: -4, y: 0 }, base: towerTop, radius: 6, height: 4 });
    const rightT = tower({ position: { x: 4, y: 0 }, base: towerTop, radius: 6, height: 4 });
    // The flag sits on the towers' shared top height, over BOTH footprints.
    const flg = flag({ position: { x: 0, y: 0 }, base: towerTop + 4 });
    const all = allRidersOf(base, [base, leftT, rightT, flg]);
    const ids = all.map((r) => r.id);
    expect(ids.filter((x) => x === flg.id)).toHaveLength(1); // exactly once
    expect(new Set(ids)).toEqual(new Set([leftT.id, rightT.id, flg.id]));
  });

  it("terminates on a contrived cycle (A rests on B and B rests on A)", () => {
    // Two towers sharing a footprint, each with base == the other's top (both
    // tops above ground): a degenerate mutual-rider cycle. The visited-set must
    // stop it looping.
    const a = tower({ id: "A", position: { x: 0, y: 0 }, base: 5, height: 3 });
    const b = tower({ id: "B", position: { x: 0, y: 0 }, base: 8, height: -3 });
    // a.top = 8 = b.base ✓ ; b.top = 5 = a.base ✓  → each rides the other.
    const all = allRidersOf(a, [a, b]);
    // It returns without hanging; B is reached once, A (the query) is excluded.
    expect(all.map((r) => r.id)).toEqual(["B"]);
  });

  it("a flag on a tower is included in the transitive set", () => {
    const twr = tower();
    const flg = seatOn(twr, flag());
    expect(allRidersOf(twr, [twr, flg]).map((r) => r.id)).toEqual([flg.id]);
  });
});
