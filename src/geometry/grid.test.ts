import { describe, expect, it } from "vitest";
import {
  snapHorizontal,
  snapHorizontalVec2,
  snapVertical,
  snapRotation,
  HORIZONTAL_GRID,
  VERTICAL_GRID,
} from "./grid";

describe("snapHorizontal (0.1 m)", () => {
  it("snaps to the nearest 0.1 m", () => {
    expect(snapHorizontal(3.43)).toBe(3.4);
    expect(snapHorizontal(3.46)).toBe(3.5);
    expect(snapHorizontal(0.04)).toBe(0);
    expect(snapHorizontal(-1.23)).toBe(-1.2);
  });

  it("matches the documented increment", () => {
    expect(HORIZONTAL_GRID).toBe(0.1);
    expect(snapHorizontal(0.05)).toBeCloseTo(0.1, 6);
  });

  it("never returns -0", () => {
    expect(Object.is(snapHorizontal(-0.01), -0)).toBe(false);
    expect(snapHorizontal(-0.01)).toBe(0);
  });

  it("snaps both components of a Vec2", () => {
    expect(snapHorizontalVec2({ x: 1.04, y: -2.17 })).toEqual({ x: 1, y: -2.2 });
  });
});

describe("snapVertical (0.5 m)", () => {
  it("snaps to the nearest 0.5 m", () => {
    expect(snapVertical(0.24)).toBe(0);
    expect(snapVertical(0.26)).toBe(0.5);
    expect(snapVertical(7.8)).toBe(8);
    expect(snapVertical(8.2)).toBe(8);
  });

  it("matches the documented increment", () => {
    expect(VERTICAL_GRID).toBe(0.5);
  });
});

describe("snapRotation (15°)", () => {
  it("snaps to the nearest 15 degrees", () => {
    expect(snapRotation(7)).toBe(0);
    expect(snapRotation(8)).toBe(15);
    expect(snapRotation(44)).toBe(45);
  });

  it("normalizes into [0, 360)", () => {
    expect(snapRotation(360)).toBe(0);
    expect(snapRotation(375)).toBe(15);
    expect(snapRotation(-15)).toBe(345);
  });
});
