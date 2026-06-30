import { Html } from "@react-three/drei";
import type { Vec2 } from "../../store/schema";
import { groundHeightAt } from "../../geometry/ground";
import { buildRamp } from "../../geometry/rampBuilder";

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

const NOOP_RAYCAST = () => null;
// Blue while aiming at empty ground (the fallback path); green when the top click
// would land on a real surface (a true connection) — matches the other ghosts.
const GROUND_TINT = "#7bb8ee";
const SURFACE_TINT = "#69d18a";
/** How far above the ramp top the rise/run label floats (meters). */
const LABEL_LIFT = 1.5;

interface RampGhostProps {
  position: Vec2; // bottom anchor (grid-snapped)
  base: number; // resolved support at the bottom anchor, relative to ground
  rotation: number; // heading (degrees), snapped
  rise: number;
  run: number;
  width: number;
  onSurface: boolean; // true when the top click would hit a real surface
}

/**
 * The live ramp preview shown while aiming the second (top) click. A transient UI
 * helper, not a persisted Piece, so a translucent inclined slab is fine. It shows
 * the resulting rise/run so the connection's slope reads before committing. Its Y
 * routes through groundHeightAt + the resolved base, never a hardcoded value.
 */
export function RampGhost({
  position,
  base,
  rotation,
  rise,
  run,
  width,
  onSurface,
}: RampGhostProps) {
  const baseY = groundHeightAt(position.x, position.y) + base;
  const tint = onSurface ? SURFACE_TINT : GROUND_TINT;
  // Preview as a ramp slab regardless of the eventual style (lighter than steps).
  const parts = buildRamp({ rise, run, width, style: "ramp" });

  return (
    <group
      position={[position.x, baseY, position.y]}
      rotation={[0, -deg2rad(rotation), 0]}
      raycast={NOOP_RAYCAST}
    >
      {parts.map((part, i) => (
        <mesh
          key={i}
          position={[part.position.x, part.position.y, part.position.z]}
          rotation={[part.rotationX, 0, 0]}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[part.size.x, part.size.y, part.size.z]} />
          <meshStandardMaterial
            color={tint}
            transparent
            opacity={0.4}
            depthWrite={false}
            roughness={0.8}
          />
        </mesh>
      ))}
      <Html position={[0, rise + LABEL_LIFT, run]} center raycast={NOOP_RAYCAST}>
        <div
          className="wall-length-label"
          data-ramp-rise={rise.toFixed(2)}
          data-ramp-run={run.toFixed(2)}
        >
          rise {rise.toFixed(2)} m · run {run.toFixed(2)} m
        </div>
      </Html>
    </group>
  );
}
