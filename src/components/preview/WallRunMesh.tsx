import { useLayoutEffect, useRef, useState } from "react";
import { TransformControls } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { Vec2, WallRun } from "../../store/schema";
import { useStore, type WallEndpoint } from "../../store/store";
import { groundHeightAt } from "../../geometry/ground";
import {
  wallRunCenter,
  wallRunLength,
  wallRunRotationDeg,
} from "../../geometry/wallRunFootprint";
import { buildWallRun } from "../../geometry/wallRunBuilder";
import { wallRunRoof } from "../../geometry/roofs";
import { snapHorizontal } from "../../geometry/grid";
import { snapEndpoint } from "../../geometry/snapEndpoint";
import { PATTERN_TILE_METERS } from "../../materials/patterns";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { isCleanClick } from "./interaction";
import { BoxParts } from "./BoxParts";
import { RoofParts } from "./RoofParts";
import { SnapRing } from "./SnapRing";

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

const HANDLE_TINT = "#f2b705";

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
  // The anchor a dragged endpoint is currently snapping to (drives the snap ring),
  // or null when the endpoint is on the free grid.
  const [dragSnapAnchor, setDragSnapAnchor] = useState<Vec2 | null>(null);

  const tool = useStore((s) => s.tool);
  const selected = useStore((s) => s.selectedId === piece.id);
  const selectPiece = useStore((s) => s.selectPiece);

  // For projecting endpoint-handle drags onto the ground plane.
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  // The default OrbitControls (makeDefault) — disabled while dragging a handle
  // so the drag doesn't also orbit the camera.
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const raycasterRef = useRef(new THREE.Raycaster());
  const handleDragRef = useRef<WallEndpoint | null>(null);

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

  // Roof (schema v3): a posted gabled cover (an open covered wall-walk) with its
  // own material. Empty when unroofed. Coexists with crenellations.
  const roof = wallRunRoof(piece);

  // Tile a pattern across the wall surface at ~PATTERN_TILE_METERS.
  const length = Math.hypot(piece.end.x - piece.position.x, piece.end.y - piece.position.y);
  const around = 2 * (length + piece.thickness);
  const repeat: [number, number] = [
    Math.max(1, Math.round(around / PATTERN_TILE_METERS)),
    Math.max(1, Math.round(piece.height / PATTERN_TILE_METERS)),
  ];

  const material = useThreeMaterial(piece.material, { repeat }, { selected, hovered });
  const roofMaterial = useThreeMaterial(piece.roofMaterial, { repeat: [2, 2] }, { selected, hovered });

  // --- endpoint-handle dragging (Select tool) ---------------------------------
  // Project a screen point onto the wall's base plane (y = baseY); we only use
  // the XZ result. The base plane Y routes through groundHeightAt + base.
  const projectToBasePlane = (clientX: number, clientY: number): Vec2 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycasterRef.current.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -baseY);
    const hit = new THREE.Vector3();
    if (!raycasterRef.current.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x, y: hit.z };
  };

  const onWindowMove = (ev: PointerEvent) => {
    const which = handleDragRef.current;
    if (!which) return;
    const p = projectToBasePlane(ev.clientX, ev.clientY);
    if (!p) return;
    // Reshape live: the endpoint snaps to a nearby piece anchor (else the grid),
    // through the SAME helper the placement path uses. Base re-resolves at the
    // start anchor in the store. The snap ring shows the live anchor.
    const snap = snapEndpoint(p, useStore.getState().design.pieces);
    setDragSnapAnchor(snap.snapped ? snap.point : null);
    useStore.getState().setWallEndpointTransient(piece.id, which, snap.point);
  };

  const onWindowUp = () => {
    if (!handleDragRef.current) return;
    handleDragRef.current = null;
    setDragSnapAnchor(null);
    useStore.getState().commitTransient(); // one undoable step
    window.removeEventListener("pointermove", onWindowMove);
    window.removeEventListener("pointerup", onWindowUp);
    if (controls) controls.enabled = true;
  };

  const startHandleDrag = (which: WallEndpoint, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    handleDragRef.current = which;
    if (controls) controls.enabled = false; // don't orbit while dragging a handle
    useStore.getState().beginTransient();
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
  };

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
  // Endpoint handles render as children of the (rotated) group, so they don't
  // need the mounted ref the gizmo does.
  const showHandles = selected && tool === "select";
  const halfX = wallRunLength(piece) / 2;
  const handleY = piece.height; // sit on the top edge
  const handleRadius = Math.max(0.3, piece.thickness * 0.75);

  return (
    <>
      <group
        ref={groupRef}
        position={[center.x, baseY, center.y]}
        rotation={[0, -deg2rad(rotationDeg), 0]}
      >
        <group onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick}>
          <BoxParts parts={parts} material={material} />
          <RoofParts parts={roof} material={roofMaterial} />
        </group>

        {/* Endpoint handles (the primary editing affordance): a selected wall
            shows a draggable handle at each end. Local +X runs start→end, so
            −halfX is the START handle and +halfX is the END handle. They sit at
            the top edge; dragging projects onto the base plane (XZ only). */}
        {showHandles && (
          <>
            <mesh
              position={[-halfX, handleY, 0]}
              onPointerDown={(e) => startHandleDrag("start", e)}
            >
              <sphereGeometry args={[handleRadius, 16, 16]} />
              <meshStandardMaterial color={HANDLE_TINT} roughness={0.5} />
            </mesh>
            <mesh
              position={[halfX, handleY, 0]}
              onPointerDown={(e) => startHandleDrag("end", e)}
            >
              <sphereGeometry args={[handleRadius, 16, 16]} />
              <meshStandardMaterial color={HANDLE_TINT} roughness={0.5} />
            </mesh>
          </>
        )}
      </group>

      {/* Snap-active affordance for endpoint editing: a ring at the anchor the
          dragged endpoint is snapping to (convenience only — no attachment). It
          lives in world space (a sibling of the rotated group), at the anchor. */}
      {dragSnapAnchor && <SnapRing at={dragSnapAnchor} />}

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
