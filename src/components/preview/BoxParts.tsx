import type * as THREE from "three";
import type { BoxPart } from "../../geometry/parts";

interface BoxPartsProps {
  parts: BoxPart[];
  material: THREE.Material;
}

/**
 * Shared renderer for the box-composed builders (gatehouse, wall run): maps each
 * pure BoxPart to a mesh. One mapping, used by both pieces, so the part→mesh
 * step is never duplicated. Local part Y comes from the builder (route through
 * the data, not an inline literal).
 */
export function BoxParts({ parts, material }: BoxPartsProps) {
  return (
    <>
      {parts.map((part, i) => (
        <mesh
          key={i}
          position={[part.position.x, part.position.y, part.position.z]}
          rotation={[0, part.rotationY, 0]}
          castShadow
          receiveShadow
          material={material}
        >
          <boxGeometry args={[part.size.x, part.size.y, part.size.z]} />
        </mesh>
      ))}
    </>
  );
}
