// The symbol library is complete (every id has a definition) and every
// definition is well-formed (a valid viewBox + at least one parseable path that
// begins with a move). We validate the path GEOMETRY's structure, never pixels.

import { describe, expect, it } from "vitest";
import { SYMBOL_IDS } from "./ids";
import { SYMBOLS, allSymbols, getSymbol } from "./index";
import { parsePath, isWellFormedPath } from "./path";

describe("SYMBOL_IDS", () => {
  it("contains exactly the starter charge set", () => {
    expect([...SYMBOL_IDS].sort()).toEqual(
      ["cross", "crown", "dragon", "eagle", "fleurDeLis", "lion", "star"].sort(),
    );
  });

  it("has no duplicate ids", () => {
    expect(new Set(SYMBOL_IDS).size).toBe(SYMBOL_IDS.length);
  });
});

describe("SYMBOLS registry completeness", () => {
  it("has a definition for every id, and no extras", () => {
    expect(Object.keys(SYMBOLS).sort()).toEqual([...SYMBOL_IDS].sort());
  });

  for (const id of SYMBOL_IDS) {
    it(`${id}: definition exists and self-identifies`, () => {
      const def = getSymbol(id);
      expect(def).toBeDefined();
      expect(def.id).toBe(id);
      expect(def.label.length).toBeGreaterThan(0);
    });
  }

  it("allSymbols() returns every definition in id order", () => {
    expect(allSymbols().map((d) => d.id)).toEqual([...SYMBOL_IDS]);
  });
});

describe("SYMBOL definitions are well-formed", () => {
  for (const id of SYMBOL_IDS) {
    const def = SYMBOLS[id];
    it(`${id}: has a positive viewBox`, () => {
      expect(def.viewBox).toHaveLength(2);
      expect(def.viewBox[0]).toBeGreaterThan(0);
      expect(def.viewBox[1]).toBeGreaterThan(0);
    });

    it(`${id}: has at least one path`, () => {
      expect(def.paths.length).toBeGreaterThan(0);
    });

    it(`${id}: every path parses and starts with a move`, () => {
      for (const d of def.paths) {
        expect(isWellFormedPath(d)).toBe(true);
        const cmds = parsePath(d);
        expect(cmds).not.toBeNull();
        expect(cmds![0]!.cmd.toLowerCase()).toBe("m");
      }
    });
  }
});

describe("parsePath (the well-formedness checker itself)", () => {
  it("accepts a simple valid path", () => {
    expect(parsePath("M0,0 L10,0 L10,10 Z")).not.toBeNull();
  });
  it("accepts implicit repeated coordinate sets", () => {
    expect(parsePath("M0,0 10,0 10,10")).not.toBeNull();
  });
  it("accepts arcs and curves", () => {
    expect(parsePath("M0,0 a5,5 0 1,0 10,0 C1,2 3,4 5,6 Z")).not.toBeNull();
  });
  it("rejects an unknown command", () => {
    expect(parsePath("M0,0 K10,10")).toBeNull();
  });
  it("rejects a path not starting with a move", () => {
    expect(parsePath("L10,10")).toBeNull();
  });
  it("rejects a wrong argument count", () => {
    expect(parsePath("M0,0 L10")).toBeNull(); // L needs 2
  });
  it("rejects an empty string", () => {
    expect(parsePath("")).toBeNull();
  });
});
