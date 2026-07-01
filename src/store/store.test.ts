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

describe("store: placement-mode toggles (persisted pref, mode-aware move path)", () => {
  beforeEach(() => {
    reset();
    useStore.getState().setPlacementMode("normal"); // start from both-off
  });

  const tower = (id: string) =>
    useStore.getState().design.pieces.find((p) => p.id === id) as Tower;

  it("setPlacementMode enforces mutual exclusivity (turning one on clears the other)", () => {
    useStore.getState().setPlacementMode("groundOnly");
    expect(useStore.getState().placementMode).toBe("groundOnly");
    // Turning the other on clears the first — a single enum can only hold one.
    useStore.getState().setPlacementMode("centerOnSupport");
    expect(useStore.getState().placementMode).toBe("centerOnSupport");
    // Back to normal (both off).
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

  it("centerOnSupport: the anchor centers on the support at COMMIT (not mid-drag)", () => {
    // The XZ centering is DEFERRED to commit so it doesn't fight the live gizmo
    // (TransformControls drives the same object from the pointer during a drag).
    // During the transient move the anchor tracks the pointer and only the height
    // is resolved; on commit (drop) it snaps onto the supporting piece's center.
    const lowerId = useStore.getState().addTower(at(3, -2)); // ground, height 8
    const moverId = useStore.getState().addTower(at(50, 50));
    const lower = tower(lowerId);
    useStore.getState().setPlacementMode("centerOnSupport");

    useStore.getState().beginTransient();
    // Drag the mover inside the lower tower's footprint but off its center.
    useStore.getState().setPiecePositionTransient(moverId, { x: 3.5, y: -1.5 });
    // Mid-drag: the anchor still tracks the pointer (raw), NOT yet centered — but
    // the height is already resolved to the support top so it reads as "on top".
    expect(tower(moverId).position).toEqual({ x: 3.5, y: -1.5 });
    expect(tower(moverId).base).toBe(lower.base + lower.height);

    // On drop the deferred snap lands the anchor on the supporting piece's center.
    useStore.getState().commitTransient();
    expect(tower(moverId).position).toEqual({ x: 3, y: -2 });
    expect(tower(moverId).base).toBe(lower.base + lower.height);
  });

  it("centerOnSupport: the live drag echoes the pointer (anti-gizmo-fight invariant)", () => {
    // Regression guard for the LIVE bug: dragging a piece onto another with the
    // Center-on-support button on did nothing, because the store moved the anchor
    // to the support center mid-drag while TransformControls was driving the same
    // object from the pointer — two writers fighting, so the piece never settled.
    // The fix keeps the anchor EQUAL to the pointer during the drag (so it never
    // fights the gizmo). This test simulates the gizmo firing onObjectChange
    // repeatedly and asserts the anchor echoes each pointer step exactly.
    const lowerId = useStore.getState().addTower(at(3, -2)); // ground, height 8
    const moverId = useStore.getState().addTower(at(50, 50));
    const lower = tower(lowerId);
    const towerTop = lower.base + lower.height;
    useStore.getState().setPlacementMode("centerOnSupport");

    useStore.getState().beginTransient();
    // A sweep of pointer positions across the tower footprint (off-center).
    for (const p of [
      { x: 4.5, y: -1.0 },
      { x: 3.8, y: -2.4 },
      { x: 2.6, y: -1.7 },
    ]) {
      useStore.getState().setPiecePositionTransient(moverId, p);
      // The anchor tracks the pointer EXACTLY — never jumps to the center — so the
      // gizmo and the store stay in agreement (no fight). Height reads as on-top.
      expect(tower(moverId).position).toEqual(p);
      expect(tower(moverId).base).toBe(towerTop);
    }

    // Only on drop does it snap onto the support center (still raised).
    useStore.getState().commitTransient();
    expect(tower(moverId).position).toEqual({ x: 3, y: -2 });
    expect(tower(moverId).base).toBe(towerTop);
  });

  it("centerOnSupport: dragging onto a tower RISES to the top, not ground (regression)", () => {
    // Regression guard for the reported bug ("stays at ground / behaves like
    // ground-only"). Through the full move→commit path the moved piece must end
    // up seated on the supporting tower's TOP (base = tower top, NOT 0) AND
    // centered — contrasted below with groundOnly, which stays on the ground.
    const lowerId = useStore.getState().addTower(at(3, -2)); // ground, height 8
    const moverId = useStore.getState().addTower(at(50, 50));
    const lower = tower(lowerId);
    const groundY = 0; // groundHeightAt is 0 this phase
    const towerTop = lower.base + lower.height; // 8

    useStore.getState().setPlacementMode("centerOnSupport");
    useStore.getState().selectPiece(moverId);
    useStore.getState().beginTransient();
    useStore.getState().setPiecePositionTransient(moverId, { x: 3.5, y: -1.5 });
    useStore.getState().commitTransient();

    // Rose to the surface top — explicitly NOT the ground — and centered.
    expect(tower(moverId).base).toBe(towerTop);
    expect(tower(moverId).base).not.toBe(groundY);
    expect(tower(moverId).position).toEqual({ x: 3, y: -2 });

    // Contrast: groundOnly over the same tower stays on the ground (no rise).
    const groundMoverId = useStore.getState().addTower(at(60, 60));
    useStore.getState().setPlacementMode("groundOnly");
    useStore.getState().selectPiece(groundMoverId);
    useStore.getState().beginTransient();
    useStore.getState().setPiecePositionTransient(groundMoverId, { x: 3.5, y: -1.5 });
    useStore.getState().commitTransient();
    expect(tower(groundMoverId).base).toBe(groundY);
  });

  it("centerOnSupport: below the 50% threshold it RISES but does NOT center (eager rule)", () => {
    // Drag the mover so its anchor sits inside the support footprint but LESS than
    // half of it overlaps (two radius-2 towers ~1.7 m apart ≈ 48% overlap). The
    // eager rule requires >50% (or aligned centers), so it face-attaches (rises)
    // yet keeps the raw XZ — it must NOT snap to the support center.
    const lowerId = useStore.getState().addTower(at(3, -2)); // ground, height 8
    const moverId = useStore.getState().addTower(at(50, 50));
    const lower = tower(lowerId);
    useStore.getState().setPlacementMode("centerOnSupport");
    useStore.getState().selectPiece(moverId);
    useStore.getState().beginTransient();
    useStore.getState().setPiecePositionTransient(moverId, { x: 3, y: -0.3 });
    useStore.getState().commitTransient();
    // Rose onto the tower (anchor is over its footprint) but stayed off-center.
    expect(tower(moverId).base).toBe(lower.base + lower.height);
    expect(tower(moverId).position).toEqual({ x: 3, y: -0.3 });
  });

  it("centerOnSupport: crossing the 50% threshold latches and centers (eager rule)", () => {
    // Nudge closer (~0.7 m apart ≈ 80% overlap) → over the 50% threshold → the
    // piece latches onto the support with their centers aligned.
    const lowerId = useStore.getState().addTower(at(3, -2)); // ground, height 8
    const moverId = useStore.getState().addTower(at(50, 50));
    const lower = tower(lowerId);
    useStore.getState().setPlacementMode("centerOnSupport");
    useStore.getState().selectPiece(moverId);
    useStore.getState().beginTransient();
    useStore.getState().setPiecePositionTransient(moverId, { x: 3.5, y: -1.5 });
    useStore.getState().commitTransient();
    expect(tower(moverId).base).toBe(lower.base + lower.height);
    expect(tower(moverId).position).toEqual({ x: 3, y: -2 }); // centered on the support
  });

  it("centerOnSupport over open ground behaves like normal: seats on ground, no center", () => {
    const moverId = useStore.getState().addTower(at(50, 50));
    useStore.getState().setPlacementMode("centerOnSupport");
    useStore.getState().selectPiece(moverId);
    useStore.getState().beginTransient();
    // No piece under the anchor → nothing to center on → stays put on the ground.
    useStore.getState().setPiecePositionTransient(moverId, { x: 20, y: 20 });
    useStore.getState().commitTransient();
    expect(tower(moverId).base).toBe(0);
    expect(tower(moverId).position).toEqual({ x: 20, y: 20 });
  });

  it("centerOnSupport over open ground leaves the anchor where it is (no surface)", () => {
    const moverId = useStore.getState().addTower(at(50, 50));
    useStore.getState().setPlacementMode("centerOnSupport");
    useStore.getState().beginTransient();
    useStore.getState().setPiecePositionTransient(moverId, { x: 20, y: 20 });
    expect(tower(moverId).position).toEqual({ x: 20, y: 20 });
    expect(tower(moverId).base).toBe(0);
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
    expect(s.design.schemaVersion).toBe(1);
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
