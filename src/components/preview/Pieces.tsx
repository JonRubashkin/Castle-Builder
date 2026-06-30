import { useStore } from "../../store/store";
import { TowerMesh } from "./TowerMesh";
import { GatehouseMesh } from "./GatehouseMesh";
import { WallRunMesh } from "./WallRunMesh";
import { GateMesh } from "./GateMesh";
import { MoatMesh } from "./MoatMesh";
import { RampMesh } from "./RampMesh";

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
          case "wallRun":
            return <WallRunMesh key={piece.id} piece={piece} />;
          case "gate":
            return <GateMesh key={piece.id} piece={piece} />;
          case "moat":
            return <MoatMesh key={piece.id} piece={piece} />;
          case "ramp":
            return <RampMesh key={piece.id} piece={piece} />;
          default:
            return null;
        }
      })}
    </>
  );
}
