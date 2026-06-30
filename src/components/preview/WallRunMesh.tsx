import { useLayoutEffect, useRef, useState } from "react";
import { TransformControls } from "@react-three/drei";
import type { Group } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Vec2, WallRun } from "../../store/schema";
import { useStore } from "../../store/store";
import { groundHeightAt } from "../../geometry/ground";
import {
  wallRunCenter,
  wallRunRotationDeg,
} from "../../geometry/wallRunFootprint";
import { buildWallRun } from "../../geometry/wallRunBuilder";
import { snapHorizontal } from "../../geometry/grid";
import { PATTERN_TILE_METERS } from "../../materials/patterns";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { isCleanClick } from "./interaction";
import { BoxParts } from "./BoxParts";

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

interface WallRunMeshProps {
  piece: WallRun;
}

export function WallRunMesh({ piece }: WallRunMeshProps) {
  const groupRef = useRef<Group>(null);
  const draggingRef = useRef(false);
  // Endpoints captured at the start of a whole-wall gizmo drag, so the delta is
  // measured from a stable origin while the store updates live.
  const dragStartRef = useRef<{ start: Vec2; end: Vec2 } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [ready, setReady] = useState(false);

  const tool = useStore((s) => s.tool);
  const selected = useStore((s) => s.selectedId === piece.id);
  const selectPiece = useStore((s) => s.selectPiece);

  // Idempotent: flips false→true once so the gizmo can attach after mount.
  useLayoutEffect(() => {
    setReady(true);
  }, []);

  // The footprint is the single source of truth for the wall's center +
  // orientation; the builder is the single source of its geometry.
  const center = wallRunCenter(piece);
  const rotationDeg = wallRunRotationDeg(piece);
  // The wall seats at one base height, resolved at its START anchor (never 0).
  const supportY = groundHeightAt(piece.position.x, piece.position.y);
  const baseY = supportY + piece.base;

  const parts = buildWallRun(piece);

  // Tile a pattern across the wall surface at ~PATTERN_TILE_METERS.
  const length = Math.hypot(piece.end.x - piece.position.x, piece.end.y - piece.position.y);
  const around = 2 * (length + piece.thickness);
  const repeat: [number, number] = [
    Math.max(1, Math.round(around / PATTERN_TILE_METERS)),
    Math.max(1, Math.round(piece.height / PATTERN_TILE_METERS)),
  ];

  const material = useThreeMaterial(piece.material, { repeat }, { selected, hovered });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };

  const handleOut = () => {
    setHovered(false);
    document.body.style.cursor = "";
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (tool !== "select") return;
    if (!isCleanClick(e.nativeEvent.clientX, e.nativeEvent.clientY)) return;
    e.stopPropagation();
    selectPiece(piece.id);
  };

  const showGizmo = selected && tool === "select" && ready && groupRef.current;

  return (
    <>
      <group
        ref={groupRef}
        position={[center.x, baseY, center.y]}
        rotation={[0, -deg2rad(rotationDeg), 0]}
      >
        <group onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick}>
          <BoxParts parts={parts} material={material} />
        </group>
      </group>

      {showGizmo && (
        <TransformControls
          object={groupRef.current!}
          mode="translate"
          showY={false}
          translationSnap={0.1}
          onMouseDown={() => {
            draggingRef.current = true;
            dragStartRef.current = { start: { ...piece.position }, end: { ...piece.end } };
            useStore.getState().beginTransient();
          }}
          onObjectChange={() => {
            if (!draggingRef.current || !groupRef.current || !dragStartRef.current) return;
            // The gizmo moves the group (the wall's midpoint). Translate that
            // delta into a new START anchor; the store shifts BOTH endpoints by
            // the same delta and re-resolves the base at the start anchor.
            const p = groupRef.current.position;
            const mid0 = {
              x: (dragStartRef.current.start.x + dragStartRef.current.end.x) / 2,
              y: (dragStartRef.current.start.y + dragStartRef.current.end.y) / 2,
            };
            const dx = snapHorizontal(p.x) - mid0.x;
            const dy = snapHorizontal(p.z) - mid0.y;
            useStore.getState().setPiecePositionTransient(piece.id, {
              x: dragStartRef.current.start.x + dx,
              y: dragStartRef.current.start.y + dy,
            });
          }}
          onMouseUp={() => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            dragStartRef.current = null;
            useStore.getState().commitTransient();
          }}
        />
      )}
    </>
  );
}
