import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./store";
import { createEmptyDesign, type Flag } from "./schema";
import type { FlagDesign } from "../flags/types";

// The saved-flags library lives on the store as a SEPARATE slice — not part of
// the castle Design, not in undo history, and untouched by newDesign. These
// tests exercise the store actions (persistence is a no-op under the node test
// env, where window.localStorage is absent — the actions still update state).

function reset() {
  useStore.setState({
    design: createEmptyDesign(),
    tool: "flag",
    selectedId: null,
    history: { past: [], future: [] },
    pendingSnapshot: null,
    flagLibrary: [],
  });
}

const design = (color: string): FlagDesign => ({
  aspect: 1.5,
  layers: [{ kind: "field", fill: { kind: "solid", color } }],
});

describe("store: saved-flags library", () => {
  beforeEach(reset);

  it("saveFlagToLibrary adds a named entry and returns its id", () => {
    const id = useStore.getState().saveFlagToLibrary("Red", design("#ff0000"));
    const lib = useStore.getState().flagLibrary;
    expect(lib).toHaveLength(1);
    expect(lib[0].id).toBe(id);
    expect(lib[0].name).toBe("Red");
  });

  it("overwrite updates in place; save-as leaves the original", () => {
    const id = useStore.getState().saveFlagToLibrary("Orig", design("#ff0000"));

    // Save-as new: another save → two entries, the first untouched.
    useStore.getState().saveFlagToLibrary("Copy", design("#00ff00"));
    let lib = useStore.getState().flagLibrary;
    expect(lib).toHaveLength(2);
    expect((lib[0].design.layers[0] as any).fill.color).toBe("#ff0000");

    // Overwrite the first in place.
    useStore.getState().overwriteFlagLibraryEntry(id, design("#0000ff"));
    lib = useStore.getState().flagLibrary;
    expect(lib).toHaveLength(2); // no new entry
    expect(lib.find((e) => e.id === id)!.name).toBe("Orig"); // name kept
    expect((lib.find((e) => e.id === id)!.design.layers[0] as any).fill.color).toBe(
      "#0000ff",
    );
  });

  it("rename and delete manage entries", () => {
    const id = useStore.getState().saveFlagToLibrary("Old", design("#f00"));
    useStore.getState().renameFlagLibraryEntry(id, "New");
    expect(useStore.getState().flagLibrary[0].name).toBe("New");

    useStore.getState().deleteFlagLibraryEntry(id);
    expect(useStore.getState().flagLibrary).toHaveLength(0);
  });

  it("applying a saved design into a flag produces an INDEPENDENT copy (no live link)", () => {
    // Place a flag, then apply a library design into it via updateFlagDesign.
    const id = useStore.getState().saveFlagToLibrary("Src", design("#ff0000"));
    const entry = useStore.getState().flagLibrary.find((e) => e.id === id)!;
    const flagId = useStore
      .getState()
      .addFlag({ position: { x: 0, y: 0 }, base: 0 });
    // The editor applies a CLONE of the entry's design; updateFlagDesign clones again.
    useStore.getState().updateFlagDesign(flagId, structuredClone(entry.design));

    const flag = useStore.getState().design.pieces.find(
      (p) => p.id === flagId,
    ) as Flag;
    // Mutate the flag's embedded design → the library entry is UNAFFECTED.
    (flag.design.layers[0] as any).fill.color = "#123456";
    expect(
      (useStore.getState().flagLibrary[0].design.layers[0] as any).fill.color,
    ).toBe("#ff0000");

    // Mutate the library entry → the placed flag is UNAFFECTED.
    useStore.getState().overwriteFlagLibraryEntry(id, design("#abcdef"));
    const flag2 = useStore.getState().design.pieces.find(
      (p) => p.id === flagId,
    ) as Flag;
    expect((flag2.design.layers[0] as any).fill.color).toBe("#123456");
  });

  it("newDesign (New Castle) leaves the library intact", () => {
    useStore.getState().saveFlagToLibrary("Keep", design("#f00"));
    useStore.getState().addFlag({ position: { x: 0, y: 0 }, base: 0 });
    expect(useStore.getState().design.pieces).toHaveLength(1);

    useStore.getState().newDesign();

    // The castle reset cleared the pieces...
    expect(useStore.getState().design.pieces).toHaveLength(0);
    // ...but the library is a separate store, untouched.
    expect(useStore.getState().flagLibrary).toHaveLength(1);
    expect(useStore.getState().flagLibrary[0].name).toBe("Keep");
  });

  it("the library is NOT part of the castle Export JSON", () => {
    useStore.getState().saveFlagToLibrary("Palette", design("#f00"));
    const json = JSON.stringify(useStore.getState().design);
    expect(json).not.toContain("Palette");
    expect(JSON.parse(json)).not.toHaveProperty("flagLibrary");
  });
});
