import { useEffect } from "react";
import { useStore } from "../../store/store";

/**
 * A viewport banner shown WHILE the one-shot "Place on top" action is armed,
 * telling the user to click a target (or Esc to cancel). It also switches the
 * scene cursor to a crosshair for the duration, so the armed state reads clearly.
 */
export function PlaceOnTopHint() {
  const armed = useStore((s) => s.placeOnTopArmed);

  useEffect(() => {
    if (!armed) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = "crosshair";
    return () => {
      document.body.style.cursor = prev;
    };
  }, [armed]);

  if (!armed) return null;

  return (
    <div className="place-on-top-hint" role="status" data-place-on-top-hint>
      Click a target piece to place on top — Esc to cancel
    </div>
  );
}
