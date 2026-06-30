import { describe, expect, it } from "vitest";
import { snapEndpoint, WALL_SNAP_TOLERANCE } from "./snapEndpoint";
import type { Gatehouse, Piece, Tower, WallRun } from "../store/schema";

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

function wall(overrides: Partial<WallRun> = {}): WallRun {
  return {
    id: "w",
    kind: "wallRun",
    position: { x: 0, y: 0 },
    end: { x: 5, y: 0 },
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

describe("snapEndpoint — wall endpoint snapping", () => {
  it("snaps to a tower anchor when the candidate is within tolerance", () => {
    const pieces: Piece[] = [tower({ id: "t1", position: { x: 10, y: 4 } })];
    // Candidate just 0.3 m away (< 0.5 tolerance) snaps onto the anchor exactly.
    const r = snapEndpoint({ x: 10.3, y: 4 }, pieces);
    expect(r.snapped).toBe(true);
    expect(r.anchorId).toBe("t1");
    expect(r.point).toEqual({ x: 10, y: 4 });
  });

  it("snaps to a gatehouse anchor too (towers AND gatehouses are anchors)", () => {
    const pieces: Piece[] = [gatehouse({ id: "g1", position: { x: -3, y: 7 } })];
    const r = snapEndpoint({ x: -3.2, y: 7.1 }, pieces);
    expect(r.snapped).toBe(true);
    expect(r.anchorId).toBe("g1");
    expect(r.point).toEqual({ x: -3, y: 7 });
  });

  it("falls back to the 0.1 m grid when no anchor is within tolerance", () => {
    const pieces: Piece[] = [tower({ id: "t1", position: { x: 10, y: 4 } })];
    // 2 m away → out of range → grid-snap the candidate (0.1 m).
    const r = snapEndpoint({ x: 1.234, y: -0.077 }, pieces);
    expect(r.snapped).toBe(false);
    expect(r.anchorId).toBeNull();
    expect(r.point).toEqual({ x: 1.2, y: -0.1 });
  });

  it("falls back to the grid when there are no anchor pieces at all", () => {
    const r = snapEndpoint({ x: 3.04, y: 4.96 }, []);
    expect(r.snapped).toBe(false);
    expect(r.point).toEqual({ x: 3, y: 5 });
  });

  it("picks the NEAREST anchor when several are in range", () => {
    const pieces: Piece[] = [
      tower({ id: "far", position: { x: 0.4, y: 0 } }), // 0.4 away
      tower({ id: "near", position: { x: 0.1, y: 0 } }), // 0.1 away → wins
    ];
    const r = snapEndpoint({ x: 0, y: 0 }, pieces);
    expect(r.anchorId).toBe("near");
    expect(r.point).toEqual({ x: 0.1, y: 0 });
  });

  it("ignores non-anchor pieces (walls/gates/ramps/moats are not snap targets)", () => {
    // A wall endpoint sits right at the candidate, but walls are NOT snap targets.
    const pieces: Piece[] = [wall({ id: "w1", position: { x: 0, y: 0 }, end: { x: 5, y: 0 } })];
    const r = snapEndpoint({ x: 0.02, y: 0.01 }, pieces);
    expect(r.snapped).toBe(false);
    expect(r.point).toEqual({ x: 0, y: 0 }); // grid-snapped, not "anchored"
  });

  it("snaps exactly at the tolerance boundary (inclusive)", () => {
    const pieces: Piece[] = [tower({ id: "t1", position: { x: 0, y: 0 } })];
    const r = snapEndpoint({ x: WALL_SNAP_TOLERANCE, y: 0 }, pieces);
    expect(r.snapped).toBe(true);
  });
});
