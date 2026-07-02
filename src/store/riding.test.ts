// Phase 2G — riding: a stacked piece moves / rises with the piece beneath it.
// These exercise the STORE paths (move commit + resize/raise commit) that apply
// the geometry-derived rider set from src/geometry/riders.ts.

import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./store";
import { createEmptyDesign, type Flag, type Tower } from "./schema";

function reset() {
  useStore.setState({
    design: createEmptyDesign(),
    tool: "tower",
    placementMode: "normal",
    selectedId: null,
    history: { past: [], future: [] },
    pendingSnapshot: null,
  });
}

const pieces = () => useStore.getState().design.pieces;
const byId = (id: string) => pieces().find((p) => p.id === id)!;
const pastLen = () => useStore.getState().history.past.length;

/** Add a tower on the ground and a flag seated exactly on its top. */
function towerWithFlagOnTop() {
  const s = useStore.getState();
  const towerId = s.addTower({ position: { x: 0, y: 0 }, base: 0 });
  const tower = byId(towerId) as Tower;
  const flagId = s.addFlag({ position: { x: 0, y: 0 }, base: tower.base + tower.height });
  return { towerId, flagId };
}

function move(id: string, x: number, y: number) {
  const s = useStore.getState();
  s.beginTransient();
  s.setPiecePositionTransient(id, { x, y });
  s.commitTransient();
}

describe("2G ride on move — riders follow the piece beneath them", () => {
  beforeEach(reset);

  it("moving a tower moves the flag resting on its top by the same delta", () => {
    const { towerId, flagId } = towerWithFlagOnTop();
    const flagBefore = byId(flagId) as Flag;
    const before = pastLen();

    move(towerId, 10, 6); // delta = (+10, +6)

    const tower = byId(towerId) as Tower;
    const flag = byId(flagId) as Flag;
    expect(tower.position).toEqual({ x: 10, y: 6 });
    expect(flag.position).toEqual({ x: 10, y: 6 }); // rode the delta
    expect(flag.base).toBe(flagBefore.base); // base unchanged on a horizontal move
    expect(pastLen()).toBe(before + 1); // exactly ONE undo step for the whole ride
  });

  it("one undo reverses both the piece and its rider", () => {
    const { towerId, flagId } = towerWithFlagOnTop();
    move(towerId, 10, 6);

    useStore.getState().undo();

    expect(byId(towerId).position).toEqual({ x: 0, y: 0 });
    expect(byId(flagId).position).toEqual({ x: 0, y: 0 }); // rider reverted too
  });

  it("a 3-high stack all rides the bottom, once each, as one undo step", () => {
    const s = useStore.getState();
    const bottomId = s.addTower({ position: { x: 0, y: 0 }, base: 0 });
    const bottom = byId(bottomId) as Tower;
    const midId = s.addTower({ position: { x: 0, y: 0 }, base: bottom.base + bottom.height });
    const mid = byId(midId) as Tower;
    const topId = s.addFlag({ position: { x: 0, y: 0 }, base: mid.base + mid.height });
    const before = pastLen();

    move(bottomId, -4, 8);

    expect(byId(bottomId).position).toEqual({ x: -4, y: 8 });
    expect(byId(midId).position).toEqual({ x: -4, y: 8 });
    expect(byId(topId).position).toEqual({ x: -4, y: 8 });
    expect(pastLen()).toBe(before + 1); // still one undo step
  });

  it("a piece NEAR but not resting on the moved piece does NOT ride", () => {
    const s = useStore.getState();
    const towerId = s.addTower({ position: { x: 0, y: 0 }, base: 0 });
    // A flag on the GROUND next to the tower (not on its top) — not a rider.
    const flagId = s.addFlag({ position: { x: 3, y: 0 }, base: 0 });

    move(towerId, 20, 20);

    expect(byId(flagId).position).toEqual({ x: 3, y: 0 }); // stayed put
  });

  it("repeated mid-drag calls move the rider exactly once by the final delta", () => {
    const { towerId, flagId } = towerWithFlagOnTop();
    const s = useStore.getState();

    s.beginTransient();
    s.setPiecePositionTransient(towerId, { x: 5, y: 0 });
    s.setPiecePositionTransient(towerId, { x: 9, y: 0 });
    s.setPiecePositionTransient(towerId, { x: 12, y: 3 });
    s.commitTransient();

    // The rider tracked the FINAL delta (12, 3), not the sum of intermediate ones.
    expect(byId(flagId).position).toEqual({ x: 12, y: 3 });
  });

  it("does not try to seat the moved piece on its own rider", () => {
    // A big flat rider centred on the tower top shouldn't cause the tower to
    // 'climb' onto it when re-resolving its base during the move.
    const { towerId } = towerWithFlagOnTop();
    move(towerId, 2, 2);
    expect(byId(towerId).base).toBe(0); // stayed on the ground
  });
});

describe("2G ride on resize/raise — riders rise with the top they sit on", () => {
  beforeEach(reset);

  it("raising a tower's height moves the flag on its top up by the same delta", () => {
    const { towerId, flagId } = towerWithFlagOnTop();
    const flagBase0 = (byId(flagId) as Flag).base;
    const tower = byId(towerId) as Tower;
    const before = pastLen();

    useStore.getState().updatePiece(towerId, { height: tower.height + 3 });

    expect((byId(flagId) as Flag).base).toBeCloseTo(flagBase0 + 3, 9);
    expect(pastLen()).toBe(before + 1); // one undo step with the edit
  });

  it("raising a tower's base moves its rider up by the same delta", () => {
    const { towerId, flagId } = towerWithFlagOnTop();
    const flagBase0 = (byId(flagId) as Flag).base;

    useStore.getState().updatePiece(towerId, { base: 2 });

    expect((byId(flagId) as Flag).base).toBeCloseTo(flagBase0 + 2, 9);
  });

  it("a 3-stack raises correctly and once each when the bottom grows", () => {
    const s = useStore.getState();
    const bottomId = s.addTower({ position: { x: 0, y: 0 }, base: 0 });
    const bottom = byId(bottomId) as Tower;
    const midId = s.addTower({ position: { x: 0, y: 0 }, base: bottom.base + bottom.height });
    const mid = byId(midId) as Tower;
    const topId = s.addFlag({ position: { x: 0, y: 0 }, base: mid.base + mid.height });
    const midBase0 = (byId(midId) as Tower).base;
    const topBase0 = (byId(topId) as Flag).base;

    s.updatePiece(bottomId, { height: bottom.height + 5 });

    expect((byId(midId) as Tower).base).toBeCloseTo(midBase0 + 5, 9);
    expect((byId(topId) as Flag).base).toBeCloseTo(topBase0 + 5, 9);
  });

  it("a non-height edit (material) moves no riders", () => {
    const { towerId, flagId } = towerWithFlagOnTop();
    const flagBase0 = (byId(flagId) as Flag).base;

    useStore.getState().updatePiece(towerId, {
      material: { kind: "solid", color: "#123456" },
    });

    expect((byId(flagId) as Flag).base).toBe(flagBase0); // unchanged
  });

  it("undo reverses a raise for both the piece and its rider", () => {
    const { towerId, flagId } = towerWithFlagOnTop();
    const tower = byId(towerId) as Tower;
    const flagBase0 = (byId(flagId) as Flag).base;

    useStore.getState().updatePiece(towerId, { height: tower.height + 3 });
    useStore.getState().undo();

    expect((byId(towerId) as Tower).height).toBe(tower.height);
    expect((byId(flagId) as Flag).base).toBeCloseTo(flagBase0, 9);
  });
});
