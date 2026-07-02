import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore, HISTORY_CAP } from "./store";
import { createEmptyDesign, type Tower } from "./schema";
import * as support from "../geometry/support";

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

describe("store: tool & selection", () => {
  beforeEach(reset);

  it("sets the active tool", () => {
    useStore.getState().setTool("select");
    expect(useStore.getState().tool).toBe("select");
  });

  it("ignores selecting a non-existent piece id", () => {
    useStore.getState().selectPiece("nope");
    expect(useStore.getState().selectedId).toBeNull();
  });
});

describe("store: addTower", () => {
  beforeEach(reset);

  it("adds a tower with default params, seated at the given base", () => {
    const id = useStore.getState().addTower(at(1, 2));
    const pieces = useStore.getState().design.pieces;
    expect(pieces).toHaveLength(1);
    const tower = pieces[0] as Tower;
    expect(tower.id).toBe(id);
    expect(tower.kind).toBe("tower");
    expect(tower.position).toEqual({ x: 1, y: 2 });
    expect(tower.base).toBe(0);
    expect(tower.profile).toBe("round");
    expect(tower.height).toBeGreaterThan(0);
    expect(tower.radius).toBeGreaterThan(0);
  });

  it("gives each tower a unique id", () => {
    const a = useStore.getState().addTower(at(0, 0));
    const b = useStore.getState().addTower(at(1, 1));
    expect(a).not.toBe(b);
  });
});

describe("store: updatePiece", () => {
  beforeEach(reset);

  it("updates editable params", () => {
    const id = useStore.getState().addTower(at(0, 0));
    useStore.getState().updatePiece(id, { height: 12, radius: 3 } as Partial<Tower>);
    const tower = useStore.getState().design.pieces[0] as Tower;
    expect(tower.height).toBe(12);
    expect(tower.radius).toBe(3);
  });
});

describe("store: deletePiece", () => {
  beforeEach(reset);

  it("removes the piece and clears selection if it was selected", () => {
    const id = useStore.getState().addTower(at(0, 0));
    useStore.getState().selectPiece(id);
    useStore.getState().deletePiece(id);
    expect(useStore.getState().design.pieces).toHaveLength(0);
    expect(useStore.getState().selectedId).toBeNull();
  });
});

describe("store: undo / redo", () => {
  beforeEach(reset);

  it("undoes and redoes an add", () => {
    useStore.getState().addTower(at(0, 0));
    expect(useStore.getState().design.pieces).toHaveLength(1);

    useStore.getState().undo();
    expect(useStore.getState().design.pieces).toHaveLength(0);

    useStore.getState().redo();
    expect(useStore.getState().design.pieces).toHaveLength(1);
  });

  it("undoes a move and a delete", () => {
    const id = useStore.getState().addTower(at(0, 0));
    useStore.getState().updatePiece(id, { height: 20 } as Partial<Tower>);
    useStore.getState().deletePiece(id);
    expect(useStore.getState().design.pieces).toHaveLength(0);

    useStore.getState().undo(); // undo delete
    expect(useStore.getState().design.pieces).toHaveLength(1);
    expect((useStore.getState().design.pieces[0] as Tower).height).toBe(20);

    useStore.getState().undo(); // undo height edit
    expect((useStore.getState().design.pieces[0] as Tower).height).not.toBe(20);
  });

  it("clears the redo stack when a new action is committed", () => {
    useStore.getState().addTower(at(0, 0));
    useStore.getState().undo();
    expect(useStore.getState().canRedo()).toBe(true);
    useStore.getState().addTower(at(1, 1));
    expect(useStore.getState().canRedo()).toBe(false);
  });

  it("caps history at HISTORY_CAP entries", () => {
    for (let i = 0; i < HISTORY_CAP + 25; i++) {
      useStore.getState().addTower(at(i, 0));
    }
    expect(useStore.getState().history.past.length).toBe(HISTORY_CAP);
  });

  it("restores a deleted piece's selection validity after undo", () => {
    const id = useStore.getState().addTower(at(0, 0));
    useStore.getState().selectPiece(id);
    useStore.getState().deletePiece(id);
    useStore.getState().undo();
    // selection was cleared on delete; piece is back but not re-selected.
    expect(useStore.getState().design.pieces).toHaveLength(1);
  });
});

