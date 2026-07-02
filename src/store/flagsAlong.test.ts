import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./store";
import { createEmptyDesign, type Flag, type WallRun } from "./schema";
import type { FlagDesign } from "../flags/types";
import { flatTopWorldY } from "../geometry/support";

function reset() {
  useStore.setState({
    design: createEmptyDesign(),
    tool: "select",
    selectedId: null,
    history: { past: [], future: [] },
    pendingSnapshot: null,
  });
}

const flags = (): Flag[] =>
  useStore.getState().design.pieces.filter((p): p is Flag => p.kind === "flag");

describe("store: addFlagsAlong (2Fe auto-place-along)", () => {
  beforeEach(reset);

  it("generates independent flag pieces along a wall in ONE undoable step", () => {
    const wallId = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 12, y: 0 }, base: 0 });
    const wall = useStore.getState().design.pieces.find((p) => p.id === wallId) as WallRun;
    const top = flatTopWorldY(wall) as number;
    const pastBefore = useStore.getState().history.past.length;

    const ids = useStore.getState().addFlagsAlong(wallId, { spacing: 4 });

    // length 12, default inset 1 → usable 10; spacing 4 → 3 flags.
    expect(ids).toHaveLength(3);
    expect(flags()).toHaveLength(3);
    // Each is a real, kind:"flag" piece seated on the wall top with its own design.
    for (const f of flags()) {
      expect(f.kind).toBe("flag");
      expect(f.base).toBeCloseTo(top, 6);
      expect(f.design).toBeTruthy();
      expect(f.position.y).toBeCloseTo(0, 6);
    }
    // Exactly ONE history entry for the whole batch.
    expect(useStore.getState().history.past.length).toBe(pastBefore + 1);

    // One undo removes ALL the generated flags together.
    useStore.getState().undo();
    expect(flags()).toHaveLength(0);
  });

  it("is generate-once: resizing the wall afterward does NOT move the flags", () => {
    const wallId = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 12, y: 0 }, base: 0 });
    useStore.getState().addFlagsAlong(wallId, { spacing: 4 });
    const before = flags().map((f) => ({ ...f.position }));

    // Move the wall's end far away — the flags must stay put (no live link).
    useStore.getState().setWallEndpoint(wallId, "end", { x: 40, y: 40 });

    const after = flags().map((f) => ({ ...f.position }));
    expect(after).toEqual(before);
  });

  it("each generated flag EMBEDS its own independent design (edit one, others unaffected)", () => {
    const wallId = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 12, y: 0 }, base: 0 });
    const ids = useStore.getState().addFlagsAlong(wallId, { spacing: 4 });

    // Edit the first flag's design; the others keep their own copies.
    const first = ids[0];
    const firstDesign = (flags().find((f) => f.id === first) as Flag).design;
    useStore.getState().updateFlagDesign(first, {
      ...firstDesign,
      aspect: 2.5,
      layers: [
        ...firstDesign.layers,
        { kind: "charge", symbolId: "star", x: 0.5, y: 0.5, scale: 0.4, color: "#ff0" },
      ],
    });

    const edited = flags().find((f) => f.id === first) as Flag;
    const other = flags().find((f) => f.id === ids[1]) as Flag;
    expect(edited.design.aspect).toBe(2.5);
    expect(edited.design.layers.some((l) => l.kind === "charge")).toBe(true);
    // The sibling flag is untouched (independent embedded design).
    expect(other.design.layers.some((l) => l.kind === "charge")).toBe(false);
  });

  it("embeds a COPY of a provided design (mutating it later doesn't leak into the flags)", () => {
    const wallId = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 12, y: 0 }, base: 0 });
    const design: FlagDesign = {
      aspect: 1.5,
      layers: [{ kind: "field", fill: { kind: "solid", color: "#123456" } }],
    };
    useStore.getState().addFlagsAlong(wallId, { count: 2, design });

    // Mutating the source object must not affect the already-embedded copies.
    design.aspect = 99;
    for (const f of flags()) expect(f.design.aspect).toBe(1.5);
  });

  it("is a no-op for an unsupported host (a tower) — no flags, no history entry", () => {
    const towerId = useStore.getState().addTower({ position: { x: 0, y: 0 }, base: 0 });
    const pastBefore = useStore.getState().history.past.length;
    const ids = useStore.getState().addFlagsAlong(towerId, { spacing: 4 });
    expect(ids).toEqual([]);
    expect(flags()).toHaveLength(0);
    expect(useStore.getState().history.past.length).toBe(pastBefore);
  });

  it("is a no-op for a missing host id", () => {
    expect(useStore.getState().addFlagsAlong("nope")).toEqual([]);
  });

  it("tags each generated flag with its host id; hand-placed flags carry no marker", () => {
    const wallId = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 12, y: 0 }, base: 0 });
    useStore.getState().addFlagsAlong(wallId, { spacing: 4 });
    for (const f of flags()) expect(f.autoFlagHostId).toBe(wallId);

    // A hand-placed flag has no provenance marker.
    const handId = useStore.getState().addFlag({ position: { x: 30, y: 0 }, base: 0 });
    const hand = flags().find((f) => f.id === handId) as Flag;
    expect(hand.autoFlagHostId).toBeUndefined();
  });

  it("re-run REPLACES: a second add removes the prior tagged set and lays a fresh one", () => {
    const wallId = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 12, y: 0 }, base: 0 });

    const first = useStore.getState().addFlagsAlong(wallId, { spacing: 4 });
    expect(flags()).toHaveLength(3);

    // Re-run with a tighter spacing → a DIFFERENT count, and NONE of the old ids
    // survive (wholesale replace, not append).
    const second = useStore.getState().addFlagsAlong(wallId, { spacing: 2 });
    const ids = flags().map((f) => f.id);
    expect(flags()).toHaveLength(second.length);
    expect(second.length).not.toBe(first.length);
    for (const oldId of first) expect(ids).not.toContain(oldId);
    for (const newId of second) expect(ids).toContain(newId);
  });

  it("re-run replaces even flags the user hand-moved after generation", () => {
    const wallId = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 12, y: 0 }, base: 0 });
    const first = useStore.getState().addFlagsAlong(wallId, { spacing: 4 });

    // The user drags one generated flag far away — it keeps its host marker.
    useStore.getState().updatePiece(first[0], { position: { x: 99, y: 99 } });

    // A re-run still removes it (wholesale — including hand-moved tagged flags).
    useStore.getState().addFlagsAlong(wallId, { spacing: 4 });
    const ids = flags().map((f) => f.id);
    expect(ids).not.toContain(first[0]);
  });

  it("re-run leaves flags tagged to a DIFFERENT host untouched", () => {
    const wallA = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 12, y: 0 }, base: 0 });
    const wallB = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 20 }, end: { x: 12, y: 20 }, base: 0 });
    useStore.getState().addFlagsAlong(wallA, { spacing: 4 });
    const bIds = useStore.getState().addFlagsAlong(wallB, { spacing: 4 });

    // Re-run on wall A: wall B's flags must all survive verbatim.
    useStore.getState().addFlagsAlong(wallA, { spacing: 4 });
    const surviving = flags().filter((f) => f.autoFlagHostId === wallB).map((f) => f.id);
    expect(surviving.sort()).toEqual([...bIds].sort());
  });

  it("re-run is ONE undo step: undo restores the prior tagged set exactly", () => {
    const wallId = useStore
      .getState()
      .addWallRun({ position: { x: 0, y: 0 }, end: { x: 12, y: 0 }, base: 0 });
    const first = useStore.getState().addFlagsAlong(wallId, { spacing: 4 });
    const before = flags()
      .map((f) => f.id)
      .sort();

    const pastBefore = useStore.getState().history.past.length;
    useStore.getState().addFlagsAlong(wallId, { spacing: 2 });
    // The whole replace is a single history entry.
    expect(useStore.getState().history.past.length).toBe(pastBefore + 1);

    // One undo brings back exactly the first batch (same ids, same count).
    useStore.getState().undo();
    const after = flags()
      .map((f) => f.id)
      .sort();
    expect(after).toEqual(before);
    expect(flags().map((f) => f.id).sort()).toEqual([...first].sort());
  });
});
