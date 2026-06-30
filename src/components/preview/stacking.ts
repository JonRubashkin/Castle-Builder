// Stacking-layer constants.
//
// Surfaces meant to read as separate must never share an exact world Y, or they
// z-fight as the camera orbits. These named constants are the ONE place those tiny
// vertical offsets live — no scattered magic numbers elsewhere (carried-over
// pattern). Phase 1 has two decorative coplanar layers (the ground plane and the
// grid lines drawn over it). Pieces are NOT nudged: they seat at their real
// support height (groundHeightAt + base). The moat water is a flat sheet at the
// ground, so it gets its OWN layer here (ground < water < pieces) to keep it from
// z-fighting the ground plane and grid.

/** The smallest vertical separation that reliably avoids z-fighting at our zoom. */
export const STACKING_EPSILON = 0.002;

/** The solid ground plane. */
export const GROUND_LAYER = 0;

/** Grid lines, drawn just above the ground plane so they never z-fight it. */
export const GRID_LAYER = GROUND_LAYER + STACKING_EPSILON;

/**
 * The moat water surface — its own layer above the ground plane and grid lines so
 * the flat sheet never z-fights either. This is a tiny render-only nudge; the
 * moat's real seating height still routes through groundHeightAt (the water sits
 * at groundHeightAt + base + WATER_LAYER), so raised terrain stays additive.
 */
export const WATER_LAYER = GRID_LAYER + STACKING_EPSILON;
