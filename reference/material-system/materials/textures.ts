import * as THREE from "three";
import type { MaterialRef } from "../model/types";
import { materialKey } from "./key";
import { createPatternCanvas } from "./patterns";

// Caches keyed by serialized MaterialRef so identical materials share output.
const dataUrlCache = new Map<string, string>();
const textureCache = new Map<string, THREE.Texture>();

// A data-URL of a pattern tile, for 2D plan fills and picker thumbnails.
export function patternDataUrl(
  ref: Extract<MaterialRef, { kind: "pattern" }>,
): string {
  const key = materialKey(ref);
  let url = dataUrlCache.get(key);
  if (!url) {
    url = createPatternCanvas(ref).toDataURL();
    dataUrlCache.set(key, url);
  }
  return url;
}

// A repeating Three.js texture for a pattern material (3D walls and floors).
export function patternTexture(
  ref: Extract<MaterialRef, { kind: "pattern" }>,
): THREE.Texture {
  const key = materialKey(ref);
  let tex = textureCache.get(key);
  if (!tex) {
    tex = new THREE.CanvasTexture(createPatternCanvas(ref));
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    textureCache.set(key, tex);
  }
  return tex;
}

// A pattern texture cloned with a specific repeat + offset (each wall face tiles
// at a world-fixed size and is offset so the pattern is continuous across a
// wall's sub-boxes). Cached by key + repeat + offset; three.js shares the image,
// so clones are cheap and nothing leaks per render.
const variantCache = new Map<string, THREE.Texture>();

export function patternTextureVariantKey(
  ref: Extract<MaterialRef, { kind: "pattern" }>,
  repeat: [number, number],
  offset: [number, number],
): string {
  return `${materialKey(ref)}@r${repeat[0].toFixed(3)},${repeat[1].toFixed(
    3,
  )}o${offset[0].toFixed(3)},${offset[1].toFixed(3)}`;
}

export function patternTextureVariant(
  ref: Extract<MaterialRef, { kind: "pattern" }>,
  repeat: [number, number],
  offset: [number, number],
): THREE.Texture {
  const key = patternTextureVariantKey(ref, repeat, offset);
  let tex = variantCache.get(key);
  if (!tex) {
    tex = patternTexture(ref).clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.offset.set(offset[0], offset[1]);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    variantCache.set(key, tex);
  }
  return tex;
}

// Plain hex for solids; the dominant tone for patterns (used as a fallback /
// chip background where a full pattern fill isn't drawn).
export function representativeColor(ref: MaterialRef): string {
  return ref.kind === "solid" ? ref.color : ref.colorA;
}
