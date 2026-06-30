import { describe, expect, it } from "vitest";
import { resolveSupportAt } from "./support";
import type { Tower } from "../store/schema";

function tower(overrides: Partial<Tower> = {}): Tower {
  return {
    id: "t",
    kind: "tower",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    profile: "round",
    radius: 2,
    height: 8,
    crenellated: false,
    merlonSize: 0.6,
    material: { kind: "solid", color: "#999" },
    ...overrides,
  };
}

describe("resolveSupportAt — the face-attach support rule", () => {
  it("over empty ground → base 0, not on a surface", () => {
    const r = resolveSupportAt({ x: 0, y: 0 }, []);
    expect(r).toEqual({ base: 0, onSurface: false, surfaceId: null });
  });

  it("over empty ground with pieces elsewhere → still ground (base 0)", () => {
    const far = tower({ id: "far", position: { x: 50, y: 50 } });
    const r = resolveSupportAt({ x: 0, y: 0 }, [far]);
    expect(r.base).toBe(0);
    expect(r.onSurface).toBe(false);
  });

  it("over a tower top → base equals that tower's top, flagged on-surface", () => {
    const lower = tower({ id: "lower", base: 0, height: 8 });
    const r = resolveSupportAt({ x: 0, y: 0 }, [lower]);
    // top = base + height = 8 (groundHeightAt is 0 in phase 1)
    expect(r.base).toBe(lower.base + lower.height);
    expect(r.onSurface).toBe(true);
    expect(r.surfaceId).toBe("lower");
  });

  it("seats on the HIGHEST overlapping top when towers are stacked", () => {
    const lower = tower({ id: "lower", base: 0, height: 8 });
    const upper = tower({ id: "upper", base: 8, height: 5 }); // top = 13
    const r = resolveSupportAt({ x: 0, y: 0 }, [lower, upper]);
    expect(r.base).toBe(13);
    expect(r.surfaceId).toBe("upper");
  });

  it("ignores a tower whose footprint the anchor is outside of", () => {
    const t = tower({ id: "t", position: { x: 0, y: 0 }, radius: 2, height: 8 });
    // anchor at x=5 is well outside a radius-2 footprint centered at origin.
    const r = resolveSupportAt({ x: 5, y: 0 }, [t]);
    expect(r.base).toBe(0);
    expect(r.onSurface).toBe(false);
  });

  it("respects a square tower's rotated footprint", () => {
    const sq = tower({
      id: "sq",
      profile: "square",
      radius: 2,
      rotation: 45,
      height: 6,
    });
    // The unrotated corner (1.9, 1.9) is OUTSIDE a 45°-rotated square → ground.
    expect(resolveSupportAt({ x: 1.9, y: 1.9 }, [sq]).onSurface).toBe(false);
    // The center is inside → seats on top (base = height = 6).
    const onTop = resolveSupportAt({ x: 0, y: 0 }, [sq]);
    expect(onTop.onSurface).toBe(true);
    expect(onTop.base).toBe(6);
  });
});
