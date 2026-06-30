import { describe, expect, it } from "vitest";
import {
  footprintAABBHalfExtents,
  footprintContains,
  towerFootprint,
  type TowerFootprint,
} from "./towerFootprint";
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

describe("towerFootprint", () => {
  it("derives center/radius/profile from the tower", () => {
    const fp = towerFootprint(tower({ position: { x: 3, y: -4 }, radius: 1.5 }));
    expect(fp).toEqual<TowerFootprint>({
      profile: "round",
      center: { x: 3, y: -4 },
      radius: 1.5,
      rotation: 0,
    });
  });
});

describe("footprintContains (round)", () => {
  const fp = towerFootprint(tower({ radius: 2 }));

  it("includes the center and points within the radius", () => {
    expect(footprintContains(fp, { x: 0, y: 0 })).toBe(true);
    expect(footprintContains(fp, { x: 1.5, y: 0 })).toBe(true);
    expect(footprintContains(fp, { x: 0, y: -2 })).toBe(true); // on the edge
  });

  it("excludes points outside the radius", () => {
    expect(footprintContains(fp, { x: 2.1, y: 0 })).toBe(false);
    expect(footprintContains(fp, { x: 1.5, y: 1.5 })).toBe(false);
  });

  it("is offset by the center", () => {
    const off = towerFootprint(tower({ position: { x: 10, y: 10 }, radius: 1 }));
    expect(footprintContains(off, { x: 10.5, y: 10 })).toBe(true);
    expect(footprintContains(off, { x: 0, y: 0 })).toBe(false);
  });
});

describe("footprintContains (square)", () => {
  it("tests an axis-aligned box at rotation 0", () => {
    const fp = towerFootprint(tower({ profile: "square", radius: 2, rotation: 0 }));
    expect(footprintContains(fp, { x: 1.9, y: 1.9 })).toBe(true);
    expect(footprintContains(fp, { x: 2.1, y: 0 })).toBe(false);
    expect(footprintContains(fp, { x: 0, y: 2.1 })).toBe(false);
  });

  it("respects rotation: a 45° box rejects a former corner", () => {
    const fp = towerFootprint(
      tower({ profile: "square", radius: 2, rotation: 45 }),
    );
    // The unrotated corner (1.9, 1.9) lies outside a 45°-rotated square.
    expect(footprintContains(fp, { x: 1.9, y: 1.9 })).toBe(false);
    // A point along the rotated diagonal (toward a vertex) is inside.
    expect(footprintContains(fp, { x: 2.5, y: 0 })).toBe(true);
  });
});

describe("footprintAABBHalfExtents", () => {
  it("equals the radius for a round footprint", () => {
    const fp = towerFootprint(tower({ radius: 3 }));
    expect(footprintAABBHalfExtents(fp)).toEqual({ x: 3, y: 3 });
  });

  it("grows for a rotated square (AABB of the rotated box)", () => {
    const fp = towerFootprint(
      tower({ profile: "square", radius: 2, rotation: 45 }),
    );
    const ext = footprintAABBHalfExtents(fp);
    expect(ext.x).toBeCloseTo(2 * Math.SQRT2, 6);
    expect(ext.y).toBeCloseTo(2 * Math.SQRT2, 6);
  });

  it("is rotation-invariant for a round footprint (rotation is meaningless)", () => {
    for (const rotation of [0, 15, 90, 200]) {
      const fp = towerFootprint(tower({ radius: 2.5, rotation }));
      expect(footprintAABBHalfExtents(fp)).toEqual({ x: 2.5, y: 2.5 });
    }
  });
});

// Part 0.2a — exercise the single-source footprint helper "hard": a sweep over
// radius / half-extent / rotation for both profiles, checking the containment
// invariants the renderer AND the hit-test both rely on.
describe("footprintContains — radius/half-extent sweep (round)", () => {
  for (const radius of [0.5, 1, 2, 3.7]) {
    it(`radius ${radius}: edge included, just-outside excluded, at any center`, () => {
      const center = { x: radius * 2, y: -radius }; // arbitrary offset
      const fp = towerFootprint(tower({ position: center, radius }));
      const inset = radius * 0.999; // just inside (avoids exact-edge FP dust)
      // Dead center and near-edge points along each axis are inside.
      expect(footprintContains(fp, center)).toBe(true);
      expect(footprintContains(fp, { x: center.x + inset, y: center.y })).toBe(true);
      expect(footprintContains(fp, { x: center.x, y: center.y - inset })).toBe(true);
      // A hair beyond the radius is outside.
      expect(
        footprintContains(fp, { x: center.x + radius + 0.001, y: center.y }),
      ).toBe(false);
      // The bounding-box corner (radius, radius) is outside a circle.
      expect(
        footprintContains(fp, { x: center.x + radius, y: center.y + radius }),
      ).toBe(false);
    });
  }
});

describe("footprintContains — half-extent + rotation sweep (square)", () => {
  for (const half of [0.5, 1.5, 3]) {
    for (const rotation of [0, 15, 30, 45, 90, 135]) {
      it(`half-extent ${half} @ ${rotation}°: center in, inner radius in, far point out`, () => {
        const fp = towerFootprint(
          tower({ profile: "square", radius: half, rotation }),
        );
        // Center is always inside, at any rotation.
        expect(footprintContains(fp, { x: 0, y: 0 })).toBe(true);
        // Any point within the INSCRIBED circle (radius = half) is inside the
        // square no matter how it is rotated — pick a few directions.
        for (const ang of [0, 1, 2.5, 4]) {
          const r = half * 0.7; // safely inside the inscribed circle
          expect(
            footprintContains(fp, { x: Math.cos(ang) * r, y: Math.sin(ang) * r }),
          ).toBe(true);
        }
        // Any point beyond the CIRCUMSCRIBED circle (radius = half·√2) is
        // outside the square no matter how it is rotated.
        for (const ang of [0, 1, 2.5, 4]) {
          const r = half * Math.SQRT2 + 0.01;
          expect(
            footprintContains(fp, { x: Math.cos(ang) * r, y: Math.sin(ang) * r }),
          ).toBe(false);
        }
      });
    }
  }

  it("a 45° square admits its rotated vertex direction but rejects the old corner", () => {
    const half = 2;
    const fp = towerFootprint(
      tower({ profile: "square", radius: half, rotation: 45 }),
    );
    // The unrotated corner is now outside.
    expect(footprintContains(fp, { x: half * 0.95, y: half * 0.95 })).toBe(false);
    // Toward a rotated vertex (along +X after a 45° spin) reaches ~half·√2.
    expect(footprintContains(fp, { x: half * 1.3, y: 0 })).toBe(true);
    expect(footprintContains(fp, { x: half * 1.45, y: 0 })).toBe(false);
  });
});
