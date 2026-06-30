import { useEffect, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useStore } from "../../store/store";
import { snapHorizontalVec2 } from "../../geometry/grid";
import { resolveSupportAt } from "../../geometry/support";
import { groundHeightAt } from "../../geometry/ground";
import { GRID_LAYER } from "./stacking";
import { isCleanClick } from "./interaction";
import { TowerGhost } from "./TowerGhost";
import { GatehouseGhost } from "./GatehouseGhost";
import { WallGhost } from "./WallGhost";
import type { Vec2 } from "../../store/schema";

const PLANE_SIZE = 400;

// The single-anchor placement tools (one click → one whole piece) share a ghost
// preview driven by the support rule.
const ANCHOR_TOOLS = ["tower", "gatehouse"] as const;
type AnchorTool = (typeof ANCHOR_TOOLS)[number];

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
 * existing piece's top via FACE-ATTACH when the anchor is over a piece.
 *
 * Tools: the single-anchor tools (tower, gatehouse) place one whole piece per
 * click with a ghost preview. The wall-run tool is TWO clicks — first sets the
 * start, the second (with a live preview + length label) sets the end. Esc
 * cancels an in-progress placement; a zero-length wall is ignored.
 */
export function GroundInteraction() {
  const tool = useStore((s) => s.tool);
  const pieces = useStore((s) => s.design.pieces);
  const [ghost, setGhost] = useState<GhostState | null>(null);
  // Wall drafting: the committed start (after the first click) and the live
  // cursor (the would-be second endpoint).
  const [wallStart, setWallStart] = useState<Vec2 | null>(null);
  const [wallCursor, setWallCursor] = useState<Vec2 | null>(null);

  const anchorTool: AnchorTool | null = (ANCHOR_TOOLS as readonly string[]).includes(
    tool,
  )
    ? (tool as AnchorTool)
    : null;

  // Reset any in-progress wall draft when leaving the wall tool.
  useEffect(() => {
    if (tool !== "wallRun") {
      setWallStart(null);
      setWallCursor(null);
    }
  }, [tool]);

  // Esc cancels an in-progress placement (the ghost and any wall draft); the
  // tool stays active so the next move re-shows the preview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGhost(null);
        setWallStart(null);
        setWallCursor(null);
      }
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
    if (anchorTool) {
      setGhost(resolveGhost(e));
      return;
    }
    if (ghost) setGhost(null);
    if (tool === "wallRun") {
      setWallCursor(snapHorizontalVec2({ x: e.point.x, y: e.point.z }));
    }
  };

  const handleOut = () => {
    if (ghost) setGhost(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isCleanClick(e.nativeEvent.clientX, e.nativeEvent.clientY)) return;
    const point = snapHorizontalVec2({ x: e.point.x, y: e.point.z });

    if (anchorTool) {
      // Seat through the support rule: ground or a face-attach surface top.
      const support = resolveSupportAt(point, pieces);
      if (anchorTool === "tower") {
        useStore.getState().addTower({ position: point, base: support.base });
      } else {
        useStore.getState().addGatehouse({ position: point, base: support.base });
      }
      return;
    }

    if (tool === "wallRun") {
      if (!wallStart) {
        setWallStart(point);
        setWallCursor(point);
        return;
      }
      // Second click: ignore a zero-length wall; otherwise place a single
      // segment and stay active for the next wall (no chaining this phase).
      if (point.x === wallStart.x && point.y === wallStart.y) return;
      // The wall seats at one base, resolved at the START anchor.
      const support = resolveSupportAt(wallStart, pieces);
      useStore.getState().addWallRun({ position: wallStart, end: point, base: support.base });
      setWallStart(null);
      setWallCursor(null);
      return;
    }

    // Select tool: clicking empty ground deselects.
    useStore.getState().selectPiece(null);
  };

  // Seat the interaction plane at the ground (routed through groundHeightAt, never
  // an inline ground-y), nudged to the grid layer to avoid z-fighting.
  const planeY = groundHeightAt(0, 0) + GRID_LAYER;

  // The wall preview's base resolves at the start anchor (the wall's support rule).
  const wallSupport = wallStart ? resolveSupportAt(wallStart, pieces) : null;

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

      {ghost && anchorTool === "tower" && (
        <TowerGhost position={ghost.position} base={ghost.base} onSurface={ghost.onSurface} />
      )}
      {ghost && anchorTool === "gatehouse" && (
        <GatehouseGhost
          position={ghost.position}
          base={ghost.base}
          onSurface={ghost.onSurface}
        />
      )}
      {tool === "wallRun" && wallStart && wallCursor && wallSupport && (
        <WallGhost
          start={wallStart}
          end={wallCursor}
          base={wallSupport.base}
          onSurface={wallSupport.onSurface}
        />
      )}
    </group>
  );
}
