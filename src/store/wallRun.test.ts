import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./store";
import { createEmptyDesign, type WallRun } from "./schema";

function reset() {
  useStore.setState({
    design: createEmptyDesign(),
    tool: "wallRun",
    selectedId: null,
    history: { past: [], future: [] },
    pendingSnapshot: null,
  });
}

const wall = (id: string) =>
  useStore.getState().design.pieces.find((p) => p.id === id) as WallRun;

describe("store: addWallRun", () => {
  beforeEach(reset);

  it("adds a wall run between two points with default params", () => {
    const id = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 10, y: 0 }, base: 0 });
    const w = wall(id);
    expect(w.kind).toBe("wallRun");
    expect(w.position).toEqual({ x: 0, y: 0 });
    expect(w.end).toEqual({ x: 10, y: 0 });
    expect(w.base).toBe(0);
    expect(w.height).toBeGreaterThan(0);
    expect(w.thickness).toBeGreaterThan(0);
  });
});

describe("store: whole-wall gizmo move", () => {
  beforeEach(reset);

  it("shifts BOTH endpoints by the same delta, base re-resolved at the start", () => {
    const id = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 10, y: 0 }, base: 0 });
    useStore.getState().beginTransient();
    // Move the start anchor to (3, 4); the end should follow by the same delta.
    useStore.getState().setPiecePositionTransient(id, { x: 3, y: 4 });
    expect(wall(id).position).toEqual({ x: 3, y: 4 });
    expect(wall(id).end).toEqual({ x: 13, y: 4 });
    expect(wall(id).base).toBe(0); // flat ground

    // Commits as a single undoable step.
    useStore.getState().commitTransient();
    useStore.getState().undo();
    expect(wall(id).position).toEqual({ x: 0, y: 0 });
    expect(wall(id).end).toEqual({ x: 10, y: 0 });
  });
});

describe("store: wall endpoint editing", () => {
  beforeEach(reset);

  it("setWallEndpointTransient moves ONE endpoint, leaving the other fixed", () => {
    const id = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 10, y: 0 }, base: 0 });
    useStore.getState().beginTransient();
    useStore.getState().setWallEndpointTransient(id, "end", { x: 4, y: 6 });
    expect(wall(id).position).toEqual({ x: 0, y: 0 }); // start unchanged
    expect(wall(id).end).toEqual({ x: 4, y: 6 });
    useStore.getState().commitTransient();
    // One undoable step restores the original endpoint.
    useStore.getState().undo();
    expect(wall(id).end).toEqual({ x: 10, y: 0 });
  });

  it("setWallEndpoint (committed) grid-snaps and updates the chosen endpoint", () => {
    const id = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 10, y: 0 }, base: 0 });
    useStore.getState().setWallEndpoint(id, "start", { x: 2.37, y: -1.04 });
    // Snapped to the 0.1 m grid.
    expect(wall(id).position).toEqual({ x: 2.4, y: -1 });
    expect(wall(id).end).toEqual({ x: 10, y: 0 });
  });
});
