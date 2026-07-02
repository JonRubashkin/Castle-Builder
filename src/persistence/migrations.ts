// Stepwise schema migrations — bring an older persisted design up to the current
// schema version before it is structurally validated (schemaValidation.ts).
//
// Each step is a PURE transform on the raw (already-parsed, not-yet-validated)
// document, keyed by the version it upgrades FROM. Migrations run in sequence, so
// a v1 document can climb to the current version one step at a time as later
// versions are added. A FUTURE unknown version is refused upstream (in
// validateDesign) rather than migrated.

import {
  DEFAULT_ROOF_MATERIAL,
  DEFAULT_ROOF_PITCH,
  SCHEMA_VERSION,
} from "../store/schema";

// The roof-host kinds (schema v3, phase 2H). Only these gain roof fields; gate /
// flag / moat are never roofed. tower / gatehouse also gain `raisedOnPosts`.
const ROOF_HOST_KINDS = new Set(["tower", "gatehouse", "wallRun", "ramp"]);
const POSTED_TOGGLE_KINDS = new Set(["tower", "gatehouse"]);

/** A parsed-but-unvalidated design document (an untyped bag of fields). */
export type RawDesign = Record<string, unknown>;

/**
 * Migrate `data` (whose schemaVersion is `fromVersion`, guaranteed ≤ current) up
 * to the current SCHEMA_VERSION. Returns a new object; the input is not mutated.
 */
export function migrateDesign(data: RawDesign, fromVersion: number): RawDesign {
  let doc = data;
  let version = fromVersion;

  // v1 → v2 (phase 2Fb): the FLAG piece (a new Piece kind embedding a FlagDesign)
  // was added. Existing designs simply have no flags — the `pieces` array is
  // untouched and list-compatible — so the migration only bumps the version.
  if (version === 1) {
    doc = { ...doc, schemaVersion: 2 };
    version = 2;
  }

  // v2 → v3 (phase 2H): ROOF fields added to the roof-host kinds. Existing host
  // pieces get roofed:false (plus the roof-pitch / roof-material defaults, and
  // raisedOnPosts:false for tower/gatehouse) so they load unroofed exactly as
  // before. gate / flag / moat are untouched. A roof is a per-piece render
  // parameter — no new objects, no reconciliation.
  if (version === 2) {
    // Only transform when `pieces` is actually an array; leave a malformed value
    // untouched so the structural validator still rejects it (don't mask errors).
    const migratedPieces = Array.isArray(doc.pieces)
      ? doc.pieces.map((raw) => {
          if (!raw || typeof raw !== "object") return raw;
          const piece = raw as Record<string, unknown>;
          if (!ROOF_HOST_KINDS.has(piece.kind as string)) return piece;
          const withRoof: Record<string, unknown> = {
            ...piece,
            roofed: false,
            roofPitch: DEFAULT_ROOF_PITCH,
            roofMaterial: DEFAULT_ROOF_MATERIAL,
          };
          if (POSTED_TOGGLE_KINDS.has(piece.kind as string)) {
            withRoof.raisedOnPosts = false;
          }
          return withRoof;
        })
      : doc.pieces;
    doc = { ...doc, schemaVersion: 3, pieces: migratedPieces };
    version = 3;
  }

  // (Future steps append here: `if (version === 3) { … version = 4; }`.)

  // Defensive: never hand back a doc claiming a version the app doesn't know.
  if (version !== SCHEMA_VERSION) {
    doc = { ...doc, schemaVersion: SCHEMA_VERSION };
  }
  return doc;
}
