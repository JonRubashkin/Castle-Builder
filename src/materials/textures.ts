// Pattern → repeating Three.js texture, cached so identical materials share one
// generated texture. Adapted from the prior project's src/materials/textures.ts.

import * as THREE from "three";
import type { MaterialRef } from "../store/schema";
import { materialKey } from "./key";
import { createPatternCanvas } from "./patterns";

const textureCache = new Map<string, THREE.Texture>();

// A repeating Three.js texture for a pattern material.
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

// A pattern texture cloned with a specific repeat + offset so a piece tiles at
// a world-fixed size. Cached by key + repeat + offset; three.js shares the
// underlying image, so clones are cheap and nothing leaks per render.
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

// Plain hex for solids; the dominant tone for patterns (used as a chip
// background / fallback where a full pattern fill is not drawn).
export function representativeColor(ref: MaterialRef): string {
  return ref.kind === "solid" ? ref.color : ref.colorA;
}
