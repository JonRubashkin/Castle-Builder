import { useEffect, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useStore } from "../../store/store";
import { snapHorizontalVec2 } from "../../geometry/grid";
import { resolveSupportAt } from "../../geometry/support";
import { groundHeightAt } from "../../geometry/ground";
import { GRID_LAYER } from "./stacking";
import { isCleanClick } from "./interaction";
import { TowerGhost } from "./TowerGhost";
import type { Vec2 } from "../../store/schema";

const PLANE_SIZE = 400;

interface GhostState {
  position: Vec2;
  base: number; // resolved support (ground or a piece top), relative to ground
  onSurface: boolean;
}

/**
 * The ground-plane interaction surface. It is an invisible (color-write-off, no
 * transparency) plane that handles the ground raycast for placement and for
 * empty-space deselect. Placement resolves the support height under the anchor
 * via resolveSupportAt — ground (groundHeightAt) when over empty ground, or an
 * existing piece's top via FACE-ATTACH when the anchor is over a piece. Tower
 * meshes stopPropagation on their own clicks only in the Select tool, so in the
 * Tower tool the ground point under the cursor still drives the anchor.
 */
export function GroundInteraction() {
  const tool = useStore((s) => s.tool);
  const pieces = useStore((s) => s.design.pieces);
  const [ghost, setGhost] = useState<GhostState | null>(null);

  // Esc cancels an in-progress placement (clears the ghost); the tool stays
  // active so the next move re-shows it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGhost(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const resolveGhost = (e: ThreeEvent<PointerEvent>): GhostState => {
    const position = snapHorizontalVec2({ x: e.point.x, y: e.point.z });
    const support = resolveSupportAt(position, pieces);
    return { position, base: support.base, onSurface: support.onSurface };
  };

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (tool !== "tower") {
      if (ghost) setGhost(null);
      return;
    }
    setGhost(resolveGhost(e));
  };

  const handleOut = () => {
    if (ghost) setGhost(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isCleanClick(e.nativeEvent.clientX, e.nativeEvent.clientY)) return;
    if (tool === "tower") {
      const position = snapHorizontalVec2({ x: e.point.x, y: e.point.z });
      // Seat through the support rule: ground or a face-attach surface top.
      const support = resolveSupportAt(position, pieces);
      useStore.getState().addTower({ position, base: support.base });
    } else {
      // Select tool: clicking empty ground deselects.
      useStore.getState().selectPiece(null);
    }
  };

  // Seat the interaction plane at the ground (routed through groundHeightAt, never
  // an inline ground-y), nudged to the grid layer to avoid z-fighting.
  const planeY = groundHeightAt(0, 0) + GRID_LAYER;

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, planeY, 0]}
        onPointerMove={handleMove}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
        {/* Invisible but still raycastable: no color write, no depth write, no
            real transparency (so it can't interact with cutaway view modes). */}
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      {tool === "tower" && ghost && (
        <TowerGhost
          position={ghost.position}
          base={ghost.base}
          onSurface={ghost.onSurface}
        />
      )}
    </group>
  );
}
