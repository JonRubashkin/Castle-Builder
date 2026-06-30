// Part 0.1 — Foundation verification: undo/redo across ALL FOUR committed
// operations (place, move, edit-params, delete). This test is PERMANENT: it is
// the load-bearing guarantee that every committed mutation pushes exactly one
// history snapshot, that undo reverses it and redo reapplies it, and that the
// history is capped (oldest entries evicted) at HISTORY_CAP.

import { beforeEach, describe, expect, it } from "vitest";
import { useStore, HISTORY_CAP } from "./store";
import { createEmptyDesign, type Tower } from "./schema";

function reset() {
  useStore.setState({
    design: createEmptyDesign(),
    tool: "tower",
    selectedId: null,
    history: { past: [], future: [] },
    pendingSnapshot: null,
  });
}

const at = (x: number, y: number) => ({ position: { x, y }, base: 0 });
const pastLen = () => useStore.getState().history.past.length;
const pieces = () => useStore.getState().design.pieces;
const firstTower = () => pieces()[0] as Tower;

describe("Part 0.1 — each operation pushes exactly one snapshot, undo/redo round-trips", () => {
  beforeEach(reset);

  it("PLACE pushes exactly one snapshot; undo reverses, redo reapplies", () => {
    expect(pastLen()).toBe(0);

    useStore.getState().addTower(at(1, 2));
    expect(pastLen()).toBe(1); // exactly one snapshot
    expect(pieces()).toHaveLength(1);

    useStore.getState().undo();
    expect(pieces()).toHaveLength(0); // reversed

    useStore.getState().redo();
    expect(pieces()).toHaveLength(1); // reapplied
    expect(firstTower().position).toEqual({ x: 1, y: 2 });
  });

  it("MOVE (transient commit) pushes exactly one snapshot; undo/redo round-trips", () => {
    useStore.getState().addTower(at(0, 0));
    const before = pastLen();

    useStore.getState().beginTransient();
    useStore.getState().setPiecePositionTransient(firstTower().id, { x: 3, y: 4 });
    useStore.getState().setPiecePositionTransient(firstTower().id, { x: 7, y: 8 });
    // Mid-drag previews do NOT touch history.
    expect(pastLen()).toBe(before);

    useStore.getState().commitTransient();
    expect(pastLen()).toBe(before + 1); // exactly one snapshot on commit
    expect(firstTower().position).toEqual({ x: 7, y: 8 });

    useStore.getState().undo();
    expect(firstTower().position).toEqual({ x: 0, y: 0 }); // reversed

    useStore.getState().redo();
    expect(firstTower().position).toEqual({ x: 7, y: 8 }); // reapplied
  });

  it("EDIT-PARAMS pushes exactly one snapshot; undo/redo round-trips", () => {
    const id = useStore.getState().addTower(at(0, 0));
    const before = pastLen();
    const original = firstTower().height;

    useStore.getState().updatePiece(id, { height: 12 } as Partial<Tower>);
    expect(pastLen()).toBe(before + 1); // exactly one snapshot
    expect(firstTower().height).toBe(12);

    useStore.getState().undo();
    expect(firstTower().height).toBe(original); // reversed

    useStore.getState().redo();
    expect(firstTower().height).toBe(12); // reapplied
  });

  it("DELETE pushes exactly one snapshot; undo restores, redo removes again", () => {
    const id = useStore.getState().addTower(at(5, 5));
    const before = pastLen();

    useStore.getState().deletePiece(id);
    expect(pastLen()).toBe(before + 1); // exactly one snapshot
    expect(pieces()).toHaveLength(0);

    useStore.getState().undo();
    expect(pieces()).toHaveLength(1); // restored
    expect(firstTower().position).toEqual({ x: 5, y: 5 });

    useStore.getState().redo();
    expect(pieces()).toHaveLength(0); // removed again
  });
});

describe("Part 0.1 — history caps at HISTORY_CAP and evicts the oldest", () => {
  beforeEach(reset);

  it("keeps exactly HISTORY_CAP snapshots and drops the earliest", () => {
    expect(HISTORY_CAP).toBe(100);

    const id = useStore.getState().addTower(at(0, 0)); // commit #1
    // 120 further edits → 121 commits total, far past the 100 cap.
    const EDITS = 120;
    for (let i = 1; i <= EDITS; i++) {
      useStore.getState().updatePiece(id, { height: i } as Partial<Tower>);
    }

    // Cap holds at exactly 100 despite 121 commits.
    expect(pastLen()).toBe(HISTORY_CAP);
    expect(firstTower().height).toBe(EDITS); // current = last edit

    // Walk undo to exhaustion. With 100 retained snapshots, we can step back
    // exactly 100 times; the earliest 21 commits were evicted.
    let undos = 0;
    while (useStore.getState().canUndo()) {
      useStore.getState().undo();
      undos++;
      expect(undos).toBeLessThanOrEqual(HISTORY_CAP + 1); // guard against a loop
    }
    expect(undos).toBe(HISTORY_CAP); // only 100 steps were ever available

    // The reachable floor is height=20 (commit at EDITS-100), NOT the original
    // default — proof the oldest history was evicted, not silently kept.
    expect(firstTower().height).toBe(EDITS - HISTORY_CAP);

    // A further undo is a no-op (nothing older survives).
    useStore.getState().undo();
    expect(firstTower().height).toBe(EDITS - HISTORY_CAP);
  });
});
