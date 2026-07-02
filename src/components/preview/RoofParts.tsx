import type * as THREE from "three";
import type { RoofPart } from "../../geometry/roofs";

interface RoofPartsProps {
  parts: RoofPart[];
  material: THREE.Material;
}

/**
 * Shared renderer for roof parts (schema v3, phase 2H): maps each pure RoofPart to
 * a mesh, exactly as BoxParts does for wall parts. One mapping, used by every
 * roof-host mesh (tower / gatehouse / wall run / ramp), so the part→mesh step is
 * never duplicated. All positions come from the pure roofs.ts helper (route
 * through the data, never an inline literal Y).
 *
 *   • cone    → a ConeGeometry (round tower).
 *   • pyramid → a 4-sided ConeGeometry rotated 45° so its flat faces align to X/Z,
 *               then scaled so the square base becomes width × depth (rectangular
 *               pyramid) — composed from a primitive, no custom geometry.
 *   • slope   → a box pitched about local X (a gable side, or the ramp cover).
 *   • post    → a box (a support post).
 */
export function RoofParts({ parts, material }: RoofPartsProps) {
  return (
    <>
      {parts.map((part, i) => {
        const pos: [number, number, number] = [
          part.position.x,
          part.position.y,
          part.position.z,
        ];
        if (part.role === "cone") {
          return (
            <mesh key={i} position={pos} castShadow receiveShadow material={material}>
              <coneGeometry args={[part.radius, part.height, part.radialSegments]} />
            </mesh>
          );
        }
        if (part.role === "pyramid") {
          return (
            <mesh
              key={i}
              position={pos}
              rotation={[0, Math.PI / 4, 0]}
              scale={[part.halfX * Math.SQRT2, 1, part.halfZ * Math.SQRT2]}
              castShadow
              receiveShadow
              material={material}
            >
              <coneGeometry args={[1, part.height, 4]} />
            </mesh>
          );
        }
        // slope + post are both boxes; the slope carries a pitch about local X.
        const rotation: [number, number, number] =
          part.role === "slope" ? [part.rotationX, 0, 0] : [0, 0, 0];
        return (
          <mesh
            key={i}
            position={pos}
            rotation={rotation}
            castShadow
            receiveShadow
            material={material}
          >
            <boxGeometry args={[part.size.x, part.size.y, part.size.z]} />
          </mesh>
        );
      })}
    </>
  );
}
