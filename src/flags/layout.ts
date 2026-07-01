// Pure per-layer LAYOUT math for the flag renderer. Everything here is a pure
// function over a flag rectangle of `w` × `h` pixels (origin top-left, y down —
// canvas convention). The renderer (renderFlag) applies colors and rasterizes;
// this module only computes WHERE things go, so it is fully unit-testable without
// a DOM (consistent with the project's "test the geometry, never the pixels").

import type { FieldFill, FlagLayer } from "./types";

// A laid-out region to fill. Rectangular divisions/stripes yield `rect`; a
// diagonal split/stripe yields a `poly` (an arbitrary polygon clipped to the
// flag rect).
export interface RectSection {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface PolySection {
  kind: "poly";
  points: Array<[number, number]>;
}
export type Section = RectSection | PolySection;

const rect = (x: number, y: number, w: number, h: number): RectSection => ({
  kind: "rect",
  x,
  y,
  w,
  h,
});

// ---------------------------------------------------------------------------
// Field divisions → one section per heraldic partition.
// ---------------------------------------------------------------------------

export function divisionSections(
  division: Extract<FieldFill, { kind: "division" }>["division"],
  w: number,
  h: number,
): Section[] {
  switch (division) {
    case "perPale": // vertical split → left, right
      return [rect(0, 0, w / 2, h), rect(w / 2, 0, w / 2, h)];
    case "perFess": // horizontal split → top, bottom
      return [rect(0, 0, w, h / 2), rect(0, h / 2, w, h / 2)];
    case "quarterly": // four quarters, reading order TL, TR, BL, BR
      return [
        rect(0, 0, w / 2, h / 2),
        rect(w / 2, 0, w / 2, h / 2),
        rect(0, h / 2, w / 2, h / 2),
        rect(w / 2, h / 2, w / 2, h / 2),
      ];
    case "perBend": {
      // Diagonal split corner-to-corner (top-left → bottom-right). Two triangles:
      // the upper-right one, then the lower-left one.
      return [
        {
          kind: "poly",
          points: [
            [0, 0],
            [w, 0],
            [w, h],
          ],
        },
        {
          kind: "poly",
          points: [
            [0, 0],
            [w, h],
            [0, h],
          ],
        },
      ];
    }
  }
}

// The number of colored sections a division produces (2, except quarterly = 4).
export function divisionSectionCount(
  division: Extract<FieldFill, { kind: "division" }>["division"],
): number {
  return division === "quarterly" ? 4 : 2;
}

// ---------------------------------------------------------------------------
// Stripe bands → N equal parallel bands.
// ---------------------------------------------------------------------------

export function stripeBands(
  orientation: Extract<FlagLayer, { kind: "stripes" }>["orientation"],
  count: number,
  w: number,
  h: number,
): Section[] {
  const n = Math.max(1, Math.floor(count));
  if (orientation === "horizontal") {
    const band = h / n;
    return Array.from({ length: n }, (_, i) => rect(0, i * band, w, band));
  }
  if (orientation === "vertical") {
    const band = w / n;
    return Array.from({ length: n }, (_, i) => rect(i * band, 0, band, h));
  }
  // Diagonal: N bands parallel to the top-left→bottom-right diagonal, each the
  // flag rect clipped to a slab between two parallel lines. The slab normal is
  // n̂ = (h, -w)/L; projecting the corners onto it gives the symmetric range
  // [-w·h/L, +w·h/L]; we split that into N equal slabs and clip the rect to each.
  const rectPoly: Array<[number, number]> = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const L = Math.hypot(w, h) || 1;
  const nx = h / L;
  const ny = -w / L;
  const extent = (w * h) / L; // half of the full projected range
  const step = (2 * extent) / n;
  const bands: Section[] = [];
  for (let i = 0; i < n; i++) {
    const lo = -extent + i * step;
    const hi = lo + step;
    // Keep the slab lo ≤ p·n̂ ≤ hi, i.e. p·n̂ ≥ lo AND p·n̂ ≤ hi.
    let poly = clipHalfPlane(rectPoly, nx, ny, lo, true);
    poly = clipHalfPlane(poly, nx, ny, hi, false);
    bands.push({ kind: "poly", points: poly });
  }
  return bands;
}

// Sutherland–Hodgman clip of a convex polygon against one half-plane. `keepGreater`
// keeps the side where p·(nx,ny) ≥ offset (else ≤ offset). Points on the boundary
// are kept. Returns the clipped polygon (possibly empty).
export function clipHalfPlane(
  points: Array<[number, number]>,
  nx: number,
  ny: number,
  offset: number,
  keepGreater: boolean,
): Array<[number, number]> {
  if (points.length === 0) return [];
  const EPS = 1e-9;
  const side = (p: [number, number]) => {
    const v = p[0] * nx + p[1] * ny - offset;
    return keepGreater ? v : -v; // ≥ 0 means inside
  };
  const out: Array<[number, number]> = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const sa = side(a);
    const sb = side(b);
    const aIn = sa >= -EPS;
    const bIn = sb >= -EPS;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = sa / (sa - sb); // interpolation to the boundary
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

// Signed-area (shoelace) magnitude of a polygon — used in tests to confirm the
// bands partition the flag.
export function polygonArea(points: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

// ---------------------------------------------------------------------------
// Charge transform → where/how big to draw a symbol.
// ---------------------------------------------------------------------------

export interface ChargeTransform {
  cx: number; // charge center in flag px
  cy: number;
  scale: number; // uniform scale applied to viewBox units → px
  vbCx: number; // viewBox center (the point that lands on cx,cy)
  vbCy: number;
  rotation: number; // radians
  // Convenience axis-aligned (unrotated) bounding box of the drawn charge.
  width: number;
  height: number;
  left: number;
  top: number;
}

// A charge at scale 1 spans the flag HEIGHT (its larger viewBox dimension maps to
// `scale * h` px, aspect preserved), centered on its normalized (x,y) position.
export function chargeTransform(
  charge: { x: number; y: number; scale: number; rotation?: number },
  w: number,
  h: number,
  viewBox: readonly [number, number],
): ChargeTransform {
  const [vbW, vbH] = viewBox;
  const cx = charge.x * w;
  const cy = charge.y * h;
  const target = charge.scale * h;
  const scale = target / Math.max(vbW, vbH);
  const width = vbW * scale;
  const height = vbH * scale;
  return {
    cx,
    cy,
    scale,
    vbCx: vbW / 2,
    vbCy: vbH / 2,
    rotation: ((charge.rotation ?? 0) * Math.PI) / 180,
    width,
    height,
    left: cx - width / 2,
    top: cy - height / 2,
  };
}
