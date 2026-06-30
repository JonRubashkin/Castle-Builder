// Minimal material resolution for phase 1a (towers are solid stone only).
//
// The full material system — procedural patterns + materialRefToThreeMaterial —
// arrives in 1b. For now we only need the solid color, with a sensible fallback
// so a (future) pattern ref still renders something opaque rather than crashing.

import type { MaterialRef } from "../../store/schema";

export function materialColor(material: MaterialRef): string {
  if (material.kind === "solid") return material.color;
  // Patterns are not wired until 1b; fall back to the pattern's primary color.
  return material.colorA;
}
