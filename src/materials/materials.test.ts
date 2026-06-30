// Part 1 — unit tests for the PURE material logic: the MaterialRef shape via
// materialKey/representativeColor, hex parsing, the pattern id list, and the
// opacity guarantee (every pattern, water included, renders OPAQUE).

import { describe, expect, it } from "vitest";
import { materialKey } from "./key";
import { representativeColor } from "./textures";
import {
  PATTERN_IDS,
  TILE_PX,
  hexToRgb,
  patternPixel,
  renderPatternRGBA,
} from "./patterns";
import type { MaterialRef, PatternId } from "../store/schema";

describe("PATTERN_IDS", () => {
  it("contains exactly the castle pattern ids", () => {
    expect([...PATTERN_IDS].sort()).toEqual(["brick", "stone", "thatch", "water"]);
  });
});

describe("materialKey (MaterialRef shape)", () => {
  it("keys a solid by its lowercased color", () => {
    const ref: MaterialRef = { kind: "solid", color: "#AABBCC" };
    expect(materialKey(ref)).toBe("solid:#aabbcc");
  });

  it("keys a pattern by id + both colors, case-insensitively", () => {
    const ref: MaterialRef = {
      kind: "pattern",
      pattern: "stone",
      colorA: "#9A958C",
      colorB: "#5B564E",
    };
    expect(materialKey(ref)).toBe("pattern:stone:#9a958c:#5b564e");
  });

  it("distinguishes solid from pattern with the same color", () => {
    const solid: MaterialRef = { kind: "solid", color: "#888888" };
    const pattern: MaterialRef = {
      kind: "pattern",
      pattern: "brick",
      colorA: "#888888",
      colorB: "#222222",
    };
    expect(materialKey(solid)).not.toBe(materialKey(pattern));
  });
});

describe("representativeColor", () => {
  it("returns the solid color, or a pattern's dominant tone", () => {
    expect(representativeColor({ kind: "solid", color: "#123456" })).toBe("#123456");
    expect(
      representativeColor({
        kind: "pattern",
        pattern: "water",
        colorA: "#2f6f9f",
        colorB: "#1b4a6b",
      }),
    ).toBe("#2f6f9f");
  });
});

describe("hexToRgb", () => {
  it("parses #rrggbb and #rgb", () => {
    expect(hexToRgb("#ff8800")).toEqual([255, 136, 0]);
    expect(hexToRgb("#f80")).toEqual([255, 136, 0]);
  });
  it("falls back to mid-grey on a bad string", () => {
    expect(hexToRgb("nope")).toEqual([128, 128, 128]);
  });
});

describe("patternPixel — pure, deterministic, in-gamut", () => {
  const a: [number, number, number] = [200, 190, 170];
  const b: [number, number, number] = [70, 60, 50];

  for (const id of PATTERN_IDS) {
    it(`${id}: deterministic and within [0,255]`, () => {
      for (const [x, y] of [
        [0, 0],
        [13, 7],
        [128, 200],
        [255, 255],
      ]) {
        const p1 = patternPixel(id, x, y, 256, a, b);
        const p2 = patternPixel(id, x, y, 256, a, b);
        expect(p1).toEqual(p2); // pure
        for (const c of p1) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(255);
        }
      }
    });
  }
});

describe("renderPatternRGBA — OPAQUE (alpha 255 everywhere)", () => {
  for (const id of PATTERN_IDS as PatternId[]) {
    it(`${id} fills every alpha byte with 255`, () => {
      const size = 16;
      const data = renderPatternRGBA(id, "#9a958c", "#5b564e", size);
      expect(data.length).toBe(size * size * 4);
      for (let i = 3; i < data.length; i += 4) {
        expect(data[i]).toBe(255);
      }
    });
  }

  it("water in particular is fully opaque (no alpha trickery)", () => {
    const data = renderPatternRGBA("water", "#2f6f9f", "#1b4a6b", 32);
    let minAlpha = 255;
    for (let i = 3; i < data.length; i += 4) minAlpha = Math.min(minAlpha, data[i]!);
    expect(minAlpha).toBe(255);
  });

  it("defaults the tile size to TILE_PX", () => {
    const data = renderPatternRGBA("stone", "#9a958c", "#5b564e");
    expect(data.length).toBe(TILE_PX * TILE_PX * 4);
  });
});
