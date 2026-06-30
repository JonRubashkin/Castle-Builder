import { Grid } from "@react-three/drei";
import type { Mesh } from "three";
import { groundHeightAt } from "../../geometry/ground";
import { GRID_LAYER, GROUND_LAYER } from "./stacking";

const GROUND_SIZE = 400; // meters; large enough to read as "infinite" ground

interface GroundProps {
  /** Ref-name the ground plane carries so placement raycasts can target it. */
  onGroundRef?: (mesh: Mesh | null) => void;
}

/**
 * The flat ground: a solid plane plus a visible grid (minor lines at 0.1 m, major
 * at 1 m). The plane's Y comes from groundHeightAt — never a hardcoded 0 — and the
 * grid sits one stacking layer above it so the two never z-fight.
 */
export function Ground({ onGroundRef }: GroundProps) {
  const groundY = groundHeightAt(0, 0) + GROUND_LAYER;
  const gridY = groundHeightAt(0, 0) + GRID_LAYER;

  return (
    <group>
      <mesh
        ref={onGroundRef}
        name="ground"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, groundY, 0]}
        receiveShadow
      >
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color="#3a4048" />
      </mesh>

      <Grid
        position={[0, gridY, 0]}
        infiniteGrid
        cellSize={0.1}
        cellThickness={0.5}
        cellColor="#4a525c"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#6b7783"
        fadeDistance={60}
        fadeStrength={1.5}
      />
    </group>
  );
}
