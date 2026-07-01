import { describe, expect, it } from "vitest";
import {
  DesignValidationError,
  parseDesignJSON,
  validateDesign,
} from "./schemaValidation";
import { createEmptyDesign, type Design } from "../store/schema";

function validDesign(): Design {
  return {
    schemaVersion: 2,
    name: "Test Castle",
    pieces: [
      {
        id: "t1",
        kind: "tower",
        position: { x: 1, y: 2 },
        base: 0,
        rotation: 0,
        profile: "round",
        radius: 2,
        height: 8,
        crenellated: false,
        merlonSize: 0.6,
        material: { kind: "solid", color: "#999" },
      },
    ],
  };
}

describe("validateDesign", () => {
  it("accepts a valid v2 design and round-trips pieces", () => {
    const design = validateDesign(validDesign());
    expect(design.schemaVersion).toBe(2);
    expect(design.pieces).toHaveLength(1);
    expect(design.pieces[0].kind).toBe("tower");
  });

  it("accepts an empty design", () => {
    expect(() => validateDesign(createEmptyDesign())).not.toThrow();
  });

  it("refuses a newer (future) schema version", () => {
    const future = { ...validDesign(), schemaVersion: 3 };
    try {
      validateDesign(future);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DesignValidationError);
      expect((err as DesignValidationError).futureVersion).toBe(true);
    }
  });

  it("rejects a missing schemaVersion", () => {
    const { schemaVersion: _omit, ...rest } = validDesign();
    expect(() => validateDesign(rest)).toThrow(DesignValidationError);
  });

  it("rejects a non-object", () => {
    expect(() => validateDesign(null)).toThrow(DesignValidationError);
    expect(() => validateDesign(42)).toThrow(DesignValidationError);
  });

  it("rejects pieces that are not an array", () => {
    expect(() =>
      validateDesign({ schemaVersion: 1, name: "x", pieces: {} }),
    ).toThrow(DesignValidationError);
  });

  it("rejects a piece with an unknown kind", () => {
    const bad = validDesign();
    (bad.pieces[0] as { kind: string }).kind = "spaceship";
    expect(() => validateDesign(bad)).toThrow(/unknown/);
  });

  it("rejects a piece missing its position", () => {
    const bad = validDesign();
    delete (bad.pieces[0] as Partial<{ position: unknown }>).position;
    expect(() => validateDesign(bad)).toThrow(DesignValidationError);
  });

  it("accepts every allowlisted pattern id (allowlist derives from PATTERN_IDS)", () => {
    for (const pattern of ["stone", "brick", "thatch", "water"]) {
      const d = validDesign();
      (d.pieces[0] as { material: unknown }).material = {
        kind: "pattern",
        pattern,
        colorA: "#9a958c",
        colorB: "#5b564e",
      };
      expect(() => validateDesign(d)).not.toThrow();
    }
  });

  it("rejects an unknown pattern id", () => {
    const bad = validDesign();
    (bad.pieces[0] as { material: unknown }).material = {
      kind: "pattern",
      pattern: "lava",
      colorA: "#fff",
      colorB: "#000",
    };
    expect(() => validateDesign(bad)).toThrow(/unknown/);
  });

  it("rejects a malformed material", () => {
    const bad = validDesign();
    (bad.pieces[0] as { material: unknown }).material = { kind: "solid" };
    expect(() => validateDesign(bad)).toThrow(DesignValidationError);
  });
});

// A v1 design fixture — a real pre-2Fb document (schemaVersion 1, no flags). It
// must open under the current app via the migration, unchanged apart from the
// version bump.
function v1Fixture() {
  return {
    schemaVersion: 1,
    name: "Old Castle",
    pieces: [
      {
        id: "t1",
        kind: "tower",
        position: { x: 1, y: 2 },
        base: 0,
        rotation: 0,
        profile: "round",
        radius: 2,
        height: 8,
        crenellated: false,
        merlonSize: 0.6,
        material: { kind: "solid", color: "#999" },
      },
      {
        id: "g1",
        kind: "gate",
        position: { x: 5, y: 0 },
        base: 0,
        rotation: 0,
        width: 2.4,
        height: 3.2,
        material: { kind: "solid", color: "#6b4a2b" },
      },
    ],
  };
}

describe("schema migration (v1 → v2)", () => {
  it("loads a v1 design as v2 with its pieces untouched", () => {
    const before = v1Fixture();
    const design = validateDesign(before);
    // The only change is the version bump; pieces carry over verbatim.
    expect(design.schemaVersion).toBe(2);
    expect(design.pieces).toHaveLength(2);
    expect(design.pieces.map((p) => p.kind)).toEqual(["tower", "gate"]);
    expect(design.pieces[0]).toMatchObject(before.pieces[0]);
    expect(design.pieces[1]).toMatchObject(before.pieces[1]);
  });

  it("migrates a v1 design with no pieces", () => {
    const design = validateDesign({ schemaVersion: 1, name: "Empty", pieces: [] });
    expect(design.schemaVersion).toBe(2);
    expect(design.pieces).toEqual([]);
  });
});

describe("flag piece validation (schema v2)", () => {
  function flagPiece() {
    return {
      id: "f1",
      kind: "flag",
      position: { x: 0, y: 0 },
      base: 0,
      rotation: 0,
      poleHeight: 6,
      clothWidth: 2.4,
      design: {
        aspect: 1.5,
        layers: [
          { kind: "field", fill: { kind: "solid", color: "#c1121f" } },
          {
            kind: "charge",
            symbolId: "lion",
            x: 0.5,
            y: 0.5,
            scale: 0.8,
            color: "#ffd60a",
          },
        ],
      },
    };
  }

  it("accepts a flag with an embedded design and round-trips it", () => {
    const d = validDesign();
    d.pieces.push(flagPiece() as never);
    const design = validateDesign(d);
    const flag = design.pieces.find((p) => p.kind === "flag");
    expect(flag).toBeTruthy();
    // The embedded design survives verbatim (embed model).
    expect((flag as { design: unknown }).design).toEqual(flagPiece().design);
  });

  it("rejects a flag missing its poleHeight", () => {
    const d = validDesign();
    const f = flagPiece();
    delete (f as Partial<{ poleHeight: unknown }>).poleHeight;
    d.pieces.push(f as never);
    expect(() => validateDesign(d)).toThrow(DesignValidationError);
  });

  it("rejects a flag whose design has an unknown layer kind", () => {
    const d = validDesign();
    const f = flagPiece();
    (f.design.layers[0] as { kind: string }).kind = "hologram";
    d.pieces.push(f as never);
    expect(() => validateDesign(d)).toThrow(/unknown/);
  });
});

describe("parseDesignJSON", () => {
  it("parses and validates a JSON string", () => {
    const json = JSON.stringify(validDesign());
    expect(parseDesignJSON(json).pieces).toHaveLength(1);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseDesignJSON("{not json")).toThrow(DesignValidationError);
  });
});
