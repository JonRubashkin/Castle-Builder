// Pure 2D picking/mapping for the flag editor's drag-on-preview (phase 2Fc). The
// preview canvas draws a FlagDesign via the SAME 2Fa renderer the world cloth
// uses; to drag a charge on it we need the inverse of the renderer's placement:
//
//   • previewPixelToFlagCoord — a pixel in the preview element → the flag's
//     normalized (x, y) in [0,1], accounting for the preview box size and the
//     flag's aspect (letterboxing when the box aspect differs from the flag's).
//   • chargeAtPoint — the topmost charge whose drawn extent contains a normalized
//     point, reusing the renderer's OWN chargeTransform so hit-test and draw can
//     never drift.
//
// These are pure + unit-tested (never pixel-tested); the event handlers just call
// them, so the interaction math lives here, not inline in the component.

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
 * Map a pixel (px, py) — relative to the preview element's top-left — to the
 * flag's normalized (x, y) in [0,1]. The flag rect (of `aspect`) is fitted
 * "contain" inside the preview box and centered, so this inverts that fit:
 * subtract the letterbox offset, divide by the displayed flag size. The result is
 * clamped to [0,1] so a drag past the edge lands on the border, not off-flag.
 */
export function previewPixelToFlagCoord(
  px: number,
  py: number,
  rect: PreviewRect,
  aspect: number,
): { x: number; y: number } {
  const a = aspect > 0 ? aspect : 1;
  const boxAspect = rect.height > 0 ? rect.width / rect.height : a;
  let dispW: number;
  let dispH: number;
  if (boxAspect > a) {
    // Box is wider than the flag → the flag is limited by the box height.
    dispH = rect.height;
    dispW = dispH * a;
  } else {
    // Box is taller/narrower → limited by width.
    dispW = rect.width;
    dispH = a > 0 ? dispW / a : rect.height;
  }
  const offsetX = (rect.width - dispW) / 2;
  const offsetY = (rect.height - dispH) / 2;
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
