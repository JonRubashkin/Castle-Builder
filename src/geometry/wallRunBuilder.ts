// The pure wall-run builder — the oriented box between the wall's two endpoints,
// plus optional crenellation teeth, returned as box parts in LOCAL space. The
// local frame is centered on the wall's MIDPOINT (its footprint center): local
// +X runs along the wall's length, local Z is the thickness, y rises from the
// underside. Teeth come from the SHARED crenellation helper (the same code the
// tower and gatehouse use). Pure + unit-tested; no hooks, no THREE.
//
// Orientation (length direction) and the midpoint are NOT recomputed here — they
// come from the one wallRunFootprint helper, so the mesh and the hit-test agree.

import type { WallRun } from "../store/schema";
import { rectCrenellations } from "./crenellations";
import type { BoxPart } from "./parts";
import { wallRunLength } from "./wallRunFootprint";

export function buildWallRun(w: WallRun): BoxPart[] {
  const length = wallRunLength(w);
  const parts: BoxPart[] = [];

  // The wall body, centered on the midpoint, rising from the underside (y=0).
  parts.push({
    role: "mass",
    position: { x: 0, y: w.height / 2, z: 0 },
    size: { x: length, y: w.height, z: w.thickness },
    rotationY: 0,
  });

  if (w.crenellated) {
    const topY = w.height + w.merlonSize / 2; // teeth sit on the top edge
    const teeth = rectCrenellations(length / 2, w.thickness / 2, topY, w.merlonSize, 1);
    for (const t of teeth) {
      parts.push({ role: "merlon", position: t.position, size: t.size, rotationY: t.rotationY });
    }
  }

  return parts;
}
