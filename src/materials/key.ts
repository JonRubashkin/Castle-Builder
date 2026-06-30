// Stable cache key for a material. Identical materials share one generated
// texture. Pure and dependency-free so it is trivial to unit-test.
// Adapted from the prior project's src/materials/key.ts (trimmed to the one
// helper the texture cache needs).

import type { MaterialRef } from "../store/schema";

export function materialKey(ref: MaterialRef): string {
  if (ref.kind === "solid") return `solid:${ref.color.toLowerCase()}`;
  return `pattern:${ref.pattern}:${ref.colorA.toLowerCase()}:${ref.colorB.toLowerCase()}`;
}
