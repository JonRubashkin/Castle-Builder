import { describe, expect, it } from "vitest";
import type { FlagDesign } from "./types";
import {
  deleteEntry,
  flagLibraryToJSON,
  getEntry,
  isValidEntry,
  listEntries,
  overwriteEntry,
  parseFlagLibraryJSON,
  renameEntry,
  sanitizeLibrary,
  saveNewEntry,
  type FlagLibrary,
} from "./library";

function design(color: string): FlagDesign {
  return {
    aspect: 1.5,
    layers: [{ kind: "field", fill: { kind: "solid", color } }],
  };
}

describe("flag library CRUD", () => {
  it("round-trips save → list → get", () => {
    let lib: FlagLibrary = [];
    const { library, entry } = saveNewEntry(lib, "Red", design("#ff0000"), {
      id: "e1",
      now: 100,
    });
    lib = library;

    expect(entry.id).toBe("e1");
    expect(entry.name).toBe("Red");
    expect(entry.createdAt).toBe(100);
    expect(entry.modifiedAt).toBe(100);

    expect(listEntries(lib)).toHaveLength(1);
    expect(getEntry(lib, "e1")?.name).toBe("Red");
    expect(getEntry(lib, "nope")).toBeUndefined();
  });

  it("saveNewEntry does not mutate the input library and deep-clones the design", () => {
    const base: FlagLibrary = [];
    const src = design("#00ff00");
    const { library, entry } = saveNewEntry(base, "Green", src, { id: "e1" });

    // Input untouched (pure).
    expect(base).toHaveLength(0);
    expect(library).toHaveLength(1);

    // The stored design is a COPY — mutating the source can't reach it.
    (src.layers[0] as any).fill.color = "#000000";
    expect((entry.design.layers[0] as any).fill.color).toBe("#00ff00");
  });

  it("trims names and falls back to a default for empty names", () => {
    const a = saveNewEntry([], "  Spaced  ", design("#111")).entry;
    expect(a.name).toBe("Spaced");
    const b = saveNewEntry([], "   ", design("#222")).entry;
    expect(b.name).toBe("Untitled flag");
  });

  it("overwriteEntry updates one entry's design in place, keeping name/createdAt", () => {
    let lib = saveNewEntry([], "Original", design("#ff0000"), {
      id: "e1",
      now: 100,
    }).library;
    lib = saveNewEntry(lib, "Other", design("#0000ff"), {
      id: "e2",
      now: 100,
    }).library;

    lib = overwriteEntry(lib, "e1", design("#00ff00"), { now: 200 });

    const e1 = getEntry(lib, "e1")!;
    expect(e1.name).toBe("Original"); // name preserved
    expect(e1.createdAt).toBe(100); // createdAt preserved
    expect(e1.modifiedAt).toBe(200); // bumped
    expect((e1.design.layers[0] as any).fill.color).toBe("#00ff00");
    // The OTHER entry is untouched.
    expect((getEntry(lib, "e2")!.design.layers[0] as any).fill.color).toBe("#0000ff");
  });

  it("save-as vs overwrite: save-as creates a NEW entry and leaves the original", () => {
    let lib = saveNewEntry([], "Original", design("#ff0000"), {
      id: "e1",
    }).library;

    // "Save as new" is just another saveNewEntry — the original stays put.
    const { library, entry } = saveNewEntry(lib, "Copy", design("#00ff00"), {
      id: "e2",
    });
    lib = library;

    expect(lib).toHaveLength(2);
    expect(entry.id).toBe("e2");
    expect((getEntry(lib, "e1")!.design.layers[0] as any).fill.color).toBe("#ff0000");
    expect((getEntry(lib, "e2")!.design.layers[0] as any).fill.color).toBe("#00ff00");
  });

  it("renameEntry renames only the target, bumping modifiedAt", () => {
    let lib = saveNewEntry([], "Old", design("#ff0000"), {
      id: "e1",
      now: 100,
    }).library;
    lib = renameEntry(lib, "e1", "New", { now: 200 });
    expect(getEntry(lib, "e1")!.name).toBe("New");
    expect(getEntry(lib, "e1")!.modifiedAt).toBe(200);
    // Unknown id → unchanged.
    expect(renameEntry(lib, "nope", "X")).toEqual(lib);
  });

  it("deleteEntry removes only the target", () => {
    let lib = saveNewEntry([], "A", design("#f00"), { id: "e1" }).library;
    lib = saveNewEntry(lib, "B", design("#0f0"), { id: "e2" }).library;
    lib = deleteEntry(lib, "e1");
    expect(lib).toHaveLength(1);
    expect(getEntry(lib, "e1")).toBeUndefined();
    expect(getEntry(lib, "e2")).toBeTruthy();
  });

  it("applying a saved design (getEntry + cloneDesign out) yields an INDEPENDENT copy", () => {
    // Save an entry, then simulate applying it: the consumer must clone the
    // entry's design so later edits to the flag (or the library) can't cross.
    const lib = saveNewEntry([], "Src", design("#ff0000"), { id: "e1" }).library;
    const entry = getEntry(lib, "e1")!;
    const applied = structuredClone(entry.design); // what the store does on apply

    // Mutating the applied (flag) design must NOT touch the library entry...
    (applied.layers[0] as any).fill.color = "#123456";
    expect((entry.design.layers[0] as any).fill.color).toBe("#ff0000");

    // ...and mutating the library entry must NOT touch the applied design.
    (entry.design.layers[0] as any).fill.color = "#abcdef";
    expect((applied.layers[0] as any).fill.color).toBe("#123456");
  });
});

describe("flag library validation / import-export", () => {
  it("isValidEntry accepts well-formed entries and rejects malformed ones", () => {
    const good = saveNewEntry([], "Ok", design("#fff"), { id: "e1" }).entry;
    expect(isValidEntry(good)).toBe(true);
    expect(isValidEntry(null)).toBe(false);
    expect(isValidEntry({ id: "x", name: "y" })).toBe(false); // no design
    expect(
      isValidEntry({
        id: "x",
        name: "y",
        createdAt: 1,
        modifiedAt: 1,
        design: { aspect: 1.5, layers: [{ kind: "bogus" }] },
      }),
    ).toBe(false); // unknown layer kind
  });

  it("sanitizeLibrary drops malformed entries and coerces non-arrays to []", () => {
    const good = saveNewEntry([], "Ok", design("#fff"), { id: "e1" }).entry;
    const mixed = [good, { id: "bad" }, 42, null];
    expect(sanitizeLibrary(mixed)).toEqual([good]);
    expect(sanitizeLibrary("nope")).toEqual([]);
    expect(sanitizeLibrary(undefined)).toEqual([]);
  });

  it("Export/Import JSON round-trips the palette", () => {
    let lib = saveNewEntry([], "A", design("#f00"), { id: "e1", now: 1 }).library;
    lib = saveNewEntry(lib, "B", design("#0f0"), { id: "e2", now: 2 }).library;
    const json = flagLibraryToJSON(lib);
    expect(parseFlagLibraryJSON(json)).toEqual(lib);
  });
});
