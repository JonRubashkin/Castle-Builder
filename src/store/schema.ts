// Schema v1 — the persisted design document and the core of the Zustand store.
// Field names are exactly as specified in CLAUDE.md. Phase 1 only: the full Piece
// union is declared (so the data model does not block later phases), but only the
// Tower variant is exercised this phase.

export const SCHEMA_VERSION = 1 as const;

export interface Vec2 {
  x: number;
  y: number;
} // a world XZ pair (y holds Z)

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Materials are data, never baked into meshes. Carried over verbatim from the
// prior project's material system. (Phase 1b wires these up; declared now so the
// schema is stable.)
export type MaterialRef =
  | { kind: "solid"; color: string } // hex
  | { kind: "pattern"; pattern: PatternId; colorA: string; colorB: string };

export type PatternId = "stone" | "brick" | "thatch" | "water"; // additive

export interface PieceBase {
  id: string;
  position: Vec2; // anchor in world XZ (grid-snapped, 0.1 m)
  base: number; // world Y of the piece's underside. Seated via groundHeightAt
  // or a surface top — NEVER hardcode 0.
  rotation: number; // degrees about world Y, snapped to 15° steps
}

export interface Tower extends PieceBase {
  kind: "tower";
  profile: "round" | "square";
  radius: number; // meters (round); half-extent for square
  height: number; // meters
  crenellated: boolean; // battlements toggle
  merlonSize: number; // tooth size, meters (used when crenellated)
  material: MaterialRef; // default a stone solid
}

export interface WallRun extends PieceBase {
  kind: "wallRun";
  end: Vec2;
  height: number;
  thickness: number;
  crenellated: boolean;
  merlonSize: number;
  material: MaterialRef;
}

export interface Gatehouse extends PieceBase {
  kind: "gatehouse";
  width: number;
  depth: number;
  height: number;
  crenellated: boolean;
  merlonSize: number;
  material: MaterialRef;
}

export interface Gate extends PieceBase {
  kind: "gate";
  width: number;
  height: number;
  material: MaterialRef;
}

export interface Ramp extends PieceBase {
  kind: "ramp";
  rise: number;
  run: number;
  width: number;
  style: "ramp" | "stair";
  material: MaterialRef;
}

export interface Moat extends PieceBase {
  kind: "moat";
  shape: "ring" | "segment";
  outerRadius?: number;
  innerRadius?: number;
  end?: Vec2;
  width?: number;
  material: MaterialRef;
}

export type Piece = Tower | WallRun | Gatehouse | Gate | Ramp | Moat;

export interface Design {
  schemaVersion: typeof SCHEMA_VERSION;
  name: string;
  pieces: Piece[];
}

// ---------------------------------------------------------------------------
// Defaults (CLAUDE.md starting values; tune for looks as pieces are built).
// ---------------------------------------------------------------------------

export const DEFAULT_TOWER_HEIGHT = 8;
export const DEFAULT_TOWER_RADIUS = 2;
export const DEFAULT_MERLON_SIZE = 0.6;

export const DEFAULT_WALL_HEIGHT = 4;
export const DEFAULT_WALL_THICKNESS = 0.6;

export const DEFAULT_GATEHOUSE_WIDTH = 6;
export const DEFAULT_GATEHOUSE_DEPTH = 4;
export const DEFAULT_GATEHOUSE_HEIGHT = 6;

export const DEFAULT_GATE_WIDTH = 2.4;
export const DEFAULT_GATE_HEIGHT = 3.2;

// Ramp / stair. Used for the empty-top fallback (a default ramp from the bottom
// anchor that the user then tunes) and the connection's default width/style; the
// rise/run of a real connection are COMPUTED to span the two clicked points.
export const DEFAULT_RAMP_RISE = 4;
export const DEFAULT_RAMP_RUN = 6;
export const DEFAULT_RAMP_WIDTH = 2;

// Moat (opaque water). Ring: outer/inner radii about the anchor. Segment: a
// straight strip of `width`. These are starting values, tuned for looks.
export const DEFAULT_MOAT_OUTER_RADIUS = 9;
export const DEFAULT_MOAT_INNER_RADIUS = 6;
export const DEFAULT_MOAT_WIDTH = 3;

export const DEFAULT_STONE_MATERIAL: MaterialRef = {
  kind: "solid",
  color: "#9a958c",
};

export const DEFAULT_TIMBER_MATERIAL: MaterialRef = {
  kind: "solid",
  color: "#6b4a2b",
};

// OPAQUE water (never real transparency): a rippled two-tone water pattern. Its
// watery read is texture + a slight sheen in materialRefToThreeMaterial, not alpha.
export const DEFAULT_WATER_MATERIAL: MaterialRef = {
  kind: "pattern",
  pattern: "water",
  colorA: "#2f6f9f",
  colorB: "#1b4a6b",
};

export function createEmptyDesign(name = "Untitled Castle"): Design {
  return { schemaVersion: SCHEMA_VERSION, name, pieces: [] };
}
