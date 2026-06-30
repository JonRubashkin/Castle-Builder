// The single source of truth for ground height.
//
// Phase 1 is a flat world: this returns 0 everywhere. Raised terrain (a motte, a
// recessed area) is a later phase. CRITICAL RULE (CLAUDE.md): never write the
// literal ground y-value (0) inline anywhere — every "where is the ground here"
// question routes through this function. When tiers arrive, a tower-on-a-motte is
// simply "this accessor returned a non-zero height", with no placement rewrite.

/**
 * World Y of the ground surface under world coordinates (x, z).
 * Flat in phase 1; the parameters are intentionally part of the contract so
 * callers already pass a location.
 */
export function groundHeightAt(_x: number, _z: number): number {
  return 0;
}
