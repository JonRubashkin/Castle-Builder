// Stacking-layer constants.
//
// Surfaces meant to read as separate must never share an exact world Y, or they
// z-fight as the camera orbits. These named constants are the ONE place those tiny
// vertical offsets live — no scattered magic numbers elsewhere (carried-over
// pattern). Phase 1 has two decorative coplanar layers (the ground plane and the
// grid lines drawn over it). Pieces are NOT nudged: they seat at their real
// support height (groundHeightAt + base). 1d will insert a WATER layer here,
// between the ground and pieces.

/** The smallest vertical separation that reliably avoids z-fighting at our zoom. */
export const STACKING_EPSILON = 0.002;

/** The solid ground plane. */
export const GROUND_LAYER = 0;

/** Grid lines, drawn just above the ground plane so they never z-fight it. */
export const GRID_LAYER = GROUND_LAYER + STACKING_EPSILON;
