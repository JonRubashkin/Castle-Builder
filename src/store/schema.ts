// Schema — the persisted design document and the core of the Zustand store.
// Field names are exactly as specified in CLAUDE.md.
//
// v2 (phase 2Fb) adds the FLAG piece, which embeds its own FlagDesign (the 2Fa
// layer-stack model) so a placed flag always carries its own design and can
// round-trip through Export/Import with the castle. The v1→v2 migration
// (src/persistence/migrations.ts) leaves existing pieces untouched — flags are a
// new, list-compatible kind — and just bumps the version.

import type { FlagDesign } from "../flags/types";
import { DEFAULT_FLAG_ASPECT } from "../flags/types";

export const SCHEMA_VERSION = 2 as const;

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

export interface Flag extends PieceBase {
  kind: "flag";
  // The full FlagDesign travels WITH the piece (the settled embed model): a
  // placed flag always carries its own design, so it never changes underneath
  // the user and Export/Import of a castle carries its flags inline. The design
  // becomes editable in 2Fc; until then placement seeds a default (below).
  design: FlagDesign;
  poleHeight: number; // meters, staff height
  clothWidth: number; // meters (cloth long edge; height derives via design.aspect)
}

export type Piece = Tower | WallRun | Gatehouse | Gate | Ramp | Moat | Flag;

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

// Flag (phase 2Fb). The pole/staff height and the cloth's long edge; the cloth
// height derives from the embedded design's aspect (clothWidth / aspect).
export const DEFAULT_FLAG_POLE_HEIGHT = 6;
export const DEFAULT_FLAG_CLOTH_WIDTH = 2.4;

// The default embedded FlagDesign seeded onto a newly placed flag (there is no
// flag editor until 2Fc). A simple red-over-white bicolor (a per-fess division)
// — plain, recognizable, and enough to see a flag reads correctly. Returns a
// FRESH object each call so every placed flag owns its own design (embed model).
export function createDefaultFlagDesign(): FlagDesign {
  return {
    aspect: DEFAULT_FLAG_ASPECT,
    layers: [
      {
        kind: "field",
        fill: { kind: "division", division: "perFess", colors: ["#c1121f", "#ffffff"] },
      },
    ],
  };
}

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
