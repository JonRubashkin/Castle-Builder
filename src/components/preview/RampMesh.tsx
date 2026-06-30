import { useLayoutEffect, useRef, useState } from "react";
import { TransformControls } from "@react-three/drei";
import type { Group } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Ramp } from "../../store/schema";
import { useStore } from "../../store/store";
import { groundHeightAt } from "../../geometry/ground";
import { buildRamp } from "../../geometry/rampBuilder";
import { snapHorizontal } from "../../geometry/grid";
import { PATTERN_TILE_METERS } from "../../materials/patterns";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { isCleanClick } from "./interaction";

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

interface RampMeshProps {
  piece: Ramp;
}

/**
 * The ramp / straight stair — the most genuinely 3D piece (its whole job is
 * connecting two heights). The group seats at the ramp's BOTTOM anchor
 * (piece.position) raised to its support height (groundHeightAt + base — never a
 * literal), rotated about Y; the pure builder lays the inclined slab (or the stair
 * blocks) climbing from the underside along local +Z. The slab's incline is a
 * pitch about local X, so parts render with a per-part rotationX (BoxParts only
 * handles Y, so the mapping is inline here).
 *
 * A ramp is NOT a face-attach target (its top is a slope, not a flat surface) — it
 * can sit ON flat tops, but nothing seats on it (resolveSupportAt excludes it).
 */
export function RampMesh({ piece }: RampMeshProps) {
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

  // A piece seats at the support height under its anchor (ground or, via
  // face-attach at the bottom, a flat piece top), never a hardcoded 0.
  const supportY = groundHeightAt(piece.position.x, piece.position.y);
  const baseY = supportY + piece.base;

  // Tile the pattern across the ramp's run × width surface at ~PATTERN_TILE_METERS.
  const repeat: [number, number] = [
    Math.max(1, Math.round(piece.width / PATTERN_TILE_METERS)),
    Math.max(1, Math.round(piece.run / PATTERN_TILE_METERS)),
  ];

  const material = useThreeMaterial(piece.material, { repeat }, { selected, hovered });

  // The pure builder is the single source of the ramp's geometry parts.
  const parts = buildRamp(piece);

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
        <group onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick}>
          {parts.map((part, i) => (
            <mesh
              key={i}
              position={[part.position.x, part.position.y, part.position.z]}
              rotation={[part.rotationX, 0, 0]}
              castShadow
              receiveShadow
              material={material}
            >
              <boxGeometry args={[part.size.x, part.size.y, part.size.z]} />
            </mesh>
          ))}
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
            // The gizmo moves the group, which sits at the bottom anchor — pass it
            // straight through. The store re-resolves the base via resolveSupportAt
            // (ground, or a flat top under the bottom anchor via face-attach).
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
