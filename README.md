# Castle Builder

A browser-based, **3D-first** castle builder. You place semantic castle pieces
directly in a 3D scene on a grid, then tweak each piece's parameters. Everything
runs client-side — no backend.

> **Phase 1 is complete.** The full kit-of-parts vocabulary exists: place /
> select / move / rotate / edit / delete **towers, gatehouses, wall runs, gates,
> moats, and ramps/stairs** on a flat ground grid, with undo/redo and autosave,
> **procedural materials** (solid + stone / brick / thatch / opaque-water
> patterns), **crenellations** (one shared merlon helper across the masses), and
> **face-attach** for both placement and gizmo moves (seat a piece on top of
> another). Wall runs draw with **two clicks** (live preview + length label), move
> whole-wall via a gizmo, and reshape per-endpoint via drag handles. The **gate**
> is a freestanding timber portcullis (it positions in an archway / against a wall
> — it does not cut a real opening). The **moat** is **opaque water** (ring or
> segment), ground-only, on its own stacking layer. The **ramp/stair** is the only
> piece placed by **connecting two heights** — click a bottom, then a top surface,
> and it computes its own params to literally span them (with a graceful default
> when the top click misses a surface). `CLAUDE.md` is the source of truth for
> conventions, the data model, and scope.
>
> **Flags (phase 2F) are feature-complete (2Fa–2Fe).** A **flag** is a real
> placeable piece — a cloth on a pole you plant one at a time (on the ground or on
> top of a piece), carrying its **own embedded heraldic design** rendered onto the
> cloth. This bumped the schema to **v2** (with a v1→v2 migration). The **flag
> editor (2Fc)** lets you select a flag and click **Edit design…** to compose its
> layer stack (add / remove / reorder field, stripes, and charges), with a **live
> preview** and **drag-on-preview** to reposition charges. The **saved-flags
> library (2Fd)** lets you name and save designs from the editor
> (**overwrite-or-save-as**), then **apply** any saved design onto another flag —
> applying **copies** it in (no live link); the library is per-origin browser
> storage, **separate** from the castle (not in a castle's Export JSON, untouched by
> New Castle). **Auto-place-along (2Fe, refined in 2Fe.1):** with a **wall run** or
> **gatehouse** selected, **Add flags along** drops a row of evenly-spaced flags
> across its top in **one undoable step** — pick spacing, then a small **chooser**
> for the design (use your last-edited design, pick a saved one, or design a new one
> on the spot). Clicking it again **re-runs and replaces** that host's row (handy
> after resizing a wall); between clicks the flags are **generate-once** (ordinary
> independent pieces that don't follow host edits until you re-run). The flag editor
> also lets you tweak a flag's **pole height / cloth width** in one place (piece
> properties — not saved to the library). **Deferred:** freeform raster paint
> (Approach B / 2Ff), flag animation/waving, and **copy/paste** (not yet in the app).
>
> **Riding (phase 2G) is built.** Stacked pieces **move and rise with the piece
> beneath them**: move a piece and everything resting on its top rides along; raise
> a piece's height (or base) and its riders rise to stay on top — recursively, each
> as **one undo step**. Riders are **computed fresh from geometry** ("what is on the
> top right now?", reusing the same support rule as face-attach) — there are **no
> stored parent/child links, no relationship graph, and no reconciliation**. A flag
> on a tower rides; nothing rides a moat; a horizontal-only edit (material, radius,
> rotation) moves no riders. A wrong guess is always undoable. **Delete-drop:**
> deleting a piece no longer leaves its riders floating — each orphaned rider
> **re-seats onto whatever support is now beneath it** (the next piece's top, else
> the ground), carrying its own sub-stack down as a rigid unit, all in the delete's
> **one undo step** (reusing the same riding geometry).
>
> **Roofs (phase 2H) are built.** Any **tower, gatehouse, wall run, or ramp** (NOT
> gate / flag / moat) can carry a **roof** — a **per-piece render parameter** drawn
> by the host itself (exactly like crenellations), **not** an independent object.
> A **round tower** gets a **cone**, a **square tower / gatehouse** a **pyramid**, a
> **wall run** a **posted gabled cover** (an open covered wall-walk), and a **ramp**
> a **posted cover parallel to the incline**. Roofs have their **own material**
> (separate from the wall material) and **coexist with crenellations** (teeth around
> the rim, roof rising within/above). tower/gatehouse roofs sit **flush on the
> crown** by default or can be **raised on posts**; the wall-walk and ramp covers
> are **always posted**. Because a roof is derived fresh from the piece, it
> **moves / resizes / rides / deletes with the host automatically** — there is **no
> floating-roof problem and no auto-detection / reconciliation** system.

## Tech stack

- Vite + React + TypeScript (strict)
- three + @react-three/fiber + @react-three/drei
- Zustand (single store, all app state)
- Vitest (unit) + Playwright (end-to-end)

## Running it

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck (tsc -b) + production build
npm test           # Vitest unit tests
npm run test:e2e   # Playwright end-to-end tests (builds + previews first)
```

`npm run dev` should start clean with no console errors.

## Controls

| Action | How |
| --- | --- |
| Orbit camera | Drag (left mouse). Locked so it can't go below the ground. |
| Zoom | Mouse wheel / trackpad scroll |
| Pan | Right-drag |
| **Tower tool** | Click the ground to place a tower at the grid-snapped cursor; the tool stays active. The ghost preview tints **blue on the ground** and **green when face-attaching** to a piece top. `Esc` cancels the in-progress placement. |
| **Gatehouse tool** | Click the ground to place a gatehouse (a rectangular mass) at the grid-snapped cursor; same ghost/face-attach behavior as the tower. |
| **Wall tool** | **Two clicks**: click a start point, then an end point — a live preview wall with a **length label** follows the cursor between them. Single segment per draw (the tool stays active for the next wall). Endpoints **snap to a nearby tower / gatehouse anchor** (within ~0.5 m — a **snap ring** shows the latch) so curtain walls join corner towers cleanly, otherwise they snap to the 0.1 m grid. Snapping is **convenience only — no attachment** (the wall stays two points; nothing rides along if the tower later moves). A zero-length wall is ignored; `Esc` cancels the in-progress wall. |
| **Gate tool** | Click the ground to place a **freestanding timber gate** (a portcullis lattice) at the grid-snapped cursor; same ghost / face-attach behavior as the tower. It's a standalone piece — position it in a gatehouse archway or against a wall; it does **not** cut a real opening (no CSG in phase 1). Rotate it (15° steps in the panel) to face across the archway. |
| **Moat tool** | Places **opaque water**. Pick a **sub-mode** in the panel (shown when the Moat tool is active): **Ring** (default) is a single click — an annulus with editable inner/outer radii; **Segment** is **two clicks** (start, then end) — a straight strip with an editable width. A moat is **ground-only** (it never face-attaches) and sits on its own water layer so it can't z-fight the ground. `Esc` cancels an in-progress segment. |
| **Ramp tool** | A **connection**, placed with **two clicks**: click a **bottom** (on the ground, or on a flat piece top via face-attach), then a **top surface** (a tower / gatehouse / wall top). The ramp computes its own `rise` / `run` / heading to **literally span** the two points — a live preview shows the resulting rise/run while you aim. The heading is **exact** (the ramp aims precisely at the connection — **no 15° rotation snap**, unlike every other piece). The connection is literal (no slope-smartness), so a steep result is honest feedback; tune it in the panel afterward. If the **top click misses a real surface** (empty ground), it falls back to a **tunable default ramp** from the bottom anchor instead of getting stuck. `Esc` cancels. A ramp can sit **on** flat tops, but **nothing face-attaches onto a ramp** (its top is a slope). |
| **Flag tool** | Click the ground to plant a **flag** (a cloth on a pole) at the grid-snapped cursor — one at a time; same ghost / face-attach behavior as the tower, so a flag can plant on the ground or **on top of a piece** (a flag on a tower top is a real castle move). Each flag carries its **own embedded heraldic design** (seeded with a default; edit it via **Edit design…**, or apply a saved one from the flag library), rendered onto the cloth. `Esc` cancels; the tool stays active. A flag is **not** a face-attach **target** — nothing stacks on a flag (its top is a pole/cloth). |
| **Face-attach** | With the tower / gatehouse / wall / **gate** / **ramp** / **flag** tool, place over an existing piece's footprint: the new piece (or a ramp's **bottom** anchor) seats on that piece's **top** (its stored base = the lower piece's top), instead of on the ground. A wall seats at its **start** anchor's support height. (The moat is exempt — it always seats on the ground; and the ramp / **flag** are never face-attach **targets**.) |
| **Select tool** | Click a piece to select it; click empty ground to deselect. |
| Move a selected piece | Drag the on-screen translate gizmo (snaps to 0.1 m; one undo step per drag). Moving uses the **same face-attach rule as placement**, subject to the **Keep on ground** toggle below. For a wall, the gizmo moves the **whole wall** (both endpoints together). Anything **resting on** the moved piece **rides along with it** (see **Riding** below). |
| **Riding** | Stacked pieces **follow the piece beneath them**. Move a piece and everything stacked on its top moves with it; raise a piece's **height** (or base) and its riders **rise to stay on top** — recursively (a whole stack rides the bottom), each as **one undo step**. Riders are figured out **fresh from the geometry** each time (what is sitting on the top right now, using the same rule as face-attach) — there's **no saved "attached to" link**, so nothing to get out of sync. A flag on a tower rides the tower; a moat carries nothing (it has no top). A **horizontal-only** edit (material, radius, rotation) moves no riders. It's a best-guess convenience, and a wrong guess is just **one Ctrl+Z**. |
| **Keep on ground** | A toggle tab on the **right of the viewport**, shown **while a piece is selected** (hidden otherwise). When **on**, a moved piece ignores face-attach and always seats on the ground (never climbs onto other pieces); when **off** (the default), moving uses the normal face-attach rule. It **persists until you turn it off** (a saved preference — **not** part of the design and **not** in undo history) and applies to the **move/drag** path (initial placement of a new piece is unaffected). |
| **Place on top of…** | A button in a selected piece's properties panel (every piece **except the moat**). Click it to **arm** a one-shot action (a banner + crosshair prompt you to click a target); the **next click on another piece** seats the selected piece on **that piece's top**, centered on it (a wall recenters both endpoints), as **one undo step** — the piece stays selected and the action ends. Overhang is fine (a larger piece just overhangs). **Excluded targets: the moat, ramps, and flags** (no flat top) — clicking one stays armed. `Esc`, a click on empty ground, or clicking the selected piece itself **cancels** with the selection unchanged. |
| Reshape a wall | A selected wall shows a **draggable handle at each end** — drag one to move that endpoint only (it **snaps to a nearby tower / gatehouse anchor**, shown by a snap ring, else the 0.1 m grid; one undo step). Start/End coordinates are also editable as number fields in the panel (the precise/keyboard path — plain grid, no anchor snap). |
| Edit a piece | Use the properties panel: tower (profile, radius/half-extent, height, rotation), gatehouse (width/depth/height, rotation), wall (height, thickness, endpoints) — each with **crenellations** (toggle + merlon size) — gate (width, height, rotation), moat (ring: inner/outer radii; segment: width), **ramp** (style ramp/stair, rise, run, width, **free rotation** — 1° steps, un-snapped, matching its precise two-click aim), **flag** (pole height, cloth width, rotation, plus **Edit design…** to open the flag editor — compose the embedded heraldic design: add/reorder field, stripes, and charges, with a live preview and drag-on-preview for charges; the editor **also** exposes the flag's **pole height** and **cloth width** so you can fully customize a flag in one place — those are piece properties committed with the design on **Apply**, and are **never** saved to the flag library). Each castle piece carries a **material** (solid color or a stone / brick / thatch / water pattern); a flag's cloth is skinned by its embedded design instead. |
| **Roof** | A selected **tower / gatehouse / wall run / ramp** panel has a **Roof** toggle; turning it on reveals a **pitch** field, a **roof material** control (its own Fill/Color, separate from the wall material), and — for **tower / gatehouse** only — a **Raised on posts** toggle (flush on the crown by default; the wall-walk / ramp covers are always posted, shown by a note). Shapes: round tower → cone, square tower / gatehouse → pyramid, wall run → posted gabled cover, ramp → posted incline cover. Roofs **coexist with crenellations** and **ride / move / resize / delete with the host** (they're a per-piece parameter, not a separate object). Every roof edit is **undoable**; toggling the roof **off keeps** its stored pitch/material so toggling back on restores them. (Gate, flag, and moat can't be roofed.) |
| **Add flags along** | A button in a selected **wall run** or **gatehouse** panel: it **generates a row of flags** evenly spaced across the host's **top edge** (a wall along its length; a gatehouse across its width), inset from the ends, as **one undo step**. Pick the **flag spacing**, then a small **chooser** for which design each flag embeds: **Use last design** (the last design you edited, or a sensible default), **Pick from library** (a saved design), or **Design new** (compose one in the flag editor, then place). Clicking it again **re-runs and REPLACES**: it first removes every flag it previously generated **for that host** (including any you hand-moved), then lays a fresh set — so after resizing a wall, one click re-spaces its flags (all one undo step). It stays **generate-once** *between* clicks: the created flags are ordinary independent pieces (selectable / movable / editable / deletable) and don't follow later host edits until you explicitly re-run. |
| Delete | `Delete` / `Backspace`, or the panel's Delete button. |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`), or the toolbar buttons. History is capped at 100. |
| **New Castle** | A top-bar button that clears the current design and starts fresh. It asks for **confirmation first** (Cancel / `Esc` / clicking the backdrop all dismiss with no change; only **Start new** resets). The reset is destructive and **irreversible once autosave overwrites** — **Export JSON first** if you want to keep the current castle. |
| Export / Import | Buttons in the bottom bar — save or load a design as JSON. |

