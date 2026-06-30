import { useEffect, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useStore } from "../../store/store";
import { snapHorizontalVec2 } from "../../geometry/grid";
import { resolveSupportAt } from "../../geometry/support";
import { groundHeightAt } from "../../geometry/ground";
import {
  rampRotationToward,
  resolveRampConnection,
} from "../../geometry/rampBuilder";
import {
  DEFAULT_RAMP_RISE,
  DEFAULT_RAMP_RUN,
  DEFAULT_RAMP_WIDTH,
  type Piece,
  type Vec2,
} from "../../store/schema";
import { GRID_LAYER } from "./stacking";
import { isCleanClick } from "./interaction";
import { TowerGhost } from "./TowerGhost";
import { GatehouseGhost } from "./GatehouseGhost";
import { GateGhost } from "./GateGhost";
import { WallGhost } from "./WallGhost";
import { MoatRingGhost, MoatSegmentGhost } from "./MoatGhost";
import { RampGhost } from "./RampGhost";

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

/** The ramp's computed placement: the addRamp input plus whether the top click
 *  landed on a real surface (a true connection) or empty ground (the fallback). */
interface RampPlacement {
  position: Vec2;
  base: number;
  rotation: number;
  rise: number;
  run: number;
  onSurface: boolean;
}

/**
 * Resolve a ramp from a bottom point to a top point — the SINGLE place the
 * connect-vs-fallback decision lives, shared by the live ghost and the commit so
 * the preview can't drift from what gets placed.
 *
 *  • If the top point is over a REAL surface (a tower/gatehouse/wall top — the
 *    existing face-attach set, which excludes ramps), the ramp literally spans the
 *    two heights via resolveRampConnection.
 *  • Otherwise (empty ground) it falls back to a default ramp from the bottom
 *    anchor, aimed toward the cursor, that the user then tunes in the panel —
 *    never an error, never stuck.
 */
function resolveRampPlacement(bottom: Vec2, top: Vec2, pieces: Piece[]): RampPlacement {
  const bottomSupport = resolveSupportAt(bottom, pieces);
  const bottomWorldY = groundHeightAt(bottom.x, bottom.y) + bottomSupport.base;
  const topSupport = resolveSupportAt(top, pieces);

  if (topSupport.onSurface) {
    const topWorldY = groundHeightAt(top.x, top.y) + topSupport.base;
    const c = resolveRampConnection(
      { point: bottom, base: bottomSupport.base, height: bottomWorldY },
      { point: top, height: topWorldY },
    );
    return { ...c, onSurface: true };
  }

  return {
    position: snapHorizontalVec2(bottom),
    base: bottomSupport.base,
    rotation: rampRotationToward(bottom, top),
    rise: DEFAULT_RAMP_RISE,
    run: DEFAULT_RAMP_RUN,
    onSurface: false,
  };
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
 *  • Ramp: a CONNECTION — click a bottom (ground or a flat top via face-attach),
 *    then a top SURFACE; the ramp computes its own params to span them. A top
 *    click on empty ground falls back to a tunable default ramp.
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
  // The ramp's own two-click draft (kept separate from the wall/segment draft):
  // the committed bottom anchor and the live top cursor.
  const [rampBottom, setRampBottom] = useState<Vec2 | null>(null);
  const [rampCursor, setRampCursor] = useState<Vec2 | null>(null);

  const anchorTool: AnchorTool | null = (ANCHOR_TOOLS as readonly string[]).includes(
    tool,
  )
    ? (tool as AnchorTool)
    : null;

  // Which tools draw with two clicks (a live start→end draft).
  const isTwoPoint = tool === "wallRun" || (tool === "moat" && moatShape === "segment");
  // The moat ring tool follows the cursor with a single-anchor ghost (ground-only).
  const isMoatRing = tool === "moat" && moatShape === "ring";
  const isRamp = tool === "ramp";

  // Reset any in-progress two-point draft when it no longer applies.
  useEffect(() => {
    if (!isTwoPoint) {
      setDraftStart(null);
      setDraftCursor(null);
    }
  }, [isTwoPoint]);

  // Reset the ramp draft when the ramp tool isn't active.
  useEffect(() => {
    if (!isRamp) {
      setRampBottom(null);
      setRampCursor(null);
    }
  }, [isRamp]);

  // Esc cancels an in-progress placement (the ghost and any draft); the tool stays
  // active so the next move re-shows the preview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGhost(null);
        setDraftStart(null);
        setDraftCursor(null);
        setRampBottom(null);
        setRampCursor(null);
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
    if (isRamp) {
      setRampCursor(cursor);
    } else if (isTwoPoint) {
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

    if (isRamp) {
      // First click = the bottom (ground or a flat top via face-attach); the live
      // preview then follows the cursor toward a provisional top.
      if (!rampBottom) {
        setRampBottom(point);
        setRampCursor(point);
        return;
      }
      // Second click = the top: connect to a real surface, else fall back to a
      // tunable default ramp (resolveRampPlacement makes that decision).
      const placement = resolveRampPlacement(rampBottom, point, pieces);
      useStore.getState().addRamp({
        position: placement.position,
        base: placement.base,
        rotation: placement.rotation,
        rise: placement.rise,
        run: placement.run,
      });
      setRampBottom(null);
      setRampCursor(null);
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

  // The live ramp preview (after the bottom click), spanning toward the cursor.
  const rampPreview =
    isRamp && rampBottom && rampCursor
      ? resolveRampPlacement(rampBottom, rampCursor, pieces)
      : null;

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
      {rampPreview && (
        <RampGhost
          position={rampPreview.position}
          base={rampPreview.base}
          rotation={rampPreview.rotation}
          rise={rampPreview.rise}
          run={rampPreview.run}
          width={DEFAULT_RAMP_WIDTH}
          onSurface={rampPreview.onSurface}
        />
      )}
    </group>
  );
}
