// The pure tower builder — returns the tower's geometry as a flat list of parts
// in LOCAL space (y up from the piece's underside; the piece's own forward is
// +Z). The renderer maps each part to a mesh whose material flows through the
// shared materialRefToThreeMaterial helper. Crenellations are a builder concern:
// when `crenellated`, merlon teeth of size `merlonSize` are added around the top
// edge (both round and square profiles) via the SHARED crenellation helper —
// the same teeth code the gatehouse and wall run use. Pure + unit-tested; no
// hooks, no THREE.

import type { Tower, Vec3 } from "../store/schema";
import {
  merlonCount,
  rectCrenellations,
  roundCrenellations,
  type MerlonBox,
} from "./crenellations";

// Re-exported so existing importers (and tests) can keep reading merlonCount
// from the tower builder even though it now lives in the shared helper.
export { merlonCount };

interface PartBase {
  /** "shaft" = the main mass; "merlon" = a crenellation tooth. */
  role: "shaft" | "merlon";
  /** Center of the part in local space. */
  position: Vec3;
}

export interface BoxPart extends PartBase {
  shape: "box";
  size: Vec3; // full extents (x, y, z)
  rotationY: number; // radians about local Y
}

export interface CylinderPart extends PartBase {
  shape: "cylinder";
  radius: number;
  height: number;
  radialSegments: number;
}

export type TowerPart = BoxPart | CylinderPart;

const RADIAL_SEGMENTS = 48;

/** Wrap a shared MerlonBox into a tower BoxPart (tagged as a merlon). */
function toMerlonPart(m: MerlonBox): BoxPart {
  return {
    role: "merlon",
    shape: "box",
    position: m.position,
    size: m.size,
    rotationY: m.rotationY,
  };
}

export function buildTower(tower: Tower): TowerPart[] {
  const parts: TowerPart[] = [];

  if (tower.profile === "round") {
    parts.push({
      role: "shaft",
      shape: "cylinder",
      position: { x: 0, y: tower.height / 2, z: 0 },
      radius: tower.radius,
      height: tower.height,
      radialSegments: RADIAL_SEGMENTS,
    });
  } else {
    parts.push({
      role: "shaft",
      shape: "box",
      position: { x: 0, y: tower.height / 2, z: 0 },
      size: { x: tower.radius * 2, y: tower.height, z: tower.radius * 2 },
      rotationY: 0,
    });
  }

  if (tower.crenellated) {
    const topY = tower.height + tower.merlonSize / 2; // teeth sit on the top edge
    const merlons =
      tower.profile === "round"
        ? roundCrenellations(tower.radius, topY, tower.merlonSize, 4)
        : rectCrenellations(tower.radius, tower.radius, topY, tower.merlonSize, 1);
    parts.push(...merlons.map(toMerlonPart));
  }

  return parts;
}
