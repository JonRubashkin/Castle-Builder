# CLAUDE.md — Castle Builder

Read this file fully before writing any code. It is the single source of truth for
conventions, the data model, and scope. If a task seems to require violating
something here, stop and ask the user instead of improvising.

This is a **3D-first** builder: the user builds directly in a 3D scene. There is no
2D plan editor. (A prior project was 2D-plan-first; this one is not — do not bring
that interaction model over.)

## What this project is

A browser-based castle builder. The user places **semantic castle pieces** —
towers, wall runs, gatehouses, gates, ramps/stairs, and moats — directly in a 3D
scene, then tweaks each piece's parameters. The aesthetic target is a **clean,
semi-realistic** castle: smooth round towers, continuous curtain walls — not a
blocky/voxel look. It is a **guided builder**: it makes recognizable castles fast
and gently keeps the user on-rails (more free-form freedom may come later).
Everything runs client-side. No backend. Deploys to Vercel (root `base: '/'` + a
`vercel.json` SPA rewrite).

The product is built in phases (see "Phase plan" at the bottom). Never build ahead
of the current phase, but never design the data model in a way that blocks a later
phase.

## The interaction model (the core decision — memorize this)

The user builds with **parametric kit-of-parts on a grid**. One placement creates
one whole semantic piece (a tower, a wall run), never a raw block. Each piece is a
pure parametric builder with editable parameters.

Depth on a 2D screen is ambiguous, so placement resolves a screen click to a 3D
point through a small set of **constraints** — never free "click anywhere in space":

- **Ground-plane raycast.** The ray hits the ground plane; the result snaps to the
  horizontal grid. This is how anything is placed *on the ground*.
- **Face-attach.** The ray hits an existing piece's face/top; the new piece's base
  snaps to that surface. This is how pieces are placed *on top of* others without
  depth ambiguity (a tower onto a gatehouse top).
- **Working plane.** A movable horizontal plane at a chosen height, for placing at
  height in empty air. Snaps to the vertical grid.
- **Gizmo editing.** After placement, a selected piece is edited with axis handles
  (move/rotate) plus its parameter panel. Gizmos are the *edit* layer, not a
  placement model — they pair with all of the above.

This is a genuine architectural surface (picking, gizmos, working-plane management),
not a free add-on. Build it deliberately.

## Tech stack (fixed — do not substitute)

- **Vite + React + TypeScript** (strict mode)
- **Zustand** for all application state (one store, single source of truth)
- **three + @react-three/fiber + @react-three/drei** for the 3D scene
- **Vitest** for unit tests; **Playwright** for end-to-end tests
- No other runtime dependencies without asking the user first. Specifically
  forbidden: CSG / boolean-geometry libraries (see "Geometry rules").

## Coordinate system & units (memorize this)

- All lengths are **meters**, stored as numbers. UI displays meters with cm
  precision (e.g. "3.40 m").
- **World space** (Three.js) is Y-up. The ground plane is the XZ plane; +Y is up.
- **Horizontal grid snap: 0.1 m.** Piece anchors and wall endpoints snap to it.
- **Vertical grid snap: 0.5 m.** A piece's stored vertical base snaps to it when
  placed via the working plane. Face-attach **overrides** the vertical grid by
  snapping the base to the *actual* top of the piece below — so the increment
  mainly governs placement in empty air.
- Defaults (refine per piece as built): tower height **8 m**, wall-run height
  **4 m**, wall-run thickness **0.6 m**, merlon (crenellation tooth) height
  **0.6 m**. Treat these as starting values, tune for looks.

All pure math (grid snapping, piece footprints, the per-piece `build()` geometry,
stair computation, camera framing) lives in `src/geometry/` (or a piece's builder
module) as **pure functions with unit tests**. React components and the store must
not contain raw geometry math — they call these functions.

## The ground-height seam (design now, even though phase 1 is flat)

Phase 1 is a **flat world** (ground at y=0). Raised terrain (a motte/mound, a
recessed area) is a **later phase**. To make terrain *additive* rather than a
migration, honor these three rules from day one:

