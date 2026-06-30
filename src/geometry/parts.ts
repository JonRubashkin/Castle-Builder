// Shared geometry-part type for the box-composed builders (gatehouse, wall run).
// Each builder returns a flat list of these in LOCAL space (y up from the
// piece's underside, the piece's own forward = +Z); the renderer maps each part
// to a mesh whose material flows through the shared materialRefToThreeMaterial
// helper. (The tower builder keeps its own part type because it also emits a
// cylinder shaft.)

import type { Vec3 } from "../store/schema";

export interface BoxPart {
  /** "mass" = the main block; "merlon" = a crenellation tooth. */
  role: "mass" | "merlon";
  position: Vec3; // center in local space
  size: Vec3; // full extents (x, y, z)
  rotationY: number; // radians about local Y (0 for axis-aligned local parts)
}