## Persistence

Your work **autosaves into this browser only** (a single `localStorage` slot).
Clearing browser data erases it, so use **Export JSON** to keep a backup and
**Import JSON** to restore it. Designs carry a `schemaVersion` (currently **v3**);
an **older** design is **migrated** forward on open (v1 → v2 just adds flags; v2 →
v3 gives existing roof-host pieces `roofed: false` plus the roof defaults — both
leaving existing pieces otherwise untouched), while a file from a **newer, unknown**
version is refused rather than risking corruption. An exported castle carries its flags
inline (each flag embeds its own design), so Export/Import round-trips them for
free.

The **saved-flags library** is a **separate** per-origin store (its own
`localStorage` slot), holding your named flag designs. It is **not** part of the
castle `Design`: it is **not** in a castle's Export JSON and is **untouched by New
Castle**. Because it doesn't ride along in a castle export, the flag editor offers
its own **Export library / Import library** JSON — the backup path for the palette.
The single browser-storage disclosure (in the bottom bar) covers both the castle
autosave and this library.
**New Castle** clears everything to a fresh empty design (after confirmation) and
autosaves the empty design — so a later reload resumes empty, not the old castle.
The reset runs through one atomic store action (`newDesign`) that also clears the
selection, undo/redo history, and any in-progress placement, and remounts the
editor tree clean (a `bootNonce` key) so no stale reference to a deleted piece can
linger.

