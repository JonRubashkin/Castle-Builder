import { test, expect } from "@playwright/test";
import {
  clickCanvasAt,
  clickCanvasCenter,
  openApp,
  pieceCount,
  pieces,
  selectedId,
} from "./helpers";

test.describe("Castle Builder — phases 1a–1b", () => {
  test("clean boot: app loads with no pieces and no console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);

    await expect(page.getByRole("heading", { name: "Castle Builder" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tower" })).toBeVisible();
    expect(await pieceCount(page)).toBe(0);
    expect(errors).toEqual([]);
  });

  test("place a tower with the Tower tool", async ({ page }) => {
    await openApp(page);

    // Tower is the default tool; click the ground to place.
    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasCenter(page);

    await expect.poll(() => pieceCount(page)).toBe(1);
  });

  test("select a tower and delete it", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);

    // Switch to Select and click the tower (placed over the origin / center).
    await page.getByRole("button", { name: "Select" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => selectedId(page)).not.toBeNull();

    // The properties panel shows the selected tower.
    await expect(page.getByRole("heading", { name: "Tower" })).toBeVisible();

    // Delete via keyboard.
    await page.keyboard.press("Delete");
    await expect.poll(() => pieceCount(page)).toBe(0);
    expect(await selectedId(page)).toBeNull();
  });

  test("autosave persists a placed tower across reload", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);

    // Give the debounced autosave time to flush, then reload.
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).__CASTLE_E2E__));

    await expect.poll(() => pieceCount(page)).toBe(1);
  });

  test("undo and redo a placement", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => pieceCount(page)).toBe(0);

    await page.getByRole("button", { name: "Redo" }).click();
    await expect.poll(() => pieceCount(page)).toBe(1);
  });

  test("toggle crenellations and change the material on a tower", async ({
    page,
  }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);

    // Select the tower to reveal its panel.
    await page.getByRole("button", { name: "Select" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => selectedId(page)).not.toBeNull();

    // Default material is a stone solid.
    expect((await pieces(page))[0].material).toMatchObject({ kind: "solid" });
    expect((await pieces(page))[0].crenellated).toBe(false);

    // Toggle crenellations on.
    await page.getByLabel("Crenellated").check();
    await expect.poll(async () => (await pieces(page))[0].crenellated).toBe(true);
    // The merlon-size field appears once crenellated.
    await expect(page.getByText("Merlon size")).toBeVisible();

    // Switch the fill to the stone pattern.
    await page.getByLabel("Fill").selectOption("stone");
    await expect
      .poll(async () => (await pieces(page))[0].material.kind)
      .toBe("pattern");
    expect((await pieces(page))[0].material.pattern).toBe("stone");

    // The change is undoable.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect
      .poll(async () => (await pieces(page))[0].material.kind)
      .toBe("solid");
  });

  test("face-attach on move: dragging a tower onto another seats it, off it drops", async ({
    page,
  }) => {
    await openApp(page);

    // Place two towers on the ground at distinct spots (via the store accessor,
    // since a precise 3D gizmo drag can't be driven without canvas pixels — which
    // e2e must never touch). Then drive the same transient move the gizmo fires.
    const ids = await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      const a = api.getState().addTower({ position: { x: 0, y: 0 }, base: 0 });
      const b = api.getState().addTower({ position: { x: 50, y: 50 }, base: 0 });
      return { a, b };
    });
    await expect.poll(() => pieceCount(page)).toBe(2);

    const lowerTop = await page.evaluate((id) => {
      const t = (window as any).__CASTLE_E2E__
        .getPieces()
        .find((p: any) => p.id === id);
      return t.base + t.height;
    }, ids.a);

    // Drag tower B's anchor over tower A (the live transient the gizmo drives).
    await page.evaluate((id) => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().beginTransient();
      api.getState().setPiecePositionTransient(id, { x: 0, y: 0 });
      api.getState().commitTransient();
    }, ids.b);

    await expect
      .poll(async () => {
        const t = (await pieces(page)).find((p) => p.id === ids.b);
        return t.base;
      })
      .toBeCloseTo(lowerTop, 6);

    // Drag it back off onto open ground → base returns to ground height.
    await page.evaluate((id) => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().beginTransient();
      api.getState().setPiecePositionTransient(id, { x: 50, y: 50 });
      api.getState().commitTransient();
    }, ids.b);

    await expect
      .poll(async () => {
        const t = (await pieces(page)).find((p) => p.id === ids.b);
        return t.base;
      })
      .toBe(0);
  });

  test("place a gatehouse, edit a param, rotate, and delete it", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);

    await page.getByRole("button", { name: "Gatehouse" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    expect((await pieces(page))[0].kind).toBe("gatehouse");

    // Select it to reveal the gatehouse panel.
    await page.getByRole("button", { name: "Select" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => selectedId(page)).not.toBeNull();
    await expect(page.getByRole("heading", { name: "Gatehouse" })).toBeVisible();

    // Edit a parameter (width) and assert the store updates.
    await page.getByLabel("Width").fill("9");
    await expect.poll(async () => (await pieces(page))[0].width).toBe(9);

    // Rotate (15° steps): set 45° and assert it sticks (a multiple of 15).
    await page.getByLabel("Rotation").fill("45");
    await expect.poll(async () => (await pieces(page))[0].rotation).toBe(45);

    // Delete via the panel button.
    await page.getByRole("button", { name: "Delete gatehouse" }).click();
    await expect.poll(() => pieceCount(page)).toBe(0);

    expect(errors).toEqual([]);
  });

  test("draw a wall run with two clicks", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);

    await page.getByRole("button", { name: "Wall" }).click();
    // First click sets the start; no piece yet.
    await clickCanvasAt(page, 250, 320);
    expect(await pieceCount(page)).toBe(0);

    // Second click (a clearly different point) sets the end → one wall run.
    await clickCanvasAt(page, 520, 220);
    await expect.poll(() => pieceCount(page)).toBe(1);

    const w = (await pieces(page))[0];
    expect(w.kind).toBe("wallRun");
    // Endpoints are distinct (non-zero length) and grid-snapped (0.1 m).
    expect(w.position).not.toEqual(w.end);
    for (const v of [w.position.x, w.position.y, w.end.x, w.end.y]) {
      expect(Math.abs(v * 10 - Math.round(v * 10))).toBeLessThan(1e-6);
    }

    expect(errors).toEqual([]);
  });

  test("select a wall run and delete it", async ({ page }) => {
    await openApp(page);

    // Place a wall straight through the origin so a center click hits it.
    await page.evaluate(() => {
      (window as any).__CASTLE_E2E__
        .getState()
        .addWallRun({ position: { x: -6, y: 0 }, end: { x: 6, y: 0 }, base: 0 });
    });
    await expect.poll(() => pieceCount(page)).toBe(1);

    await page.getByRole("button", { name: "Select" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => selectedId(page)).not.toBeNull();
    await expect(page.getByRole("heading", { name: "Wall" })).toBeVisible();

    await page.keyboard.press("Delete");
    await expect.poll(() => pieceCount(page)).toBe(0);
  });

  test("drag a wall endpoint reshapes the wall (one endpoint moves)", async ({
    page,
  }) => {
    await openApp(page);

    const id = await page.evaluate(() => {
      return (window as any).__CASTLE_E2E__
        .getState()
        .addWallRun({ position: { x: 0, y: 0 }, end: { x: 10, y: 0 }, base: 0 });
    });
    await expect.poll(() => pieceCount(page)).toBe(1);

    // Drive the same transient the endpoint handle fires (a real 3D handle drag
    // can't be driven without canvas pixels — which e2e must never touch).
    await page.evaluate((wid) => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().beginTransient();
      api.getState().setWallEndpointTransient(wid, "end", { x: 4, y: 6 });
      api.getState().commitTransient();
    }, id);

    const w = (await pieces(page)).find((p) => p.id === id);
    expect(w.position).toEqual({ x: 0, y: 0 }); // start unchanged
    expect(w.end).toEqual({ x: 4, y: 6 }); // end moved
  });

  test("place a gate, edit a param, rotate (15° steps), and delete it", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);

    await page.getByRole("button", { name: "Gate", exact: true }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    expect((await pieces(page))[0].kind).toBe("gate");

    // Select it to reveal the panel. The gate is an open lattice (bars with
    // gaps), so a center click can slip through a gap — select via the store
    // accessor for determinism (a real 3D bar pick can't be driven without
    // canvas pixels, which e2e must never touch).
    await page.getByRole("button", { name: "Select" }).click();
    await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().selectPiece(api.getPieces()[0].id);
    });
    await expect.poll(() => selectedId(page)).not.toBeNull();
    await expect(page.getByRole("heading", { name: "Gate" })).toBeVisible();

    // Edit width.
    await page.getByLabel("Width").fill("3");
    await expect.poll(async () => (await pieces(page))[0].width).toBe(3);

    // Rotate to 90° (a multiple of 15) so the gate can face across an archway.
    await page.getByLabel("Rotation").fill("90");
    await expect.poll(async () => (await pieces(page))[0].rotation).toBe(90);

    // Delete via the panel button.
    await page.getByRole("button", { name: "Delete gate" }).click();
    await expect.poll(() => pieceCount(page)).toBe(0);

    expect(errors).toEqual([]);
  });

  test("gate face-attaches onto a wall top when placed over it", async ({ page }) => {
    await openApp(page);

    // A wall on the ground through the origin (top at base + height).
    const wallTop = await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      const id = api
        .getState()
        .addWallRun({ position: { x: -6, y: 0 }, end: { x: 6, y: 0 }, base: 0 });
      const w = api.getPieces().find((p: any) => p.id === id);
      return w.base + w.height;
    });
    await expect.poll(() => pieceCount(page)).toBe(1);

    // Place a gate over the wall (the origin is on the wall footprint).
    await page.getByRole("button", { name: "Gate", exact: true }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(2);

    const gate = (await pieces(page)).find((p) => p.kind === "gate");
    expect(gate.base).toBeCloseTo(wallTop, 6); // seated on the wall top
  });

  test("place a RING moat, edit its radii, and delete it", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);

    // The Moat tool defaults to the ring sub-mode.
    await page.getByRole("button", { name: "Moat", exact: true }).click();
    await expect(page.getByRole("button", { name: "Ring" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    const m = (await pieces(page))[0];
    expect(m.kind).toBe("moat");
    expect(m.shape).toBe("ring");
    // Ground-only: seated at base 0 (groundHeightAt is 0 in this flat phase).
    expect(m.base).toBe(0);
    // Default opaque-water material.
    expect(m.material).toMatchObject({ kind: "pattern", pattern: "water" });

    // Select via the store accessor (a ring's center is a hole, so a center click
    // would miss it — a real 3D band pick can't be driven without canvas pixels).
    await page.evaluate((id) => {
      (window as any).__CASTLE_E2E__.getState().selectPiece(id);
    }, m.id);
    await expect(page.getByRole("heading", { name: "Moat" })).toBeVisible();

    // Edit the radii live and assert the store updates.
    await page.getByLabel("Outer radius").fill("12");
    await expect.poll(async () => (await pieces(page))[0].outerRadius).toBe(12);
    await page.getByLabel("Inner radius").fill("8");
    await expect.poll(async () => (await pieces(page))[0].innerRadius).toBe(8);

    // Delete via the panel button.
    await page.getByRole("button", { name: "Delete moat" }).click();
    await expect.poll(() => pieceCount(page)).toBe(0);

    expect(errors).toEqual([]);
  });

  test("place a SEGMENT moat with two clicks, edit width, and delete it", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);

    await page.getByRole("button", { name: "Moat", exact: true }).click();
    // Switch the sub-mode to segment.
    await page.getByRole("button", { name: "Segment" }).click();
    await expect(page.getByRole("button", { name: "Segment" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Two-point placement: first click sets the start (no piece yet).
    await clickCanvasAt(page, 250, 320);
    expect(await pieceCount(page)).toBe(0);
    // Second click (a clearly different point) places one segment moat.
    await clickCanvasAt(page, 520, 220);
    await expect.poll(() => pieceCount(page)).toBe(1);

    const m = (await pieces(page))[0];
    expect(m.kind).toBe("moat");
    expect(m.shape).toBe("segment");
    expect(m.base).toBe(0); // ground-only
    // Endpoints are distinct and grid-snapped (0.1 m).
    expect(m.position).not.toEqual(m.end);
    for (const v of [m.position.x, m.position.y, m.end.x, m.end.y]) {
      expect(Math.abs(v * 10 - Math.round(v * 10))).toBeLessThan(1e-6);
    }

    // Select and edit width.
    await page.evaluate((id) => {
      (window as any).__CASTLE_E2E__.getState().selectPiece(id);
    }, m.id);
    await expect(page.getByRole("heading", { name: "Moat" })).toBeVisible();
    await page.getByLabel("Width").fill("4");
    await expect.poll(async () => (await pieces(page))[0].width).toBe(4);

    // Delete via the panel button (the Width input still has focus, so a Delete
    // keypress would be swallowed by the text field rather than deleting).
    await page.getByRole("button", { name: "Delete moat" }).click();
    await expect.poll(() => pieceCount(page)).toBe(0);

    expect(errors).toEqual([]);
  });

  test("a segment moat moves ground-only (gizmo transient never face-attaches)", async ({
    page,
  }) => {
    await openApp(page);

    // A tall tower at the origin, and a segment moat passing over it.
    const ids = await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().addTower({ position: { x: 0, y: 0 }, base: 0 });
      const moat = api
        .getState()
        .addMoatSegment({ position: { x: -20, y: 0 }, end: { x: -10, y: 0 } });
      return { moat };
    });
    await expect.poll(() => pieceCount(page)).toBe(2);

    // Drag the moat's start anchor onto the tower (the live transient the gizmo
    // drives). A moat must stay ground-only — base 0, never the tower top.
    await page.evaluate((id) => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().beginTransient();
      api.getState().setPiecePositionTransient(id, { x: 0, y: 0 });
      api.getState().commitTransient();
    }, ids.moat);

    const m = (await pieces(page)).find((p) => p.id === ids.moat);
    expect(m.base).toBe(0); // ground-only, even sitting over a tower
  });

  test("ramp: two-click connect from ground to a tower top stores rise ≈ tower height", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);

    // A tower at the origin (projects near the canvas center), height 8.
    const towerHeight = await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      const id = api.getState().addTower({ position: { x: 0, y: 0 }, base: 0 });
      return api.getPieces().find((p: any) => p.id === id).height;
    });
    await expect.poll(() => pieceCount(page)).toBe(1);

    // Ramp tool: first click a bottom on open ground (a far corner), then a top
    // click over the tower (canvas center → over the tower footprint).
    await page.getByRole("button", { name: "Ramp", exact: true }).click();
    await clickCanvasAt(page, 80, 90); // bottom — on the ground, away from the tower
    expect(await pieceCount(page)).toBe(1); // first click only sets the bottom
    await clickCanvasCenter(page); // top — over the tower top → a real connection
    await expect.poll(() => pieceCount(page)).toBe(2);

    const ramp = (await pieces(page)).find((p) => p.kind === "ramp");
    expect(ramp).toBeTruthy();
    // The bottom is on the ground (base 0), so the rise literally spans the tower
    // height regardless of where the bottom landed.
    expect(ramp.base).toBe(0);
    expect(ramp.rise).toBeCloseTo(towerHeight, 6);
    expect(ramp.run).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test("ramp: a top click on empty ground falls back to a tunable default ramp", async ({
    page,
  }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Ramp", exact: true }).click();
    // Both clicks land on empty ground → the graceful fallback default ramp.
    await clickCanvasAt(page, 200, 320); // bottom
    expect(await pieceCount(page)).toBe(0);
    await clickCanvasAt(page, 520, 220); // top — empty ground, not a surface
    await expect.poll(() => pieceCount(page)).toBe(1);

    const ramp = (await pieces(page))[0];
    expect(ramp.kind).toBe("ramp");
    // Default rise/run from constants (the user tunes after). Default style "ramp".
    expect(ramp.rise).toBe(4);
    expect(ramp.run).toBe(6);
    expect(ramp.style).toBe("ramp");
    expect(ramp.base).toBe(0); // bottom on the ground
  });

  test("ramp: toggle ramp/stair, edit rise, and delete", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);

    // Place a ramp via the store, then select it via the accessor (a ramp's slope
    // can't be reliably picked by a single canvas click — and e2e never reads
    // canvas pixels).
    const id = await page.evaluate(() => {
      return (window as any).__CASTLE_E2E__.getState().addRamp({
        position: { x: 0, y: 0 },
        base: 0,
        rotation: 0,
        rise: 4,
        run: 6,
      });
    });
    await expect.poll(() => pieceCount(page)).toBe(1);

    await page.getByRole("button", { name: "Select" }).click();
    await page.evaluate((rid) => {
      (window as any).__CASTLE_E2E__.getState().selectPiece(rid);
    }, id);
    await expect(page.getByRole("heading", { name: "Ramp" })).toBeVisible();

    // Toggle ramp → stair.
    await page.getByLabel("Style").selectOption("stair");
    await expect.poll(async () => (await pieces(page))[0].style).toBe("stair");

    // Edit the rise.
    await page.getByLabel("Rise").fill("5");
    await expect.poll(async () => (await pieces(page))[0].rise).toBe(5);

    // Delete via the panel button.
    await page.getByRole("button", { name: "Delete ramp" }).click();
    await expect.poll(() => pieceCount(page)).toBe(0);

    expect(errors).toEqual([]);
  });

  test("face-attach: a tower placed over another seats on its top", async ({
    page,
  }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasCenter(page); // tower #1 on the ground
    await expect.poll(() => pieceCount(page)).toBe(1);

    // Click the same spot again: the anchor is over tower #1's footprint, so
    // face-attach seats the new tower on tower #1's top.
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(2);

    const ps = await pieces(page);
    const lower = ps[0];
    const upper = ps[1];
    // Upper tower's stored base equals the lower tower's top (base + height).
    expect(upper.base).toBeCloseTo(lower.base + lower.height, 6);
    // And the first tower stayed on the ground.
    expect(lower.base).toBe(0);
  });
});
