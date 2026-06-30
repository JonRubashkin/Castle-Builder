// The pure gatehouse builder — a single rectangular mass (width × depth ×
// height) plus optional crenellation teeth, returned as box parts in LOCAL
// space (y up from the underside; width along local X, depth along local Z).
// Teeth come from the SHARED crenellation helper (the same code the tower and
// wall run use). Pure + unit-tested; no hooks, no THREE.

import type { Gatehouse } from "../store/schema";
import { rectCrenellations } from "./crenellations";
import type { BoxPart } from "./parts";

export function buildGatehouse(g: Gatehouse): BoxPart[] {
  const parts: BoxPart[] = [];

  // The main mass, centered on the anchor, rising from the underside (y=0).
  parts.push({
    role: "mass",
    position: { x: 0, y: g.height / 2, z: 0 },
    size: { x: g.width, y: g.height, z: g.depth },
    rotationY: 0,
  });

  if (g.crenellated) {
    const topY = g.height + g.merlonSize / 2; // teeth sit on the top edge
    const teeth = rectCrenellations(g.width / 2, g.depth / 2, topY, g.merlonSize, 1);
    for (const t of teeth) {
      parts.push({ role: "merlon", position: t.position, size: t.size, rotationY: t.rotationY });
    }
  }

  return parts;
}