The **Keep on ground** toggle is a saved **UI preference**, stored in a separate
`localStorage` slot — **not** part of the design document and **not** in undo
history. It survives reload independently of the castle, and **New Castle** does
not reset it. The **last-used flag design** (which backs the "Use last design"
option of the "Add flags along" chooser) is another such saved preference in its
own slot — updated whenever you apply/edit a flag design, not part of the Design,
not in undo history, and untouched by New Castle. (The **Place on top** action is a
transient one-shot — not saved, not in undo history for the arming itself; only the
resulting placement is one undoable step.)

## Flags (phase 2F)

Heraldic **flags** are a self-contained feature built alongside the castle kit.
**Slices 2Fa–2Fe are done — flags are feature-complete.** 2Fa shipped the
foundation — the layer-stack data model, the symbol library, the renderer, and a
dev QA route. **2Fb** added the flag as a real placeable piece — a cloth on a pole,
planted one at a time (ground or face-attach), carrying its **own embedded
`FlagDesign`** rendered onto the cloth via the 2Fa renderer (schema bumped to **v2**
with a v1→v2 migration). **2Fc** added the flag editor — a modal that composes the
selected flag's embedded design. **2Fd** added the saved-flags library — a
persistent, named palette of designs you save from the editor and reuse across
flags and castles. **2Fe adds auto-place-along:** a one-click **Add flags along**
action that drops a row of independent flags across a wall run or gatehouse top.
**2Fe.1 refines it:** each auto-flag is tagged to its host so a re-run **replaces**
that host's row (wholesale, one undo step); "Add flags along" opens a **design
chooser** (use your last-edited design, pick a saved one, or design a new one)
backed by a persisted **last-used design**; and the flag editor now also edits a
flag's **pole height / cloth width** (piece properties, never saved to the
library). **Deferred:** freeform raster paint (**2Ff / Approach B**), flag
animation/waving, and **copy/paste** (the app has none yet — when added, a pasted
flag must clone all params but drop the auto-placement host tag).

