// Procedural pattern generation — adapted from the prior project's
// src/materials/patterns.ts. Patterns are pure, periodic-per-tile, per-pixel
// definitions rendered at runtime onto small offscreen canvases (no image
// assets) and used as repeating Three.js textures.
//
// The castle pattern set is stone / brick / thatch / water. ALL are OPAQUE:
// `water` fakes its look with rippled color, never real transparency (real
// alpha would reawaken the cutaway-material-hiding bug the prior project hit,
// and this app has cutaway-style view modes coming).

import type { MaterialRef, PatternId } from "../store/schema";

// The single runtime source of truth for the pattern id list. The schema's
// PatternId type and the importer's allowlist both derive from this, so adding
// an id here is additive (no id is ever wrongly rejected on import).
export const PATTERN_IDS: PatternId[] = ["stone", "brick", "thatch", "water"];

// Tile resolution and how many world-meters one tile covers (so a piece's
// surface tiles at a predictable real-world size).
export const TILE_PX = 256;
export const PATTERN_TILE_METERS = 1;

export type RGB = [number, number, number];

// Parse "#rgb" or "#rrggbb" to RGB. Falls back to mid-grey on a bad string.
export function hexToRgb(hex: string): RGB {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Blend two colors. Interior detail (mortar) returns a or b exactly; the
// shaded/rippled patterns interpolate for variation.
const lerpRgb = (a: RGB, b: RGB, t: number): RGB => {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  ];
};

// Value noise hashed on integer cell coords, WRAPPED to `period` cells so a
// tile of `period` cells repeats seamlessly. Returns 0..1.
const cellNoise = (ix: number, iy: number, period: number): number => {
  const p = period < 1 ? 1 : period;
  const xx = ((ix % p) + p) % p;
  const yy = ((iy % p) + p) % p;
  let h = (xx * 374761393 + yy * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
};

// Pure per-pixel pattern definition. Every pattern is periodic with `size`, so
// tiles repeat on any surface. `a` = colorA (the dominant tone), `b` = colorB
// (mortar / accent / shadow tone).
export function patternPixel(
  pattern: PatternId,
  x: number,
  y: number,
  size: number,
  a: RGB,
  b: RGB,
): RGB {
  switch (pattern) {
    case "stone": {
      // Coursed rubble: staggered rough blocks with mortar grooves and a
      // per-block shade variation.
      const course = size / 4; // 4 courses
      const mortar = Math.max(2, size / 40);
      const row = Math.floor(y / course);
      const offset = (row % 2) * (size / 6); // alternate-course stagger
      const block = size / 3; // ~3 blocks across
      const bx = (x + offset) % block;
      const by = y % course;
      if (by < mortar || bx < mortar) return b; // mortar groove
      const shade = cellNoise(Math.floor((x + offset) / block), row, 32);
      // Vary each block between colorA and a tone partway toward the mortar.
      return lerpRgb(a, lerpRgb(a, b, 0.4), shade);
    }
    case "brick": {
      // Running bond: thin courses, half-brick stagger, fine mortar.
      const course = size / 6; // 6 courses
      const mortar = Math.max(2, size / 64);
      const row = Math.floor(y / course);
      const brick = size / 4; // 4 bricks across
      const offset = (row % 2) * (brick / 2); // running-bond stagger
      const bx = (x + offset) % brick;
      const by = y % course;
      if (by < mortar || bx < mortar) return b; // mortar joint
      const shade = cellNoise(Math.floor((x + offset) / brick), row, 24);
      return lerpRgb(a, lerpRgb(a, b, 0.25), shade * 0.7);
    }
    case "thatch": {
      // Layered straw: horizontal courses of bundled vertical strands, each
      // course shadowed along its lower edge.
      const course = size / 6;
      const row = Math.floor(y / course);
      const offset = (row % 2) * (size / 24);
      const strand = Math.floor((x + offset) / (size / 40)); // 40 strands
      const streak = cellNoise(strand, row, 40);
      const by = y % course;
      const shadow = by > course * 0.8 ? 0.45 : 0; // course underside
      return lerpRgb(a, b, Math.min(1, streak * 0.65 + shadow));
    }
    case "water": {
      // Overlapping sine ripples. Each term advances a whole number of 2*PI
      // over `size`, so the ripples tile seamlessly. OPAQUE — no real alpha.
      const k = (2 * Math.PI) / size;
      const r1 = Math.sin(x * k * 3 + Math.sin(y * k * 2) * 1.6);
      const r2 = Math.sin((x + y) * k * 2);
      return lerpRgb(a, b, (r1 * 0.6 + r2 * 0.4 + 1) / 2);
    }
  }
}

// Fill RGBA pixels for one tile. Pure over a typed array (verifiable without a
// DOM). Alpha is ALWAYS 255 — every pattern, water included, is opaque.
export function renderPatternRGBA(
  pattern: PatternId,
  colorA: string,
  colorB: string,
  size = TILE_PX,
): Uint8ClampedArray {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, bl] = patternPixel(pattern, x, y, size, a, b);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = bl;
      data[i + 3] = 255; // OPAQUE
    }
  }
  return data;
}

export function createPatternCanvas(
  ref: Extract<MaterialRef, { kind: "pattern" }>,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const rgba = renderPatternRGBA(ref.pattern, ref.colorA, ref.colorB, TILE_PX);
    const image = ctx.createImageData(TILE_PX, TILE_PX);
    image.data.set(rgba);
    ctx.putImageData(image, 0, 0);
  }
  return canvas;
}
