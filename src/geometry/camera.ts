// Pure camera helpers. The default view is the classic isometric angle
// (~45° azimuth, ~35.264° elevation — the true-isometric "(1,1,1)" direction).

import type { Vec3 } from "../store/schema";

export const ISO_AZIMUTH_DEG = 45;
/** True isometric elevation: atan(1/√2) ≈ 35.264°. */
export const ISO_ELEVATION_DEG = (Math.atan(1 / Math.SQRT2) * 180) / Math.PI;

/** Unit direction pointing FROM the target TO the camera, for the iso view. */
export function isoCameraDirection(): Vec3 {
  const az = (ISO_AZIMUTH_DEG * Math.PI) / 180;
  const el = (ISO_ELEVATION_DEG * Math.PI) / 180;
  const horizontal = Math.cos(el);
  return {
    x: horizontal * Math.sin(az),
    y: Math.sin(el),
    z: horizontal * Math.cos(az),
  };
}

/** Camera position at `distance` from `target` along the iso direction. */
export function isoCameraPosition(distance: number, target: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const d = isoCameraDirection();
  return {
    x: target.x + d.x * distance,
    y: target.y + d.y * distance,
    z: target.z + d.z * distance,
  };
}
