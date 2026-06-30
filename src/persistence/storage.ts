// Client-side autosave + JSON export/import.
//
// Persistence is a single localStorage slot (kept deliberately simple in phase 1).
// Per-origin storage is per-domain and lost if the user clears browser data, so
// Export/Import JSON is the real carry-over/backup path. Every load is validated;
// a future unknown schema version is refused rather than corrupting data.

import type { Design } from "../store/schema";
import {
  DesignValidationError,
  parseDesignJSON,
  validateDesign,
} from "./schemaValidation";

const AUTOSAVE_KEY = "castle-builder:autosave";

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
