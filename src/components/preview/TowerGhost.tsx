import {
  DEFAULT_TOWER_HEIGHT,
  DEFAULT_TOWER_RADIUS,
  type Vec2,
} from "../../store/schema";
import { groundHeightAt } from "../../geometry/ground";

const NOOP_RAYCAST = () => null;

// Distinct tints so the user can read WHERE the next tower will seat: blue on
// the ground, green when face-attaching to a piece top.
const GROUND_TINT = "#7bb8ee";
const SURFACE_TINT = "#69d18a";

interface TowerGhostProps {
  position: Vec2; // grid-snapped world XZ
  base: number; // resolved support height (relative to ground), 0 = on ground
  onSurface: boolean; // true when face-attaching to a piece top
}

/**
 * The placement preview that follows the cursor in the Tower tool. This is a
 * transient UI helper, NOT a persisted Piece — so the opaque-materials rule
 * (which governs pieces and water) doesn't apply; a translucent ghost is fine.
 * Its Y comes from the support rule (groundHeightAt + the resolved base), never
 * a hardcoded value.
 */
export function TowerGhost({ position, base, onSurface }: TowerGhostProps) {
  const baseY = groundHeightAt(position.x, position.y) + base;
  const tint = onSurface ? SURFACE_TINT : GROUND_TINT;
  return (
    <group position={[position.x, baseY, position.y]} raycast={NOOP_RAYCAST}>
      <mesh position={[0, DEFAULT_TOWER_HEIGHT / 2, 0]} raycast={NOOP_RAYCAST}>
        <cylinderGeometry
          args={[DEFAULT_TOWER_RADIUS, DEFAULT_TOWER_RADIUS, DEFAULT_TOWER_HEIGHT, 48]}
        />
        <meshStandardMaterial
          color={tint}
          transparent
          opacity={0.4}
          depthWrite={false}
          roughness={0.8}
        />
      </mesh>
    </group>
  );
}
