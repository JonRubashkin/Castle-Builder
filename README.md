# Castle Builder

A browser-based, **3D-first** castle builder. You place semantic castle pieces
directly in a 3D scene on a grid, then tweak each piece's parameters. Everything
runs client-side — no backend.

> **Phases 1a–1d** are implemented: place / select / move / delete **towers,
> gatehouses, wall runs, gates, and moats** on a flat ground grid, with undo/redo
> and autosave, **procedural materials** (solid + stone / brick / thatch /
> opaque-water patterns), **crenellations** (one shared merlon helper across the
> masses), and **face-attach** for both placement and gizmo moves (seat a piece on
> top of another). Wall runs draw with **two clicks** (live preview + length
> label), move whole-wall via a gizmo, and reshape per-endpoint via drag handles.
> The **gate** is a freestanding timber portcullis (it positions in an archway /
> against a wall — it does not cut a real opening). The **moat** is **opaque
> water** (ring or segment), ground-only, on its own stacking layer. Ramps/stairs
> come in a later phase (see `CLAUDE.md` → "Phase plan"). `CLAUDE.md` is the source
> of truth for conventions, the data model, and scope.

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
| **Wall tool** | **Two clicks**: click a start point, then an end point — a live preview wall with a **length label** follows the cursor between them. Single segment per draw (the tool stays active for the next wall). Endpoints snap to 0.1 m; a zero-length wall is ignored; `Esc` cancels the in-progress wall. |
| **Gate tool** | Click the ground to place a **freestanding timber gate** (a portcullis lattice) at the grid-snapped cursor; same ghost / face-attach behavior as the tower. It's a standalone piece — position it in a gatehouse archway or against a wall; it does **not** cut a real opening (no CSG in phase 1). Rotate it (15° steps in the panel) to face across the archway. |
| **Moat tool** | Places **opaque water**. Pick a **sub-mode** in the panel (shown when the Moat tool is active): **Ring** (default) is a single click — an annulus with editable inner/outer radii; **Segment** is **two clicks** (start, then end) — a straight strip with an editable width. A moat is **ground-only** (it never face-attaches) and sits on its own water layer so it can't z-fight the ground. `Esc` cancels an in-progress segment. |
| **Face-attach** | With the tower / gatehouse / wall / **gate** tool, click over an existing piece's footprint: the new piece seats on that piece's **top** (its stored base = the lower piece's top), instead of on the ground. A wall seats at its **start** anchor's support height. (The moat is exempt — it always seats on the ground.) |
| **Select tool** | Click a piece to select it; click empty ground to deselect. |
| Move a selected piece | Drag the on-screen translate gizmo (snaps to 0.1 m; one undo step per drag). Moving uses the **same face-attach rule as placement**. For a wall, the gizmo moves the **whole wall** (both endpoints together). |
| Reshape a wall | A selected wall shows a **draggable handle at each end** — drag one to move that endpoint only (grid-snapped, one undo step). Start/End coordinates are also editable as number fields in the panel. |
| Edit a piece | Use the properties panel: tower (profile, radius/half-extent, height, rotation), gatehouse (width/depth/height, rotation), wall (height, thickness, endpoints) — each with **crenellations** (toggle + merlon size) — gate (width, height, rotation), moat (ring: inner/outer radii; segment: width). Each piece carries a **material** (solid color or a stone / brick / thatch / water pattern). |
| Delete | `Delete` / `Backspace`, or the panel's Delete button. |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`), or the toolbar buttons. History is capped at 100. |
| Export / Import | Buttons in the bottom bar — save or load a design as JSON. |

## Persistence

Your work **autosaves into this browser only** (a single `localStorage` slot).
Clearing browser data erases it, so use **Export JSON** to keep a backup and
**Import JSON** to restore it. Designs carry a `schemaVersion`; a file from a
newer, unknown version is refused on open rather than risking corruption.

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
                       footprints for tower/gatehouse/wall/gate/moat, the shared
                       oriented-rectangle footprint, the ring footprint, support/
                       face-attach resolution, iso camera) — no React, no store
  materials/           MaterialRef → THREE factory + procedural pattern textures
                       (stone/brick/thatch/opaque-water), generated at runtime
  store/               Zustand store, schema v1, undo/redo, ?e2e=1 test accessor
  persistence/         autosave + JSON export/import + schema validation
  components/preview/   the R3F scene, ground/grid, pieces, gizmo, placement
  components/ui/        toolbar, properties panel, file/export bar
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
  and footprints (ring inside/outside hit-test, segment oriented hit-test),
  support/face-attach resolution across piece kinds (including the wall's
  start-anchor base rule, the gate face-attaching onto a piece, and the moat being
  ground-only / never a stackable surface), the wall endpoint/whole-wall move
  actions, the iso camera, store actions + undo/redo (one snapshot per committed
  op, with the 100-entry cap and eviction), the procedural-material logic (opaque
  output, pattern ids), and schema validation.
- E2E tests cover clean boot, placing a tower, select + delete, undo/redo,
  autosave surviving a reload, toggling crenellations + changing material,
  face-attach, placing a gatehouse (edit/rotate/delete), drawing a wall with two
  clicks, selecting + deleting a wall, dragging a wall endpoint, placing a **gate**
  (edit/rotate/delete + face-attach onto a wall top), placing a **ring moat**
  (edit radii, delete), placing a **segment moat** (two clicks, edit width,
  delete), and the moat staying ground-only on a gizmo move. They read app state
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
