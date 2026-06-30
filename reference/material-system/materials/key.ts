import type { MaterialRef } from "../model/types";

// Stable cache key for a material. Identical materials share one generated
// texture / data-URL. Kept pure and dependency-free so it's easy to unit-test.
//
// NOTE: copied from the old project's src/materials/key.ts, trimmed to just the
// part the material system needs. The original file also exported `materialDomId`
// (an SVG `url(#...)`-safe id) and `materialLabel` (chip/tooltip text); both were
// tied to the 2D plan editor / pickers and are NOT needed by the texture
// generation or `materialRefToThreeMaterial`, so they were left behind.
export function materialKey(ref: MaterialRef): string {
  if (ref.kind === "solid") return `solid:${ref.color.toLowerCase()}`;
  return `pattern:${ref.pattern}:${ref.colorA.toLowerCase()}:${ref.colorB.toLowerCase()}`;
}