- **The model — a layer stack.** A `FlagDesign` is `{ aspect, layers[] }` drawn
  **back-to-front**: a **field** (a solid color or a `perPale` / `perFess` /
  `perBend` / `quarterly` division), **stripes** (N horizontal / vertical /
  diagonal bands), and **charges** (preset symbols positioned by normalized
  coordinates, scaled, colored, optionally rotated). It's plain data that
  round-trips through JSON.
- **The symbol library.** Hand-authored SVG silhouettes — **star, cross,
  fleur-de-lis, lion, dragon, eagle, crown** — derived from one `SYMBOL_IDS` list
  (adding one is additive).
- **The renderer.** `renderFlag(design, canvas)` composites the stack onto an
  offscreen canvas (**opaque**, no real transparency), reusing the material
  system's canvas→texture path (`flagTexture` yields a Three.js texture). The
  per-layer layout math is pure and unit-tested; the raster is never pixel-tested.
- **The flag piece (2Fb).** A flag is a **pole + a static cloth** (a builder in
  `src/geometry/flagBuilder.ts`, footprint in `flagFootprint.ts`). The cloth is
  skinned by `flagTexture(flag.design)` — **opaque, double-sided, slightly
  curved** so it doesn't read as flat cardboard (no waving — deferred). A placed
  flag **embeds its full `FlagDesign`** (the design travels with the piece), so it
  never changes underneath you and Export/Import carries it inline.