describe("store: transient interaction", () => {
  beforeEach(reset);

  it("previews a move without recording history until commit", () => {
    const id = useStore.getState().addTower(at(0, 0));
    const historyBefore = useStore.getState().history.past.length;

    useStore.getState().beginTransient();
    useStore.getState().setPiecePositionTransient(id, { x: 5, y: 5 });
    useStore.getState().setPiecePositionTransient(id, { x: 9, y: 9 });
    // mid-drag: position moved, but no new history entry yet
    expect(useStore.getState().design.pieces[0].position).toEqual({ x: 9, y: 9 });
    expect(useStore.getState().history.past.length).toBe(historyBefore);

    useStore.getState().commitTransient();
    expect(useStore.getState().history.past.length).toBe(historyBefore + 1);

    // a single undo restores the pre-drag position
    useStore.getState().undo();
    expect(useStore.getState().design.pieces[0].position).toEqual({ x: 0, y: 0 });
  });

  it("cancelTransient restores the pre-drag snapshot without history", () => {
    const id = useStore.getState().addTower(at(0, 0));
    const historyBefore = useStore.getState().history.past.length;
    useStore.getState().beginTransient();
    useStore.getState().setPiecePositionTransient(id, { x: 5, y: 5 });
    useStore.getState().cancelTransient();
    expect(useStore.getState().design.pieces[0].position).toEqual({ x: 0, y: 0 });
    expect(useStore.getState().history.past.length).toBe(historyBefore);
  });
});

describe("store: a gizmo move resolves base through the same support rule", () => {
  beforeEach(reset);

  const tower = (id: string) =>
    useStore.getState().design.pieces.find((p) => p.id === id) as Tower;

  it("the move path resolves base through resolveSupportAt", () => {
    const spy = vi.spyOn(support, "resolveSupportAt");
    const id = useStore.getState().addTower(at(0, 0));
    useStore.getState().beginTransient();
    useStore.getState().setPiecePositionTransient(id, { x: 5, y: 5 });
    // The placement path and the move path call the same shared helper.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("dragging a tower's anchor over another tower's top seats its base on that top", () => {
    const lowerId = useStore.getState().addTower(at(0, 0)); // ground, height 8
    const moverId = useStore.getState().addTower(at(50, 50)); // far away on the ground
    const lower = tower(lowerId);

    useStore.getState().beginTransient();
    // Drag the mover so its anchor lands over the lower tower's footprint.
    useStore.getState().setPiecePositionTransient(moverId, { x: 0, y: 0 });

    // Face-attach: base snaps to the lower tower's top (base + height).
    expect(tower(moverId).base).toBe(lower.base + lower.height);
    expect(tower(moverId).position).toEqual({ x: 0, y: 0 });

    // Drag back over open ground → base drops back to ground height (0).
    useStore.getState().setPiecePositionTransient(moverId, { x: 50, y: 50 });
    expect(tower(moverId).base).toBe(0);

    // The whole drag commits as a single undoable step.
    useStore.getState().commitTransient();
    useStore.getState().undo();
    expect(tower(moverId).position).toEqual({ x: 50, y: 50 });
    expect(tower(moverId).base).toBe(0);
  });

  it("a dragged tower never seats on its own footprint", () => {
    const id = useStore.getState().addTower(at(0, 0));
    useStore.getState().beginTransient();
    // Nudge within its own footprint — it must stay on the ground, not climb itself.
    useStore.getState().setPiecePositionTransient(id, { x: 0.1, y: 0 });
    expect(tower(id).base).toBe(0);
  });
});