1. **`groundHeightAt(x, z)` is the single source of truth for ground height.** It
   returns **0** today. **Never write the literal ground y-value (`0`) inline**
   anywhere — every "where is the ground here" question routes through this
   function. (This is the direct analog of the old project's "never hardcode
   `levels[0]`" rule.)
2. **A piece seats at the support height under its anchor.** That support is the
   ground (`groundHeightAt`) or, via face-attach, the top of the piece below. The
   placement code asks for the support height; it never assumes 0. When tiers
   arrive, a tower-on-a-motte is simply "the accessor returned a non-zero height."
3. **The moat is an opaque-water kit piece — never real transparency.** Its watery
   look is faked with a water texture + a slight sheen. Do **not** use real alpha:
   real transparency reawakens the cutaway material-hiding bug learned on the prior
   project, and this app has cutaway-style view modes. Water is OPAQUE.

These cost nothing in a flat phase 1 and are what let raised terrain slot in later
without rewriting every placement path.

## Vertical stacking (free placement, NOT storeys)

Pieces stack by **explicit vertical placement**, not by a storey/level system.
There is **no `levels[]` array** (the prior project's storey system does NOT carry
over). Every piece is a flat top-level object that carries its own stored vertical
**base** (snapped to the 0.5 m vertical grid, or to a real surface via face-attach).

- "Stacking" means **a piece sits on top of another piece** (a tower on a
  gatehouse), achieved by face-attach snapping the new piece's base to the lower
  piece's top. The base is then **stored explicitly** on the piece.
- **No parent/child auto-riding in phase 1.** Moving/raising the lower piece does
  NOT auto-move the piece resting on it; the upper piece keeps its stored base.
  (Auto-riding parent/child is a deliberate **later** possibility — and would carry
  the prior project's "be conservative with anything that auto-mutates the user's
  work" caution. Not now.)

## Data model (schema v1)

This is the persisted design document and the core of the Zustand store. Keep field
names exactly as written. **Phase 1 only — do not forward-declare speculative fields
for deferred features** (terrain tiers, parent/child riding, wall↔tower attachment).
Add fields when the phase that needs them arrives, with a migration if necessary.

```ts
interface Design {
  schemaVersion: 1;
  name: string;
  pieces: Piece[];          // flat list — NO levels[]. Every piece carries its own
                            // base height; stacking is explicit vertical placement.
}

// A Piece is a discriminated union on `kind`. All pieces share an id, a horizontal
// anchor position (grid-snapped), a stored vertical base, and a rotation about Y.
interface PieceBase {
  id: string;
  position: Vec2;           // anchor in world XZ (grid-snapped, 0.1 m)
  base: number;             // world Y of the piece's underside (vertical grid /
                            // face-attach). Seated via groundHeightAt or a surface
                            // top — NEVER hardcode 0.
  rotation: number;         // degrees about world Y, snapped to 15° steps
}

interface Tower extends PieceBase {
  kind: "tower";
  profile: "round" | "square";
  radius: number;           // meters (round); half-extent for square
  height: number;           // meters
  crenellated: boolean;     // battlements toggle
  merlonSize: number;       // tooth size, meters (used when crenellated)
  material: MaterialRef;    // default a stone solid
}

interface WallRun extends PieceBase {
  kind: "wallRun";
  // A horizontal piece between two grid-snapped points. `position` is one end;
  // `end` the other (both world XZ). `rotation` is unused for wall runs (the two
  // points define direction) — keep it 0.
  end: Vec2;
  height: number;           // meters
  thickness: number;        // meters
  crenellated: boolean;
  merlonSize: number;
  material: MaterialRef;
}

interface Gatehouse extends PieceBase {
  kind: "gatehouse";
  width: number;            // meters (along its facing)
  depth: number;            // meters
  height: number;           // meters
  crenellated: boolean;
  merlonSize: number;
  material: MaterialRef;
}

interface Gate extends PieceBase {
  kind: "gate";             // the door/portcullis opening element
  width: number;            // meters
  height: number;           // meters
  material: MaterialRef;    // default a timber solid
}

interface Ramp extends PieceBase {
  kind: "ramp";             // ramp / straight stair — connects two heights
  // The most complex builder. Connects `base` up to `base + rise` over `run`.
  rise: number;             // meters of vertical climb
  run: number;              // meters of horizontal length
  width: number;            // meters
  style: "ramp" | "stair";  // smooth ramp vs. stepped stair
  material: MaterialRef;
}

interface Moat extends PieceBase {
  kind: "moat";
  // OPAQUE water. Phase 1: a ring around a footprint OR a straight segment.
  shape: "ring" | "segment";
  // ring: outer/inner radii about `position`. segment: `end` + width.
  outerRadius?: number;     // ring
  innerRadius?: number;     // ring
  end?: Vec2;               // segment
  width?: number;           // segment
  material: MaterialRef;    // opaque water material — NEVER real transparency
}

type Piece = Tower | WallRun | Gatehouse | Gate | Ramp | Moat;

interface Vec2 { x: number; y: number; } // a world XZ pair (y holds Z)
interface Vec3 { x: number; y: number; z: number; }

// Materials are data, never baked into meshes. Carried over verbatim from the
// prior project's material system.
type MaterialRef =
  | { kind: "solid"; color: string }                              // hex
  | { kind: "pattern"; pattern: PatternId; colorA: string; colorB: string };

type PatternId =
  | "stone" | "brick" | "thatch" | "water";  // add ids as needed (additive)
```

Pattern textures are generated **procedurally at runtime** onto small offscreen
canvases and used as repeating Three.js textures (no image assets), exactly as in
the prior project. Water blends/ripples for a watery look but renders **OPAQUE**
(sheen, not alpha). Adding `PatternId` values is additive (no schema bump); any
importer pattern allowlist derives from the id list so new ids are never rejected.

## Piece builders (the kit of parts)

Each piece kind has a **pure builder** that returns geometry parts in local space
(y up from the piece's underside, the piece's own forward = +Z), composed from
shared primitives (box / cylinder / etc.), plus its material slot(s). This mirrors
the prior project's furniture-catalog `build()` pattern: builders are pure data (no
hooks), the renderer maps each part to a mesh whose material flows through the
shared `materialRefToThreeMaterial` helper (so patterns work for free), and the
builder is unit-tested.

- **Local→world:** a piece renders as a group seated at its support height
  (`groundHeightAt` or a face-attach surface top) at `position`, raised to `base`,
  rotated about world Y by `-rotation`.
- **Crenellations** are a builder concern: when `crenellated`, the builder adds the
  merlon teeth (size `merlonSize`) along the top edge of a tower/wall/gatehouse. It
  is a **per-piece parameter**, not a separate detail pass.
- **Wall↔tower junctions overlap; the tower mass hides the seam** (the prior
  project's "corner post fills the junction" spirit). Phase 1 has **no attachment
  relationship** between wall runs and towers — this is a deliberate decision, not
  an accident. A wall run that meets a tower simply overlaps it.
- **Ramp/stair is the most complex builder** and the most genuinely 3D piece (its
  whole job is connecting two heights). Give it its own pure tested geometry helper
  (the analog of the prior project's `computeStair`). **Build it LAST in phase 1.**

## 3D scene & camera rules

- **OrthographicCamera** for the isometric look. Orbit rotation (drag) and zoom are
  allowed; **lock vertical orbit so the camera can't go below the ground plane**.
  Default view: classic iso angle (~45° azimuth, ~35° elevation).
- **Stacking offsets.** Surfaces meant to read as separate must never share an exact
  world Y or they z-fight as the camera orbits. Ground plane < moat water < pieces
  each sit on their own layer, defined as **named constants** in
  `src/components/preview/stacking.ts` (carried-over pattern — no scattered magic
  numbers). Keep piece materials **opaque** (water included).
- **Picking & gizmos.** Pieces are pickable: hovering highlights (subtle emissive
  echo of the selection tint) with a pointer cursor; a clean click (not an orbit
  drag) selects through the shared `selection` state + store action. Clicking empty
  space deselects. A selected piece shows a transform gizmo (move/rotate) and is
  editable through its parameter panel.
- **One shared helper when two paths must match.** Anything computed for BOTH
  rendering and picking/placement/collision must be a **single source of truth**
  (the prior project's worst recurring bugs came from two code paths that should
  have been one). E.g. a piece's footprint used for both its mesh and its
  hit-test/snap comes from one pure function.

## Geometry rules

- **No CSG libraries.** Compose geometry from primitives and parts, never boolean
  ops. A gate "opening" in a gatehouse is composed (jambs + lintel + gap), not
  subtracted.
- All pure geometry (snapping, footprints, builders, stair computation, framing)
  lives in pure tested functions under `src/geometry/` (or the piece's builder
  module). Components and the store call them; they don't inline math.

## State, undo, persistence (carried-over patterns)

- One Zustand store holds: the `Design`, the active tool, the current selection,
  view settings, and undo/redo history.
- **Every mutation goes through a named store action.** Components never write state
  directly.
- **Undo/redo from day one.** Snapshots of the `Design` pushed on each *committed*
  action; mid-drag/gizmo movements update a transient preview, history records only
  on commit (mouse-up). Ctrl+Z / Ctrl+Shift+Z (and Ctrl+Y). Cap history at 100.
- **Persistence.** Client-side only (IndexedDB or a single autosave slot — keep it
  simple in phase 1; no backend). **Per-origin storage** is per-domain and lost if
  browser data is cleared — **Export/Import JSON is the carry-over/backup path**.
  Per-design `schemaVersion` is validated on open; a future unknown version is
  refused rather than corrupting data. Surface a calm browser-storage disclosure in
  the UI.

## Safety nets & known-bug lessons (carried over)

- **Error boundary early.** An app-wide `ErrorBoundary` shows a readable "Something
  went wrong" card with a Reload button instead of a blank page, and does NOT
  auto-retry (so it can't re-enter a render loop).
- **Read the actual error.** A white screen is usually a specific console error, not
  a mystery — read it before guessing. Watch for per-render effects that set state
  (the prior project's React #185 update-depth loop came from a non-idempotent
  layout-measuring effect). Any per-render `useLayoutEffect` must be **idempotent**
  (round sub-pixel measurements, cache, use a fit tolerance).
- **Be conservative with anything that auto-mutates the user's work.**
  Generate-once + explicit beats clever-auto that surprises people. (Why
  parent/child auto-riding is deferred.)

## Verification (do this every session)

- `npm run dev` must start clean; interact with the changed feature and check the
  browser console for errors/warnings.
- `npm test` (Vitest) must pass. New pure-geometry functions require tests:
  grid snapping, each piece builder's footprint/key dimensions, ground-height
  routing, stair computation, camera framing.
- `npm run build` must succeed before finishing a session.
- **End-to-end tests (Playwright)** in `e2e/` (Vitest excludes `e2e/**`); run with
  `npm run test:e2e`. Cover high-value integration flows (clean boot, place a
  piece, select + delete, autosave persists across reload). **Assert on DOM and
  app/store state — NEVER on the 3D WebGL canvas pixels** (deliberately out of
  scope to stay stable). Expose store state through a test-only accessor gated
  behind a `?e2e=1` flag. CI runs both Vitest and Playwright on push/PR.
- Keep `README.md` current: how to run, current feature list, controls/shortcuts.
- **Update README + this CLAUDE.md every time** behavior or scope changes.

## Scope guards

- **Desktop, mouse + keyboard only.** Do not write touch handling.
- **Flat world only in phase 1.** No terrain editing/sculpting yet — but honor the
  ground-height seam so it's additive later.
- **No 2D plan editor.** Building happens in 3D.
- **No storey/level system.** Stacking is explicit vertical placement.
- **No parent/child auto-riding, no wall↔tower attachment** in phase 1 (both
  deferred, deliberately).
- No real lighting/illumination design; no measurements/annotations beyond simple
  piece dimensions in the panel.
- Accessibility basics only: focus styles, button labels, no exotic ARIA work.

## Phase plan

Phase 1 is sub-phased so each prompt ships one coherent slice (one prompt = one
coherent commit), the discipline carried over from the prior project. Build in
order; do not build ahead.

**Current status: phase 1a is implemented.** You can place / select / move /
delete towers on the flat grid, with undo/redo, autosave, Export/Import JSON,
and CI (Vitest + Playwright) green. One scoping note: the ground-plane raycast +
gizmo placement backbone is in, but **working-plane-at-height placement was left
for a later phase** (it is only needed once pieces stack in empty air), so 1a
places towers on the ground only. Next up is **1b**.

- **1a (foundation):** fresh Vite + React + TS repo; Zustand store + schema v1 +
  undo/redo; the 3D scene with the carried-over orthographic iso camera + orbit/zoom
  + below-ground lock; the ground-plane grid; `groundHeightAt` (returns 0); the
  placement backbone (ground raycast + working plane + gizmo) and selection; place /
  select / move / delete **ONE** piece type (the **tower**) end-to-end; Vercel
  deploy; Playwright + Vitest + CI from day one.
- **1b (face-attach + materials):** face-attach placement (a piece onto another
  piece's top); copy in the **material system** (MaterialRef, procedural patterns,
  `materialRefToThreeMaterial`) and wire the tower's material + crenellations.
- **1c (the masses):** add the **wall run** (two-point placement + height +
  thickness + crenellations) and the **gatehouse**; wall↔tower overlap (no
  attachment).
- **1d (openings & water):** add the **gate** and the **moat** (opaque water,
  ring/segment).
- **1e (navigation):** add the **ramp/stair** with its own pure tested geometry
  helper. **Built last.**
- **2+:** raised terrain (tiers / motte via `groundHeightAt`), parent/child
  auto-riding, wall↔tower attachment, more pieces, more freedom. Do not start any
  of this without instruction.