- **The flag editor (2Fc).** With a flag selected, **Edit design…** opens a modal
  that edits a **working copy** of the flag's embedded `FlagDesign`; only **Apply**
  commits it — as **one coalesced, undoable** store edit (`updateFlagDesign`) —
  while **Cancel / Esc / backdrop** discard. A **live preview** re-renders the
  working design through the very same `renderFlag`, so the preview and the placed
  cloth can't drift. You can **add / remove / reorder** layers (up/down controls;
  order = draw order, back → front) and edit each: a **field** (solid or a
  division, a color per section), **stripes** (orientation, count, a color per
  band), or a **charge** (symbol from `SYMBOL_IDS`, x/y, scale, color, rotation).
  Charges are **draggable directly on the preview** — the pixel→coord mapping and
  the hit-test are **pure, tested** functions (`previewPixelToFlagCoord`,
  `chargeAtPoint` in `src/flags/editorPicking.ts`) reusing the renderer's own
  charge transform, and dragging edits the **same** x/y the sliders do (one source
  of truth — no drift). Editing the **aspect** reshapes the cloth on Apply. The
  preview is pinned in a **fixed-width** box: only its **height** varies with the
  aspect (`height = width / aspect`, clamped, letterboxed/centered — never
  stretched), so changing the aspect **never reflows** the surrounding controls
  (the box reserves the max height). The pixel→coord mapping accounts for the
  letterboxing, so charge-dragging stays accurate at any aspect.
