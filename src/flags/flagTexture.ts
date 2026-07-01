// FlagDesign → Three.js texture, routed through the material system's shared
// offscreen-canvas-texture path (`canvasToTexture`) rather than a parallel one.
// A flag is a single non-tiling image, so it uses the default clamp-to-edge wrap
// and renders OPAQUE (see renderFlag). This is the seam the flag *piece* (2Fb)
// will consume to skin a cloth mesh; 2Fa only needs it to exist and be correct.

import type * as THREE from "three";
import { canvasToTexture } from "../materials/textures";
import { FLAG_TEX_HEIGHT, renderFlag } from "./renderFlag";
import type { FlagDesign } from "./types";

export function flagTexture(
  design: FlagDesign,
  height = FLAG_TEX_HEIGHT,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  renderFlag(design, canvas, height);
  return canvasToTexture(canvas);
}
