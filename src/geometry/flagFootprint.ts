// The pure flag-footprint helper — the SINGLE source of truth for a flag's
// horizontal extent. A flag's stored `position` is the POLE anchor; the cloth
// flies out along local +X. The footprint is the CLOTH's oriented rectangle (the
// big visible target — selection should feel like clicking the flag, not just the
// thin staff), anchored at the pole: it spans local X [0, clothWidth] and starts
// AT the pole, so the pole base falls on its near edge too.
//
// NOTE on picking: like the other pieces, 3D pointer picking is done by R3F
// raycasting the actual meshes (pole + cloth); this footprint is the shared
// horizontal extent (broad-phase / camera framing / future snap), derived once so
// it can't drift from what the mesh draws.
//
// Rotation convention matches the renderer (group rotation [0, -deg2rad(rotation),
// 0], under which a LOCAL point (lx, lz) maps to world
//   (lx·cos r − lz·sin r,  lx·sin r + lz·cos r)).
// So local +X maps to world (cos r, sin r); the cloth-rectangle center is the pole
// anchor pushed half the cloth width along that heading.

import type { Flag } from "../store/schema";
import type { RectFootprint } from "./rectFootprint";

/** The footprint's depth (along the cloth's local Z), in meters — the thin cloth
 *  given a small clickable band so the extent isn't a zero-area strip. */
export const FLAG_FOOTPRINT_DEPTH = 0.5;

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

export function flagFootprint(flag: Flag): RectFootprint {
  const r = deg2rad(flag.rotation);
  const half = flag.clothWidth / 2;
  return {
    center: {
      x: flag.position.x + Math.cos(r) * half,
      y: flag.position.y + Math.sin(r) * half,
    },
    halfX: half, // cloth width runs along local X
    halfZ: FLAG_FOOTPRINT_DEPTH / 2,
    rotation: flag.rotation,
  };
}
