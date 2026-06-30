# Castle Builder

A browser-based, **3D-first** castle builder. You place semantic castle pieces
directly in a 3D scene on a grid, then tweak each piece's parameters. Everything
runs client-side — no backend.

> **Phases 1a–1b** are implemented: place / select / move / delete the **tower**
> on a flat ground grid, with undo/redo and autosave, **procedural materials**
> (solid + stone / brick / thatch / opaque-water patterns), **crenellations**,
> and **face-attach** for both placement and gizmo moves (seat a tower on top
> of another, whether placing a new one or dragging an existing one). Walls,
> gatehouses, gates, moats, and ramps/stairs come in later phases (see
> `CLAUDE.md` → "Phase plan"). `CLAUDE.md` is the source of truth for
> conventions, the data model, and scope.

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
| **Face-attach** | With the Tower tool, click over an existing tower's footprint: the new tower seats on that tower's **top** (its stored base = the lower tower's top), instead of on the ground. |
| **Select tool** | Click a tower to select it; click empty ground to deselect. |
| Move a selected tower | Drag the on-screen translate gizmo (snaps to 0.1 m; one undo step per drag). Moving uses the **same face-attach rule as placement**: drag the tower's anchor over another tower and it climbs onto that tower's top live; drag it back over open ground and it drops to ground height. |
| Edit a tower | Use the properties panel: profile, radius/half-extent, height, **crenellations** (toggle + merlon/tooth size), and **material** (solid color or a stone / brick / thatch / water pattern with two colors). |
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
                       tower footprint, the tower builder, support/face-attach
                       resolution, iso camera) — no React, no store
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

- Unit tests cover grid snapping, `groundHeightAt`, the tower footprint helper
  (a radius/half-extent/rotation sweep), the tower builder + crenellations,
  support/face-attach resolution, the iso camera, store actions + undo/redo
  (one snapshot per committed op, with the 100-entry cap and eviction), the
  procedural-material logic (opaque output, pattern ids), and schema validation.
- E2E tests cover clean boot, placing a tower, select + delete, undo/redo,
  autosave surviving a reload, toggling crenellations + changing material, and
  face-attach (a tower seated on another). They read app state through a
  test-only accessor exposed at `window.__CASTLE_E2E__` when the page is opened
  with `?e2e=1`, and never assert on the WebGL canvas pixels.
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
