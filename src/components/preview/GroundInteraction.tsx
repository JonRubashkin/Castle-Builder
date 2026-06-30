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
import { GateGhost } from "./GateGhost";
import { WallGhost } from "./WallGhost";
import { MoatRingGhost, MoatSegmentGhost } from "./MoatGhost";
import type { Vec2 } from "../../store/schema";

const PLANE_SIZE = 400;

// The single-anchor placement tools (one click → one whole piece) share a ghost
// preview driven by the support rule (ground or face-attach).
const ANCHOR_TOOLS = ["tower", "gatehouse", "gate"] as const;
type AnchorTool = (typeof ANCHOR_TOOLS)[number];

interface GhostState {
  position: Vec2;
  base: number; // resolved support (ground or a piece top), relative to ground
  onSurface: boolean;
}

/**
 * The ground-plane interaction surface. It is an invisible (color-write-off, no
 * transparency) plane that handles the ground raycast for placement and for
 * empty-space deselect.
 *
 * Tools:
 *  • Single-anchor (tower, gatehouse, GATE): place one whole piece per click with
 *    a ghost preview; the base resolves via resolveSupportAt — ground
 *    (groundHeightAt) over empty ground, or a piece top via FACE-ATTACH.
 *  • Wall run: TWO clicks (start, then end) with a live preview + length label.
 *  • Moat: GROUND-ONLY, never face-attach. Its sub-mode chooses ring vs. segment.
 *    Ring is single-anchor + radii (panel); segment is two clicks (start, end)
 *    with width from the panel.
 *
 * Esc cancels an in-progress placement; a zero-length wall/segment is ignored.
 */
export function GroundInteraction() {
  const tool = useStore((s) => s.tool);
  const moatShape = useStore((s) => s.moatShape);
  const pieces = useStore((s) => s.design.pieces);
  const [ghost, setGhost] = useState<GhostState | null>(null);
  // Two-point drafting (a wall, or a segment moat): the committed start (after the
  // first click) and the live cursor (the would-be second endpoint).
  const [draftStart, setDraftStart] = useState<Vec2 | null>(null);
  const [draftCursor, setDraftCursor] = useState<Vec2 | null>(null);

  const anchorTool: AnchorTool | null = (ANCHOR_TOOLS as readonly string[]).includes(
    tool,
  )
    ? (tool as AnchorTool)
    : null;

  // Which tools draw with two clicks (a live start→end draft).
  const isTwoPoint = tool === "wallRun" || (tool === "moat" && moatShape === "segment");
  // The moat ring tool follows the cursor with a single-anchor ghost (ground-only).
  const isMoatRing = tool === "moat" && moatShape === "ring";

  // Reset any in-progress two-point draft when it no longer applies.
  useEffect(() => {
    if (!isTwoPoint) {
      setDraftStart(null);
      setDraftCursor(null);
    }
  }, [isTwoPoint]);

  // Esc cancels an in-progress placement (the ghost and any draft); the tool stays
  // active so the next move re-shows the preview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGhost(null);
        setDraftStart(null);
        setDraftCursor(null);
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
    const cursor = snapHorizontalVec2({ x: e.point.x, y: e.point.z });
    if (isTwoPoint) {
      setDraftCursor(cursor);
    } else if (isMoatRing) {
      setDraftCursor(cursor); // reuse the cursor slot to drive the ring ghost
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
      } else if (anchorTool === "gatehouse") {
        useStore.getState().addGatehouse({ position: point, base: support.base });
      } else {
        useStore.getState().addGate({ position: point, base: support.base });
      }
      return;
    }

    if (isMoatRing) {
      // Ground-only single-anchor ring (radii come from defaults / the panel).
      useStore.getState().addMoatRing({ position: point });
      return;
    }

    if (isTwoPoint) {
      if (!draftStart) {
        setDraftStart(point);
        setDraftCursor(point);
        return;
      }
      // Second click: ignore a zero-length draft; otherwise place a single piece
      // and stay active for the next one (no chaining this phase).
      if (point.x === draftStart.x && point.y === draftStart.y) return;
      if (tool === "wallRun") {
        // The wall seats at one base, resolved at the START anchor (face-attach).
        const support = resolveSupportAt(draftStart, pieces);
        useStore
          .getState()
          .addWallRun({ position: draftStart, end: point, base: support.base });
      } else {
        // Segment moat: ground-only (the store resolves the base from the ground).
        useStore.getState().addMoatSegment({ position: draftStart, end: point });
      }
      setDraftStart(null);
      setDraftCursor(null);
      return;
    }

    // Select tool: clicking empty ground deselects.
    useStore.getState().selectPiece(null);
  };

  // Seat the interaction plane at the ground (routed through groundHeightAt, never
  // an inline ground-y), nudged to the grid layer to avoid z-fighting.
  const planeY = groundHeightAt(0, 0) + GRID_LAYER;

  // The wall preview's base resolves at the start anchor (the wall's support rule).
  const wallSupport =
    tool === "wallRun" && draftStart ? resolveSupportAt(draftStart, pieces) : null;

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
      {ghost && anchorTool === "gate" && (
        <GateGhost position={ghost.position} base={ghost.base} onSurface={ghost.onSurface} />
      )}
      {tool === "wallRun" && draftStart && draftCursor && wallSupport && (
        <WallGhost
          start={draftStart}
          end={draftCursor}
          base={wallSupport.base}
          onSurface={wallSupport.onSurface}
        />
      )}
      {isMoatRing && draftCursor && <MoatRingGhost position={draftCursor} />}
      {tool === "moat" && moatShape === "segment" && draftStart && draftCursor && (
        <MoatSegmentGhost start={draftStart} end={draftCursor} />
      )}
    </group>
  );
}