describe("store: placement-mode toggle (persisted pref, mode-aware move path)", () => {
  beforeEach(() => {
    reset();
    useStore.getState().setPlacementMode("normal"); // start from off
  });

  const tower = (id: string) =>
    useStore.getState().design.pieces.find((p) => p.id === id) as Tower;

  it("setPlacementMode toggles between normal and groundOnly", () => {
    useStore.getState().setPlacementMode("groundOnly");
    expect(useStore.getState().placementMode).toBe("groundOnly");
    useStore.getState().setPlacementMode("normal");
    expect(useStore.getState().placementMode).toBe("normal");
  });

  it("groundOnly: a piece dragged over another stays on the ground (never climbs)", () => {
    useStore.getState().addTower(at(0, 0)); // ground, height 8
    const moverId = useStore.getState().addTower(at(50, 50));
    useStore.getState().setPlacementMode("groundOnly");

    useStore.getState().beginTransient();
    // Anchor lands squarely over the lower tower — but groundOnly ignores it.
    useStore.getState().setPiecePositionTransient(moverId, { x: 0, y: 0 });
    expect(tower(moverId).base).toBe(0); // ground, not the tower top
    expect(tower(moverId).position).toEqual({ x: 0, y: 0 });
  });

  it("normal: a piece dragged over another climbs onto its top (face-attach)", () => {
    useStore.getState().addTower(at(0, 0)); // ground, height 8
    const moverId = useStore.getState().addTower(at(50, 50));
    useStore.getState().setPlacementMode("normal");

    useStore.getState().beginTransient();
    useStore.getState().setPiecePositionTransient(moverId, { x: 0, y: 0 });
    expect(tower(moverId).base).toBe(8); // seated on the lower tower's top
    // Normal never re-centers the anchor — it tracks the pointer exactly.
    expect(tower(moverId).position).toEqual({ x: 0, y: 0 });
  });

  it("the placement mode is NOT part of the design and survives undo", () => {
    const id = useStore.getState().addTower(at(0, 0));
    useStore.getState().setPlacementMode("groundOnly");
    // A committed mutation + undo should not touch the pref.
    useStore.getState().updatePiece(id, { height: 10 });
    useStore.getState().undo();
    expect(useStore.getState().placementMode).toBe("groundOnly");
    // And it is not stored on the design document.
    expect("placementMode" in useStore.getState().design).toBe(false);
  });
});

