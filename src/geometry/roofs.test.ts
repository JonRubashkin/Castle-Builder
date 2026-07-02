import { describe, expect, it } from "vitest";
import {
  CONE_RADIAL_SEGMENTS,
  ROOF_COVER_THICKNESS,
  ROOF_POST_CLEARANCE,
  ROOF_POST_SIZE,
  gatehouseRoof,
  rampRoof,
  roofPostHeight,
  towerRoof,
  wallRunRoof,
  type RoofPart,
} from "./roofs";
import { buildRamp } from "./rampBuilder";
import { wallRunLength } from "./wallRunFootprint";
import type { Gatehouse, Ramp, Tower, WallRun } from "../store/schema";

const ROOF_MAT = { kind: "solid" as const, color: "#7c3b2a" };

function tower(over: Partial<Tower> = {}): Tower {
  return {
    id: "t",
    kind: "tower",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    profile: "round",
    radius: 2,
    height: 8,
    crenellated: false,
    merlonSize: 0.6,
    material: { kind: "solid", color: "#999" },
    roofed: true,
    roofPitch: 3,
    roofMaterial: ROOF_MAT,
    raisedOnPosts: false,
    ...over,
  };
}

function gatehouse(over: Partial<Gatehouse> = {}): Gatehouse {
  return {
    id: "g",
    kind: "gatehouse",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    width: 6,
    depth: 4,
    height: 6,
    crenellated: false,
    merlonSize: 0.6,
    material: { kind: "solid", color: "#999" },
    roofed: true,
    roofPitch: 2.5,
    roofMaterial: ROOF_MAT,
    raisedOnPosts: false,
    ...over,
  };
}

function wallRun(over: Partial<WallRun> = {}): WallRun {
  return {
    id: "w",
    kind: "wallRun",
    position: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    base: 0,
    rotation: 0,
    height: 4,
    thickness: 0.6,
    crenellated: false,
    merlonSize: 0.6,
    material: { kind: "solid", color: "#999" },
    roofed: true,
    roofPitch: 1.5,
    roofMaterial: ROOF_MAT,
    ...over,
  };
}

function ramp(over: Partial<Ramp> = {}): Ramp {
  return {
    id: "r",
    kind: "ramp",
    position: { x: 0, y: 0 },
    base: 0,
    rotation: 0,
    rise: 4,
    run: 6,
    width: 2,
    style: "ramp",
    material: { kind: "solid", color: "#999" },
    roofed: true,
    roofPitch: 1,
    roofMaterial: ROOF_MAT,
    ...over,
  };
}

const byRole = (parts: RoofPart[], role: RoofPart["role"]) => parts.filter((p) => p.role === role);

describe("roofs: unroofed hosts draw nothing", () => {
  it("returns no parts when roofed is false", () => {
    expect(towerRoof(tower({ roofed: false }))).toEqual([]);
    expect(gatehouseRoof(gatehouse({ roofed: false }))).toEqual([]);
    expect(wallRunRoof(wallRun({ roofed: false }))).toEqual([]);
    expect(rampRoof(ramp({ roofed: false }))).toEqual([]);
  });
});

describe("roofs: round tower → cone", () => {
  it("a flush round tower is a single cone sized to radius/pitch, above the crown", () => {
    const t = tower({ radius: 2, height: 8, roofPitch: 3, raisedOnPosts: false });
    const parts = towerRoof(t);
    expect(byRole(parts, "post")).toHaveLength(0); // flush → no posts
    const cones = byRole(parts, "cone");
    expect(cones).toHaveLength(1);
    const cone = cones[0] as Extract<RoofPart, { role: "cone" }>;
    expect(cone.radius).toBe(2);
    expect(cone.height).toBe(3);
    expect(cone.radialSegments).toBe(CONE_RADIAL_SEGMENTS);
    // Sits on the crown (y=8): center at eave + pitch/2 = 8 + 1.5.
    expect(cone.position.y).toBeCloseTo(8 + 3 / 2, 9);
  });

  it("a raised round tower adds 4 posts and lifts the cone by the post height", () => {
    const t = tower({ height: 8, roofPitch: 3, raisedOnPosts: true, crenellated: false });
    const parts = towerRoof(t);
    const posts = byRole(parts, "post");
    expect(posts).toHaveLength(4);
    const postH = roofPostHeight(false, t.merlonSize);
    for (const p of posts) {
      expect((p as any).size.y).toBeCloseTo(postH, 9);
      expect((p as any).position.y).toBeCloseTo(8 + postH / 2, 9); // crown → eave
    }
    const cone = byRole(parts, "cone")[0] as Extract<RoofPart, { role: "cone" }>;
    expect(cone.position.y).toBeCloseTo(8 + postH + 3 / 2, 9); // lifted onto the posts
  });
});

