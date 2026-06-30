import {
  DEFAULT_GATEHOUSE_DEPTH,
  DEFAULT_GATEHOUSE_HEIGHT,
  DEFAULT_GATEHOUSE_WIDTH,
  type Vec2,
} from "../../store/schema";
import { groundHeightAt } from "../../geometry/ground";

const NOOP_RAYCAST = () => null;

// Blue on the ground, green when face-attaching to a piece top (matches the
// tower ghost so placement reads consistently).
const GROUND_TINT = "#7bb8ee";
const SURFACE_TINT = "#69d18a";

interface GatehouseGhostProps {
  position: Vec2; // grid-snapped world XZ anchor
  base: number; // resolved support height (relative to ground), 0 = on ground
  onSurface: boolean; // true when face-attaching to a piece top
}

/**
 * The placement preview that follows the cursor in the Gatehouse tool. A
 * transient UI helper, NOT a persisted Piece — so a translucent ghost is fine
 * (the opaque-materials rule governs pieces, not previews). Its Y comes from the
 * support rule (groundHeightAt + the resolved base), never a hardcoded value.
 */
export function GatehouseGhost({ position, base, onSurface }: GatehouseGhostProps) {
  const baseY = groundHeightAt(position.x, position.y) + base;
  const tint = onSurface ? SURFACE_TINT : GROUND_TINT;
  return (
    <group position={[position.x, baseY, position.y]} raycast={NOOP_RAYCAST}>
      <mesh position={[0, DEFAULT_GATEHOUSE_HEIGHT / 2, 0]} raycast={NOOP_RAYCAST}>
        <boxGeometry
          args={[DEFAULT_GATEHOUSE_WIDTH, DEFAULT_GATEHOUSE_HEIGHT, DEFAULT_GATEHOUSE_DEPTH]}
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
