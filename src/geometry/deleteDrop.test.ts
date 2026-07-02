import { describe, expect, it } from "vitest";
import { dropRidersAfterDelete } from "./deleteDrop";
import type { Piece, Tower } from "../store/schema";

let seq = 0;
const id = () => `p-${seq++}`;

function tower(overrides: Partial<Tower> = {}): Tower {
  return {
    id: id(),
    kind: "tower",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    profile: "round",
    radius: 3,
    height: 4,
    crenellated: false,
    merlonSize: 0.6,
    material: { kind: "solid", color: "#999" },
    ...overrides,
  };
}

/** A tower seated exactly on top of `host` at `host`'s anchor. */
function seatOn(host: Tower, overrides: Partial<Tower> = {}): Tower {
  return tower({ position: { ...host.position }, base: host.base + host.height, ...overrides });
}

const baseOf = (pieces: Piece[], pid: string) => pieces.find((p) => p.id === pid)!.base;

describe("dropRidersAfterDelete — orphaned riders re-seat", () => {
  it("A-on-B-on-C: deleting C drops the B+A sub-stack to the ground together", () => {
    const c = tower({ position: { x: 0, y: 0 }, base: 0, height: 4 });
    const b = seatOn(c, { height: 5 }); // base 4
    const a = seatOn(b); // base 9
    const next = dropRidersAfterDelete([c, b, a], c.id);

    expect(next.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
    // B re-seats on the ground (0); A stays on B's new top (0 + 5 = 5).
    expect(baseOf(next, b.id)).toBeCloseTo(0, 9);
    expect(baseOf(next, a.id)).toBeCloseTo(5, 9);
  });

  it("A-on-B-on-C: deleting the MIDDLE B re-seats A onto C's top (not the ground)", () => {
    const c = tower({ position: { x: 0, y: 0 }, base: 0, height: 4 });
    const b = seatOn(c, { height: 5 }); // base 4
    const a = seatOn(b); // base 9
    const next = dropRidersAfterDelete([c, b, a], b.id);

    expect(next.map((p) => p.id).sort()).toEqual([a.id, c.id].sort());
    // C is untouched; A drops onto C's top (0 + 4 = 4), NOT the ground.
    expect(baseOf(next, c.id)).toBeCloseTo(0, 9);
    expect(baseOf(next, a.id)).toBeCloseTo(4, 9);
  });

  it("a 3-high sub-stack rides down as a rigid unit when its base is deleted", () => {
    // D on C on B on A (A on the ground). Delete A → B/C/D drop rigidly by A.height.
    const a = tower({ position: { x: 0, y: 0 }, base: 0, height: 4 });
    const b = seatOn(a, { height: 3 }); // base 4
    const c = seatOn(b, { height: 2 }); // base 7
    const d = seatOn(c); // base 9
    const next = dropRidersAfterDelete([a, b, c, d], a.id);

    expect(next.map((p) => p.id).sort()).toEqual([b.id, c.id, d.id].sort());
    // Everything drops by A.height (4): B→0, C→3, D→5, preserving the stack shape.
    expect(baseOf(next, b.id)).toBeCloseTo(0, 9);
    expect(baseOf(next, c.id)).toBeCloseTo(3, 9);
    expect(baseOf(next, d.id)).toBeCloseTo(5, 9);
  });

  it("leaves non-riders untouched and removes the deleted piece", () => {
    const c = tower({ position: { x: 0, y: 0 }, base: 0, height: 4 });
    const b = seatOn(c);
    const far = tower({ position: { x: 100, y: 100 }, base: 0 });
    const next = dropRidersAfterDelete([c, b, far], c.id);
    expect(next.find((p) => p.id === c.id)).toBeUndefined();
    expect(baseOf(next, far.id)).toBe(0);
    expect(baseOf(next, b.id)).toBeCloseTo(0, 9);
  });

  it("returns a fresh array and does not mutate the input", () => {
    const c = tower({ position: { x: 0, y: 0 }, base: 0, height: 4 });
    const b = seatOn(c);
    const input = [c, b];
    dropRidersAfterDelete(input, c.id);
    expect(b.base).toBeCloseTo(4, 9); // original object unchanged
  });
});
