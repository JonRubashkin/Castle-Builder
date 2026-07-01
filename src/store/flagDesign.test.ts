import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./store";
import { createEmptyDesign, type Flag } from "./schema";
import type { FlagDesign } from "../flags/types";

function reset() {
  useStore.setState({
    design: createEmptyDesign(),
    tool: "flag",
    selectedId: null,
    history: { past: [], future: [] },
    pendingSnapshot: null,
  });
}

const flagOf = () => useStore.getState().design.pieces[0] as Flag;

// A working-copy edit like the editor's Apply carries (added layers + a moved
// charge) — the whole editing session coalesced into one design object.
function editedDesign(base: FlagDesign): FlagDesign {
  return {
    ...base,
    aspect: 2,
    layers: [
      ...base.layers,
      { kind: "stripes", orientation: "vertical", count: 2, colors: ["#000", "#fff"] },
      { kind: "charge", symbolId: "star", x: 0.25, y: 0.75, scale: 0.4, color: "#ff0" },
    ],
  };
}

describe("store: updateFlagDesign (the editor's Apply)", () => {
  beforeEach(reset);

  it("commits the whole design as ONE undoable, coalesced edit", () => {
    const id = useStore.getState().addFlag({ position: { x: 0, y: 0 }, base: 0 });
    const before = structuredClone(flagOf().design);
    const pastBefore = useStore.getState().history.past.length;

    useStore.getState().updateFlagDesign(id, editedDesign(before));

    const after = flagOf().design;
    expect(after.aspect).toBe(2);
    expect(after.layers).toHaveLength(before.layers.length + 2);
    expect(after.layers.some((l) => l.kind === "stripes")).toBe(true);
    expect(after.layers.some((l) => l.kind === "charge")).toBe(true);
    // Exactly ONE new history entry for the whole session (coalesced).
    expect(useStore.getState().history.past.length).toBe(pastBefore + 1);
  });

  it("is reversible: one undo restores the pre-edit design (Cancel-equivalent state)", () => {
    const id = useStore.getState().addFlag({ position: { x: 0, y: 0 }, base: 0 });
    const before = structuredClone(flagOf().design);

    useStore.getState().updateFlagDesign(id, editedDesign(before));
    expect(flagOf().design.aspect).toBe(2);

    useStore.getState().undo();
    expect(flagOf().design).toEqual(before);
  });

  it("stores a CLONE — later mutating the passed object does not leak into state", () => {
    const id = useStore.getState().addFlag({ position: { x: 0, y: 0 }, base: 0 });
    const working = editedDesign(structuredClone(flagOf().design));
    useStore.getState().updateFlagDesign(id, working);

    // Mutate the working copy after Apply; committed state must be unaffected.
    working.aspect = 99;
    working.layers.push({ kind: "field", fill: { kind: "solid", color: "#000" } });
    expect(flagOf().design.aspect).toBe(2);
  });
});
