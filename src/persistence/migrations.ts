// Stepwise schema migrations — bring an older persisted design up to the current
// schema version before it is structurally validated (schemaValidation.ts).
//
// Each step is a PURE transform on the raw (already-parsed, not-yet-validated)
// document, keyed by the version it upgrades FROM. Migrations run in sequence, so
// a v1 document can climb to the current version one step at a time as later
// versions are added. A FUTURE unknown version is refused upstream (in
// validateDesign) rather than migrated.

import { SCHEMA_VERSION } from "../store/schema";

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

  // (Future steps append here: `if (version === 2) { … version = 3; }`.)

  // Defensive: never hand back a doc claiming a version the app doesn't know.
  if (version !== SCHEMA_VERSION) {
    doc = { ...doc, schemaVersion: SCHEMA_VERSION };
  }
  return doc;
}
