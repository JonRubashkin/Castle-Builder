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
