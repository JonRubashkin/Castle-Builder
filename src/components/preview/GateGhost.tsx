import {
  DEFAULT_GATE_HEIGHT,
  DEFAULT_GATE_WIDTH,
  type Vec2,
} from "../../store/schema";
import { groundHeightAt } from "../../geometry/ground";
import { GATE_THICKNESS } from "../../geometry/gateFootprint";

const NOOP_RAYCAST = () => null;

// Blue on the ground, green when face-attaching to a piece top (matches the
// tower/gatehouse ghosts so placement reads consistently).
const GROUND_TINT = "#7bb8ee";
const SURFACE_TINT = "#69d18a";

interface GateGhostProps {
  position: Vec2; // grid-snapped world XZ anchor
  base: number; // resolved support height (relative to ground), 0 = on ground
  onSurface: boolean; // true when face-attaching to a piece top
}

/**
 * The placement preview that follows the cursor in the Gate tool. A transient UI
 * helper, NOT a persisted Piece — so a translucent ghost is fine (the
 * opaque-materials rule governs pieces, not previews). Its Y comes from the
 * support rule (groundHeightAt + the resolved base), never a hardcoded value.
 */
export function GateGhost({ position, base, onSurface }: GateGhostProps) {
  const baseY = groundHeightAt(position.x, position.y) + base;
  const tint = onSurface ? SURFACE_TINT : GROUND_TINT;
  return (
    <group position={[position.x, baseY, position.y]} raycast={NOOP_RAYCAST}>
      <mesh position={[0, DEFAULT_GATE_HEIGHT / 2, 0]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[DEFAULT_GATE_WIDTH, DEFAULT_GATE_HEIGHT, GATE_THICKNESS]} />
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
