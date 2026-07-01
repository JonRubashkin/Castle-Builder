// Unit tests for the PURE flag-layout math: division rects, stripe bands, and
// charge transforms. We test geometry/layout, never rasterized pixels.

import { describe, expect, it } from "vitest";
import {
  chargeTransform,
  clipHalfPlane,
  divisionSectionCount,
  divisionSections,
  polygonArea,
  stripeBands,
  type RectSection,
} from "./layout";

const W = 300;
const H = 200;

const asRect = (s: ReturnType<typeof divisionSections>[number]): RectSection => {
  if (s.kind !== "rect") throw new Error("expected a rect section");
  return s;
};

describe("divisionSections", () => {
  it("perPale → two half-width columns tiling the flag", () => {
    const [l, r] = divisionSections("perPale", W, H).map(asRect);
    expect(l).toEqual({ kind: "rect", x: 0, y: 0, w: W / 2, h: H });
    expect(r).toEqual({ kind: "rect", x: W / 2, y: 0, w: W / 2, h: H });
  });

  it("perFess → two half-height rows tiling the flag", () => {
    const [t, b] = divisionSections("perFess", W, H).map(asRect);
    expect(t).toEqual({ kind: "rect", x: 0, y: 0, w: W, h: H / 2 });
    expect(b).toEqual({ kind: "rect", x: 0, y: H / 2, w: W, h: H / 2 });
  });

  it("quarterly → four correct quarters in reading order (TL,TR,BL,BR)", () => {
    const q = divisionSections("quarterly", W, H).map(asRect);
    expect(q).toHaveLength(4);
    expect(q[0]).toEqual({ kind: "rect", x: 0, y: 0, w: W / 2, h: H / 2 });
    expect(q[1]).toEqual({ kind: "rect", x: W / 2, y: 0, w: W / 2, h: H / 2 });
    expect(q[2]).toEqual({ kind: "rect", x: 0, y: H / 2, w: W / 2, h: H / 2 });
    expect(q[3]).toEqual({ kind: "rect", x: W / 2, y: H / 2, w: W / 2, h: H / 2 });
    // The four quarters tile the whole flag with no gaps/overlap.
    const area = q.reduce((s, r) => s + r.w * r.h, 0);
    expect(area).toBeCloseTo(W * H);
  });

  it("perBend → two triangles splitting the flag corner-to-corner", () => {
    const secs = divisionSections("perBend", W, H);
    expect(secs).toHaveLength(2);
    for (const s of secs) expect(s.kind).toBe("poly");
    const total =
      polygonArea((secs[0] as { points: [number, number][] }).points) +
      polygonArea((secs[1] as { points: [number, number][] }).points);
    expect(total).toBeCloseTo(W * H);
  });

  it("divisionSectionCount matches the section arrays", () => {
    for (const d of ["perPale", "perFess", "perBend", "quarterly"] as const) {
      expect(divisionSectionCount(d)).toBe(divisionSections(d, W, H).length);
    }
  });
});

describe("stripeBands", () => {
  it("N horizontal stripes → N equal full-width bands that tile top-to-bottom", () => {
    const n = 5;
    const bands = stripeBands("horizontal", n, W, H).map(asRect);
    expect(bands).toHaveLength(n);
    bands.forEach((b, i) => {
      expect(b).toEqual({ kind: "rect", x: 0, y: (i * H) / n, w: W, h: H / n });
    });
    expect(bands.reduce((s, b) => s + b.w * b.h, 0)).toBeCloseTo(W * H);
  });

  it("N vertical stripes → N equal full-height bands tiling left-to-right", () => {
    const n = 3;
    const bands = stripeBands("vertical", n, W, H).map(asRect);
    expect(bands).toHaveLength(n);
    bands.forEach((b, i) => {
      expect(b).toEqual({ kind: "rect", x: (i * W) / n, y: 0, w: W / n, h: H });
    });
  });

  it("N diagonal stripes → N polygons that partition the flag area", () => {
    const n = 4;
    const bands = stripeBands("diagonal", n, W, H);
    expect(bands).toHaveLength(n);
    let total = 0;
    for (const b of bands) {
      expect(b.kind).toBe("poly");
      const pts = (b as { points: [number, number][] }).points;
      // Every vertex lies within the flag rect.
      for (const [x, y] of pts) {
        expect(x).toBeGreaterThanOrEqual(-1e-6);
        expect(x).toBeLessThanOrEqual(W + 1e-6);
        expect(y).toBeGreaterThanOrEqual(-1e-6);
        expect(y).toBeLessThanOrEqual(H + 1e-6);
      }
      total += polygonArea(pts);
    }
    expect(total).toBeCloseTo(W * H);
  });

  it("clamps a nonsensical count to at least one band", () => {
    expect(stripeBands("horizontal", 0, W, H)).toHaveLength(1);
    expect(stripeBands("horizontal", -3, W, H)).toHaveLength(1);
  });
});

describe("clipHalfPlane", () => {
  it("keeps the whole polygon when it lies inside the half-plane", () => {
    const sq: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    // Keep x ≥ -5: everything survives.
    expect(clipHalfPlane(sq, 1, 0, -5, true)).toHaveLength(4);
  });

  it("clips a square to half when split down the middle", () => {
    const sq: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const half = clipHalfPlane(sq, 1, 0, 5, true); // keep x ≥ 5
    expect(polygonArea(half)).toBeCloseTo(50);
  });
});

describe("chargeTransform", () => {
  const vb: readonly [number, number] = [100, 100];

  it("a charge at (0.5,0.5) scale 1 centers on the flag", () => {
    const t = chargeTransform({ x: 0.5, y: 0.5, scale: 1 }, W, H, vb);
    expect(t.cx).toBe(W / 2);
    expect(t.cy).toBe(H / 2);
    // A square viewBox at scale 1 spans the flag height.
    expect(t.width).toBeCloseTo(H);
    expect(t.height).toBeCloseTo(H);
    expect(t.left).toBeCloseTo(W / 2 - H / 2);
    expect(t.top).toBeCloseTo(0);
    expect(t.rotation).toBe(0);
    expect(t.vbCx).toBe(50);
    expect(t.vbCy).toBe(50);
  });

  it("positions by normalized coordinates and scales by flag height", () => {
    const t = chargeTransform({ x: 0.25, y: 0.75, scale: 0.5 }, W, H, vb);
    expect(t.cx).toBe(0.25 * W);
    expect(t.cy).toBe(0.75 * H);
    expect(t.width).toBeCloseTo(0.5 * H);
  });

  it("preserves a non-square viewBox aspect ratio", () => {
    const t = chargeTransform({ x: 0.5, y: 0.5, scale: 1 }, W, H, [50, 100]);
    // Larger dimension (100) maps to the flag height; width is half of that.
    expect(t.height).toBeCloseTo(H);
    expect(t.width).toBeCloseTo(H / 2);
  });

  it("converts rotation degrees to radians", () => {
    const t = chargeTransform({ x: 0.5, y: 0.5, scale: 1, rotation: 90 }, W, H, vb);
    expect(t.rotation).toBeCloseTo(Math.PI / 2);
  });
});
