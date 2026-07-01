// A visible <canvas> that draws a FlagDesign via the pure renderFlag. Used by the
// dev QA route to eyeball flags. (The scene-texture path — flagTexture — is a thin
// wrapper over the same renderFlag; the flag piece consumes it in 2Fb.)

import { useEffect, useRef } from "react";
import { renderFlag } from "../renderFlag";
import type { FlagDesign } from "../types";

export function FlagCanvas({
  design,
  height = 200,
}: {
  design: FlagDesign;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (canvas) renderFlag(design, canvas, height);
  }, [design, height]);

  return (
    <canvas
      ref={ref}
      style={{
        height,
        width: "auto",
        border: "1px solid #333",
        borderRadius: 4,
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
        imageRendering: "auto",
      }}
    />
  );
}
