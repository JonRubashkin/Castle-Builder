// Phase 2Fd — the saved-flags library (pure CRUD).
//
// A per-origin collection of NAMED FlagDesigns, saved from the flag editor and
// reused across flags and castles. It is deliberately SEPARATE from the castle
// `Design`: it is NOT a piece, NOT part of the castle Export JSON, and untouched
// by `newDesign` (New Castle) — mirroring the prior project's design↔library
// separation (and this project's Keep-on-ground pref, another "separate from the
// Design" store).
//
// The CRUD here is PURE: every function takes a library value and returns a NEW
// library (never mutating the input), deep-cloning designs on the way IN so a
// saved entry can't share a reference with the live working copy — applying a
// library design COPIES it (no live link), and saving COPIES it (the flag keeps
// its own embedded design). Persistence (its own localStorage slot) lives in
// `src/persistence/storage.ts`; this module is storage-agnostic and unit-tested.

import type { FlagDesign } from "./types";

export interface FlagLibraryEntry {
  id: string;
  name: string;
  design: FlagDesign; // an OWNED copy — never shared with a placed flag / working copy
  createdAt: number; // epoch ms
  modifiedAt: number; // epoch ms
}

export type FlagLibrary = FlagLibraryEntry[];

// Id generation for new entries. Kept module-local (like the store's nextId) so
// callers don't have to thread it; tests may override via the `id` option for
// determinism.
let idCounter = 0;
function nextEntryId(): string {
  idCounter += 1;
  return `flag-${Date.now().toString(36)}-${idCounter}`;
}

/** Deep-clone a design so a stored/applied copy shares no reference with its source. */
export function cloneDesign(design: FlagDesign): FlagDesign {
  return structuredClone(design);
}

/** List entries (a shallow copy of the array; entries themselves are untouched). */
export function listEntries(library: FlagLibrary): FlagLibrary {
  return library.slice();
}

/** Get one entry by id, or undefined. */
export function getEntry(
  library: FlagLibrary,
  id: string,
): FlagLibraryEntry | undefined {
  return library.find((e) => e.id === id);
}

/**
 * Save a NEW named entry. Returns the new library plus the created entry (so the
 * caller can record its id as the working design's source). The name is trimmed;
 * an empty name falls back to "Untitled flag". The design is deep-cloned in.
 */
export function saveNewEntry(
  library: FlagLibrary,
  name: string,
  design: FlagDesign,
  opts: { id?: string; now?: number } = {},
): { library: FlagLibrary; entry: FlagLibraryEntry } {
  const now = opts.now ?? Date.now();
  const entry: FlagLibraryEntry = {
    id: opts.id ?? nextEntryId(),
    name: name.trim() || "Untitled flag",
    design: cloneDesign(design),
    createdAt: now,
    modifiedAt: now,
  };
  return { library: [...library, entry], entry };
}

/**
 * Overwrite an existing entry's DESIGN in place (by id), bumping modifiedAt. The
 * name and createdAt are preserved. If the id is unknown the library is returned
 * unchanged. The design is deep-cloned in. Overwriting is always an EXPLICIT act
 * (the caller offers it as a distinct choice) — never a silent clobber.
 */
export function overwriteEntry(
  library: FlagLibrary,
  id: string,
  design: FlagDesign,
  opts: { now?: number } = {},
): FlagLibrary {
  const now = opts.now ?? Date.now();
  return library.map((e) =>
    e.id === id ? { ...e, design: cloneDesign(design), modifiedAt: now } : e,
  );
}

/** Rename an entry (by id), bumping modifiedAt. Unknown id → unchanged. */
export function renameEntry(
  library: FlagLibrary,
  id: string,
  name: string,
  opts: { now?: number } = {},
): FlagLibrary {
  const now = opts.now ?? Date.now();
  return library.map((e) =>
    e.id === id ? { ...e, name: name.trim() || e.name, modifiedAt: now } : e,
  );
}

/** Delete an entry (by id). Unknown id → unchanged. */
export function deleteEntry(library: FlagLibrary, id: string): FlagLibrary {
  return library.filter((e) => e.id !== id);
}

// --- validation (for load / import) -----------------------------------------

// Structurally validate a FlagDesign the same shallow way the castle importer
// does (a plain object with a numeric aspect + an array of known-kind layers) —
// so a corrupt slot is rejected while a well-formed design (including future
// additive symbol ids) round-trips. Deep layer semantics belong to the renderer.
const FLAG_LAYER_KINDS = new Set(["field", "stripes", "charge"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidFlagDesign(value: unknown): value is FlagDesign {
  if (!isPlainObject(value)) return false;
  if (typeof value.aspect !== "number") return false;
  if (!Array.isArray(value.layers)) return false;
  return value.layers.every(
    (l) =>
      isPlainObject(l) &&
      typeof l.kind === "string" &&
      FLAG_LAYER_KINDS.has(l.kind),
  );
}

/** True if `value` is a well-formed library entry. */
export function isValidEntry(value: unknown): value is FlagLibraryEntry {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "number" &&
    typeof value.modifiedAt === "number" &&
    isValidFlagDesign(value.design)
  );
}

/**
 * Coerce unknown parsed JSON into a valid FlagLibrary, dropping any malformed
 * entry (a lenient load never crashes — a corrupt slot degrades to fewer/no
 * entries rather than throwing). Non-array input yields an empty library.
 */
export function sanitizeLibrary(value: unknown): FlagLibrary {
  if (!Array.isArray(value)) return [];
  return value.filter(isValidEntry);
}

// --- library-only Export / Import (its own JSON) ----------------------------
//
// The library does NOT ride along in a castle export, so it gets its own small
// JSON backup path — the way to move the palette between browsers. It is a plain
// array of entries; import sanitizes (dropping malformed entries) rather than
// refusing the whole file.

export function flagLibraryToJSON(library: FlagLibrary): string {
  return JSON.stringify(library, null, 2);
}

export function parseFlagLibraryJSON(text: string): FlagLibrary {
  return sanitizeLibrary(JSON.parse(text));
}