describe("store: the one-shot 'Place on top' action", () => {
  beforeEach(reset);

  const piece = (id: string) =>
    useStore.getState().design.pieces.find((p) => p.id === id) as Tower;

  it("arms only with a selection; seats the selected piece on the target top, centered", () => {
    const targetId = useStore.getState().addTower({ position: { x: 3, y: -2 }, base: 0 });
    const moverId = useStore.getState().addTower({ position: { x: 40, y: 40 }, base: 0 });
    const target = piece(targetId);

    useStore.getState().selectPiece(moverId);
    useStore.getState().armPlaceOnTop();
    expect(useStore.getState().placeOnTopArmed).toBe(true);

    useStore.getState().placeOnTopTarget(targetId);

    // Seated on the target's top, centered on its anchor; still selected; disarmed.
    expect(piece(moverId).base).toBe(target.base + target.height);
    expect(piece(moverId).base).not.toBe(0);
    expect(piece(moverId).position).toEqual({ x: 3, y: -2 });
    expect(useStore.getState().selectedId).toBe(moverId);
    expect(useStore.getState().placeOnTopArmed).toBe(false);
  });

  it("is ONE undoable step (undo returns the piece to its prior spot + base)", () => {
    const targetId = useStore.getState().addTower({ position: { x: 3, y: -2 }, base: 0 });
    const moverId = useStore.getState().addTower({ position: { x: 40, y: 40 }, base: 0 });
    useStore.getState().selectPiece(moverId);
    useStore.getState().armPlaceOnTop();
    useStore.getState().placeOnTopTarget(targetId);

    useStore.getState().undo();
    expect(piece(moverId).position).toEqual({ x: 40, y: 40 });
    expect(piece(moverId).base).toBe(0);
  });

  it("arming requires a selection (no-op when nothing selected)", () => {
    useStore.getState().selectPiece(null);
    useStore.getState().armPlaceOnTop();
    expect(useStore.getState().placeOnTopArmed).toBe(false);
  });

  it("clicking the selected piece itself while armed cancels (no placement)", () => {
    const moverId = useStore.getState().addTower({ position: { x: 5, y: 5 }, base: 0 });
    useStore.getState().selectPiece(moverId);
    useStore.getState().armPlaceOnTop();
    useStore.getState().placeOnTopTarget(moverId); // click self
    expect(useStore.getState().placeOnTopArmed).toBe(false);
    expect(piece(moverId).position).toEqual({ x: 5, y: 5 });
    expect(piece(moverId).base).toBe(0);
  });

  it("clicking an invalid target (a moat) is a no-op that STAYS armed", () => {
    const moatId = useStore.getState().addMoatRing({ position: { x: 0, y: 0 } });
    const moverId = useStore.getState().addTower({ position: { x: 40, y: 40 }, base: 0 });
    useStore.getState().selectPiece(moverId);
    useStore.getState().armPlaceOnTop();
    useStore.getState().placeOnTopTarget(moatId);
    // No placement, and still armed so the user can pick a real target.
    expect(useStore.getState().placeOnTopArmed).toBe(true);
    expect(piece(moverId).base).toBe(0);
    expect(piece(moverId).position).toEqual({ x: 40, y: 40 });
  });

  it("selecting another piece disarms the action", () => {
    const aId = useStore.getState().addTower({ position: { x: 0, y: 0 }, base: 0 });
    const bId = useStore.getState().addTower({ position: { x: 20, y: 20 }, base: 0 });
    useStore.getState().selectPiece(aId);
    useStore.getState().armPlaceOnTop();
    expect(useStore.getState().placeOnTopArmed).toBe(true);
    useStore.getState().selectPiece(bId);
    expect(useStore.getState().placeOnTopArmed).toBe(false);
  });

  it("a two-point wall recenters BOTH endpoints onto the target center", () => {
    const targetId = useStore.getState().addTower({ position: { x: 10, y: 0 }, base: 0 });
    const target = piece(targetId);
    const wallId = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 4, y: 0 }, base: 0 });
    useStore.getState().selectPiece(wallId);
    useStore.getState().armPlaceOnTop();
    useStore.getState().placeOnTopTarget(targetId);

    const wall = useStore.getState().design.pieces.find((p) => p.id === wallId) as {
      position: { x: number; y: number };
      end: { x: number; y: number };
      base: number;
    };
    // The wall's midpoint lands on the target center; endpoints shift rigidly.
    const midX = (wall.position.x + wall.end.x) / 2;
    const midY = (wall.position.y + wall.end.y) / 2;
    expect(midX).toBeCloseTo(10, 6);
    expect(midY).toBeCloseTo(0, 6);
    expect(wall.position).toEqual({ x: 8, y: 0 });
    expect(wall.end).toEqual({ x: 12, y: 0 });
    expect(wall.base).toBe(target.base + target.height);
  });
});

describe("store: newDesign (the New Castle reset)", () => {
  beforeEach(reset);

  it("swaps in a fresh empty design and clears all doc transients", () => {
    // Build up some state: pieces, a selection, undo history, a pending snapshot.
    const id = useStore.getState().addTower(at(0, 0));
    useStore.getState().addTower(at(20, 20));
    useStore.getState().selectPiece(id);
    useStore.getState().beginTransient(); // leaves a pending snapshot

    expect(useStore.getState().design.pieces.length).toBe(2);
    expect(useStore.getState().selectedId).toBe(id);
    expect(useStore.getState().history.past.length).toBeGreaterThan(0);
    expect(useStore.getState().pendingSnapshot).not.toBeNull();

    useStore.getState().newDesign();

    const s = useStore.getState();
    expect(s.design).toEqual(createEmptyDesign());
    expect(s.design.pieces).toEqual([]);
    expect(s.design.schemaVersion).toBe(3);
    expect(s.selectedId).toBeNull(); // no surviving reference to a gone piece
    expect(s.history.past).toEqual([]);
    expect(s.history.future).toEqual([]);
    expect(s.pendingSnapshot).toBeNull();
  });

  it("bumps bootNonce so the editor tree remounts clean", () => {
    const before = useStore.getState().bootNonce;
    useStore.getState().newDesign();
    expect(useStore.getState().bootNonce).toBe(before + 1);
  });

  it("clears redo history too (a fresh start, not an undoable step)", () => {
    useStore.getState().addTower(at(0, 0));
    useStore.getState().undo(); // pushes onto future
    expect(useStore.getState().history.future.length).toBeGreaterThan(0);
    useStore.getState().newDesign();
    expect(useStore.getState().history.future).toEqual([]);
  });
});
