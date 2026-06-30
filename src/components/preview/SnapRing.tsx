import type { Vec2 } from "../../store/schema";
import { groundHeightAt } from "../../geometry/ground";
import { SNAP_RING_LAYER } from "./stacking";

const NOOP_RAYCAST = () => null;
const SNAP_TINT = "#f2b705";

interface SnapRingProps {
  at: Vec2; // world XZ of the anchor the endpoint is snapping to
  radius?: number; // outer radius (meters)
}

/**
 * A subtle ring shown flat on the ground at a piece anchor while a wall endpoint
 * is SNAPPING to it — the prior project's snap-active affordance. It is a purely
 * decorative, non-pickable transient overlay (a translucent UI hint, like the
 * placement ghosts — not a persisted Piece), so transparency is fine here. Its Y
 * routes through groundHeightAt (never a literal) so terrain stays additive.
 */
export function SnapRing({ at, radius = 0.7 }: SnapRingProps) {
  const y = groundHeightAt(at.x, at.y) + SNAP_RING_LAYER;
  return (
    <mesh
      position={[at.x, y, at.y]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={NOOP_RAYCAST}
    >
      <ringGeometry args={[radius * 0.6, radius, 32]} />
      <meshBasicMaterial
        color={SNAP_TINT}
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </mesh>
  );
}
