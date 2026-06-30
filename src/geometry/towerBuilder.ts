// The pure tower builder — returns the tower's geometry as a flat list of parts
// in LOCAL space (y up from the piece's underside; the piece's own forward is
// +Z). The renderer maps each part to a mesh whose material flows through the
// shared materialRefToThreeMaterial helper. Crenellations are a builder concern:
// when `crenellated`, merlon teeth of size `merlonSize` are added around the top
// edge (both round and square profiles). Pure + unit-tested; no hooks, no THREE.

import type { Tower, Vec3 } from "../store/schema";

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

/**
 * How many merlon teeth fit around the top edge for the given perimeter. Merlons
 * and crenels (gaps) alternate at roughly equal width, so one merlon "slot" is
 * about two tooth-widths of perimeter.
 */
export function merlonCount(perimeter: number, merlonSize: number, min: number): number {
  if (merlonSize <= 0) return min;
  return Math.max(min, Math.floor(perimeter / (2 * merlonSize)));
}

function roundMerlons(tower: Tower): BoxPart[] {
  const { radius, height, merlonSize } = tower;
  const perimeter = 2 * Math.PI * radius;
  const n = merlonCount(perimeter, merlonSize, 4);
  const y = height + merlonSize / 2; // sits on the top edge
  const teeth: BoxPart[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2;
    teeth.push({
      role: "merlon",
      shape: "box",
      position: { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius },
      size: { x: merlonSize, y: merlonSize, z: merlonSize },
      rotationY: theta, // face outward
    });
  }
  return teeth;
}

function squareMerlons(tower: Tower): BoxPart[] {
  const { radius: half, height, merlonSize } = tower;
  const side = half * 2;
  const perEdge = merlonCount(side, merlonSize, 1);
  const y = height + merlonSize / 2;
  const teeth: BoxPart[] = [];
  // Distribute `perEdge` teeth evenly along each of the four top edges, inset so
  // they sit on the rim and read as separate teeth.
  for (let i = 0; i < perEdge; i++) {
    const t = (i + 0.5) / perEdge; // 0..1 along the edge
    const d = -half + t * side; // position along the edge
    // +X and -X edges (vary in z); +Z and -Z edges (vary in x).
    teeth.push(tooth(half, d, y, merlonSize));
    teeth.push(tooth(-half, d, y, merlonSize));
    teeth.push(toothZ(d, half, y, merlonSize));
    teeth.push(toothZ(d, -half, y, merlonSize));
  }
  return teeth;
}

function tooth(x: number, z: number, y: number, s: number): BoxPart {
  return {
    role: "merlon",
    shape: "box",
    position: { x, y, z },
    size: { x: s, y: s, z: s },
    rotationY: 0,
  };
}
function toothZ(x: number, z: number, y: number, s: number): BoxPart {
  return tooth(x, z, y, s);
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
    const merlons =
      tower.profile === "round" ? roundMerlons(tower) : squareMerlons(tower);
    parts.push(...merlons);
  }

  return parts;
}
