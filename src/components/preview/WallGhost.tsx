import { Html } from "@react-three/drei";
import {
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  type Vec2,
} from "../../store/schema";
import { groundHeightAt } from "../../geometry/ground";

const NOOP_RAYCAST = () => null;
const GROUND_TINT = "#7bb8ee";
const SURFACE_TINT = "#69d18a";

interface WallGhostProps {
  start: Vec2; // grid-snapped world XZ start anchor
  end: Vec2; // current grid-snapped cursor (the live second endpoint)
  base: number; // resolved support height at the start anchor, relative to ground
  onSurface: boolean;
}

/**
 * The live wall preview shown while drawing (after the first click, following the
 * cursor) with a length label. A transient UI helper, not a persisted Piece, so a
 * translucent box is fine. Its Y comes from the support rule (groundHeightAt + the
 * resolved base at the start anchor), never a hardcoded value.
 */
export function WallGhost({ start, end, base, onSurface }: WallGhostProps) {
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const length = Math.hypot(dx, dz);
  if (length === 0) return null;

  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const baseY = groundHeightAt(start.x, start.y) + base;
  const rotationY = -Math.atan2(dz, dx); // group rotation; local +X → start→end
  const tint = onSurface ? SURFACE_TINT : GROUND_TINT;
  const midHeight = DEFAULT_WALL_HEIGHT / 2;

  return (
    <group position={[center.x, baseY, center.y]} rotation={[0, rotationY, 0]} raycast={NOOP_RAYCAST}>
      <mesh position={[0, midHeight, 0]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[length, DEFAULT_WALL_HEIGHT, DEFAULT_WALL_THICKNESS]} />
        <meshStandardMaterial
          color={tint}
          transparent
          opacity={0.4}
          depthWrite={false}
          roughness={0.8}
        />
      </mesh>
      <Html position={[0, DEFAULT_WALL_HEIGHT + 1, 0]} center raycast={NOOP_RAYCAST}>
        <div className="wall-length-label" data-wall-length={length.toFixed(2)}>
          {length.toFixed(2)} m
        </div>
      </Html>
    </group>
  );
}
