# reference/material-system — holding area (Pre-1b)

A **verbatim copy** of the material system from the previous project (the
2D-plan-first home designer), staged here to adapt from in the next prompt.
**Inert** — nothing here is imported by `src/`. The original directory structure
is preserved so the modules' relative imports (`../model/types`, `./key`,
`./patterns`, `./textures`) resolve unchanged within this folder.

## What was copied, and from where (old-repo paths)

| File here | Old-repo origin | Notes |
| --- | --- | --- |
| `materials/patterns.ts` | `src/materials/patterns.ts` | **Verbatim.** Procedural per-pixel pattern definitions + offscreen-canvas tile rendering (`patternPixel`, `renderPatternRGBA`, `createPatternCanvas`), `PATTERN_IDS`, `hexToRgb`. |
| `materials/textures.ts` | `src/materials/textures.ts` | **Verbatim.** Turns pattern canvases into cached repeating `THREE.CanvasTexture`s (`patternTexture`, `patternTextureVariant`, `patternDataUrl`, `representativeColor`). |
| `materials/threeMaterial.ts` | `src/materials/threeMaterial.ts` | **Verbatim.** The `materialRefToThreeMaterial` helper (the requested target) plus its co-located `applyMaterialStyle` / `useThreeMaterial` / option+style types — all pure material code, kept together so the module stays coherent. |
| `model/types.ts` | `src/model/types.ts` | **Material portion only.** Just `MaterialRef` + `PatternId`. The surrounding 2D-plan-first types (walls, floors, levels, roofs, furniture, site, openings) were intentionally left behind. |
| `materials/key.ts` | `src/materials/key.ts` | **Shared helper, trimmed.** Only `materialKey` (the cache key `textures.ts` imports). The original's `materialDomId` (SVG `url(#…)` id) and `materialLabel` (chip text) were 2D-plan/picker-tied and not needed, so they were dropped. |

### The one shared helper brought along
`materials/key.ts`'s `materialKey` — `textures.ts` imports it to key its texture /
data-URL caches. It is a tiny, pure, dependency-free string function; copied
(trimmed) because the texture generation directly requires it.

## Deliberately NOT copied
No SVG plan editor, no plan-space geometry (`wallToBoxes`, plan→world), no
wall/floor/roof/furniture data model, no Zustand store, no levels. Where a source
file mixed material code with 2D-shaped code (`model/types.ts`, `materials/key.ts`),
only the material portion was extracted.
