import { useLayoutEffect, useRef, useState } from "react";
import { TransformControls } from "@react-three/drei";
import type { Group } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Gatehouse } from "../../store/schema";
import { useStore } from "../../store/store";
import { groundHeightAt } from "../../geometry/ground";
import { gatehouseFootprint } from "../../geometry/gatehouseFootprint";
import { buildGatehouse } from "../../geometry/gatehouseBuilder";
import { snapHorizontal } from "../../geometry/grid";
import { PATTERN_TILE_METERS } from "../../materials/patterns";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { isCleanClick } from "./interaction";
import { BoxParts } from "./BoxParts";

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

interface GatehouseMeshProps {
  piece: Gatehouse;
}

export function GatehouseMesh({ piece }: GatehouseMeshProps) {
  const groupRef = useRef<Group>(null);
  const draggingRef = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [ready, setReady] = useState(false);

  const tool = useStore((s) => s.tool);
  const selected = useStore((s) => s.selectedId === piece.id);
  const selectPiece = useStore((s) => s.selectPiece);

  // Idempotent: flips false→true once so the gizmo can attach after mount.
  useLayoutEffect(() => {
    setReady(true);
  }, []);

  // Footprint is the single source of truth for the gatehouse's extent + center.
  const fp = gatehouseFootprint(piece);
  // A piece seats at the support height under its anchor (ground today), never 0.
  const supportY = groundHeightAt(piece.position.x, piece.position.y);
  const baseY = supportY + piece.base;

  // Tile a pattern at ~PATTERN_TILE_METERS across the surface.
  const around = 2 * (piece.width + piece.depth);
  const repeat: [number, number] = [
    Math.max(1, Math.round(around / PATTERN_TILE_METERS)),
    Math.max(1, Math.round(piece.height / PATTERN_TILE_METERS)),
  ];

  const material = useThreeMaterial(piece.material, { repeat }, { selected, hovered });

  // The pure builder is the single source of the gatehouse's geometry parts.
  const parts = buildGatehouse(piece);

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
    // While the one-shot "Place on top" is armed, a click on a piece TARGETS it
    // (seat the selected piece on this one) instead of selecting it. An invalid
    // target (a moat / a ramp) is a no-op that stays armed; clicking self cancels.
    const store = useStore.getState();
    if (store.placeOnTopArmed) {
      store.placeOnTopTarget(piece.id);
      return;
    }
    selectPiece(piece.id);
  };

  const showGizmo = selected && tool === "select" && ready && groupRef.current;

  return (
    <>
      <group
        ref={groupRef}
        position={[fp.center.x, baseY, fp.center.y]}
        rotation={[0, -deg2rad(piece.rotation), 0]}
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
