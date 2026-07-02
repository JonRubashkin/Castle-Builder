// Validating a persisted design on open. A per-design schemaVersion is checked: a
// FUTURE unknown version is REFUSED rather than risking corruption; a malformed
// document is rejected with a readable reason.

import { SCHEMA_VERSION, type Design, type Piece, type Vec2 } from "../store/schema";
import { PATTERN_IDS } from "../materials/patterns";
import { migrateDesign } from "./migrations";

// The importer's pattern allowlist DERIVES from the runtime id list, so adding a
// new PatternId never causes a previously-saved/exported design to be rejected.
const PATTERN_ALLOWLIST = new Set<string>(PATTERN_IDS);

export class DesignValidationError extends Error {
  /** True when the document is from a newer, unknown schema version. */
  readonly futureVersion: boolean;
  constructor(message: string, futureVersion = false) {
    super(message);
    this.name = "DesignValidationError";
    this.futureVersion = futureVersion;
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isVec2(v: unknown): v is Vec2 {
  return isPlainObject(v) && typeof v.x === "number" && typeof v.y === "number";
}

const KNOWN_KINDS = new Set([
  "tower",
  "wallRun",
  "gatehouse",
  "gate",
  "ramp",
  "moat",
  "flag",
]);

// A flag piece embeds a full FlagDesign (the 2Fa layer stack). Validate its shape
// structurally — a plain object with a numeric aspect and an array of layers, each
// a known layer kind — so a corrupt document is rejected while a well-formed flag
// (including future additive symbol ids) round-trips. Deep per-layer validation is
// out of scope for 2Fb (the renderer owns layer semantics).
const FLAG_LAYER_KINDS = new Set(["field", "stripes", "charge"]);

function validateFlagDesign(value: unknown, index: number): void {
  if (!isPlainObject(value)) {
    throw new DesignValidationError(`pieces[${index}].design must be an object`);
  }
  if (typeof value.aspect !== "number") {
    throw new DesignValidationError(
      `pieces[${index}].design.aspect must be a number`,
    );
  }
  if (!Array.isArray(value.layers)) {
    throw new DesignValidationError(
      `pieces[${index}].design.layers must be an array`,
    );
  }
  value.layers.forEach((layer, li) => {
    if (
      !isPlainObject(layer) ||
      typeof layer.kind !== "string" ||
      !FLAG_LAYER_KINDS.has(layer.kind)
    ) {
      throw new DesignValidationError(
        `pieces[${index}].design.layers[${li}].kind is unknown`,
      );
    }
  });
}

function validateMaterial(value: unknown, index: number, field = "material"): void {
  // Material is optional in the raw document (older saves may predate it); when
  // present it must be a well-formed solid or pattern. Unknown pattern ids are
  // rejected, but the allowlist DERIVES from PATTERN_IDS so additive ids pass.
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    throw new DesignValidationError(`pieces[${index}].${field} must be an object`);
  }
  if (value.kind === "solid") {
    if (typeof value.color !== "string") {
      throw new DesignValidationError(
        `pieces[${index}].${field}.color must be a string`,
      );
    }
    return;
  }
  if (value.kind === "pattern") {
    if (typeof value.pattern !== "string" || !PATTERN_ALLOWLIST.has(value.pattern)) {
      throw new DesignValidationError(
        `pieces[${index}].${field}.pattern is unknown: ${value.pattern}`,
      );
    }
    if (typeof value.colorA !== "string" || typeof value.colorB !== "string") {
      throw new DesignValidationError(
        `pieces[${index}].${field} pattern needs string colorA/colorB`,
      );
    }
    return;
  }
  throw new DesignValidationError(
    `pieces[${index}].${field}.kind is unknown: ${value.kind}`,
  );
}

// The roof-host kinds (schema v3, phase 2H). Only these carry roof fields; the
// v2→v3 migration guarantees an older host piece has them by the time this runs.
const ROOF_HOST_KINDS = new Set(["tower", "gatehouse", "wallRun", "ramp"]);
const POSTED_TOGGLE_KINDS = new Set(["tower", "gatehouse"]);

/** Validate the roof fields on a roof-host piece (present since the v3 migration). */
function validateRoofFields(value: Record<string, unknown>, index: number): void {
  if (typeof value.roofed !== "boolean") {
    throw new DesignValidationError(`pieces[${index}].roofed must be a boolean`);
  }
  if (typeof value.roofPitch !== "number") {
    throw new DesignValidationError(`pieces[${index}].roofPitch must be a number`);
  }
  if (value.roofMaterial === undefined) {
    throw new DesignValidationError(`pieces[${index}].roofMaterial is required`);
  }
  validateMaterial(value.roofMaterial, index, "roofMaterial");
  if (POSTED_TOGGLE_KINDS.has(value.kind as string) && typeof value.raisedOnPosts !== "boolean") {
    throw new DesignValidationError(`pieces[${index}].raisedOnPosts must be a boolean`);
  }
}

function validatePiece(value: unknown, index: number): Piece {
  if (!isPlainObject(value)) {
    throw new DesignValidationError(`pieces[${index}] is not an object`);
  }
  if (typeof value.id !== "string") {
    throw new DesignValidationError(`pieces[${index}].id must be a string`);
  }
  if (typeof value.kind !== "string" || !KNOWN_KINDS.has(value.kind)) {
    throw new DesignValidationError(`pieces[${index}].kind is unknown: ${value.kind}`);
  }
  if (!isVec2(value.position)) {
    throw new DesignValidationError(`pieces[${index}].position must be {x,y}`);
  }
  if (typeof value.base !== "number") {
    throw new DesignValidationError(`pieces[${index}].base must be a number`);
  }
  if (typeof value.rotation !== "number") {
    throw new DesignValidationError(`pieces[${index}].rotation must be a number`);
  }
  validateMaterial(value.material, index);
  // Roof fields (schema v3): required on the roof-host kinds (the v2→v3 migration
  // adds them to older host pieces before this validation runs).
  if (ROOF_HOST_KINDS.has(value.kind)) {
    validateRoofFields(value, index);
  }
  // Flag-specific fields: the embedded FlagDesign plus the pole/cloth dimensions.
  if (value.kind === "flag") {
    if (typeof value.poleHeight !== "number") {
      throw new DesignValidationError(`pieces[${index}].poleHeight must be a number`);
    }
    if (typeof value.clothWidth !== "number") {
      throw new DesignValidationError(`pieces[${index}].clothWidth must be a number`);
    }
    // Auto-placement provenance marker (2Fe.1): optional; when present it must be a
    // string. Additive within v2 (no version bump) — old saves simply omit it.
    if (value.autoFlagHostId !== undefined && typeof value.autoFlagHostId !== "string") {
      throw new DesignValidationError(
        `pieces[${index}].autoFlagHostId must be a string when present`,
      );
    }
    validateFlagDesign(value.design, index);
  }
  return value as unknown as Piece;
}

/**
 * Validate an unknown value as a schema-v1 Design. Throws DesignValidationError
 * on any problem; refuses (with futureVersion=true) a newer schema version.
 */
export function validateDesign(data: unknown): Design {
  if (!isPlainObject(data)) {
    throw new DesignValidationError("Design must be an object");
  }
  const version = data.schemaVersion;
  if (typeof version !== "number") {
    throw new DesignValidationError("Missing schemaVersion");
  }
  if (version > SCHEMA_VERSION) {
    throw new DesignValidationError(
      `This design was made with a newer version (schema v${version}). ` +
        `This app understands up to v${SCHEMA_VERSION}. Refusing to open it to ` +
        `avoid corrupting your data.`,
      true,
    );
  }
  if (version < 1) {
    throw new DesignValidationError(`Unsupported schema version v${version}`);
  }
  // Bring an older (but known) document up to the current schema before validating
  // its structure — a pure transform on the raw doc (migrations.ts). v1 → v2 only
  // bumps the version (flags are additive), so the fields below read the same.
  const migrated =
    version < SCHEMA_VERSION ? migrateDesign(data, version) : data;
  if (typeof migrated.name !== "string") {
    throw new DesignValidationError("Design.name must be a string");
  }
  if (!Array.isArray(migrated.pieces)) {
    throw new DesignValidationError("Design.pieces must be an array");
  }
  const pieces = migrated.pieces.map(validatePiece);
  return { schemaVersion: SCHEMA_VERSION, name: migrated.name, pieces };
}

/** Parse + validate a JSON string into a Design. */
export function parseDesignJSON(json: string): Design {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new DesignValidationError("File is not valid JSON");
  }
  return validateDesign(data);
}
