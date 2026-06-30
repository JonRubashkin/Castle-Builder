import {
  DEFAULT_TOWER_HEIGHT,
  DEFAULT_TOWER_RADIUS,
  type Vec2,
} from "../../store/schema";
import { groundHeightAt } from "../../geometry/ground";

const NOOP_RAYCAST = () => null;

interface TowerGhostProps {
  position: Vec2; // grid-snapped world XZ
}

/**
 * The placement preview that follows the cursor in the Tower tool. This is a
 * transient UI helper, NOT a persisted Piece — so the opaque-materials rule
 * (which governs pieces and water) doesn't apply; a translucent ghost is fine.
 */
export function TowerGhost({ position }: TowerGhostProps) {
  const baseY = groundHeightAt(position.x, position.y);
  return (
    <group position={[position.x, baseY, position.y]} raycast={NOOP_RAYCAST}>
      <mesh position={[0, DEFAULT_TOWER_HEIGHT / 2, 0]} raycast={NOOP_RAYCAST}>
        <cylinderGeometry
          args={[DEFAULT_TOWER_RADIUS, DEFAULT_TOWER_RADIUS, DEFAULT_TOWER_HEIGHT, 48]}
        />
        <meshStandardMaterial
          color="#7bb8ee"
          transparent
          opacity={0.4}
          depthWrite={false}
          roughness={0.8}
        />
      </mesh>
    </group>
  );
}
