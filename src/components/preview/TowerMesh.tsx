import { useLayoutEffect, useRef, useState } from "react";
import { TransformControls } from "@react-three/drei";
import type { Group } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Tower } from "../../store/schema";
import { useStore } from "../../store/store";
import { groundHeightAt } from "../../geometry/ground";
import { towerFootprint } from "../../geometry/towerFootprint";
import { snapHorizontal } from "../../geometry/grid";
import { PATTERN_TILE_METERS } from "../../materials/patterns";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { isCleanClick } from "./interaction";

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

interface TowerMeshProps {
  piece: Tower;
}

export function TowerMesh({ piece }: TowerMeshProps) {
  const groupRef = useRef<Group>(null);
  const draggingRef = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [ready, setReady] = useState(false);

  const tool = useStore((s) => s.tool);
  const selected = useStore((s) => s.selectedId === piece.id);
  const selectPiece = useStore((s) => s.selectPiece);

  // Idempotent: flips false→true exactly once so the gizmo can attach after the
  // group mounts (the group ref is null on the first render).
  useLayoutEffect(() => {
    setReady(true);
  }, []);

  // Footprint is the single source of truth for the tower's horizontal extent.
  const fp = towerFootprint(piece);
  // A piece seats at the support height under its anchor (ground today), never 0.
  const supportY = groundHeightAt(piece.position.x, piece.position.y);
  const baseY = supportY + piece.base;

  // Tile a pattern at ~PATTERN_TILE_METERS across the tower's surface so stones
  // read at a believable size; solids ignore repeat.
  const around =
    piece.profile === "round" ? 2 * Math.PI * fp.radius : fp.radius * 2;
  const repeat: [number, number] = [
    Math.max(1, Math.round(around / PATTERN_TILE_METERS)),
    Math.max(1, Math.round(piece.height / PATTERN_TILE_METERS)),
  ];

  // All rendering flows through the shared MaterialRef→THREE factory, so solids
  // and procedural patterns work for free; selection/hover is a styling pass.
  const material = useThreeMaterial(
    piece.material,
    { repeat },
    { selected, hovered },
  );

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
        position={[piece.position.x, baseY, piece.position.y]}
        rotation={[0, -deg2rad(piece.rotation), 0]}
      >
        <mesh
          position={[0, piece.height / 2, 0]}
          castShadow
          receiveShadow
          material={material}
          onPointerOver={handleOver}
          onPointerOut={handleOut}
          onClick={handleClick}
        >
          {piece.profile === "round" ? (
            <cylinderGeometry args={[fp.radius, fp.radius, piece.height, 48]} />
          ) : (
            <boxGeometry args={[fp.radius * 2, piece.height, fp.radius * 2]} />
          )}
        </mesh>
      </group>

      {showGizmo && (
        <TransformControls
          object={groupRef.current!}
          mode="translate"
          showY={false}
          translationSnap={0.1}
          onMouseDown={() => {
            draggingRef.current = true;
            useStore.getState().beginTransient();
          }}
          onObjectChange={() => {
            if (!draggingRef.current || !groupRef.current) return;
            const p = groupRef.current.position;
            useStore.getState().setPiecePositionTransient(piece.id, {
              x: snapHorizontal(p.x),
              y: snapHorizontal(p.z),
            });
          }}
          onMouseUp={() => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            useStore.getState().commitTransient();
          }}
        />
      )}
    </>
  );
}
