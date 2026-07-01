// The single source of truth for the browser-storage disclosure copy.
//
// Everything persisted by this app is per-origin browser storage (localStorage):
// the castle autosave, the placement-mode pref, AND the saved-flags library
// (2Fd) — all lost if the user clears browser data. This one string is reused
// wherever the disclosure is shown, so the wording never drifts into scattered
// copies.
export const STORAGE_DISCLOSURE =
  "Your work autosaves in this browser only — the castle and your saved-flags " +
  "library both live in this browser's storage. Clearing browser data erases " +
  "them. Use Export JSON to back up a castle, and Export library (in the flag " +
  "editor) to back up your saved flags.";
