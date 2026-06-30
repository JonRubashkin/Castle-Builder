// The shared MaterialRef → THREE material factory (the requested target helper)
// plus its co-located selection/hover styling and a memoizing hook. Adapted
// from the prior project's src/materials/threeMaterial.ts.
//
// Both rendering paths (a piece mesh and, later, other kits) flow through
// materialRefToThreeMaterial, so the solid/pattern branching lives in exactly
// one place and procedural patterns work for every piece "for free".

import * as THREE from "three";
import { useEffect, useMemo } from "react";
import type { MaterialRef } from "../store/schema";
import { patternTextureVariant, patternTextureVariantKey } from "./textures";

const SELECT_EMISSIVE = "#7bb8ee";

export interface MaterialBuildOptions {
  repeat?: [number, number];
  offset?: [number, number];
  side?: THREE.Side;
  roughness?: number;
}

export interface MaterialStyle {
  selected?: boolean;
  // Hover echo: a subtler version of the selection tint, so hovered and
  // selected read as related but distinct.
  hovered?: boolean;
}

// Water reads as water through a slight sheen (lower roughness, a touch of
// metalness) on top of its rippled texture — NEVER real transparency, which
// would break the cutaway view modes.
function isWater(ref: MaterialRef): boolean {
  return ref.kind === "pattern" && ref.pattern === "water";
}

// Shared factory: build a THREE material for a MaterialRef. Solids use a color;
// patterns use a cached repeating texture. The result is ALWAYS opaque.
export function materialRefToThreeMaterial(
  ref: MaterialRef,
  opts: MaterialBuildOptions = {},
): THREE.MeshStandardMaterial {
  const water = isWater(ref);
  const mat = new THREE.MeshStandardMaterial({
    roughness: opts.roughness ?? (water ? 0.32 : 0.85),
    metalness: water ? 0.1 : 0, // faint sheen for water; still opaque
    side: opts.side ?? THREE.FrontSide,
  });
  if (ref.kind === "solid") {
    mat.color.set(ref.color);
  } else {
    mat.color.set("#ffffff");
    mat.map = patternTextureVariant(
      ref,
      opts.repeat ?? [1, 1],
      opts.offset ?? [0, 0],
    );
  }
  // Explicitly opaque: water and every other piece material render without alpha.
  mat.transparent = false;
  mat.opacity = 1;
  return mat;
}

// Identity that requires a fresh material (a shader recompile happens when
// `map` is added, so switching solid <-> pattern must yield a NEW material):
// kind, colors, texture variant, side, roughness.
export function materialBuildKey(
  ref: MaterialRef,
  opts: MaterialBuildOptions,
): string {
  const base =
    ref.kind === "solid"
      ? `solid:${ref.color.toLowerCase()}`
      : patternTextureVariantKey(
          ref,
          opts.repeat ?? [1, 1],
          opts.offset ?? [0, 0],
        );
  return `${base}|s${opts.side ?? THREE.FrontSide}|r${opts.roughness ?? "auto"}`;
}

// Apply selection/hover styling onto an existing material in place (no rebuild):
// a subtle emissive echo of the selection tint. Materials stay opaque.
export function applyMaterialStyle(
  material: THREE.MeshStandardMaterial,
  style: MaterialStyle,
): void {
  const selected = style.selected ?? false;
  const hovered = style.hovered ?? false;
  material.emissive.set(selected || hovered ? SELECT_EMISSIVE : "#000000");
  material.emissiveIntensity = selected ? 0.35 : hovered ? 0.16 : 0;
}

// A memoized THREE material rebuilt — and the previous one disposed — only when
// its build identity changes. Switching solid <-> pattern therefore yields a
// brand-new, correctly-compiled material (three.js needs a recompile when `map`
// is added, which a reused instance would not get). Selection/hover styling is
// applied each render without a rebuild.
export function useThreeMaterial(
  ref: MaterialRef,
  opts: MaterialBuildOptions,
  style: MaterialStyle,
): THREE.MeshStandardMaterial {
  const key = materialBuildKey(ref, opts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const material = useMemo(() => materialRefToThreeMaterial(ref, opts), [key]);
  useEffect(() => () => material.dispose(), [material]);

  applyMaterialStyle(material, style);
  return material;
}
