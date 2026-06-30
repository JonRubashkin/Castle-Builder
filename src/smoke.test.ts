import { describe, it, expect } from "vitest";

// Smoke test so `npm test` has something to run from the first commit.
describe("smoke", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });
});
