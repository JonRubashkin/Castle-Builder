import { useLayoutEffect, useRef, useState } from "react";
import { TransformControls } from "@react-three/drei";
import type { Group } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Moat } from "../../store/schema";
import { useStore } from "../../store/store";
import { groundHeightAt } from "../../geometry/ground";
import { moatSegmentCenter, moatSegmentRotationDeg } from "../../geometry/moatFootprint";
import { buildMoat } from "../../geometry/moatBuilder";
import { snapHorizontal } from "../../geometry/grid";
import { PATTERN_TILE_METERS } from "../../materials/patterns";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { isCleanClick } from "./interaction";
import { WATER_LAYER } from "./stacking";

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

interface MoatMeshProps {
  piece: Moat;
}

/**
 * The moat: a flat OPAQUE-water sheet (a ring annulus or a straight strip) lying
 * at the ground. Its material is the water pattern through the shared factory —
 * always opaque (sheen + texture, never alpha). It is GROUND-ONLY: it seats at
 * groundHeightAt + base (base is always the ground-relative 0), plus the WATER
 * stacking layer so it never z-fights the ground. The inner mesh is rotated flat
 * and carries no position, so the ground-seam guard sees no literal Y.
 */
export function MoatMesh({ piece }: MoatMeshProps) {
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

  const geo = buildMoat(piece);
  // A ring is centered on its anchor; a segment on the midpoint of its endpoints.
  const center = piece.shape === "segment" ? moatSegmentCenter(piece) : piece.position;
  const rotationDeg = piece.shape === "segment" ? moatSegmentRotationDeg(piece) : 0;

  // Ground-only seating: groundHeightAt + base (the ground-relative 0), lifted to
  // the WATER stacking layer. Routes through groundHeightAt — never a literal.
  const waterY = groundHeightAt(piece.position.x, piece.position.y) + piece.base + WATER_LAYER;

  // Tile the rippled water across the surface at ~PATTERN_TILE_METERS.
  const span =
    geo.shape === "ring" ? geo.outerRadius * 2 : Math.max(geo.length, geo.width);
  const tiles = Math.max(1, Math.round(span / PATTERN_TILE_METERS));
  const repeat: [number, number] = [tiles, tiles];

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
        position={[center.x, waterY, center.y]}
        rotation={[0, -deg2rad(rotationDeg), 0]}
      >
        {/* The flat sheet: a ring annulus or a plane strip, rotated to lie in the
            group's XZ plane. No position prop → stays at the group origin (so the
            ground-seam guard sees no inline literal Y). */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          material={material}
          onPointerOver={handleOver}
          onPointerOut={handleOut}
          onClick={handleClick}
        >
          {geo.shape === "ring" ? (
            <ringGeometry args={[geo.innerRadius, geo.outerRadius, geo.segments]} />
          ) : (
            <planeGeometry args={[geo.length, geo.width]} />
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
            // The gizmo moves the group center. For a ring that IS the anchor; for
            // a segment the store shifts both endpoints by the same delta. We pass
            // the new START anchor either way.
            if (piece.shape === "segment") {
              const c0 = moatSegmentCenter(piece);
              const dx = snapHorizontal(p.x) - c0.x;
              const dy = snapHorizontal(p.z) - c0.y;
              useStore.getState().setPiecePositionTransient(piece.id, {
                x: piece.position.x + dx,
                y: piece.position.y + dy,
              });
            } else {
              useStore.getState().setPiecePositionTransient(piece.id, {
                x: snapHorizontal(p.x),
                y: snapHorizontal(p.z),
              });
            }
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
