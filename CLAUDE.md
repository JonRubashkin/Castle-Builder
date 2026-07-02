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
- **Riding is implemented (phase 2G), geometry-derived — NO stored links.** Moving
  or raising a lower piece now carries the pieces resting on it along with it. The
  riders are **computed FRESH from geometry** at move/resize time (see "Riding
  (phase 2G)" below) — there is **no `parent`/`child` field, no relationship graph,
  no schema change, and no reconciliation**. "Resting on" reuses the SAME support
  rule face-attach uses (`resolveSupportAt`), so the rider set can never drift from
  seating. A move applies one horizontal delta to the whole transitive rider set; a
  top-height/base raise applies the same vertical delta to it — each as **one undo
  step**. It is a geometry heuristic ("what is on top right now?"), and a wrong
  guess is always **undoable**.

## Riding (phase 2G)

Stacked pieces **ride** the piece beneath them: moving or raising a lower piece
carries everything resting on it. This is deliberately implemented **WITHOUT
stored parent/child links** — riders are **computed fresh from geometry** at
move/resize time (the "single source of truth from geometry; don't persist
redundant relationships" instinct). **No schema change, no relationship graph, no
reconciliation.** It is a heuristic ("what is on top right now?") and a wrong guess
is always **undoable**.

- **The pure helper** (`src/geometry/riders.ts`). `ridersOf(piece, allPieces)`
  returns the DIRECT riders; `allRidersOf(piece, allPieces)` returns the TRANSITIVE
  set (riders, their riders, …), each piece **once**, **cycle-safe** (a visited-set
  so a degenerate mutual-rider configuration terminates instead of looping). Both
  are pure + unit-tested. A candidate rides `piece` when it is "resting on" it, and
  **"resting on" reuses the SAME support geometry** face-attach/move already use —
  `resolveSupportAt(candidate.position, [piece])` must return `piece` as the
  surface AND the candidate's stored `base` must match that top (within a tiny
  tolerance). There is **NO second notion of "resting on"**.
  - Because the test flows entirely through `resolveSupportAt`, the surface
    exclusions come for free: a **moat / ramp / gate / flag is not a support
    surface**, so **nothing rides one** (in particular *nothing tries to ride a
    moat*). But a **flag resting on a tower top IS a valid rider** — the exclusion
    is about being a *support surface*, never about being a *rider*.
- **Ride on move** (`setPiecePositionTransient`). The rider set is computed **once
  from the pre-move geometry** (off the pending-interaction snapshot, so repeated
  mid-drag calls stay idempotent — each rider moves exactly once by the TOTAL
  delta, never re-evaluated frame-to-frame). The moved piece and every rider
  translate by the same **horizontal** delta (a two-point wall/segment rider shifts
  BOTH endpoints); riders **RIDE, they do not re-seat** — their base is untouched
  by a horizontal move. History records **one commit on mouse-up** (the standard
  transient rule). It **composes with** the existing machinery: the moved piece
  still resolves its own base through the mode-aware `resolveSupportAt`
  (Keep-on-ground / face-attach), now **excluding its riders** so it can't
  accidentally climb onto something riding it; the moat stays inherently
  ground-only.
- **Ride on resize/raise** (`updatePiece`). An edit that raises the piece's **flat
  top** (its `height`) OR its **base** moves the surface riders sit on; the riders
  (captured from the **pre-edit** geometry) shift by the same **vertical** delta
  (`Δbase + Δheight`), as **one undo step with the edit**. A **horizontal-only**
  param change (material, radius, width/depth, rotation) leaves the top unchanged →
  delta 0 → **riders are untouched**. If a radius/width shrink drops a rider off the
  new (smaller) top, we **do not chase it** (leave it; the user can move it — "don't
  auto-mutate surprisingly").
- **Out of scope for 2G:** stored parent/child relationships or any persisted
  stacking graph; reconciliation; riders re-seating their own support during a ride
  (they translate rigidly); auto-roofs; detach/re-parent UI.

## Data model (schema v2)

This is the persisted design document and the core of the Zustand store. Keep field
names exactly as written. **Do not forward-declare speculative fields for deferred
features** (terrain tiers, parent/child riding, wall↔tower attachment). Add fields
when the phase that needs them arrives, with a migration if necessary.

**Schema history.** v1 was the phase-1 kit (tower / wallRun / gatehouse / gate /
ramp / moat). **v2 (phase 2Fb) added the `Flag` piece** (below), which embeds its
own `FlagDesign`. The bump ships with a **stepwise migration**
(`src/persistence/migrations.ts`): `validateDesign` migrates an older-but-known
document up to the current version before structurally validating it. v1 → v2 only
bumps the version (flags are additive / list-compatible — existing `pieces` are
untouched); a **future unknown version is still refused**. Add the next step to
`migrateDesign` (never mutate old saves in place) when the schema next changes.
**2Fe.1** added an OPTIONAL `Flag.autoFlagHostId` provenance marker — additive
within v2, so it needs **no bump/migration** (old saves simply omit it; the
validator type-checks it when present and preserves it on round-trip, exactly like
adding a `PatternId`).

```ts
interface Design {
  schemaVersion: 2;
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

interface Flag extends PieceBase {
  kind: "flag";             // schema v2 (phase 2Fb): a cloth on a pole
  // Embeds its FULL FlagDesign (2Fa) — the design travels WITH the piece (the
  // settled embed model), so a placed flag never changes underneath the user and
  // Export/Import carries its flags inline. A flag is NOT a face-attach target
  // (its top is a pole/cloth, not a flat surface) — nothing stacks on it.
  design: FlagDesign;
  poleHeight: number;       // meters, staff height
  clothWidth: number;       // meters (cloth long edge; height = clothWidth/aspect)
  autoFlagHostId?: string;  // 2Fe.1 auto-placement provenance: set ONLY on flags
                            // generated by "Add flags along" (the host they were
                            // laid along). Hand-placed / pasted flags have NONE.
                            // Optional + additive within v2 (no migration): old
                            // saves omit it; the validator preserves it on
                            // round-trip. A re-run REPLACES this host's tagged set.
}

type Piece = Tower | WallRun | Gatehouse | Gate | Ramp | Moat | Flag;

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
- **New Castle (the reset).** A top-bar **New Castle** button (`NewCastleButton`)
  clears the design and starts fresh — but **only after explicit confirmation**
  (a dismissable dialog: Cancel / Esc / backdrop change nothing; only "Start new"
  resets). The reset is **destructive and irreversible** once autosave overwrites,
  so confirmation is **mandatory — never reset without it**. It goes through ONE
  shared atomic store action, **`newDesign`**, which swaps in a fresh empty
  `Design` (schemaVersion 1, empty pieces, default name) AND resets every
  doc-dependent transient (selection, undo/redo history, the pending-interaction
  snapshot) so **no reference to a now-gone piece survives** — the prior project's
  hard-won lesson (a reset that swaps the doc but leaves dangling transient
  references white-screens). It also **bumps a monotonic `bootNonce`**; the editor
  tree is keyed on it (`<Editor key={bootNonce} />`) so the reset **fully remounts
  a clean tree** rather than mutating the live one in place, which additionally
  clears component-local in-progress placement/drag state. The doc-lifecycle hooks
  (`useAutosave`, shortcuts, the e2e accessor) live in `App` **outside** the keyed
  subtree on purpose — remounting `useAutosave` would re-run its load-from-storage
  and could race the old design back in. The fresh empty design persists via the
  existing autosave path (a later reload resumes the empty design).

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
  Generate-once + explicit beats clever-auto that surprises people. Riding
  (phase 2G) auto-moves riders, but stays within this caution: it is
  **geometry-derived** (no persisted relationship to drift or reconcile), acts only
  on a direct user move/resize, and every ride is **one undoable step** — a wrong
  guess costs one Ctrl+Z.

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
- **CI guard scripts** (`scripts/`, run via `npm run guards`, wired into CI):
  - **`guard:ground-seam`** enforces the ground-height-seam rule by failing on
    any inline **literal Y-position** assignment (`position={[x, <literal>, z]}`,
    `.position.y = <literal>`, `.position.setY/​.set`). Vertical placement must
    route through `groundHeightAt` / a surface top. Legitimate exceptions (e.g.
    the lighting rig) live in a justified allowlist at the top of
    `scripts/check-ground-seam.mjs` (add a `{ file, y, reason }` entry).
  - **`guard:e2e-canvas`** enforces the "no canvas pixels in e2e" rule by failing
    if any `e2e/**` spec uses `getContext` / `toDataURL` / `readPixels` /
    `.screenshot(` / `toMatchSnapshot(`. E2E asserts on DOM/store state only.
- Keep `README.md` current: how to run, current feature list, controls/shortcuts.
- **Update README + this CLAUDE.md every time** behavior or scope changes.

## Flags (phase 2F)

Phase 2F adds heraldic **flags** as a self-contained feature. The `FlagDesign`
model + renderer were kept deliberately **separate from the phase-1
`Design`/`Piece` schema** through 2Fa; the flag *piece* and its **schema bump to
v2** landed in **2Fb** (now done — see the data model + the flag-piece bullet
below). The `FlagDesign` model, renderer, and symbol library live under
`src/flags/`; the flag *piece* (builder / footprint / mesh) lives with the other
pieces under `src/geometry/` + `src/components/preview/`, consuming `flagTexture`.

- **The model — a composed layer stack ("Approach A").** A `FlagDesign`
  (`src/flags/types.ts`) is `{ aspect, layers[] }`, where `layers` draw
  **back-to-front** (index 0 underneath). Three layer kinds:
  - **field** — the background: a `solid` color, or a `division` (`perPale` /
    `perFess` / `perBend` / `quarterly`) with one color per resulting section.
  - **stripes** — N equal parallel bands (`horizontal` / `vertical` / `diagonal`,
    `count`, per-band `colors` cycled) — the "many different lines" case.
  - **charge** — a preset library symbol (`symbolId`, normalized `x`/`y` in
    `0..1`, `scale`, `color`, optional `rotation`).
  Field names are load-bearing (later slices depend on them). A `FlagDesign` is
  plain data and **round-trips through JSON** (Export/Import works for free).
  This is Approach A only — **freeform raster paint is Approach B, deferred**
  (do not build or stub it).
- **The symbol (charge) library** (`src/flags/symbols/`). Hand-authored SVG path
  silhouettes keyed by `SymbolId`, derived from **one `SYMBOL_IDS` source-of-truth
  list** (`symbols/ids.ts`) exactly like the material system's `PATTERN_IDS`
  allowlist — adding a symbol is additive. Starter set: **star, cross,
  fleurDeLis, lion, dragon, eagle, crown**. Each `SymbolDef` is pure data (a
  nominal `viewBox` + one or more path `d` strings); the registry
  (`symbols/index.ts`) maps every id → def. Silhouettes are simple/bold (they must
  read at flag scale). Well-formedness is unit-tested via a **pure path parser**
  (`symbols/path.ts`) — never pixels.
- **The renderer** (`src/flags/renderFlag.ts`). `renderFlag(design, canvas)` draws
  the stack back-to-front onto a 2D offscreen canvas (field → stripes → charges,
  in layer order), producing an **OPAQUE** image (the field always covers the rect
  first; no fill uses alpha < 1 — consistent with the opaque-materials rule). The
  per-layer **layout math is pure and tested** (`src/flags/layout.ts`:
  `divisionSections`, `stripeBands` — diagonal bands via half-plane polygon
  clipping — and `chargeTransform`); the renderer only rasterizes their output, so
  the raster itself is **not pixel-tested**. `flagTexture(design)`
  (`src/flags/flagTexture.ts`) wraps the canvas into a Three.js texture through the
  material system's **shared** `canvasToTexture` helper (`src/materials/textures.ts`)
  — NOT a parallel texture path — for the flag piece to consume (2Fb).
- **The flag piece (2Fb, built).** A `Flag` piece (schema v2 — see the data model)
  is a **pole/staff + a static cloth**, from a pure builder
  (`src/geometry/flagBuilder.ts`: `buildFlag` → a thin cylinder pole + a cloth
  rectangle `clothWidth × clothWidth/aspect` flying out along local +X from the
  pole top) with one footprint helper (`flagFootprint.ts`: the cloth's oriented
  rectangle, anchored at the pole — the big visible click target). The cloth is
  skinned by `flagTexture(flag.design)` in `FlagMesh` — **OPAQUE, double-sided,
  slightly curved** (a render-only static wave so it doesn't read as flat
  cardboard; **no animation/waving** — deferred); the pole uses a timber solid.
  Placement is **single-anchor** (ground-raycast + face-attach via
  `resolveSupportAt`, exactly like the tower/gate), a new flag seeded with a
  default `FlagDesign` (`createDefaultFlagDesign`) until the 2Fc editor. Select /
  gizmo-move / **15° rotation** / delete + a param panel (poleHeight, clothWidth,
  rotation) reuse the shared machinery. A flag is **NOT a face-attach target**
  (excluded from `isFaceAttachSurface` / `flatTopWorldY` → also excluded as a
  Place-on-top target), matching the moat/ramp exclusions.
- **The flag editor (2Fc, built).** A modal (`src/components/ui/FlagEditor.tsx`,
  opened by an **Edit design…** button in the selected flag's panel) that edits a
  **WORKING COPY** of the flag's embedded `FlagDesign` in local React state. Only
  **Apply** commits, through the named store action **`updateFlagDesign(id,
  design)`** — ONE undoable, **coalesced** entry (the whole editing session — many
  layer edits + a charge drag — collapses into a single history step, the project's
  slider-coalescing spirit); **Cancel / Esc / backdrop** discard the working copy.
  A **live preview** re-renders the working design through the SAME 2Fa
  `renderFlag` the world cloth uses (so preview and placed flag can't drift). The
  working-copy layer ops are **pure + tested** (`src/flags/editorOps.ts`:
  `addLayer` / `removeLayer` / `moveLayer` / `updateLayer` / `setAspect`, each
  returning a NEW design — up/down reorder only; **drag-reorder deferred**). Per
  layer: **field** (solid or division, a color per section), **stripes**
  (orientation / count / a color per band), **charge** (symbol picked from
  `SYMBOL_IDS`, x / y / scale / color / rotation). **Charges drag on the preview**
  via two **pure, tested** functions (`src/flags/editorPicking.ts`):
  `previewPixelToFlagCoord` (a preview pixel → normalized `0..1`, accounting for
  the box size + aspect letterboxing — the inverse of the renderer's placement) and
  `chargeAtPoint` (the topmost charge whose extent contains a point, reusing the
  renderer's OWN `chargeTransform` so hit-test and draw can't drift). The dragged
  charge and the Part-3 x/y sliders edit the **same** value (one source of truth —
  no separate drag-state). Editing the **aspect** reshapes the cloth on Apply. The
  preview is pinned top-left in a **FIXED-WIDTH** box (the 2Fe layout fix): the
  width never changes, and the **height** = `width / aspect` **clamped** to a
  min/max — so changing the aspect varies only the preview height (a wider flag →
  shorter, a squarer flag → taller), **never reflowing** the surrounding controls
  (the box reserves the max height; within it the flag is **letterboxed/centered**,
  never stretched). The box math is **pure + tested** (`previewBoxSize` +
  `flagContainRect` in `editorPicking.ts`), and `previewPixelToFlagCoord` uses the
  SAME `flagContainRect` fit, so charge-dragging stays accurate at any aspect.
- **Dev QA route.** A dev-only `#flags` hash route (`src/flags/dev/FlagQA.tsx`,
  wired in `main.tsx`, analogous to the prior project's `#catalog`) renders the
  hardcoded `FLAG_EXAMPLES` (solid, tricolor, quartered, field+charge, busy) plus
  the whole symbol library. It is **not** part of the main app UI.
- **Embed-vs-library model (settled, built).** A **placed flag piece embeds its
  own `FlagDesign`** (the design travels with the piece, so Export/Import of a
  castle carries its flags). The **saved-flags library (2Fd, built)** is a
  **separate** store of **named** flag designs with **overwrite-or-save-as**
  semantics (like naming a document); applying a library design **copies** it into
  the working design (no live link). The library persists client-side in its **own**
  `localStorage` slot — NOT part of the castle `Design`, NOT in the castle Export
  JSON, and **untouched by `newDesign`** (New Castle) — exactly like the
  placement-mode pref is a separate slot. See "The saved-flags library" below.
- **The saved-flags library (2Fd, built).** A per-origin palette of named
  `FlagDesign`s, decoupled from the castle. Pure CRUD lives in `src/flags/library.ts`
  (`FlagLibraryEntry` = `{ id, name, design, createdAt, modifiedAt }`; `listEntries`
  / `getEntry` / `saveNewEntry` / `overwriteEntry` / `renameEntry` / `deleteEntry`,
  each returning a NEW library and **deep-cloning designs in** so a saved entry never
  shares a reference with the live working copy — copy, not link) plus lenient
  `sanitizeLibrary` and library-only `flagLibraryToJSON` / `parseFlagLibraryJSON`
  (all unit-tested). It persists through its own slot
  (`saveFlagLibrary` / `loadFlagLibrary` in `src/persistence/storage.ts`), is
  hydrated onto the store's **`flagLibrary`** slice on boot, and every mutation goes
  through a named store action (`saveFlagToLibrary` → returns the new id /
  `overwriteFlagLibraryEntry` / `renameFlagLibraryEntry` / `deleteFlagLibraryEntry` /
  `replaceFlagLibrary`), each persisting the slot. It is **NOT in undo history**
  (a separate store, like the Keep-on-ground pref) and **`newDesign` leaves it
  intact** (not listed in the reset). The UI is a panel inside the flag editor
  (`src/components/ui/FlagLibraryPanel.tsx`): **Save to library** with
  overwrite-or-save-as (the editor tracks the working design's **source entry id**
  when applied from the library → Overwrite that entry OR Save as new; a hand-built
  design only Saves as new — **never a silent overwrite**), and an **Apply** picker
  listing entries with `renderFlag` **thumbnails** (reusing the renderer — no
  parallel thumbnail path). Apply COPIES the entry's design into the editor's
  working copy and records the source id; it commits only on the editor's existing
  Apply (one coalesced undoable `updateFlagDesign`). Rename (inline) and delete
  (two-step confirm) manage entries; **deleting an entry does NOT touch any placed
  flag that already embedded a copy of it**. Because the palette doesn't ride along
  in a castle export, the panel also offers **Export library / Import library** JSON
  (its own backup path). The browser-storage disclosure is single-sourced in
  `src/persistence/disclosure.ts` (`STORAGE_DISCLOSURE`, shown in the bottom bar) and
  now names the library alongside the castle autosave.
- **Auto-place-along (2Fe, built).** A **generate-once** convenience that drops a
  row of independent `Flag` pieces along a HOST piece's flat top edge. The pure
  math is `flagPositionsAlong(piece, { count?, spacing?, inset? })` in
  `src/geometry/flagAlong.ts` (unit-tested): it returns evenly-spaced anchor
  positions + a `base` from the SHARED `flatTopWorldY` (never a literal ground-y)
  along the host's top. **Supported hosts: the wall run** (flags along its length,
  its two endpoints) **and the gatehouse** (a row across the top along local X /
  the width). A **tower is DEFERRED** (a round/point top has no natural "along"
  line — place a single flag by hand); gate / ramp / moat / flag are not hosts. The
  action is the store's **`addFlagsAlong(hostId, { spacing?/count?, design? })`** —
  ONE undoable step; each flag **embeds a COPY** of the chosen design. The UI is
  an **Add flags along** control (`AddFlagsAlongControl` in `PiecePanel.tsx`, shown
  on the wall-run + gatehouse panels) — analogous to the crenellations toggle but an
  ACTION that generates pieces, not a per-piece render parameter. **Generate-once,
  NOT auto-maintained** (the project's core caution): the generated flags are
  ordinary independent pieces from that moment — selectable / movable / editable /
  deletable, indistinguishable from hand-placed flags — and there is **NO live
  "flags follow the wall" link**: resizing/moving the host later does not re-space
  or move them (exactly like the prior project's generate-once roofs).
- **Auto-place refinements (2Fe.1, built).** Three refinements to the above, still
  generate-once (no live follow — re-spacing happens only on an explicit re-run):
  - **Provenance + re-run-replaces.** Each generated flag is tagged with the host
    it came from (`Flag.autoFlagHostId`, the optional additive v2 field). "Add flags
    along" now **REPLACES**: `addFlagsAlong` first **deletes every flag tagged to
    that host** (a WHOLESALE replace — including any the user hand-moved after a
    prior generation; explicit + user-triggered, so the user simply doesn't re-run
    if they've tweaked flags they want to keep), then lays a fresh tagged set — all
    as ONE undo step. So after resizing a wall, one click re-spaces its flags. Flags
    tagged to a DIFFERENT host are untouched. A hand-placed flag has no marker.
  - **Design chooser + `lastFlagDesign`.** Clicking "Add flags along" opens a
    lightweight **chooser**: **Use last design** (the persisted `lastFlagDesign`
    pref, or a sensible default), **Pick from library** (a 2Fd saved design), or
    **Design new** (opens the flag editor in an **author mode** to compose one, then
    places with it). `lastFlagDesign` is a **persisted UI pref** (its own
    `localStorage` slot via `saveLastFlagDesign`/`loadLastFlagDesign`, a
    `lastFlagDesign` store slice, `setLastFlagDesign`) — **NOT part of the Design,
    NOT in undo, untouched by newDesign** — updated whenever a flag design is
    applied/edited (the editor's Apply / author-mode Apply). The chosen design is
    COPIED into each generated flag.
  - **Flag dimensions in the editor.** The flag editor also exposes the flag PIECE's
    **`poleHeight`/`clothWidth`** alongside the design controls, edited through the
    SAME working-copy → Apply/Cancel path (Cancel discards, Apply commits design +
    dimensions together as ONE undoable step). Critical separation:
    poleHeight/clothWidth are **properties of the Flag piece, NOT of `FlagDesign`** —
    **saving to the library saves only the design** (aspect + layers), and applying
    a library design **never changes** a flag's pole/cloth. `updateFlagDesign(id,
    design, dims?)` carries the optional dims so Apply is one coalesced entry.
- **Copy/paste (NOT present — deferred).** The project has **no copy/paste**
  (no store action, no clipboard, no keyboard/menu path) as of 2Fe.1, so the
  "paste preserves customized dimensions" work is **out of scope** and flagged for a
  future prompt (building copy/paste from scratch was explicitly out of scope for
  this slice). **When copy/paste IS added:** a paste must be a faithful clone of the
  source's params (all customized dimensions incl. the flag fields `poleHeight` /
  `clothWidth` / embedded `FlagDesign`), differing only by a fresh id + an offset
  position — **EXCEPT** it must **clear `autoFlagHostId`** (a pasted flag is a fresh
  independent hand-placed piece; keeping the marker would let a later re-run on that
  host delete the user's pasted copy).
- **Phase-2F sub-plan (build in order; one slice = one coherent commit):**
  - **2Fa (DONE):** the `FlagDesign` layer-stack model, the symbol library,
    the pure renderer + `flagTexture`, and the `#flags` QA route. **No editor, no
    placement, no flag piece, no library UI.**
  - **2Fb (DONE — this slice):** the **flag piece** (a cloth mesh skinned by
    `flagTexture`) + its **schema bump to v2** (with a v1→v2 migration) +
    single-anchor placement (ground / face-attach); a placed flag **embeds** its
    `FlagDesign`. Select / move / 15° rotate / delete + a pole/cloth param panel.
    **No editor yet** — placement seeds a default design (2Fc adds editing).
  - **2Fc (DONE — this slice):** the **flag editor** modal (add/reorder/edit
    layers; pick field/division, stripes, charges) operating on a **working copy**
    of the selected flag's embedded design, with a live `renderFlag` preview and
    **drag-on-preview** for charges (pure tested pixel→coord + hit-test). Apply
    commits ONE coalesced undoable edit (`updateFlagDesign`); Cancel/Esc/backdrop
    discard. **No library, no auto-place, no drag-reorder of layers.**
  - **2Fd (DONE — this slice):** the **saved-flags library** — its own persistence
    slot + pure CRUD (`src/flags/library.ts`), a `flagLibrary` store slice with
    named save/overwrite/rename/delete actions, and a picker in the flag editor
    (thumbnails via `renderFlag`, overwrite-or-save-as, apply-COPIES-not-links,
    rename/delete, library-only Export/Import). Separate from the castle Design,
    not in its Export JSON, untouched by New Castle. **No auto-place-along yet.**
  - **2Fe (DONE — this slice):** the **auto-place-along** convenience — a pure
    tested `flagPositionsAlong` (hosts: wall run + gatehouse; tower deferred), a
    store `addFlagsAlong` (one undoable batch, each flag embeds a copy of the
    default or a chosen library design), and an **Add flags along** panel control.
    **GENERATE-ONCE** (no live follow); a preview-layout fix pins the editor
    preview at a fixed width. **Flags are now feature-complete.**
  - **2Fe.1 (DONE — this slice):** auto-place **refinements** — the
    `Flag.autoFlagHostId` provenance marker + **re-run-replaces** (wholesale, one
    undo step, generate-once between clicks); a **design chooser** on "Add flags
    along" (use-last / pick-from-library / design-new) backed by a persisted
    `lastFlagDesign` pref; and **editor pole/cloth dimension** controls (piece props
    via the working-copy/Apply flow, **not** saved to the library). Copy/paste
    fidelity was **deferred** (the project has no copy/paste yet).
  - **Deferred:** **2Ff / Approach B** (freeform raster paint), flag
    animation/waving, and **copy/paste** (absent — a future prompt; when added,
    a pasted flag must clone all params but **clear `autoFlagHostId`**).

## Scope guards

- **Desktop, mouse + keyboard only.** Do not write touch handling.
- **Flat world only in phase 1.** No terrain editing/sculpting yet — but honor the
  ground-height seam so it's additive later.
- **No 2D plan editor.** Building happens in 3D.
- **No storey/level system.** Stacking is explicit vertical placement.
- **Riding is BUILT (phase 2G) but geometry-derived only — no wall↔tower
  attachment.** Moving/raising a piece carries its riders (computed fresh from
  geometry via `resolveSupportAt`; see "Riding (phase 2G)"). Still **no stored
  parent/child links, no relationship graph, no reconciliation**, and **no
  wall↔tower attachment** (walls still just overlap towers). Riders re-seating
  their own support during a ride, auto-roofs, and detach/re-parent UI are all
  **out of scope**.
- No real lighting/illumination design; no measurements/annotations beyond simple
  piece dimensions in the panel.
- Accessibility basics only: focus styles, button labels, no exotic ARIA work.
- **Flags: 2Fa (model + symbols + renderer + `#flags` route), 2Fb (the flag
  piece + schema v2 + placement), 2Fc (the flag editor), 2Fd (the saved-flags
  library), 2Fe (auto-place-along), and 2Fe.1 (auto-place refinements: provenance
  + re-run-replaces, the design chooser + `lastFlagDesign`, editor pole/cloth
  dimensions) are ALL DONE — flags are feature-complete.** Still **no** Approach B
  freeform paint (2Ff), **no** flag animation/waving, **no drag-reorder** of editor
  layers (up/down is enough), **no live-linked library flags** (applying always
  COPIES), **no live "flags follow the wall" auto-maintenance** (Add flags along is
  generate-once; re-spacing happens only on an explicit re-run), and **no
  copy/paste** (absent — deferred; when added, a pasted flag must clone all params
  but clear `autoFlagHostId`) — all deferred (see "Flags (phase 2F)").

## Phase plan

Phase 1 is sub-phased so each prompt ships one coherent slice (one prompt = one
coherent commit), the discipline carried over from the prior project. Build in
order; do not build ahead.

**Current status: PHASE 1 IS COMPLETE (1a–1e).** The full kit-of-parts
vocabulary exists. You can place / select / move / rotate / edit / delete
towers, gatehouses, wall runs, gates, moats, and ramps/stairs on the flat grid,
with undo/redo, autosave, Export/Import JSON (round-tripping all six kinds), and
CI green. **Post-1e refinements (still phase 1, not new scope):** the ramp aims
**exactly** at its connection (no 15° snap on the ramp heading; see 1e); wall
endpoints **snap to nearby tower/gatehouse anchors** (convenience only, no
attachment; see 1c); and a top-bar **New Castle** reset clears to a fresh empty
design after confirmation (see "State, undo, persistence"). **1b added:** the
material system (MaterialRef + runtime procedural patterns
stone/brick/thatch/opaque-water + `materialRefToThreeMaterial` in
`src/materials/`) wired through the piece meshes with a panel Fill control;
**crenellations** as a per-piece parameter; and **face-attach** placement
(`src/geometry/support.ts` → `resolveSupportAt`) so a piece seats on top of
another, the stored base routed through the support-height rule (`groundHeightAt`
over ground, the surface top over a piece — never a hardcoded 0), with the
placement path and the gizmo-move path resolving base through the *same* helper.

**1c added the masses — the gatehouse and the wall run:**
- The **crenellation logic is now one shared pure helper**
  (`src/geometry/crenellations.ts`: `merlonCount` + `roundCrenellations` +
  `rectCrenellations`) used by the tower, gatehouse, and wall-run builders — no
  duplicated merlon code. The tower renders identically after the extraction.
- The **gatehouse** is a single-anchor rectangular mass
  (`src/geometry/gatehouseBuilder.ts`), with every tower affordance reused:
  ground-raycast + face-attach placement and gizmo-move through
  `resolveSupportAt`, selection, rotation (15° steps via the panel), a param
  panel (width/depth/height + crenellations + material), delete.
- The **wall run** is a two-point horizontal piece
  (`src/geometry/wallRunBuilder.ts`). Placement is **two clicks** (start, then
  end with a live preview + length label); single segment, Esc cancels, a
  zero-length wall is ignored, endpoints snap to 0.1 m. A **whole-wall gizmo
  move** shifts both endpoints together; **per-endpoint handles** reshape one
  end (both undoable). **Base resolves via `resolveSupportAt` at the START
  anchor** — the whole wall sits at that one height; a wall spanning two
  different support heights is *not* handled in phase 1 (it takes the start
  anchor's height, which in this flat phase is always ground).
- Each rectangular piece's footprint comes from **one helper feeding both mesh
  and hit-test**: `gatehouseFootprint` / `wallRunFootprint`, both built on the
  shared `rectFootprint.ts` (oriented-rectangle contains, with the correct
  non-square rotation inverse). `resolveSupportAt` now seats on any footprinted
  piece's top (tower / gatehouse / wall run), picking the highest overlap.
- **Wall↔tower junctions overlap; there is no attachment relationship** (a wall
  whose end lands against a tower simply overlaps it — deliberate, per the
  geometry rules).
- **Endpoint snapping** (`src/geometry/snapEndpoint.ts`: `snapEndpoint` +
  `WALL_SNAP_TOLERANCE` ≈ 0.5 m): a wall endpoint **snaps to the nearest piece
  anchor** (tower / gatehouse **center**) within tolerance — nearest wins — else
  it falls back to the 0.1 m grid. It is **one shared pure helper** called by
  BOTH the placement path (each wall click, in `GroundInteraction`) and the
  endpoint-handle editing path (the live drag, in `WallRunMesh`) — never two
  copies. A subtle **snap ring** (`SnapRing`, on its own `SNAP_RING_LAYER`)
  shows at the anchor while snapping. This is **CONVENIENCE ONLY — it introduces
  NO attachment relationship**: the wall stays two plain stored points, nothing
  rides along if the anchor later moves, and the wall↔tower **overlap** is
  unchanged (the tower still hides the seam; snapping just lands the endpoint on
  the tower's center cleanly). The panel's endpoint number fields stay the
  precise/keyboard path (plain grid, no anchor snap).

**1d added the openings & water — the gate and the moat:**
- The **gate** is a freestanding **timber portcullis grid**
  (`src/geometry/gateBuilder.ts`: a lattice of vertical + horizontal bars; chosen
  over a flat plank door because the open grid reads unmistakably as a gate and
  looks correct standing in an archway). Phase 1 has **no CSG and no attachment**,
  so the gate does **not** cut a real opening — it is a standalone mass the user
  positions in a gatehouse archway or against a wall. Every tower affordance is
  reused: ground-raycast + **face-attach** placement and gizmo-move through
  `resolveSupportAt`, selection, rotation (15° steps so it can face across an
  archway), a param panel (width / height + material Fill), delete. Its footprint
  (`gateFootprint`, an oriented width × `GATE_THICKNESS` rectangle) feeds both the
  mesh and the hit-test.
- The **moat** is the first **non-box** piece and the first real test of the
  **opaque-water rule** (`src/geometry/moatBuilder.ts` + `moatFootprint.ts`). It
  renders through `materialRefToThreeMaterial` with the **water** pattern, which is
  **OPAQUE** — texture + a slight sheen, **never** real alpha/opacity-below-1 (that
  would reawaken the cutaway material-hiding bug). Two shapes share one builder:
  - **ring:** an annulus between `innerRadius` and `outerRadius` about `position`,
    lying flat at the ground. Hit-test = inside the outer circle AND outside the
    inner (`ringFootprintContains`). Single-anchor placement (one click) + radii
    from the panel (live geometry).
  - **segment:** a straight rectangular water strip from `position` to `end` with
    `width`, lying flat — an oriented rectangle reusing `rectFootprint`. Two-point
    placement (click start, click end); width from the panel.
  - The moat tool chooses ring vs. segment via a **panel sub-mode** (default ring),
    surfaced in the empty-selection panel when the Moat tool is active.
- The moat is **GROUND-ONLY**: it always seats at `groundHeightAt(position)` and
  **never face-attaches** (water-on-a-tower is nonsensical). Its base still routes
  through the ground-height rule (the underside is `groundHeightAt + base`, base
  always the ground-relative 0), so raised terrain stays additive; it just does not
  participate in face-attach (placement and the gizmo-move transient both keep it on
  the ground). It is also **not a stackable surface** — nothing face-attaches onto a
  moat (`resolveSupportAt` ignores it).
- The moat water sits on its **own named stacking layer** (`WATER_LAYER` in
  `src/components/preview/stacking.ts`, ground < grid < water < pieces) so the flat
  sheet never z-fights the ground plane or grid.

**1e added the navigation piece — the ramp/stair (built LAST, closing phase 1):**
- The **pure stair/ramp helper** (`src/geometry/rampBuilder.ts`, the analog of the
  prior project's `computeStair`) returns geometry parts in local space (underside
  at y=0, climbing along +Z). `style: "ramp"` → a single inclined slab from (0,0)
  up to (rise, run), pitched about local X; `style: "stair"` → solid stepped
  blocks, step count from a target riser (`STAIR_RISER_TARGET` ≈ 0.18 m), actual
  riser = rise/steps, tread = run/steps. Degenerate (zero/negative) rise/run is
  guarded (no parts). It is the **most-tested helper in phase 1**.
- The ramp is the **only piece placed by connecting two points**. The pure
  `resolveRampConnection` takes a bottom point (+ its support height via
  `resolveSupportAt`) and a top hit (+ its surface height) and returns
  `{ position, base, rotation, rise, run }`: `base` = the bottom support height,
  `rise` = top − bottom world height (clamped ≥ 0), `run` = the XZ distance (floored
  to a minimum), `rotation` = the **EXACT** bottom→top heading (`rampRotationToward`,
  normalized to [0, 360) with **NO 15° snap**). The ramp is the one piece that aims
  *precisely* at its connection — every other piece keeps the 15° rotation grid.
  **Literal connection — no slope-smartness**; a steep result is honest feedback,
  tuned in the panel after.
- **Two-click placement** (`GroundInteraction`): first click = the **bottom**
  (ground-raycast + face-attach through `resolveSupportAt`, so a ramp can start on
  the ground or on a flat piece top); second click = the **top** — if the ray's
  ground-projected XZ is over a real surface (tower/gatehouse/wall top, the existing
  face-attach set), `resolveRampConnection` spans the two; a live preview shows the
  resulting rise/run while aiming. **Graceful fallback:** a top click on empty
  ground creates a tunable **default ramp** from the bottom anchor (default
  rise/run/width/style from constants) — never errors, never gets stuck. Esc
  cancels; the tool stays active.
- One pure footprint helper (`rampFootprint`, a run × width oriented rectangle via
  `rectFootprint`) feeds both the mesh and the hit-test. Selection + gizmo move
  (base re-resolved through `resolveSupportAt` at the bottom anchor) + **free
  rotation** (the ramp's panel rotation field is un-snapped — 1° steps, normalized
  to [0, 360) — consistent with the precise two-click aim; all other pieces stay on
  the 15° grid) + delete + a param panel (style ramp/stair, rise, run, width,
  rotation, material).
- A **ramp is NOT a face-attach target** — its top is a slope, not a flat surface.
  It can be placed **onto** flat tops, but **nothing face-attaches onto it** and the
  top-click surface set excludes ramps (`resolveSupportAt` ignores ramps as both a
  containment and a top surface).

One scoping note still holds: **working-plane-at-arbitrary-height placement is
deferred** — the ramp's top click must hit a real surface; empty-air top points are
a phase 2+ deferral (face-attach covers the stacking these phases need).

**Post-1e refinement — "Keep on ground" toggle (still phase 1, not new scope):**
One toggle tab on the right of the viewport, shown **while a piece is selected**
(hidden otherwise), changes how a moved/dragged piece resolves its support. It is
a **persisted UI preference — NOT part of the `Design`, NOT in undo history** (the
snapToWall-style pref pattern): stored in its own `localStorage` slot
(`savePlacementMode` / `loadPlacementMode` in `src/persistence/storage.ts`),
hydrated into the store on boot, survives reload, and is untouched by `newDesign`.
- Modeled as ONE enum `placementMode: "normal" | "groundOnly"` on the store
  (default `"normal"` = off), set through the `setPlacementMode` action. The tab
  (`components/ui/PlacementModeTabs.tsx`) flips between the two.
- The behavior routes through the ONE shared support path, **not a duplicate**:
  `resolveSupportAt(anchor, pieces, mode)` is mode-aware — `groundOnly`
  short-circuits to the ground (skips surface hits; base still routed through
  `groundHeightAt`), `normal` is the default face-attach rule (ground or a piece
  top). The mode is **read in the move path**: the store's
  `setPiecePositionTransient` passes `state.placementMode` straight into
  `resolveSupportAt`. The moat stays inherently ground-only regardless of the
  toggle.
- **Scoped to the move/drag path** (a selected piece being dragged) — initial
  placement of a NEW piece is deliberately unaffected (the tab only shows with a
  selection, and the placement path calls `resolveSupportAt` with the default
  `"normal"` mode).

**Post-1e refinement — the "Place on top" one-shot action (still phase 1, not new
scope):** A **"Place on top of…"** button in the selected piece's properties panel
(`PlaceOnTopButton` in `components/ui/PiecePanel.tsx`), shown for **every piece
except the moat** (water can't be the piece being placed). It replaces the old
persisted center-on-support mode with an **explicit, one-shot action** — the
generate-once-and-explicit-beats-clever-auto lesson.
- **Armed state** is a transient UI flag `placeOnTopArmed` on the store (NOT part
  of the `Design`, NOT persisted, NOT in undo history), set/cleared by
  `armPlaceOnTop` / `cancelPlaceOnTop`. While armed the button shows an active
  state and a viewport banner (`PlaceOnTopHint`) + crosshair cursor hint the user
  to click a target.
- While armed, a click on a piece routes through `placeOnTopTarget(targetId)`
  (the six mesh click handlers branch on `placeOnTopArmed` before selecting)
  instead of selecting. The pure resolver `resolvePlaceOnTop(moving, target)` in
  `src/geometry/placeOnTop.ts` returns `{ position, base, end? }`: `base` seats on
  the **target's flat top** via the SHARED height helper `flatTopWorldY` in
  `support.ts` (the same `groundHeightAt + base + height` logic face-attach uses —
  **never a literal**), and the moving piece's footprint **center** aligns to the
  **target's own `position` anchor** (the footprint source of truth — never a
  separately computed center). A **two-point wall** shifts **both endpoints
  rigidly** so its midpoint lands on the target center. It is **ONE undoable step**
  (`placeOnTopTarget` calls the store's `commit`); the moved piece **stays
  selected** and the action ends (disarms).
- **Overhang is allowed** — a moving piece larger than the target top still
  centers (honest, visible; nudge/move after). **No blocking, no rejection.**
- **Excluded targets: the moat and the ramp** — derived from `flatTopWorldY`
  returning null (a moat is flat water / not a face-attach surface; a ramp's top is
  a slope). `isPlaceOnTopTarget(piece)` = `flatTopWorldY(piece) !== null`, so the
  target set is exactly {tower, gatehouse, wall run, gate} and can't drift from the
  height helper. Clicking an excluded target while armed is a **no-op that stays
  armed** (pick a real target without re-arming); clicking the **already-selected
  piece** cancels; **Esc** (via `useKeyboardShortcuts`, without deselecting) or a
  click on **empty ground** (via `GroundInteraction`) cancels with the selection
  unchanged.
- After placing, the piece rests on the target and can be freely gizmo-moved on top
  (normal move behavior) or sent elsewhere by arming "Place on top" again.

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
- **2F (flags):** heraldic flags as a self-contained feature, sub-phased 2Fa–2Fe
  (+ **2Fe.1** refinements) — **all complete; flags are feature-complete** (2Ff /
  Approach B + waving still deferred; **copy/paste** absent → deferred). 2Fa shipped
  the `FlagDesign` layer-stack model, the SVG symbol
  library, the pure renderer + `flagTexture`, and the `#flags` QA route; **2Fb**
  added the **flag piece** (pole + cloth skinned by `flagTexture`), the **schema
  bump to v2** (with a v1→v2 migration), and single-anchor placement (a placed flag
  **embeds** its `FlagDesign`); **2Fc** added the **flag editor** modal
  (working-copy layer add/reorder/edit + a live `renderFlag` preview +
  drag-on-preview for charges, applied via one coalesced undoable
  `updateFlagDesign`); **2Fd** added the **saved-flags library** — a separate
  per-origin store of named designs (`src/flags/library.ts` CRUD + a `flagLibrary`
  store slice), with an editor panel for overwrite-or-save-as, an Apply picker
  (renderFlag thumbnails, copies-not-links), rename/delete, and library-only
  Export/Import; **2Fe** added **auto-place-along** — a pure `flagPositionsAlong`
  (hosts: wall run + gatehouse), a store `addFlagsAlong` (one undoable batch,
  generate-once), and an **Add flags along** panel control, plus a fixed-width
  editor-preview layout fix; **2Fe.1** refined auto-place with a host **provenance
  marker** (`autoFlagHostId`) + **re-run-replaces** (wholesale, one undo step), a
  **design chooser** (use-last / library / design-new) backed by a persisted
  `lastFlagDesign`, and **editor pole/cloth dimension** controls (piece props, not
  saved to the library) — see "Flags (phase 2F)".
- **2G (riding — DONE):** stacked pieces move/rise with the piece beneath them,
  **geometry-derived** (no stored links). A pure `ridersOf`/`allRidersOf`
  (`src/geometry/riders.ts`, reusing `resolveSupportAt`) feeds the move commit
  (one horizontal delta to the whole transitive set) and the resize/raise commit
  (the same vertical delta on a top-height/base change) — each ONE undo step. See
  "Riding (phase 2G)".
- **2+:** raised terrain (tiers / motte via `groundHeightAt`), **persisted**
  parent/child relationships (2G already does riding without them), wall↔tower
  attachment, more pieces, more freedom. Do not start any of this without
  instruction.
