import { describe, expect, it } from "vitest";
import {
  addLayer,
  defaultChargeLayer,
  fieldColorCount,
  moveLayer,
  removeLayer,
  resizeColors,
  setAspect,
  updateLayer,
} from "./editorOps";
import type { FlagDesign, FlagLayer } from "./types";

function baseDesign(): FlagDesign {
  return {
    aspect: 1.5,
    layers: [{ kind: "field", fill: { kind: "solid", color: "#c1121f" } }],
  };
}

describe("editorOps — working-copy layer ops", () => {
  it("addLayer appends the new layer on top (last = frontmost) and is immutable", () => {
    const d0 = baseDesign();
    const d1 = addLayer(d0, "stripes");
    expect(d1.layers).toHaveLength(2);
    expect(d1.layers[1]!.kind).toBe("stripes");
    // The original design is untouched (immutable op).
    expect(d0.layers).toHaveLength(1);
    expect(d1).not.toBe(d0);
  });

  it("addLayer allows multiple fields (no hard block)", () => {
    const d = addLayer(addLayer(baseDesign(), "field"), "field");
    expect(d.layers.filter((l) => l.kind === "field")).toHaveLength(3);
  });

  it("removeLayer drops the indexed layer; out-of-range is a no-op", () => {
    const d0 = addLayer(baseDesign(), "charge"); // [field, charge]
    const d1 = removeLayer(d0, 0);
    expect(d1.layers.map((l) => l.kind)).toEqual(["charge"]);
    expect(removeLayer(d0, 9)).toBe(d0); // no-op returns same ref
  });

  it("moveLayer reorders by ±1 and clamps at the ends", () => {
    // [field, stripes, charge]
    const d0 = addLayer(addLayer(baseDesign(), "stripes"), "charge");
    const up = moveLayer(d0, 0, 1);
    expect(up.layers.map((l) => l.kind)).toEqual(["stripes", "field", "charge"]);
    const down = moveLayer(d0, 2, -1);
    expect(down.layers.map((l) => l.kind)).toEqual(["field", "charge", "stripes"]);
    // Moving the top layer further up is a clamped no-op.
    expect(moveLayer(d0, 2, 1)).toBe(d0);
    expect(moveLayer(d0, 0, -1)).toBe(d0);
  });

  it("updateLayer replaces exactly one layer", () => {
    const d0 = addLayer(baseDesign(), "charge"); // [field, charge]
    const newCharge: FlagLayer = { ...defaultChargeLayer(), x: 0.2, y: 0.8 };
    const d1 = updateLayer(d0, 1, newCharge);
    expect(d1.layers[1]).toEqual(newCharge);
    expect(d1.layers[0]).toEqual(d0.layers[0]); // field untouched
  });

  it("setAspect updates the aspect only", () => {
    const d = setAspect(baseDesign(), 2);
    expect(d.aspect).toBe(2);
    expect(d.layers).toEqual(baseDesign().layers);
  });
});

describe("editorOps — color helpers", () => {
  it("resizeColors grows (cycling the palette) and shrinks", () => {
    expect(resizeColors(["#a", "#b"], 4)).toEqual(["#a", "#b", "#a", "#b"]);
    expect(resizeColors(["#a", "#b", "#c"], 2)).toEqual(["#a", "#b"]);
    expect(resizeColors([], 2, "#000000")).toEqual(["#000000", "#000000"]);
  });

  it("fieldColorCount is 1 for solid and the section count for divisions", () => {
    expect(fieldColorCount({ kind: "solid", color: "#a" })).toBe(1);
    expect(
      fieldColorCount({ kind: "division", division: "perPale", colors: [] }),
    ).toBe(2);
    expect(
      fieldColorCount({ kind: "division", division: "quarterly", colors: [] }),
    ).toBe(4);
  });
});
