// Validating a persisted design on open. A per-design schemaVersion is checked: a
// FUTURE unknown version is REFUSED rather than risking corruption; a malformed
// document is rejected with a readable reason.

import { SCHEMA_VERSION, type Design, type Piece, type Vec2 } from "../store/schema";
import { PATTERN_IDS } from "../materials/patterns";

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
]);

function validateMaterial(value: unknown, index: number): void {
  // Material is optional in the raw document (older saves may predate it); when
  // present it must be a well-formed solid or pattern. Unknown pattern ids are
  // rejected, but the allowlist DERIVES from PATTERN_IDS so additive ids pass.
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    throw new DesignValidationError(`pieces[${index}].material must be an object`);
  }
  if (value.kind === "solid") {
    if (typeof value.color !== "string") {
      throw new DesignValidationError(
        `pieces[${index}].material.color must be a string`,
      );
    }
    return;
  }
  if (value.kind === "pattern") {
    if (typeof value.pattern !== "string" || !PATTERN_ALLOWLIST.has(value.pattern)) {
      throw new DesignValidationError(
        `pieces[${index}].material.pattern is unknown: ${value.pattern}`,
      );
    }
    if (typeof value.colorA !== "string" || typeof value.colorB !== "string") {
      throw new DesignValidationError(
        `pieces[${index}].material pattern needs string colorA/colorB`,
      );
    }
    return;
  }
  throw new DesignValidationError(
    `pieces[${index}].material.kind is unknown: ${value.kind}`,
  );
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
  if (version < SCHEMA_VERSION) {
    throw new DesignValidationError(`Unsupported schema version v${version}`);
  }
  if (typeof data.name !== "string") {
    throw new DesignValidationError("Design.name must be a string");
  }
  if (!Array.isArray(data.pieces)) {
    throw new DesignValidationError("Design.pieces must be an array");
  }
  const pieces = data.pieces.map(validatePiece);
  return { schemaVersion: SCHEMA_VERSION, name: data.name, pieces };
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
