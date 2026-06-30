import { describe, expect, it } from "vitest";
import {
  DesignValidationError,
  parseDesignJSON,
  validateDesign,
} from "./schemaValidation";
import { createEmptyDesign, type Design } from "../store/schema";

function validDesign(): Design {
  return {
    schemaVersion: 1,
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
  it("accepts a valid v1 design and round-trips pieces", () => {
    const design = validateDesign(validDesign());
    expect(design.schemaVersion).toBe(1);
    expect(design.pieces).toHaveLength(1);
    expect(design.pieces[0].kind).toBe("tower");
  });

  it("accepts an empty design", () => {
    expect(() => validateDesign(createEmptyDesign())).not.toThrow();
  });

  it("refuses a newer (future) schema version", () => {
    const future = { ...validDesign(), schemaVersion: 2 };
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

describe("parseDesignJSON", () => {
  it("parses and validates a JSON string", () => {
    const json = JSON.stringify(validDesign());
    expect(parseDesignJSON(json).pieces).toHaveLength(1);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseDesignJSON("{not json")).toThrow(DesignValidationError);
  });
});
