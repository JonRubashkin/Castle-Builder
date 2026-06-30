import { useStore } from "../../store/store";
import { TowerMesh } from "./TowerMesh";
import { GatehouseMesh } from "./GatehouseMesh";

/** Renders every piece in the design. */
export function Pieces() {
  const pieces = useStore((s) => s.design.pieces);
  return (
    <>
      {pieces.map((piece) => {
        switch (piece.kind) {
          case "tower":
            return <TowerMesh key={piece.id} piece={piece} />;
          case "gatehouse":
            return <GatehouseMesh key={piece.id} piece={piece} />;
          default:
            return null;
        }
      })}
    </>
  );
}
