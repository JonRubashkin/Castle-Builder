import { Html } from "@react-three/drei";
import {
  DEFAULT_MOAT_INNER_RADIUS,
  DEFAULT_MOAT_OUTER_RADIUS,
  DEFAULT_MOAT_WIDTH,
  type Vec2,
} from "../../store/schema";
import { groundHeightAt } from "../../geometry/ground";
import { MOAT_RING_SEGMENTS } from "../../geometry/moatBuilder";
import { WATER_LAYER } from "./stacking";

const NOOP_RAYCAST = () => null;
const WATER_TINT = "#7bb8ee";
/** How far above the water the length label floats (meters). */
const LABEL_LIFT = 1.5;

/** Where the flat water ghost sits: the ground (via groundHeightAt) lifted to the
 *  water layer — never a hardcoded Y. */
function waterY(anchor: Vec2): number {
  return groundHeightAt(anchor.x, anchor.y) + WATER_LAYER;
}

/** Ring placement preview (single anchor + default radii). Transparency is fine
 *  on a transient ghost — the opaque-water rule governs persisted pieces. */
export function MoatRingGhost({ position }: { position: Vec2 }) {
  return (
    <group position={[position.x, waterY(position), position.y]} raycast={NOOP_RAYCAST}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
        <ringGeometry
          args={[DEFAULT_MOAT_INNER_RADIUS, DEFAULT_MOAT_OUTER_RADIUS, MOAT_RING_SEGMENTS]}
        />
        <meshStandardMaterial
          color={WATER_TINT}
          transparent
          opacity={0.45}
          depthWrite={false}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/** Segment placement preview (after the first click, following the cursor) with a
 *  length label, mirroring the wall draft. */
export function MoatSegmentGhost({ start, end }: { start: Vec2; end: Vec2 }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;

  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const rotationY = -Math.atan2(dy, dx); // group rotation; local +X → start→end

  return (
    <group position={[center.x, waterY(start), center.y]} rotation={[0, rotationY, 0]} raycast={NOOP_RAYCAST}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[length, DEFAULT_MOAT_WIDTH]} />
        <meshStandardMaterial
          color={WATER_TINT}
          transparent
          opacity={0.45}
          depthWrite={false}
          roughness={0.4}
        />
      </mesh>
      <Html position={[0, LABEL_LIFT, 0]} center raycast={NOOP_RAYCAST}>
        <div className="wall-length-label" data-moat-length={length.toFixed(2)}>
          {length.toFixed(2)} m
        </div>
      </Html>
    </group>
  );
}
