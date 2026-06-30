import { describe, expect, it } from "vitest";
import {
  buildRamp,
  computeStair,
  MIN_RAMP_RUN,
  RAMP_SLAB_THICKNESS,
  resolveRampConnection,
  STAIR_RISER_TARGET,
  type RampDims,
} from "./rampBuilder";

function ramp(over: Partial<RampDims> = {}): RampDims {
  return { rise: 4, run: 6, width: 2, style: "ramp", ...over };
}

describe("buildRamp — inclined slab (style: ramp)", () => {
  it("emits one slab spanning the underside (0,0) to the top (rise, run)", () => {
    const parts = buildRamp(ramp({ rise: 4, run: 6, width: 2 }));
    expect(parts).toHaveLength(1);
    const slab = parts[0];
    expect(slab.role).toBe("slab");
    // Center is the midpoint of the climb: (y = rise/2, z = run/2).
    expect(slab.position).toEqual({ x: 0, y: 2, z: 3 });
    // Length is the incline hypotenuse; width applies along X; thickness is fixed.
    expect(slab.size.z).toBeCloseTo(Math.hypot(4, 6), 6);
    expect(slab.size.x).toBe(2);
    expect(slab.size.y).toBeCloseTo(RAMP_SLAB_THICKNESS, 6);
  });

  it("pitches the slab so its ends land at y=0 (bottom) and y=rise (top)", () => {
    const rise = 4;
    const run = 6;
    const slab = buildRamp(ramp({ rise, run }))[0];
    const angle = Math.atan2(rise, run);
    expect(slab.rotationX).toBeCloseTo(-angle, 6);

    // Rotating the slab's local ±Z half-length ends about X by rotationX, then
    // adding the center, must reproduce the (0,0)→(rise,run) span.
    const half = slab.size.z / 2;
    const r = slab.rotationX;
    // local end (0,0,+half) → (y' = -(+half)·sin r, z' = (+half)·cos r) + center
    const topY = -half * Math.sin(r) + slab.position.y;
    const topZ = half * Math.cos(r) + slab.position.z;
    const botY = half * Math.sin(r) + slab.position.y;
    const botZ = -half * Math.cos(r) + slab.position.z;
    expect(botY).toBeCloseTo(0, 6);
    expect(botZ).toBeCloseTo(0, 6);
    expect(topY).toBeCloseTo(rise, 6);
    expect(topZ).toBeCloseTo(run, 6);
  });

  it("width applies across local X", () => {
    expect(buildRamp(ramp({ width: 3.5 }))[0].size.x).toBe(3.5);
  });

  it("a steeper rise gives a steeper pitch (a more negative rotationX)", () => {
    const shallow = buildRamp(ramp({ rise: 1, run: 10 }))[0].rotationX;
    const steep = buildRamp(ramp({ rise: 8, run: 10 }))[0].rotationX;
    expect(steep).toBeLessThan(shallow); // both negative; steeper is more negative
  });
});

describe("computeStair — step layout", () => {
  it("step count scales with rise (more rise → more steps)", () => {
    const low = computeStair(1, 6).steps;
    const high = computeStair(4, 6).steps;
    expect(high).toBeGreaterThan(low);
  });

  it("uses round(rise / target) for the step count", () => {
    // rise 4 / 0.18 ≈ 22.2 → 22 steps
    expect(computeStair(4, 6).steps).toBe(Math.round(4 / STAIR_RISER_TARGET));
  });

  it("the actual riser is ≈ the target and lands exactly on the rise", () => {
    const rise = 4;
    const { steps, riser } = computeStair(rise, 6);
    expect(riser).toBeCloseTo(STAIR_RISER_TARGET, 1); // close to the target
    expect(steps * riser).toBeCloseTo(rise, 6); // sums exactly to the rise
  });

  it("tread depth is run / steps", () => {
    const { steps, tread } = computeStair(4, 6);
    expect(tread).toBeCloseTo(6 / steps, 6);
  });

  it("guards degenerate rise/run with zero steps", () => {
    expect(computeStair(0, 6)).toEqual({ steps: 0, riser: 0, tread: 0 });
    expect(computeStair(-2, 6)).toEqual({ steps: 0, riser: 0, tread: 0 });
    expect(computeStair(4, 0)).toEqual({ steps: 0, riser: 0, tread: 0 });
  });

  it("a tiny-but-positive rise still yields at least one step", () => {
    expect(computeStair(0.05, 6).steps).toBe(1);
  });
});