describe("roofs: square tower / gatehouse → pyramid", () => {
  it("a square tower yields a pyramid sized to the half-extent + pitch", () => {
    const t = tower({ profile: "square", radius: 2.5, roofPitch: 3 });
    const pyr = byRole(towerRoof(t), "pyramid")[0] as Extract<RoofPart, { role: "pyramid" }>;
    expect(pyr.halfX).toBe(2.5);
    expect(pyr.halfZ).toBe(2.5);
    expect(pyr.height).toBe(3);
  });

  it("a gatehouse pyramid matches the width × depth top footprint", () => {
    const g = gatehouse({ width: 6, depth: 4, height: 6, roofPitch: 2.5 });
    const pyr = byRole(gatehouseRoof(g), "pyramid")[0] as Extract<RoofPart, { role: "pyramid" }>;
    expect(pyr.halfX).toBe(3);
    expect(pyr.halfZ).toBe(2);
    expect(pyr.height).toBe(2.5);
    expect(pyr.position.y).toBeCloseTo(6 + 2.5 / 2, 9); // flush on the crown
  });

  it("a raised gatehouse adds 4 corner posts and lifts the pyramid", () => {
    const g = gatehouse({ raisedOnPosts: true, height: 6, roofPitch: 2.5 });
    const parts = gatehouseRoof(g);
    expect(byRole(parts, "post")).toHaveLength(4);
    const postH = roofPostHeight(false, g.merlonSize);
    const pyr = byRole(parts, "pyramid")[0] as Extract<RoofPart, { role: "pyramid" }>;
    expect(pyr.position.y).toBeCloseTo(6 + postH + 2.5 / 2, 9);
  });
});

describe("roofs: wall run → posted gabled cover", () => {
  it("the gable ridge length equals the wall length (one source of truth)", () => {
    const w = wallRun({ position: { x: 0, y: 0 }, end: { x: 10, y: 0 }, thickness: 0.6 });
    const slopes = byRole(wallRunRoof(w), "slope");
    expect(slopes).toHaveLength(2); // two gable sides
    for (const s of slopes) {
      expect((s as any).size.x).toBeCloseTo(wallRunLength(w), 9); // ridge = wall length
    }
    // The two slopes pitch in opposite directions (a symmetric gable).
    expect((slopes[0] as any).rotationX).toBeCloseTo(-(slopes[1] as any).rotationX, 9);
  });

  it("is always posted (posts exist even though there is no toggle)", () => {
    const w = wallRun({ position: { x: 0, y: 0 }, end: { x: 12, y: 0 } });
    const posts = byRole(wallRunRoof(w), "post");
    expect(posts.length).toBeGreaterThanOrEqual(4); // both ends, both sides, ≥2 pairs
    expect(posts.length % 2).toBe(0); // posts come in side pairs
    const postH = roofPostHeight(w.crenellated, w.merlonSize);
    for (const p of posts) {
      expect((p as any).size.y).toBeCloseTo(postH, 9);
      expect((p as any).size.x).toBeCloseTo(ROOF_POST_SIZE, 9);
    }
  });

  it("a longer wall gets more posts", () => {
    const short = byRole(wallRunRoof(wallRun({ end: { x: 4, y: 0 } })), "post").length;
    const long = byRole(wallRunRoof(wallRun({ end: { x: 30, y: 0 } })), "post").length;
    expect(long).toBeGreaterThan(short);
  });
});

describe("roofs: ramp → posted incline cover parallel to the slope", () => {
  it("the cover slab parallels the ramp slab (same pitch angle) and slope length", () => {
    const r = ramp({ rise: 4, run: 6, width: 2 });
    const slope = byRole(rampRoof(r), "slope")[0] as Extract<RoofPart, { role: "slope" }>;
    // buildRamp pitches its slab by -atan2(rise, run); the cover must match.
    const rampSlab = buildRamp(r).find((p) => p.role === "slab")!;
    expect(slope.rotationX).toBeCloseTo(rampSlab.rotationX, 9);
    expect(slope.size.z).toBeCloseTo(Math.hypot(r.rise, r.run), 9); // slope length
    // Lifted clear of the incline by the clearance.
    expect(slope.position.y).toBeCloseTo(r.rise / 2 + ROOF_POST_CLEARANCE, 9);
  });

  it("is always posted, posts of the clearance height", () => {
    const posts = byRole(rampRoof(ramp({ rise: 4, run: 12 })), "post");
    expect(posts.length).toBeGreaterThanOrEqual(4);
    for (const p of posts) {
      expect((p as any).size.y).toBeCloseTo(ROOF_POST_CLEARANCE, 9);
    }
  });
});

describe("roofs: coexist with crenellations", () => {
  it("a crenellated + roofed tower still draws its roof (both are drawn)", () => {
    // The teeth come from the tower builder; the roof from here. Both non-empty.
    const t = tower({ crenellated: true, roofed: true, raisedOnPosts: true });
    const parts = towerRoof(t);
    expect(byRole(parts, "cone")).toHaveLength(1);
    // Raised posts clear the parapet: post height includes the merlon height.
    const postH = roofPostHeight(true, t.merlonSize);
    expect((byRole(parts, "post")[0] as any).size.y).toBeCloseTo(postH, 9);
    expect(postH).toBeGreaterThan(ROOF_POST_CLEARANCE); // taller than a plain post
  });
});

describe("roofs: cover thickness constant is used", () => {
  it("slopes use ROOF_COVER_THICKNESS as their slab thickness", () => {
    const s = byRole(wallRunRoof(wallRun()), "slope")[0] as Extract<RoofPart, { role: "slope" }>;
    expect(s.size.y).toBeCloseTo(ROOF_COVER_THICKNESS, 9);
  });
});
