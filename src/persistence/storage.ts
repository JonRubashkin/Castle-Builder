// Client-side autosave + JSON export/import.
//
// Persistence is a single localStorage slot (kept deliberately simple in phase 1).
// Per-origin storage is per-domain and lost if the user clears browser data, so
// Export/Import JSON is the real carry-over/backup path. Every load is validated;
// a future unknown schema version is refused rather than corrupting data.

import type { Design } from "../store/schema";
import type { PlacementMode } from "../geometry/support";
import { type FlagLibrary, sanitizeLibrary } from "../flags/library";
import {
  DesignValidationError,
  parseDesignJSON,
  validateDesign,
} from "./schemaValidation";

const AUTOSAVE_KEY = "castle-builder:autosave";
// The placement-mode toggle is a persisted UI PREFERENCE — NOT part of the
// Design and NOT in undo history. It lives in its own localStorage slot so it
// survives reload independently of the design (the prior project's snapToWall
// pref pattern).
const PLACEMENT_MODE_KEY = "castle-builder:placement-mode";
// The saved-flags library is a SEPARATE per-origin store (named FlagDesigns),
// NOT part of the castle Design and NOT in its Export JSON — so it gets its own
// slot, untouched by autosave / New Castle (exactly like the placement-mode pref).
const FLAG_LIBRARY_KEY = "castle-builder:flag-library";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // storage disabled (e.g. privacy mode)
  }
}

export function saveAutosave(design: Design): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(AUTOSAVE_KEY, JSON.stringify(design));
  } catch (err) {
    console.warn("Autosave failed:", err);
  }
}

/** Load the autosaved design, or null if none / invalid. A refused future
 * version is surfaced as a console warning (not a crash). */
export function loadAutosave(): Design | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    return parseDesignJSON(raw);
  } catch (err) {
    if (err instanceof DesignValidationError) {
      console.warn("Ignoring autosave:", err.message);
    } else {
      console.warn("Ignoring unreadable autosave:", err);
    }
    return null;
  }
}

export function clearAutosave(): void {
  storage()?.removeItem(AUTOSAVE_KEY);
}

// --- Placement-mode preference (persisted, not in the Design) ---------------

const PLACEMENT_MODES: PlacementMode[] = ["normal", "groundOnly"];

/** Persist the placement-mode preference. Failures are non-fatal (privacy mode). */
export function savePlacementMode(mode: PlacementMode): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(PLACEMENT_MODE_KEY, mode);
  } catch (err) {
    console.warn("Saving placement mode failed:", err);
  }
}

/** Load the placement-mode preference, defaulting to "normal" (both toggles off). */
export function loadPlacementMode(): PlacementMode {
  const store = storage();
  if (!store) return "normal";
  const raw = store.getItem(PLACEMENT_MODE_KEY);
  return raw && (PLACEMENT_MODES as string[]).includes(raw)
    ? (raw as PlacementMode)
    : "normal";
}

// --- Saved-flags library (persisted, separate from the Design) --------------

/** Persist the saved-flags library. Failures are non-fatal (privacy mode). */
export function saveFlagLibrary(library: FlagLibrary): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(FLAG_LIBRARY_KEY, JSON.stringify(library));
  } catch (err) {
    console.warn("Saving flag library failed:", err);
  }
}

/** Load the saved-flags library, sanitizing out any malformed entry (a corrupt
 * slot degrades to fewer/no entries rather than crashing); [] if none. */
export function loadFlagLibrary(): FlagLibrary {
  const store = storage();
  if (!store) return [];
  const raw = store.getItem(FLAG_LIBRARY_KEY);
  if (!raw) return [];
  try {
    return sanitizeLibrary(JSON.parse(raw));
  } catch (err) {
    console.warn("Ignoring unreadable flag library:", err);
    return [];
  }
}

// --- Export / Import -------------------------------------------------------

export function designToJSON(design: Design): string {
  return JSON.stringify(design, null, 2);
}

/** Trigger a browser download of the design as a .json file. */
export function downloadDesign(design: Design): void {
  const blob = new Blob([designToJSON(design)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = design.name.trim().replace(/[^\w-]+/g, "_") || "castle";
  a.href = url;
  a.download = `${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Read a File chosen via <input type=file> and validate it into a Design. */
export async function importDesignFile(file: File): Promise<Design> {
  const text = await file.text();
  return parseDesignJSON(text);
}

export { validateDesign, parseDesignJSON, DesignValidationError };
