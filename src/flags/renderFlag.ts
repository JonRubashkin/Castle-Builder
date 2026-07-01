// The pure(-ish) flag renderer: draw a FlagDesign's layer stack back-to-front
// onto a 2D canvas, producing an OPAQUE image usable as a Three.js texture.
//
// The layout MATH (division rects, stripe bands, charge transforms) lives in
// ./layout.ts as pure, unit-tested functions; this module only rasterizes their
// output (set a fill color, fill a rect/polygon, stroke a Path2D). The raster
// itself is intentionally NOT pixel-tested — testing the layout math is the
// contract (consistent with the project's "never pixel-test" rule).
//
// Opaque, deliberately: the field layer always covers the whole rect first, and
// no fill uses alpha < 1, so the cloth is a solid image — matching the project's
// opaque-materials rule (real transparency in scene textures reawakens the
// cutaway material-hiding bug).

import {
  chargeTransform,
  divisionSections,
  stripeBands,
  type Section,
} from "./layout";
import { getSymbol } from "./symbols";
import type { FlagDesign, FlagLayer } from "./types";

// Texture resolution: the flag's rendered height in px. Width follows the aspect.
export const FLAG_TEX_HEIGHT = 256;

// Size a canvas to a design's aspect at the given height, returning [w, h].
export function flagCanvasSize(
  aspect: number,
  height = FLAG_TEX_HEIGHT,
): [number, number] {
  const w = Math.max(1, Math.round(height * aspect));
  return [w, height];
}

function fillSection(
  ctx: CanvasRenderingContext2D,
  section: Section,
  color: string,
): void {
  ctx.fillStyle = color;
  if (section.kind === "rect") {
    ctx.fillRect(section.x, section.y, section.w, section.h);
    return;
  }
  const pts = section.points;
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.closePath();
  ctx.fill();
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: FlagLayer,
  w: number,
  h: number,
): void {
  switch (layer.kind) {
    case "field": {
      if (layer.fill.kind === "solid") {
        ctx.fillStyle = layer.fill.color;
        ctx.fillRect(0, 0, w, h);
      } else {
        const sections = divisionSections(layer.fill.division, w, h);
        const colors = layer.fill.colors;
        sections.forEach((s, i) => {
          fillSection(ctx, s, colors[i % Math.max(1, colors.length)] ?? "#000000");
        });
      }
      return;
    }
    case "stripes": {
      const bands = stripeBands(layer.orientation, layer.count, w, h);
      const colors = layer.colors;
      bands.forEach((band, i) => {
        fillSection(ctx, band, colors[i % Math.max(1, colors.length)] ?? "#000000");
      });
      return;
    }
    case "charge": {
      const def = getSymbol(layer.symbolId);
      const t = chargeTransform(layer, w, h, def.viewBox);
      ctx.save();
      ctx.translate(t.cx, t.cy);
      ctx.rotate(t.rotation);
      ctx.scale(t.scale, t.scale);
      ctx.translate(-t.vbCx, -t.vbCy);
      ctx.fillStyle = layer.color;
      for (const d of def.paths) ctx.fill(new Path2D(d));
      ctx.restore();
      return;
    }
  }
}

// Draw the whole stack onto `canvas` (sized to the design's aspect). Returns the
// canvas for chaining. Layers draw in array order (index 0 underneath).
export function renderFlag(
  design: FlagDesign,
  canvas: HTMLCanvasElement,
  height = FLAG_TEX_HEIGHT,
): HTMLCanvasElement {
  const [w, h] = flagCanvasSize(design.aspect, height);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Start opaque: a black backing in case a (malformed) design has no field layer
  // — the cloth is never see-through.
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  for (const layer of design.layers) drawLayer(ctx, layer, w, h);
  return canvas;
}
