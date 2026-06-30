import { useStore } from "../../store/store";
import { TowerMesh } from "./TowerMesh";

/** Renders every piece in the design. Phase 1a only has towers. */
export function Pieces() {
  const pieces = useStore((s) => s.design.pieces);
  return (
    <>
      {pieces.map((piece) =>
        piece.kind === "tower" ? <TowerMesh key={piece.id} piece={piece} /> : null,
      )}
    </>
  );
}
