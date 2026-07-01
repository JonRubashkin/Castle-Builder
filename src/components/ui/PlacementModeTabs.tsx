import { useStore } from "../../store/store";

/**
 * The "Keep on ground" placement-mode toggle, shown on the right side of the
 * viewport WHILE a piece is selected (hidden when nothing is selected). It changes
 * how a moved/dragged piece resolves its support (see resolveSupportAt / the
 * store's move path): when on, a dragged piece never climbs onto other pieces — it
 * always seats on the ground. It defaults off and PERSISTS until turned off (a
 * persisted UI pref, not part of the Design, not in undo history).
 *
 * Modeled as a single enum placementMode: "normal" (off) / "groundOnly" (on);
 * clicking the toggle flips between them.
 */
export function PlacementModeTabs() {
  const selectedId = useStore((s) => s.selectedId);
  const placementMode = useStore((s) => s.placementMode);
  const setPlacementMode = useStore((s) => s.setPlacementMode);

  // Hidden unless a piece is selected.
  if (selectedId === null) return null;

  const groundOnly = placementMode === "groundOnly";

  return (
    <div className="placement-tabs" role="group" aria-label="Placement mode">
      <button
        type="button"
        className={groundOnly ? "placement-tabs__btn is-active" : "placement-tabs__btn"}
        aria-pressed={groundOnly}
        data-placement-toggle="groundOnly"
        title="A moved piece never climbs onto others — it always seats on the ground."
        onClick={() => setPlacementMode(groundOnly ? "normal" : "groundOnly")}
      >
        <span className="placement-tabs__label">Keep on ground</span>
        <span className="placement-tabs__state">{groundOnly ? "On" : "Off"}</span>
      </button>
    </div>
  );
}
