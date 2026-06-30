// Material data model — copied verbatim from the old project's src/model/types.ts
// (only the material-system portion; the surrounding 2D-plan-first types — walls,
// floors, levels, roofs, furniture — were intentionally NOT copied).

// Interior patterns + landscape surfaces (grass/water/gravel) for outdoor floor
// regions. All are procedural and OPAQUE — water fakes its look with texture, not
// transparency (real transparency would reawaken the cutaway-hiding bug).
export type PatternId =
  | "checker"
  | "planks"
  | "tile"
  | "stripes"
  | "grass"
  | "water"
  | "gravel";

// Materials are data, never baked into meshes. Reused by future furniture/floor work.
export type MaterialRef =
  | { kind: "solid"; color: string } // hex
  | {
      kind: "pattern";
      pattern: PatternId;
      colorA: string;
      colorB: string;
    };
