import { describe, expect, it } from "vitest";
import {
  ISO_AZIMUTH_DEG,
  ISO_ELEVATION_DEG,
  isoCameraDirection,
  isoCameraPosition,
} from "./camera";

describe("iso camera", () => {
  it("uses the classic iso angles", () => {
    expect(ISO_AZIMUTH_DEG).toBe(45);
    expect(ISO_ELEVATION_DEG).toBeCloseTo(35.264, 2);
  });

  it("direction is the normalized (1,1,1) vector", () => {
    const d = isoCameraDirection();
    const inv = 1 / Math.sqrt(3);
    expect(d.x).toBeCloseTo(inv, 6);
    expect(d.y).toBeCloseTo(inv, 6);
    expect(d.z).toBeCloseTo(inv, 6);
  });

  it("position sits at the requested distance along the iso direction", () => {
    const p = isoCameraPosition(30);
    const len = Math.hypot(p.x, p.y, p.z);
    expect(len).toBeCloseTo(30, 6);
    expect(p.y).toBeGreaterThan(0); // above ground
  });
});
