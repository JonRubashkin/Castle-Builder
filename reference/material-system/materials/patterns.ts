import type { MaterialRef, PatternId } from "../model/types";

export const PATTERN_IDS: PatternId[] = [
  "checker",
  "planks",
  "tile",
  "stripes",
  "grass",
  "water",
  "gravel",
];

// Tile resolution and how many world-meters one tile covers (shared by 2D fills
// and 3D textures so the plan and preview match).
export const TILE_PX = 256;
export const PATTERN_TILE_METERS = 1;

export type RGB = [number, number, number];

// Parse "#rgb" or "#rrggbb" (the only forms the pickers produce) to RGB.
export function hexToRgb(hex: string): RGB {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Blend two colors (interior patterns return a or b exactly; the landscape
// patterns interpolate for a noisy/rippled look).
const lerpRgb = (a: RGB, b: RGB, t: number): RGB => {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  ];
};

// Value noise hashed on integer cell coords, WRAPPED to `period` cells so a tile
// of `period` cells repeats seamlessly (no seam where tiles meet). Returns 0..1.
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
// tiles repeat seamlessly on any surface, and the same pixels feed the 2D plan,
// the 3D textures, and the picker thumbnails. Interior patterns return colorA or
// colorB; landscape patterns (grass/water/gravel) blend between them.
export function patternPixel(
  pattern: PatternId,
  x: number,
  y: number,
  size: number,
  a: RGB,
  b: RGB,
): RGB {
  switch (pattern) {
    case "checker": {
      const cell = size / 2;
      const cx = Math.floor(x / cell) % 2;
      const cy = Math.floor(y / cell) % 2;
      return cx === cy ? a : b;
    }
    case "planks": {
      const plank = size / 4;
      const lineW = Math.max(1, size / 128);
      const onSeam = y % plank < lineW; // plank seam (horizontal)
      const row = Math.floor(y / plank);
      const xJoint = row % 2 === 0 ? size / 2 : size / 4;
      const onJoint = Math.abs(x - xJoint) < lineW; // staggered cross-joint
      return onSeam || onJoint ? b : a;
    }
    case "tile": {
      const cell = size / 2;
      const grout = Math.max(2, size / 32);
      const ix = x % cell;
      const iy = y % cell;
      const inTile =
        ix >= grout / 2 &&
        ix < cell - grout / 2 &&
        iy >= grout / 2 &&
        iy < cell - grout / 2;
      return inTile ? a : b;
    }
    case "stripes": {
      const band = size / 4;
      // Anti-diagonal banding; (x+y) shifts by a whole number of bands across a
      // tile edge (size / band is even), so stripes line up seamlessly.
      return Math.floor((x + y) / band) % 2 === 0 ? a : b;
    }
    case "grass": {
      // Vertical blade streaks + a fine speckle, blended between two greens.
      const blade = Math.floor(x / (size / 48)); // 48 blades across the tile
      const streak = cellNoise(blade, 0, 48);
      const speck = cellNoise(
        Math.floor(x / (size / 64)),
        Math.floor(y / (size / 64)),
        64,
      );
      return lerpRgb(a, b, streak * 0.7 + speck * 0.3);
    }
    case "water": {
      // Overlapping sine ripples. Each term advances a whole number of 2*PI over
      // `size`, so the ripples tile seamlessly. OPAQUE — no real transparency.
      const k = (2 * Math.PI) / size;
      const r1 = Math.sin(x * k * 3 + Math.sin(y * k * 2) * 1.6);
      const r2 = Math.sin((x + y) * k * 2);
      return lerpRgb(a, b, (r1 * 0.6 + r2 * 0.4 + 1) / 2);
    }
    case "gravel": {
      // Speckled stones: each small cell a random shade, plus a finer grain.
      const stone = cellNoise(
        Math.floor(x / (size / 20)),
        Math.floor(y / (size / 20)),
        20,
      );
      const grain = cellNoise(
        Math.floor(x / (size / 80)),
        Math.floor(y / (size / 80)),
        80,
      );
      return lerpRgb(a, b, stone * 0.65 + grain * 0.35);
    }
  }
}

// Fill RGBA pixels for one tile. Reused by the canvas drawing and verifiable
// without a DOM (pure function over a typed array).
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
      data[i + 3] = 255;
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
    const rgba = renderPatternRGBA(
      ref.pattern,
      ref.colorA,
      ref.colorB,
      TILE_PX,
    );
    const image = ctx.createImageData(TILE_PX, TILE_PX);
    image.data.set(rgba);
    ctx.putImageData(image, 0, 0);
  }
  return canvas;
}
