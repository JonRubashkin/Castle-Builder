import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/store";

/**
 * "New Castle" — a top-bar action that clears the current design and starts fresh,
 * but ONLY after explicit confirmation (the reset is destructive and becomes
 * irreversible once autosave overwrites the old design). The confirmation dialog
 * is dismissable with Cancel / Esc / a backdrop click, all of which change
 * nothing; only "Start new" calls the store's shared `newDesign` reset.
 */
export function NewCastleButton() {
  const [open, setOpen] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Esc dismisses the dialog (no change); focus the safe default on open.
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const confirm = () => {
    setOpen(false);
    // One shared atomic reset: fresh empty design + all transients cleared +
    // bootNonce bump (remounts the editor tree clean). Read via getState so this
    // button doesn't re-render on every store change.
    useStore.getState().newDesign();
  };

  return (
    <>
      <button type="button" data-action="new-castle" onClick={() => setOpen(true)}>
        New Castle
      </button>

      {open && (
        <div
          className="modal-backdrop"
          data-testid="new-castle-backdrop"
          onClick={() => setOpen(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-castle-title"
            // Clicks inside the dialog must not bubble to the backdrop (dismiss).
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal__title" id="new-castle-title">
              Start a new castle?
            </h2>
            <p className="modal__body">
              This clears your current design. Export first if you want to keep it.
            </p>
            <div className="modal__actions">
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                className="modal__confirm"
                data-action="new-castle-confirm"
                onClick={confirm}
              >
                Start new
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
