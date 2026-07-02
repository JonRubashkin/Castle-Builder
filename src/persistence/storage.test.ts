// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadLastFlagDesign, saveLastFlagDesign } from "./storage";
import type { FlagDesign } from "../flags/types";

const KEY = "castle-builder:last-flag-design";

describe("persistence: lastFlagDesign slot (2Fe.1)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("round-trips a saved design through its own slot", () => {
    const design: FlagDesign = {
      aspect: 1.8,
      layers: [
        { kind: "field", fill: { kind: "solid", color: "#123456" } },
        { kind: "charge", symbolId: "star", x: 0.5, y: 0.5, scale: 0.4, color: "#fff" },
      ],
    };
    saveLastFlagDesign(design);
    expect(loadLastFlagDesign()).toEqual(design);
  });

  it("returns null when nothing is stored", () => {
    expect(loadLastFlagDesign()).toBeNull();
  });

  it("returns null (never throws) for a malformed slot", () => {
    window.localStorage.setItem(KEY, "{ not json");
    expect(loadLastFlagDesign()).toBeNull();

    window.localStorage.setItem(KEY, JSON.stringify({ nope: true }));
    expect(loadLastFlagDesign()).toBeNull();
  });
});
