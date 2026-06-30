# Castle Builder

A browser-based, **3D-first** castle builder. You place semantic castle pieces
directly in a 3D scene on a grid, then tweak each piece's parameters. Everything
runs client-side — no backend.

> **Phase 1a (foundation)** is implemented: place / select / move / delete the
> **tower** on a flat ground grid, with undo/redo and autosave. Materials,
> face-attach, walls, gatehouses, gates, moats, and ramps/stairs come in later
> phases (see `CLAUDE.md` → "Phase plan"). `CLAUDE.md` is the source of truth for
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
| **Tower tool** | Click the ground to place a tower at the grid-snapped cursor; the tool stays active. `Esc` cancels. |
| **Select tool** | Click a tower to select it; click empty ground to deselect. |
| Move a selected tower | Drag the on-screen translate gizmo (snaps to 0.1 m; one undo step per drag). |
| Edit a tower | Use the properties panel (profile, radius/half-extent, height). |
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
                       tower footprint, iso camera) — no React, no store
  store/               Zustand store, schema v1, undo/redo, ?e2e=1 test accessor
  persistence/         autosave + JSON export/import + schema validation
  components/preview/   the R3F scene, ground/grid, pieces, gizmo, placement
  components/ui/        toolbar, properties panel, file/export bar
  hooks/                keyboard shortcuts, autosave wiring
e2e/                   Playwright tests (assert on DOM/store state, never canvas pixels)
```

## Deploy (Vercel)

Static SPA. `base: '/'` plus `vercel.json` rewrites all routes to `index.html`.
Build command `npm run build`, output `dist/`.

## Testing notes

- Unit tests cover grid snapping, `groundHeightAt`, the tower footprint helper,
  the iso camera, store actions + undo/redo, and schema validation.
- E2E tests cover clean boot, placing a tower, select + delete, undo/redo, and
  autosave surviving a reload. They read app state through a test-only accessor
  exposed at `window.__CASTLE_E2E__` when the page is opened with `?e2e=1`, and
  never assert on the WebGL canvas pixels.
- CI (GitHub Actions) runs the build, Vitest, and Playwright on every push/PR.