- **The saved-flags library (2Fd).** A per-origin palette of **named** designs,
  managed from a panel inside the flag editor. **Save to library** captures the
  current working design under a name, with **overwrite-or-save-as**: a design
  applied *from* a library entry can **Overwrite** that entry or **Save as new**; a
  hand-built design only Saves as a new named entry — overwriting is always an
  explicit choice (never a silent clobber). The picker lists entries with
  `renderFlag` **thumbnails**; **Apply** copies a design into the editor's working
  copy — a **copy, not a live link** (editing the flag afterward doesn't touch the
  library entry, and vice versa) — committed on the editor's Apply like any other
  edit. Entries can be **renamed** and **deleted** (delete is a two-step confirm);
  deleting an entry does **not** affect any placed flag that already embedded a copy
  of it. The library is its **own** `localStorage` slot — **separate** from the
  castle, **not** in a castle's Export JSON, and **untouched by New Castle** — so it
  also has its own **Export library / Import library** JSON backup. The pure library
  CRUD lives in `src/flags/library.ts` (unit-tested); the UI is
  `src/components/ui/FlagLibraryPanel.tsx`.
- **Auto-place-along (2Fe).** With a **wall run** or **gatehouse** selected, the
  panel's **Add flags along** button generates a row of independent `Flag` pieces
  evenly spaced along the host's flat **top edge** — a wall along its length, a
  gatehouse across its width (both derived from one pure helper,
  `flagPositionsAlong` in `src/geometry/flagAlong.ts`, unit-tested: N positions for
  a length/spacing, inset from the ends, seated on the host's top via the shared
  `flatTopWorldY` — never a literal). A small control picks the **spacing** and
  **which design** each flag embeds (the default, or a copy of a saved library
  design). It is **one undoable step** (the store's `addFlagsAlong`), and
  **generate-once**: the flags become ordinary independent pieces immediately — no
  live link to the host, so resizing/moving the wall later does **not** move or
  re-space them (the same generate-once-and-explicit caution as the rest of the
  builder). Supported hosts are **wall run + gatehouse only**; a tower (round/point
  top) is deferred — place a single flag on it by hand.
- **Dev QA route.** Open **`#flags`** (e.g. `http://localhost:5173/#flags`) — a
  dev-only screen (not in the main app) that renders example flags (solid,
  tricolor, quartered, field+charge, busy) and the full symbol library, so the
  renderer can be eyeballed before the editor exists.
- **Sub-plan:** **2Fa** model + symbols + renderer (**done**) → **2Fb** flag piece
  + schema bump + placement (**done**) → **2Fc** editor (**done**) → **2Fd**
  saved-flags library (**done**) → **2Fe** auto-place-along (**done**). Flags are
  **feature-complete**; **2Ff / Approach B** (freeform raster paint) and flag
  waving remain deferred.

## Coordinates & units

Lengths are **meters** (UI shows cm precision). World space is Y-up; the ground is
the XZ plane. Horizontal grid snap is **0.1 m**, vertical **0.5 m**, rotation
**15°**. Ground height routes through a single `groundHeightAt(x, z)` accessor
(returns 0 in this flat phase) so raised terrain can slot in later.

## Project layout

```
src/
  geometry/            pure, unit-tested math (grid snapping, ground height,
                       the shared crenellation helper, per-piece builders +
                       footprints for tower/gatehouse/wall/gate/moat/ramp/flag,
                       the shared oriented-rectangle footprint, the ring footprint,
                       the ramp/stair builder + two-point connection helper,
                       support/face-attach resolution, the geometry-derived
                       riders helper (riders.ts, phase 2G) + delete-drop
                       (deleteDrop.ts), the pure roof geometry (roofs.ts, phase 2H),
                       wall-endpoint anchor snapping, iso camera) — no React, no store
  materials/           MaterialRef → THREE factory + procedural pattern textures
                       (stone/brick/thatch/opaque-water), generated at runtime;
                       the shared canvasToTexture helper (patterns + flags)
  flags/               (phase 2F) the FlagDesign layer-stack model, the pure
                       layout math + renderFlag, flagTexture, the hand-authored
                       symbol library (symbols/), and the dev #flags QA route
                       (the flag *piece* builder/mesh live under geometry/ +
                       components/preview, consuming flagTexture)
  store/               Zustand store, schema v3, undo/redo, ?e2e=1 test accessor
  persistence/         autosave + JSON export/import + schema validation +
                       stepwise migrations (migrations.ts, e.g. v1 → v2 → v3)
  components/preview/   the R3F scene, ground/grid, pieces, gizmo, placement
  components/ui/        toolbar, properties panel (+ Place-on-top action),
                       Keep-on-ground toggle, place-on-top hint banner,
                       file/export bar, New Castle button + confirmation dialog
  hooks/                keyboard shortcuts, autosave wiring
scripts/               CI guard scripts (ground-seam, e2e-no-canvas)
e2e/                   Playwright tests (assert on DOM/store state, never canvas pixels)
```

## Deploy (Vercel)

Static SPA. `base: '/'` plus `vercel.json` rewrites all routes to `index.html`.
Build command `npm run build`, output `dist/`.

## Testing notes

- Unit tests cover grid snapping, `groundHeightAt`, the shared crenellation
  helper (teeth count/size for round & rectangular edges), the tower footprint
  helper, the gatehouse + wall-run builders and footprints (dimensions, length,
  orientation, oriented-rectangle hit-test), the **gate** builder + footprint
  (portcullis bar layout, oriented hit-test), the **moat** ring + segment builders
  and footprints (ring inside/outside hit-test, segment oriented hit-test), the
  **ramp/stair** builder (ramp slab extent, stair step count vs rise, actual riser
  ≈ target, degenerate inputs) + its two-point **connection** helper (rise/run/
  rotation from two points, clamps for top-below-bottom and zero distance) +
  footprint (run × width oriented hit-test), support/face-attach resolution across
  piece kinds (including the wall's start-anchor base rule, the gate face-attaching
  onto a piece, the moat being ground-only / never a stackable surface, and the
  **ramp never being a face-attach target** while its bottom still seats on tops),
  **wall-endpoint snapping** (snaps to the nearest tower/gatehouse anchor in range,
  nearest-wins, grid fallback, ignores non-anchor pieces),
  the wall endpoint/whole-wall move
  actions, the iso camera, store actions + undo/redo (one snapshot per committed
  op, with the 100-entry cap and eviction), the **`newDesign` reset** (fresh empty
  doc + selection/history/pending-snapshot cleared + `bootNonce` bumped), the
  procedural-material logic (opaque output, pattern ids), the **placement-mode**
  support resolution (ground-only forces the ground even over a surface; normal is
  unchanged) and its **mode-aware move path**, the **"Place on top" resolver**
  (`resolvePlaceOnTop`: base = the target's flat top via the shared `flatTopWorldY`
  helper — asserted to be the surface height, not the ground — anchor = the
  target's center, a two-point wall recenters both endpoints, overhang still
  centers, and the moat/ramp are excluded targets) plus its **store action**
  (arm → target → one undoable placement, stays selected; invalid-target no-op;
  self-click cancel), the **flag builder** (pole + cloth dimensions, the
  aspect-derived cloth height, the cloth footprint), the **riders helper (phase
  2G)** — `ridersOf`/`allRidersOf` (a piece on a tower is a rider; near-but-not-
  overlapping / wrong-height is not; the transitive set of a 3-high stack; each
  piece once even through a diamond; a contrived cycle terminates; a flag on a
  tower is included; nothing rides a moat; it matches `resolveSupportAt`) and the
  **store riding paths** (move applies one delta to the whole set as one undo step;
  a resize/raise applies the vertical delta to riders; non-height edits move
  nothing), **delete-drop (phase 2H)** — `dropRidersAfterDelete` (both worked
  examples: deleting the base drops the sub-stack to the ground; deleting the middle
  re-seats the top onto the next piece's top; a 3-high sub-stack falls rigidly;
  non-riders untouched; pure/no-mutation), the **roof geometry (phase 2H)** —
  `roofs.ts` (cone from radius+pitch, pyramid from footprint+pitch, wall-cover ridge
  = wall length with opposed gable slopes, ramp-cover pitch parallels the ramp slab
  + slope length, always-posted wall/ramp with post height/count, raised
  tower/gatehouse posts + lift, crenellated+roofed drawing both, roofed:false draws
  nothing), the **v1 → v2 and v2 → v3 migrations**
  (a v1 fixture loads at the current version untouched; a v2 fixture gains
  `roofed: false` + roof defaults on host pieces while a gate stays untouched) and
  **flag validation** (a
  flag round-trips its embedded design; malformed flags are rejected), and schema
  validation.
- E2E tests cover clean boot, placing a tower, select + delete, undo/redo,
  autosave surviving a reload, toggling crenellations + changing material,
  face-attach, placing a gatehouse (edit/rotate/delete), drawing a wall with two
  clicks, selecting + deleting a wall, dragging a wall endpoint, placing a **gate**
  (edit/rotate/delete + face-attach onto a wall top), placing a **ring moat**
  (edit radii, delete), placing a **segment moat** (two clicks, edit width,
  delete), the moat staying ground-only on a gizmo move, the **ramp** two-click
  connect (ground → a tower top, asserting the stored rise ≈ the tower height),
  the ramp's **empty-top fallback** default ramp, toggling ramp/stair + editing +
  deleting a ramp, a **mixed castle of all six kinds persisting across a
  reload**, **wall-endpoint anchor snapping** (an endpoint over a tower latches to
  its anchor; far endpoints grid-snap), the **Keep-on-ground toggle** (appears on
  selection / hidden when deselected; persists across reload; keeps a dragged piece
  on the ground), the **"Place on top" action** (arm from the panel, click a target
  → the piece seats on the target's top with centers aligned, stays selected, one
  undo reverses it; `Esc` while armed cancels with no change), the **flag piece**
  (place with the Flag tool → an embedded design + default params; select / edit /
  rotate / delete; face-attach onto a tower top with an undoable move; nothing
  stacks onto a flag; **Export → Import round-trips the embedded design** through
  the validated load path), **riding (phase 2G)** (moving a tower moves a flag on
  its top by the same delta with one undo reversing both; a 3-high stack all rides
  the bottom; raising a tower's height raises its rider while a material edit moves
  nothing; a piece near-but-not-on-top does not ride), **delete-drop (phase 2H)**
  (deleting the base of a stack re-seats the survivors — the sub-stack drops to the
  ground — and one undo restores it), **roofs (phase 2H)** (toggle a roof on a tower
  via the panel and assert `roofed` + stored params; change pitch/material;
  raise-on-posts on a gatehouse; wall-run + ramp covers exist in state; a roof
  rides/moves/deletes with its host; crenellated+roofed coexist), and **New Castle**
  (Cancel/`Esc` keep the
  design; confirm clears it + selection + undo history and survives a reload as
  empty). They read app state
  through a test-only accessor exposed at `window.__CASTLE_E2E__` when the page is
  opened with `?e2e=1`, and never assert on the WebGL canvas pixels.
- CI (GitHub Actions) runs two guard scripts, the build, Vitest, and Playwright
  on every push/PR.

### CI guards (`scripts/`, also `npm run guards`)

- **`guard:ground-seam`** — fails if a **literal Y-position** is assigned inline
  (`position={[x, <literal>, z]}`, `.position.y = <literal>`, `.position.setY(…)`,
  `.position.set(x, <literal>, z)`). Vertical placement must route through
  `groundHeightAt(x, z)` / a surface top so raised terrain stays additive.
  Legitimate cases (e.g. the lighting rig) live in a small justified allowlist at
  the top of `scripts/check-ground-seam.mjs`; add a `{ file, y, reason }` entry
  to allowlist a new one.
- **`guard:e2e-canvas`** — fails if any `e2e/**` spec reads canvas/WebGL pixels
  (`getContext`, `toDataURL`, `readPixels`, `.screenshot(`, `toMatchSnapshot(`).
  E2E must assert on DOM/store state via the `?e2e=1` accessor only.
