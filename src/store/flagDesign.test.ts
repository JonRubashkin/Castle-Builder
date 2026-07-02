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

  it("commits pole/cloth dimensions WITH the design as ONE undoable step (Part 3)", () => {
    const id = useStore.getState().addFlag({ position: { x: 0, y: 0 }, base: 0 });
    const before = structuredClone(flagOf().design);
    const pole0 = flagOf().poleHeight;
    const cloth0 = flagOf().clothWidth;
    const pastBefore = useStore.getState().history.past.length;

    useStore
      .getState()
      .updateFlagDesign(id, editedDesign(before), { poleHeight: 9, clothWidth: 3.3 });

    expect(flagOf().design.aspect).toBe(2);
    expect(flagOf().poleHeight).toBe(9);
    expect(flagOf().clothWidth).toBe(3.3);
    // Design + dimensions are a single coalesced history entry.
    expect(useStore.getState().history.past.length).toBe(pastBefore + 1);

    // One undo reverses design AND dimensions together.
    useStore.getState().undo();
    expect(flagOf().design).toEqual(before);
    expect(flagOf().poleHeight).toBe(pole0);
    expect(flagOf().clothWidth).toBe(cloth0);
  });
});

describe("store: lastFlagDesign pref (2Fe.1)", () => {
  beforeEach(() => {
    reset();
    useStore.setState({ lastFlagDesign: null });
  });

  it("updates when a flag design is applied (backs the chooser's use-last)", () => {
    const id = useStore.getState().addFlag({ position: { x: 0, y: 0 }, base: 0 });
    const edited = editedDesign(structuredClone(flagOf().design));
    useStore.getState().updateFlagDesign(id, edited);

    const last = useStore.getState().lastFlagDesign;
    expect(last).toEqual(edited);
    // It is a CLONE — mutating the passed design doesn't leak into the pref.
    edited.aspect = 99;
    expect(useStore.getState().lastFlagDesign!.aspect).toBe(2);
  });

  it("setLastFlagDesign stores an independent clone", () => {
    const design: FlagDesign = {
      aspect: 1.5,
      layers: [{ kind: "field", fill: { kind: "solid", color: "#abcdef" } }],
    };
    useStore.getState().setLastFlagDesign(design);
    expect(useStore.getState().lastFlagDesign).toEqual(design);
    design.aspect = 42;
    expect(useStore.getState().lastFlagDesign!.aspect).toBe(1.5);
  });

  it("saving a design to the library stores ONLY the design (no pole/cloth dims)", () => {
    const id = useStore.getState().addFlag({ position: { x: 0, y: 0 }, base: 0 });
    // The flag has customized dimensions; those are PIECE props, not design.
    useStore.getState().updatePiece(id, { poleHeight: 12, clothWidth: 4 });
    const flag = flagOf();

    const entryId = useStore.getState().saveFlagToLibrary("Banner", flag.design);
    const entry = useStore.getState().flagLibrary.find((e) => e.id === entryId)!;
    // The library entry's design carries only aspect + layers — never pole/cloth.
    expect(Object.keys(entry.design).sort()).toEqual(["aspect", "layers"]);
    expect("poleHeight" in entry.design).toBe(false);
    expect("clothWidth" in entry.design).toBe(false);
  });
});
