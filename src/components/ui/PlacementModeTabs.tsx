import { useStore } from "../../store/store";
import type { PlacementMode } from "../../store/store";

/**
 * Two placement-mode toggle tabs shown on the right side of the viewport WHILE a
 * piece is selected (hidden when nothing is selected). They change how a
 * moved/dragged piece resolves its support (see resolveSupportAt / the store's
 * move path). Both default off and each PERSISTS until turned off (a persisted UI
 * pref, not part of the Design, not in undo history).
 *
 * The two are MUTUALLY EXCLUSIVE — turning one on turns the other off — modeled
 * as a single enum placementMode: "normal" (both off) / "groundOnly" /
 * "centerOnSupport". Clicking an active toggle returns to "normal".
 */
export function PlacementModeTabs() {
  const selectedId = useStore((s) => s.selectedId);
  const placementMode = useStore((s) => s.placementMode);
  const setPlacementMode = useStore((s) => s.setPlacementMode);

  // Hidden unless a piece is selected.
  if (selectedId === null) return null;

  const toggle = (mode: Exclude<PlacementMode, "normal">) =>
    setPlacementMode(placementMode === mode ? "normal" : mode);

  const groundOnly = placementMode === "groundOnly";
  const centerOnSupport = placementMode === "centerOnSupport";

  return (
    <div className="placement-tabs" role="group" aria-label="Placement mode">
      <button
        type="button"
        className={groundOnly ? "placement-tabs__btn is-active" : "placement-tabs__btn"}
        aria-pressed={groundOnly}
        data-placement-toggle="groundOnly"
        title="A moved piece never climbs onto others — it always seats on the ground."
        onClick={() => toggle("groundOnly")}
      >
        <span className="placement-tabs__label">Keep on ground</span>
        <span className="placement-tabs__state">{groundOnly ? "On" : "Off"}</span>
      </button>
      <button
        type="button"
        className={
          centerOnSupport ? "placement-tabs__btn is-active" : "placement-tabs__btn"
        }
        aria-pressed={centerOnSupport}
        data-placement-toggle="centerOnSupport"
        title="When a moved piece rests on another, center it on that piece's top."
        onClick={() => toggle("centerOnSupport")}
      >
        <span className="placement-tabs__label">Center on support</span>
        <span className="placement-tabs__state">{centerOnSupport ? "On" : "Off"}</span>
      </button>
    </div>
  );
}