describe("buildRamp — stair (style: stair)", () => {
  it("emits one solid block per step, each rising from the underside to its tread top", () => {
    const rise = 4;
    const run = 6;
    const { steps, riser, tread } = computeStair(rise, run);
    const parts = buildRamp(ramp({ rise, run, width: 2, style: "stair" }));
    expect(parts).toHaveLength(steps);

    parts.forEach((p, i) => {
      expect(p.role).toBe("step");
      expect(p.rotationX).toBe(0);
      expect(p.size.x).toBe(2); // width
      expect(p.size.z).toBeCloseTo(tread, 6); // tread depth
      const topY = (i + 1) * riser;
      expect(p.size.y).toBeCloseTo(topY, 6); // full block height to its tread top
      expect(p.position.y).toBeCloseTo(topY / 2, 6); // centered vertically
      expect(p.position.z).toBeCloseTo(i * tread + tread / 2, 6); // marching +Z
    });
  });

  it("the top step's tread top reaches the full rise; steps cover the full run", () => {
    const rise = 3;
    const run = 9;
    const parts = buildRamp(ramp({ rise, run, style: "stair" }));
    const last = parts[parts.length - 1];
    expect(last.position.y + last.size.y / 2).toBeCloseTo(rise, 6);
    expect(last.position.z + last.size.z / 2).toBeCloseTo(run, 6);
  });

  it("more rise yields more step boxes", () => {
    const few = buildRamp(ramp({ rise: 1, run: 6, style: "stair" })).length;
    const many = buildRamp(ramp({ rise: 5, run: 6, style: "stair" })).length;
    expect(many).toBeGreaterThan(few);
  });
});

describe("buildRamp — degenerate inputs", () => {
  it("returns no parts for zero or negative rise/run (both styles)", () => {
    for (const style of ["ramp", "stair"] as const) {
      expect(buildRamp(ramp({ rise: 0, style }))).toEqual([]);
      expect(buildRamp(ramp({ rise: -1, style }))).toEqual([]);
      expect(buildRamp(ramp({ run: 0, style }))).toEqual([]);
      expect(buildRamp(ramp({ run: -3, style }))).toEqual([]);
    }
  });
});

describe("resolveRampConnection — two-point connection math", () => {
  it("spans a known bottom and top: rise = height delta, run = XZ distance", () => {
    const c = resolveRampConnection(
      { point: { x: 0, y: 0 }, base: 0, height: 0 },
      { point: { x: 0, y: 6 }, height: 8 }, // 6 m away in +Z, 8 m up
    );
    expect(c.position).toEqual({ x: 0, y: 0 });
    expect(c.base).toBe(0);
    expect(c.rise).toBe(8);
    expect(c.run).toBeCloseTo(6, 6);
    expect(c.rotation).toBe(0); // bottom→top points along +Z → 0°
  });

  it("rise is the WORLD-height delta and base is the bottom's stored base", () => {
    // Bottom seated on a piece top (base 8, world height 8); top surface at 13.
    const c = resolveRampConnection(
      { point: { x: 2, y: 0 }, base: 8, height: 8 },
      { point: { x: 2, y: 5 }, height: 13 },
    );
    expect(c.base).toBe(8);
    expect(c.rise).toBe(5);
    expect(c.run).toBeCloseTo(5, 6);
  });

  it("aims exactly at the top — an axis-aligned heading is exact", () => {
    // Top in the +X direction → local +Z must point +X → exactly 270°.
    const c = resolveRampConnection(
      { point: { x: 0, y: 0 }, base: 0, height: 0 },
      { point: { x: 6, y: 0 }, height: 4 },
    );
    expect(c.rotation).toBe(270);
  });

  it("aims exactly at the top with NO 15° snap on a non-15°-multiple heading", () => {
    // An off-axis top whose heading is not a multiple of 15°: the ramp uses the
    // EXACT bottom→top heading (ramps aim precisely; other pieces snap to 15°).
    const bottom = { point: { x: 0, y: 0 }, base: 0, height: 0 };
    const top = { point: { x: 3, y: 5 }, height: 4 };
    const exact = ((Math.atan2(-3, 5) * 180) / Math.PI + 360) % 360;
    const c = resolveRampConnection(bottom, top);
    expect(c.rotation).toBeCloseTo(exact, 6);
    expect(c.rotation % 15).not.toBe(0); // not on the 15° grid — proves no snap
  });

  it("run is the literal click distance regardless of the heading", () => {
    // An off-axis top: distance is honest (the heading is exact, not rounded).
    const top = { point: { x: 3, y: 5 }, height: 4 };
    const c = resolveRampConnection({ point: { x: 0, y: 0 }, base: 0, height: 0 }, top);
    expect(c.run).toBeCloseTo(Math.hypot(3, 5), 6);
  });

  it("clamps a top BELOW the bottom to a non-negative rise (never negative)", () => {
    const c = resolveRampConnection(
      { point: { x: 0, y: 0 }, base: 0, height: 5 },
      { point: { x: 0, y: 6 }, height: 2 }, // top lower than bottom
    );
    expect(c.rise).toBe(0);
  });

  it("floors a (near) zero horizontal distance to the minimum run", () => {
    const c = resolveRampConnection(
      { point: { x: 0, y: 0 }, base: 0, height: 0 },
      { point: { x: 0, y: 0 }, height: 8 }, // coincident in XZ
    );
    expect(c.run).toBe(MIN_RAMP_RUN);
  });

  it("grid-snaps the stored bottom anchor", () => {
    const c = resolveRampConnection(
      { point: { x: 1.234, y: -0.077 }, base: 0, height: 0 },
      { point: { x: 1.234, y: 6 }, height: 8 },
    );
    expect(c.position).toEqual({ x: 1.2, y: -0.1 });
  });
});
