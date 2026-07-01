import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TransformControls } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { DEFAULT_TIMBER_MATERIAL, type Flag } from "../../store/schema";
import { useStore } from "../../store/store";
import { groundHeightAt } from "../../geometry/ground";
import { buildFlag, POLE_RADIAL_SEGMENTS } from "../../geometry/flagBuilder";
import { snapHorizontal } from "../../geometry/grid";
import { flagTexture } from "../../flags/flagTexture";
import { applyMaterialStyle, useThreeMaterial } from "../../materials/threeMaterial";
import { isCleanClick } from "./interaction";

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

// Cloth mesh detail: a few width segments give a gentle STATIC curve so the cloth
// doesn't read as flat cardboard (no animation — waving is deferred). The wave is
// a render-only touch; the pure builder returns a flat rectangle.
const CLOTH_WIDTH_SEGMENTS = 12;
const CLOTH_WAVE_AMPLITUDE = 0.12; // meters of z-displacement toward the free edge

interface FlagMeshProps {
  piece: Flag;
}

/**
 * The flag piece — a pole/staff + a cloth skinned by the 2Fa renderFlag texture
 * of the piece's EMBEDDED design (the design travels with the piece). The group
 * seats at the flag's support height (groundHeightAt + base — never a literal) at
 * `position`, rotated about Y; the pure builder lays out the pole and cloth.
 *
 * A flag is NOT a face-attach target (its top is a pole/cloth, not a flat
 * surface) — nothing stacks on it (resolveSupportAt / flatTopWorldY exclude it).
 */
export function FlagMesh({ piece }: FlagMeshProps) {
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
  // face-attach, a piece top), never a hardcoded 0.
  const supportY = groundHeightAt(piece.position.x, piece.position.y);
  const baseY = supportY + piece.base;

  // The pure builder is the single source of the flag's pole + cloth geometry.
  const { pole, cloth } = buildFlag(piece);

  // The pole uses a simple timber solid (a wooden staff); it flows through the
  // shared MaterialRef→THREE factory so selection/hover highlighting works too.
  const poleMaterial = useThreeMaterial(
    DEFAULT_TIMBER_MATERIAL,
    {},
    { selected, hovered },
  );

  // The cloth is a flat rectangle given a subtle static curve (a gentle wave that
  // deepens toward the free edge). Its UVs (planeGeometry's default 0..1) map the
  // flag texture across the cloth; the plane spans local X (width) and Y (height).
  const clothGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      cloth.width,
      cloth.height,
      CLOTH_WIDTH_SEGMENTS,
      1,
    );
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i); // −width/2 (hoist) .. +width/2 (free edge)
      const u = (x + cloth.width / 2) / cloth.width; // 0 at pole, 1 at free edge
      posAttr.setZ(i, Math.sin(u * Math.PI * 2) * CLOTH_WAVE_AMPLITUDE * u);
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [cloth.width, cloth.height]);

  useEffect(() => () => clothGeometry.dispose(), [clothGeometry]);

  // The cloth's texture is the renderFlag raster of the EMBEDDED design, routed
  // through the shared canvas→texture path (flagTexture). It is OPAQUE and
  // double-sided so the flag reads from both sides as the camera orbits. Rebuilt
  // (and the old one disposed) only when the embedded design changes.
  const designKey = useMemo(() => JSON.stringify(piece.design), [piece.design]);
  const clothMaterial = useMemo(() => {
    const texture = flagTexture(piece.design);
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designKey]);

  useEffect(
    () => () => {
      clothMaterial.map?.dispose();
      clothMaterial.dispose();
    },
    [clothMaterial],
  );

  // Selection/hover echo on the cloth (the pole gets it via useThreeMaterial).
  applyMaterialStyle(clothMaterial, { selected, hovered });

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
    // (seat the selected piece on this one) instead of selecting it. A flag is an
    // invalid target (no flat top) → a no-op that stays armed; clicking self cancels.
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
        position={[piece.position.x, baseY, piece.position.y]}
        rotation={[0, -deg2rad(piece.rotation), 0]}
      >
        {/* Pointer handlers on the inner group catch hits on the pole or cloth, so
            the whole flag picks as one piece. */}
        <group onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick}>
          <mesh
            position={[pole.position.x, pole.position.y, pole.position.z]}
            castShadow
            receiveShadow
            material={poleMaterial}
          >
            <cylinderGeometry
              args={[pole.radius, pole.radius, pole.height, POLE_RADIAL_SEGMENTS]}
            />
          </mesh>
          <mesh
            position={[cloth.position.x, cloth.position.y, cloth.position.z]}
            geometry={clothGeometry}
            material={clothMaterial}
            castShadow
          />
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
