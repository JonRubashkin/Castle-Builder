import { describe, expect, it } from "vitest";
import { rampCenter, rampFootprint } from "./rampFootprint";
import { rectFootprintContains } from "./rectFootprint";
import type { Ramp } from "../store/schema";

function ramp(over: Partial<Ramp> = {}): Ramp {
  return {
    id: "r",
    kind: "ramp",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    rise: 4,
    run: 6,
    width: 2,
    style: "ramp",
    material: { kind: "solid", color: "#9a958c" },
    ...over,
  };
}

describe("rampCenter — the run-midpoint of the oriented rectangle", () => {
  it("at rotation 0, the center is the bottom anchor pushed +run/2 along +Z", () => {
    expect(rampCenter(ramp({ position: { x: 0, y: 0 }, run: 6 }))).toEqual({ x: 0, y: 3 });
  });

  it("at rotation 90°, the run pushes along −X (local +Z heads −X)", () => {
    const c = rampCenter(ramp({ position: { x: 0, y: 0 }, run: 6, rotation: 90 }));
    expect(c.x).toBeCloseTo(-3, 6);
    expect(c.y).toBeCloseTo(0, 6);
  });
});

describe("rampFootprint — run × width oriented rectangle", () => {
  it("is centered on the run-midpoint with half-extents width/2 × run/2", () => {
    const fp = rampFootprint(ramp({ run: 6, width: 2 }));
    expect(fp.center).toEqual({ x: 0, y: 3 });
    expect(fp.halfX).toBeCloseTo(1, 6); // width/2
    expect(fp.halfZ).toBeCloseTo(3, 6); // run/2
    expect(fp.rotation).toBe(0);
  });

  it("hit-test: a point on the deck is inside; points past the run/width are outside", () => {
    const fp = rampFootprint(ramp({ run: 6, width: 2, rotation: 0 }));
    expect(rectFootprintContains(fp, { x: 0, y: 3 })).toBe(true); // mid-deck
    expect(rectFootprintContains(fp, { x: 0, y: 0 })).toBe(true); // at the bottom anchor edge
    expect(rectFootprintContains(fp, { x: 0, y: 6 })).toBe(true); // at the top edge
    expect(rectFootprintContains(fp, { x: 0, y: 6.5 })).toBe(false); // past the run
    expect(rectFootprintContains(fp, { x: 1.5, y: 3 })).toBe(false); // past the width
  });

  it("respects the heading: a rotated ramp's deck rotates with it", () => {
    const fp = rampFootprint(ramp({ position: { x: 0, y: 0 }, run: 6, width: 2, rotation: 90 }));
    // The deck now runs along −X, so a point 3 m in −X is mid-deck (inside).
    expect(rectFootprintContains(fp, { x: -3, y: 0 })).toBe(true);
    // …and the old +Z mid-deck point is now outside.
    expect(rectFootprintContains(fp, { x: 0, y: 3 })).toBe(false);
  });
});
