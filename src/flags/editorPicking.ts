// Pure 2D picking/mapping + layout math for the flag editor's preview (phase
// 2Fc/2Fe). The preview canvas draws a FlagDesign via the SAME 2Fa renderer the
// world cloth uses; to draw and drag on it we need:
//
//   • previewBoxSize — the preview canvas's DISPLAY size (2Fe layout fix): the
//     WIDTH is fixed; the HEIGHT = width/aspect, clamped to a sensible min/max.
//     Only the height varies with aspect, so the surrounding controls never
//     reflow (the component reserves the max height around it).
//   • flagContainRect — fit a flag of `aspect` "contain" inside a box, centered
//     (letterboxed when the box aspect ≠ the flag's). The ONE fit shared by the
//     preview DRAW and previewPixelToFlagCoord, so drawing and hit-mapping can't
//     drift.
//   • previewPixelToFlagCoord — a pixel in the preview element → the flag's
//     normalized (x, y) in [0,1], the inverse of `flagContainRect`.
//   • chargeAtPoint — the topmost charge whose drawn extent contains a normalized
//     point, reusing the renderer's OWN chargeTransform so hit-test and draw can
//     never drift.
//
// These are pure + unit-tested (never pixel-tested); the event handlers/draw just
// call them, so the interaction math lives here, not inline in the component.

import { chargeTransform } from "./layout";
import { getSymbol } from "./symbols";
import type { FlagDesign } from "./types";

export interface PreviewRect {
  width: number;
  height: number;
}

/** Clamp to [0,1] (keeps a dragged charge inside the flag rect). */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * The preview canvas's DISPLAY size for a flag of `aspect` (the 2Fe layout fix).
 * The WIDTH is always the fixed dimension; the HEIGHT follows the flag's shape
 * (`width / aspect`) but is clamped to [minHeight, maxHeight] so an extreme aspect
 * can't make the preview absurdly tall or a sliver. A wider/more-rectangular flag
 * → shorter preview; a squarer flag → taller preview — width never changes, so the
 * controls beside it never move. (The component reserves the max height so the
 * varying height doesn't shift the controls below it either.)
 */
export function previewBoxSize(
  aspect: number,
  fixedWidth: number,
  minHeight: number,
  maxHeight: number,
): PreviewRect {
  const a = aspect > 0 ? aspect : 1;
  const ideal = fixedWidth / a;
  const height = Math.min(maxHeight, Math.max(minHeight, ideal));
  return { width: fixedWidth, height };
}

export interface ContainRect {
  /** Displayed flag width/height inside the box (≤ the box; letterbox otherwise). */
  dispW: number;
  dispH: number;
  /** Top-left offset of the displayed flag within the box (the letterbox bars). */
  offsetX: number;
  offsetY: number;
}

/**
 * Fit a flag of `aspect` "contain" inside `box`, centered — the displayed flag
 * size + its letterbox offset. Shared by the preview DRAW (drawImage into this
 * rect) and previewPixelToFlagCoord (its inverse), so the two can't drift.
 */
export function flagContainRect(box: PreviewRect, aspect: number): ContainRect {
  const a = aspect > 0 ? aspect : 1;
  const boxAspect = box.height > 0 ? box.width / box.height : a;
  let dispW: number;
  let dispH: number;
  if (boxAspect > a) {
    // Box is wider than the flag → the flag is limited by the box height.
    dispH = box.height;
    dispW = dispH * a;
  } else {
    // Box is taller/narrower → limited by width.
    dispW = box.width;
    dispH = a > 0 ? dispW / a : box.height;
  }
  return {
    dispW,
    dispH,
    offsetX: (box.width - dispW) / 2,
    offsetY: (box.height - dispH) / 2,
  };
}

/**
 * Map a pixel (px, py) — relative to the preview element's top-left — to the
 * flag's normalized (x, y) in [0,1]. The flag rect (of `aspect`) is fitted
 * "contain" inside the preview box and centered (see `flagContainRect`), so this
 * inverts that fit: subtract the letterbox offset, divide by the displayed flag
 * size. The result is clamped to [0,1] so a drag past the edge lands on the
 * border, not off-flag.
 */
export function previewPixelToFlagCoord(
  px: number,
  py: number,
  rect: PreviewRect,
  aspect: number,
): { x: number; y: number } {
  const { dispW, dispH, offsetX, offsetY } = flagContainRect(rect, aspect);
  const x = dispW > 0 ? (px - offsetX) / dispW : 0;
  const y = dispH > 0 ? (py - offsetY) / dispH : 0;
  return { x: clamp01(x), y: clamp01(y) };
}

/**
 * The index (into design.layers) of the TOPMOST charge layer whose drawn extent
 * contains the normalized point (x, y), or null if none. The extent is the
 * charge's axis-aligned bounding box from the renderer's own chargeTransform
 * (evaluated in a unit-height `aspect × 1` flag space, so it is resolution- and
 * DOM-independent) — the exact position/scale the renderer draws, so the
 * hit-test and the draw can't diverge. Rotation is ignored for the hit-test (the
 * unrotated box), which is intentionally forgiving for grabbing a charge.
 */
export function chargeAtPoint(
  design: FlagDesign,
  x: number,
  y: number,
): number | null {
  const a = design.aspect > 0 ? design.aspect : 1;
  const pxUnit = x * a; // point in the same `aspect × 1` space as the transform
  const pyUnit = y;
  for (let i = design.layers.length - 1; i >= 0; i--) {
    const layer = design.layers[i]!;
    if (layer.kind !== "charge") continue;
    const def = getSymbol(layer.symbolId);
    const t = chargeTransform(layer, a, 1, def.viewBox);
    if (
      pxUnit >= t.left &&
      pxUnit <= t.left + t.width &&
      pyUnit >= t.top &&
      pyUnit <= t.top + t.height
    ) {
      return i;
    }
  }
  return null;
}
