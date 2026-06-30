import { useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useStore } from "../../store/store";
import { groundHeightAt } from "../../geometry/ground";
import { snapHorizontalVec2 } from "../../geometry/grid";
import { GRID_LAYER } from "./stacking";
import { isCleanClick } from "./interaction";
import { TowerGhost } from "./TowerGhost";
import type { Vec2 } from "../../store/schema";

const PLANE_SIZE = 400;

/**
 * The ground-plane interaction surface. It is an invisible (color-write-off, no
 * transparency) plane that handles the ground raycast for placement and for
 * empty-space deselect. Tower meshes sit above it and stopPropagation on their
 * own clicks, so a click on a tower never reaches this plane.
 */
export function GroundInteraction() {
  const tool = useStore((s) => s.tool);
  const [ghost, setGhost] = useState<Vec2 | null>(null);

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (tool !== "tower") {
      if (ghost) setGhost(null);
      return;
    }
    const snapped = snapHorizontalVec2({ x: e.point.x, y: e.point.z });
    setGhost(snapped);
  };

  const handleOut = () => {
    if (ghost) setGhost(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isCleanClick(e.nativeEvent.clientX, e.nativeEvent.clientY)) return;
    if (tool === "tower") {
      const snapped = snapHorizontalVec2({ x: e.point.x, y: e.point.z });
      const base = groundHeightAt(snapped.x, snapped.y);
      useStore.getState().addTower({ position: snapped, base });
    } else {
      // Select tool: clicking empty ground deselects.
      useStore.getState().selectPiece(null);
    }
  };

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, GRID_LAYER, 0]}
        onPointerMove={handleMove}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
        {/* Invisible but still raycastable: no color write, no depth write, no
            real transparency (so it can't interact with cutaway view modes). */}
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      {tool === "tower" && ghost && <TowerGhost position={ghost} />}
    </group>
  );
}
