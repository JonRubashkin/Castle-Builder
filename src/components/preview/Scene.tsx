import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { isoCameraPosition } from "../../geometry/camera";
import { Ground } from "./Ground";
import { GroundInteraction } from "./GroundInteraction";
import { Pieces } from "./Pieces";

const CAMERA_DISTANCE = 60;
const ISO = isoCameraPosition(CAMERA_DISTANCE);

// Lock the vertical orbit so the camera can never dip to or below the ground
// plane. Polar angle is measured from +Y; PI/2 is the horizon.
const MAX_POLAR_ANGLE = Math.PI / 2 - 0.05;

export function Scene() {
  return (
    <Canvas
      orthographic
      camera={{
        position: [ISO.x, ISO.y, ISO.z],
        zoom: 40,
        near: -1000,
        far: 2000,
      }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#222831"]} />
      <hemisphereLight args={["#cdd6e0", "#3a4048", 0.9]} />
      <directionalLight position={[20, 40, 15]} intensity={1.1} castShadow />
      <ambientLight intensity={0.25} />

      <Ground />
      <GroundInteraction />
      <Pieces />

      <OrbitControls
        makeDefault
        enableRotate
        enableZoom
        enablePan
        maxPolarAngle={MAX_POLAR_ANGLE}
        minZoom={8}
        maxZoom={200}
      />
    </Canvas>
  );
}
