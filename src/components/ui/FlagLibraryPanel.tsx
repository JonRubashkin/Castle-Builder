// Phase 2Fd — the saved-flags library UI, embedded in the flag editor.
//
// Two jobs, sharing the library store:
//   • SAVE the current working design to the library (Part 2), with
//     overwrite-or-save-as: if the working design was applied FROM a library
//     entry (sourceEntryId set + still present) the user can Overwrite it OR
//     Save as new; a fresh/hand-built design only ever Saves as a new named
//     entry. Overwriting is always an EXPLICIT button — never a silent clobber.
//   • APPLY a saved design to the working copy (Part 3): a picker lists entries
//     with a renderFlag thumbnail; Apply COPIES the design into the working copy
//     (no live link) and records the source id so a later Save can Overwrite.
//     Entries can be renamed / deleted (delete is a two-step confirm) from here.
//
// Saving/applying here only touch the LIBRARY and the editor's local WORKING
// COPY — the placed flag's embedded design is unchanged until the editor's Apply.

import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/store";
import { renderFlag } from "../../flags/renderFlag";
import type { FlagDesign } from "../../flags/types";
import type { FlagLibraryEntry } from "../../flags/library";
import {
  flagLibraryToJSON,
  parseFlagLibraryJSON,
} from "../../flags/library";

const THUMB_HEIGHT = 36; // px — the picker thumbnail height (width follows aspect)

/** A small non-interactive thumbnail rendered through the SAME renderFlag the
 * world cloth uses (reusing the renderer — no parallel thumbnail path). */
function FlagThumb({ design }: { design: FlagDesign }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (canvas) renderFlag(design, canvas, THUMB_HEIGHT);
  }, [design]);
  return (
    <canvas
      ref={ref}
      className="flag-library__thumb"
      style={{ height: THUMB_HEIGHT, width: "auto" }}
      aria-hidden="true"
    />
  );
}

function LibraryRow({
  entry,
  isSource,
  onApply,
  onRename,
  onDelete,
}: {
  entry: FlagLibraryEntry;
  isSource: boolean;
  onApply: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(entry.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <li
      className={isSource ? "flag-library__row is-source" : "flag-library__row"}
      data-testid="flag-library-row"
      data-entry-id={entry.id}
    >
      <FlagThumb design={entry.design} />

      {renaming ? (
        <form
          className="flag-library__rename"
          onSubmit={(e) => {
            e.preventDefault();
            onRename(name);
            setRenaming(false);
          }}
        >
          <input
            aria-label={`Rename ${entry.name}`}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit">Save</button>
          <button
            type="button"
            onClick={() => {
              setName(entry.name);
              setRenaming(false);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <span className="flag-library__name" title={entry.name}>
          {entry.name}
        </span>
      )}

      {!renaming && (
        <div className="flag-library__row-actions">
          <button
            type="button"
            data-action="apply-flag-library"
            onClick={onApply}
          >
            Apply
          </button>
          <button type="button" onClick={() => setRenaming(true)}>
            Rename
          </button>
          {confirmingDelete ? (
            <>
              <button
                type="button"
                className="flag-library__delete-confirm"
                data-action="confirm-delete-flag-library"
                onClick={onDelete}
              >
                Confirm delete
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)}>
              Delete
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function FlagLibraryPanel({
  workingDesign,
  sourceEntryId,
  onApply,
  onSourceChange,
}: {
  workingDesign: FlagDesign;
  sourceEntryId: string | null;
  // Apply a library design to the editor's working copy (a COPY — no live link).
  onApply: (design: FlagDesign, sourceId: string) => void;
  // Report the working design's new/cleared library source (after save / delete).
  onSourceChange: (id: string | null) => void;
}) {
  const library = useStore((s) => s.flagLibrary);
  const saveFlagToLibrary = useStore((s) => s.saveFlagToLibrary);
  const overwriteFlagLibraryEntry = useStore((s) => s.overwriteFlagLibraryEntry);
  const renameFlagLibraryEntry = useStore((s) => s.renameFlagLibraryEntry);
  const deleteFlagLibraryEntry = useStore((s) => s.deleteFlagLibraryEntry);
  const replaceFlagLibrary = useStore((s) => s.replaceFlagLibrary);

  const [name, setName] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  // The entry the working design came from (if it still exists) — enables the
  // Overwrite choice. Cleared if that entry was since deleted.
  const source = sourceEntryId
    ? library.find((e) => e.id === sourceEntryId)
    : undefined;

  const saveAsNew = () => {
    const id = saveFlagToLibrary(name, workingDesign);
    onSourceChange(id); // now the working design is linked to this new entry for future Overwrite
    setName("");
  };

  const overwrite = () => {
    if (!source) return;
    overwriteFlagLibraryEntry(source.id, workingDesign);
  };

  const apply = (entry: FlagLibraryEntry) => {
    // COPY the design into the working copy (structuredClone at the store/CRUD
    // boundary already guarantees independence; clone once more here so the
    // editor's local edits can't reach the library entry object either).
    onApply(structuredClone(entry.design), entry.id);
  };

  const del = (entry: FlagLibraryEntry) => {
    deleteFlagLibraryEntry(entry.id);
    // Deleting the source entry only drops the Overwrite link — the working copy
    // (and any placed flag that already embedded it) is untouched.
    if (entry.id === sourceEntryId) onSourceChange(null);
  };

  const exportLibrary = () => {
    const blob = new Blob([flagLibraryToJSON(library)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flag-library.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importLibrary = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      replaceFlagLibrary(parseFlagLibraryJSON(await file.text()));
    } catch {
      window.alert("Could not read that flag-library file.");
    }
  };

  return (
    <div className="flag-library" aria-label="Saved-flags library">
      <h3 className="flag-library__title">Saved-flags library</h3>

      {/* Save to library (overwrite-or-save-as). */}
      <div className="flag-library__save">
        <input
          aria-label="Library entry name"
          placeholder="Name this design…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          data-action="save-flag-as-new"
          onClick={saveAsNew}
        >
          Save as new
        </button>
        {source && (
          <button
            type="button"
            data-action="overwrite-flag-library"
            onClick={overwrite}
            title={`Update “${source.name}” in place`}
          >
            Overwrite “{source.name}”
          </button>
        )}
      </div>

      {/* The picker. */}
      <ul className="flag-library__list" aria-label="Saved flags">
        {library.length === 0 && (
          <li className="flag-library__row flag-library__row--empty">
            No saved flags yet — name a design and Save as new.
          </li>
        )}
        {library.map((entry) => (
          <LibraryRow
            key={entry.id}
            entry={entry}
            isSource={entry.id === sourceEntryId}
            onApply={() => apply(entry)}
            onRename={(n) => renameFlagLibraryEntry(entry.id, n)}
            onDelete={() => del(entry)}
          />
        ))}
      </ul>

      {/* Library-only backup (it doesn't ride along in a castle export). */}
      <div className="flag-library__io">
        <button type="button" onClick={exportLibrary}>
          Export library
        </button>
        <button type="button" onClick={() => importRef.current?.click()}>
          Import library
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          onChange={importLibrary}
          hidden
          data-testid="flag-library-import"
        />
      </div>
    </div>
  );
}
