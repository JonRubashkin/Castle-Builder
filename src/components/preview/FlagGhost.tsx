import {
  DEFAULT_FLAG_CLOTH_WIDTH,
  DEFAULT_FLAG_POLE_HEIGHT,
  type Vec2,
} from "../../store/schema";
import { groundHeightAt } from "../../geometry/ground";
import { flagClothHeight, POLE_RADIUS } from "../../geometry/flagBuilder";
import { DEFAULT_FLAG_ASPECT } from "../../flags/types";

const NOOP_RAYCAST = () => null;

// Blue on the ground, green when face-attaching to a piece top (matches the
// tower/gatehouse/gate ghosts so placement reads consistently).
const GROUND_TINT = "#7bb8ee";
const SURFACE_TINT = "#69d18a";

interface FlagGhostProps {
  position: Vec2; // grid-snapped world XZ anchor (the pole base)
  base: number; // resolved support height (relative to ground), 0 = on ground
  onSurface: boolean; // true when face-attaching to a piece top
}

/**
 * The placement preview that follows the cursor in the Flag tool. A transient UI
 * helper, NOT a persisted Piece — so a translucent ghost is fine (the
 * opaque-materials rule governs pieces, not previews). Its Y comes from the
 * support rule (groundHeightAt + the resolved base), never a hardcoded value. It
 * previews the DEFAULT flag dimensions (a plain silhouette — the design is seeded
 * on placement).
 */
export function FlagGhost({ position, base, onSurface }: FlagGhostProps) {
  const baseY = groundHeightAt(position.x, position.y) + base;
  const tint = onSurface ? SURFACE_TINT : GROUND_TINT;
  const clothHeight = flagClothHeight(DEFAULT_FLAG_CLOTH_WIDTH, DEFAULT_FLAG_ASPECT);
  const clothCenterY = DEFAULT_FLAG_POLE_HEIGHT - clothHeight / 2;

  return (
    <group position={[position.x, baseY, position.y]} raycast={NOOP_RAYCAST}>
      {/* The pole. */}
      <mesh position={[0, DEFAULT_FLAG_POLE_HEIGHT / 2, 0]} raycast={NOOP_RAYCAST}>
        <cylinderGeometry
          args={[POLE_RADIUS, POLE_RADIUS, DEFAULT_FLAG_POLE_HEIGHT, 12]}
        />
        <meshStandardMaterial
          color={tint}
          transparent
          opacity={0.4}
          depthWrite={false}
          roughness={0.8}
        />
      </mesh>
      {/* The cloth (flies out along +X from the pole). */}
      <mesh
        position={[DEFAULT_FLAG_CLOTH_WIDTH / 2, clothCenterY, 0]}
        raycast={NOOP_RAYCAST}
      >
        <planeGeometry args={[DEFAULT_FLAG_CLOTH_WIDTH, clothHeight]} />
        <meshStandardMaterial
          color={tint}
          transparent
          opacity={0.4}
          depthWrite={false}
          side={2}
          roughness={0.8}
        />
      </mesh>
    </group>
  );
}
