import { describe, expect, it } from "vitest";
import { groundHeightAt } from "./ground";

describe("groundHeightAt", () => {
  it("returns 0 everywhere in the flat phase-1 world", () => {
    expect(groundHeightAt(0, 0)).toBe(0);
    expect(groundHeightAt(123.4, -56.7)).toBe(0);
    expect(groundHeightAt(-1000, 1000)).toBe(0);
  });
});
