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

  test("wall endpoint snaps onto a nearby tower anchor", async ({ page }) => {
    await openApp(page);

    // Place a tower at the canvas center, then read its (grid-snapped) anchor.
    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    const towerAnchor = (await pieces(page))[0].position;

    // Draw a wall whose START click lands over the tower (within snap tolerance):
    // the stored start endpoint should latch onto the tower anchor exactly.
    await page.getByRole("button", { name: "Wall" }).click();
    await clickCanvasCenter(page); // start → snaps to the tower anchor
    await clickCanvasAt(page, 520, 220); // end → somewhere far away
    await expect.poll(() => pieceCount(page)).toBe(2);

    const wall = (await pieces(page)).find((p) => p.kind === "wallRun");
    expect(wall).toBeTruthy();
    expect(wall.position).toEqual(towerAnchor); // endpoint == the tower anchor
  });

  test("wall endpoints far from any piece grid-snap (no anchor snap)", async ({
    page,
  }) => {
    await openApp(page);

    // A tower at center exists, but the wall is drawn far away from it.
    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    const towerAnchor = (await pieces(page))[0].position;

    await page.getByRole("button", { name: "Wall" }).click();
    await clickCanvasAt(page, 250, 320);
    await clickCanvasAt(page, 520, 220);
    await expect.poll(() => pieceCount(page)).toBe(2);

    const wall = (await pieces(page)).find((p) => p.kind === "wallRun");
    expect(wall).toBeTruthy();
    // Both endpoints land on the 0.1 m grid (not latched onto the far tower).
    for (const v of [wall.position.x, wall.position.y, wall.end.x, wall.end.y]) {
      expect(Math.abs(v * 10 - Math.round(v * 10))).toBeLessThan(1e-6);
    }
    expect(wall.position).not.toEqual(towerAnchor);
    expect(wall.end).not.toEqual(towerAnchor);
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

  test("phase 1 complete: a mixed castle of all six kinds persists across reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);

    // Build a small mixed castle — one of every kind — via the store accessor
    // (deterministic placement; e2e never reads canvas pixels).
    await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      const s = api.getState();
      s.addTower({ position: { x: 0, y: 0 }, base: 0 });
      s.addGatehouse({ position: { x: 12, y: 0 }, base: 0 });
      s.addWallRun({ position: { x: 2, y: 0 }, end: { x: 10, y: 0 }, base: 0 });
      s.addGate({ position: { x: 12, y: 0 }, base: 0 });
      s.addMoatRing({ position: { x: 0, y: 20 } });
      s.addRamp({ position: { x: -8, y: 0 }, base: 0, rotation: 0, rise: 4, run: 6 });
    });
    await expect.poll(() => pieceCount(page)).toBe(6);

    const kindsBefore = await page.evaluate(() =>
      (window as any).__CASTLE_E2E__.getPieces().map((p: any) => p.kind).sort(),
    );
    expect(kindsBefore).toEqual([
      "gate",
      "gatehouse",
      "moat",
      "ramp",
      "tower",
      "wallRun",
    ]);

    // Let the debounced autosave flush, then reload and confirm all six survive.
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).__CASTLE_E2E__));

    await expect.poll(() => pieceCount(page)).toBe(6);
    const kindsAfter = await page.evaluate(() =>
      (window as any).__CASTLE_E2E__.getPieces().map((p: any) => p.kind).sort(),
    );
    expect(kindsAfter).toEqual(kindsBefore);

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

  test("New Castle: Cancel keeps the design; confirm clears it and survives reload", async ({
    page,
  }) => {
    const undoPastLength = () =>
      page.evaluate(() => (window as any).__CASTLE_E2E__.getState().history.past.length);

    await openApp(page);

    // Build up a small design (towers → non-empty pieces + undo history).
    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasAt(page, 300, 300);
    await clickCanvasAt(page, 500, 250);
    await expect.poll(() => pieceCount(page)).toBe(2);
    // Select a piece so we can confirm the reset clears the selection too.
    await page.getByRole("button", { name: "Select" }).click();
    await clickCanvasAt(page, 300, 300);
    await expect.poll(() => selectedId(page)).not.toBeNull();
    expect(await undoPastLength()).toBeGreaterThan(0);

    // Open the dialog and CANCEL → nothing changes.
    await page.getByRole("button", { name: "New Castle" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await pieceCount(page)).toBe(2); // design intact

    // Open again and CONFIRM → fresh empty design, transients + history cleared.
    await page.getByRole("button", { name: "New Castle" }).click();
    await page.getByRole("button", { name: "Start new" }).click();
    await expect.poll(() => pieceCount(page)).toBe(0);
    expect(await selectedId(page)).toBeNull();
    expect(await undoPastLength()).toBe(0);

    // The fresh design persists: a reload resumes the empty design (not the old).
    await page.waitForTimeout(500); // let the debounced autosave flush
    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).__CASTLE_E2E__));
    await expect.poll(() => pieceCount(page)).toBe(0);
  });

  test('"Keep on ground" toggle: appears on selection, hidden when deselected', async ({
    page,
  }) => {
    await openApp(page);

    const groundBtn = page.getByRole("button", { name: "Keep on ground" });
    // The removed "Center on support" toggle must no longer exist.
    const centerBtn = page.getByRole("button", { name: "Center on support" });

    // Nothing selected → the toggle is hidden.
    await expect(groundBtn).toBeHidden();
    await expect(centerBtn).toHaveCount(0);

    // Place and select a tower → the toggle appears (center-on-support never does).
    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    await page.getByRole("button", { name: "Select" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => selectedId(page)).not.toBeNull();

    await expect(groundBtn).toBeVisible();
    await expect(centerBtn).toHaveCount(0);
    await expect(groundBtn).toHaveAttribute("aria-pressed", "false");

    // Deselect (click empty ground) → the toggle hides again.
    await clickCanvasAt(page, 40, 40);
    await expect.poll(() => selectedId(page)).toBeNull();
    await expect(groundBtn).toBeHidden();
  });

  test('"Keep on ground" toggle: toggles and persists across reload', async ({
    page,
  }) => {
    const mode = () =>
      page.evaluate(() => (window as any).__CASTLE_E2E__.getState().placementMode);

    await openApp(page);

    // Place + select a tower so the toggle is visible.
    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasCenter(page);
    await page.getByRole("button", { name: "Select" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => selectedId(page)).not.toBeNull();

    const groundBtn = page.getByRole("button", { name: "Keep on ground" });

    // Turn "Keep on ground" on.
    await groundBtn.click();
    await expect(groundBtn).toHaveAttribute("aria-pressed", "true");
    expect(await mode()).toBe("groundOnly");

    // The pref survives a reload (it is NOT part of the design's undo history).
    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).__CASTLE_E2E__));
    expect(await mode()).toBe("groundOnly");
  });

  test("placement-mode: ground-only keeps a dragged piece on the ground", async ({
    page,
  }) => {
    await openApp(page);

    const ids = await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      const a = api.getState().addTower({ position: { x: 0, y: 0 }, base: 0 });
      const b = api.getState().addTower({ position: { x: 50, y: 50 }, base: 0 });
      api.getState().selectPiece(b);
      api.getState().setPlacementMode("groundOnly");
      return { a, b };
    });
    await expect.poll(() => pieceCount(page)).toBe(2);

    // Drag tower B's anchor squarely over tower A. Ground-only → it must NOT climb.
    await page.evaluate((id) => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().beginTransient();
      api.getState().setPiecePositionTransient(id, { x: 0, y: 0 });
      api.getState().commitTransient();
    }, ids.b);

    const b = (await pieces(page)).find((p) => p.id === ids.b);
    expect(b.base).toBe(0); // stayed on the ground, never seated on tower A's top
  });

  test('"Place on top": places A on B (base = B top, anchor = B center), stays selected, one undo', async ({
    page,
  }) => {
    await openApp(page);

    const { ids, bPos, bTop } = await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      const a = api.getState().addTower({ position: { x: 3, y: -2 }, base: 0 });
      const b = api.getState().addTower({ position: { x: 20, y: 12 }, base: 0 });
      const pb = api.getPieces().find((p: any) => p.id === b);
      api.getState().selectPiece(a);
      return { ids: { a, b }, bPos: pb.position, bTop: pb.base + pb.height };
    });
    await expect.poll(() => pieceCount(page)).toBe(2);

    // Arm "Place on top" with the real panel button (piece A is selected).
    const placeBtn = page.getByRole("button", { name: /Place on top of/ });
    await expect(placeBtn).toBeVisible();
    await placeBtn.click();
    await expect(page.locator("[data-place-on-top]")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Click piece B (the target) → A seats on B's top, centered on B, stays selected.
    await page.evaluate((targetId) => {
      (window as any).__CASTLE_E2E__.getState().placeOnTopTarget(targetId);
    }, ids.b);

    let a = (await pieces(page)).find((p) => p.id === ids.a);
    expect(a.position).toEqual(bPos); // anchor centered on B
    expect(a.base).toBeCloseTo(bTop, 6); // base seated on B's top
    expect(a.base).not.toBe(0); // rose off the ground
    expect(await selectedId(page)).toBe(ids.a); // still selected
    // The action ended (disarmed).
    await expect(page.locator("[data-place-on-top]")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // One undo reverses it (A back on the ground at its original spot).
    await page.evaluate(() => (window as any).__CASTLE_E2E__.getState().undo());
    a = (await pieces(page)).find((p) => p.id === ids.a);
    expect(a.position).toEqual({ x: 3, y: -2 });
    expect(a.base).toBe(0);
  });

  test('"Place on top": Esc while armed cancels with no change (selection unchanged)', async ({
    page,
  }) => {
    await openApp(page);

    const ids = await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      const a = api.getState().addTower({ position: { x: 3, y: -2 }, base: 0 });
      const b = api.getState().addTower({ position: { x: 20, y: 12 }, base: 0 });
      api.getState().selectPiece(a);
      return { a, b };
    });
    await expect.poll(() => pieceCount(page)).toBe(2);

    const placeBtn = page.getByRole("button", { name: /Place on top of/ });
    await placeBtn.click();
    await expect(page.locator("[data-place-on-top]")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Esc cancels the armed action; selection stays on A and nothing moves.
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-place-on-top]")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(await selectedId(page)).toBe(ids.a); // selection unchanged

    const a = (await pieces(page)).find((p) => p.id === ids.a);
    expect(a.position).toEqual({ x: 3, y: -2 });
    expect(a.base).toBe(0);
  });


  test("place a flag with the Flag tool (embedded design + default params)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);

    await page.getByRole("button", { name: "Flag" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);

    const flag = (await pieces(page))[0];
    expect(flag.kind).toBe("flag");
    // Default pole/cloth params.
    expect(flag.poleHeight).toBeGreaterThan(0);
    expect(flag.clothWidth).toBeGreaterThan(0);
    // It embeds its own FlagDesign (the design travels with the piece).
    expect(flag.design).toBeTruthy();
    expect(typeof flag.design.aspect).toBe("number");
    expect(Array.isArray(flag.design.layers)).toBe(true);
    expect(flag.design.layers.length).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test("flag: select, edit a param, rotate (15° steps), and delete", async ({
    page,
  }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Flag" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);

    // Select via the accessor (the thin pole / angled cloth is awkward to pick by
    // a single canvas click — and e2e never reads canvas pixels).
    await page.getByRole("button", { name: "Select" }).click();
    await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().selectPiece(api.getPieces()[0].id);
    });
    await expect.poll(() => selectedId(page)).not.toBeNull();
    await expect(page.getByRole("heading", { name: "Flag" })).toBeVisible();

    // Edit a param (pole height).
    await page.getByLabel("Pole height").fill("9");
    await expect.poll(async () => (await pieces(page))[0].poleHeight).toBe(9);

    // Rotate (15° steps).
    await page.getByLabel("Rotation").fill("45");
    await expect.poll(async () => (await pieces(page))[0].rotation).toBe(45);

    // Delete via the panel button.
    await page.getByRole("button", { name: "Delete flag" }).click();
    await expect.poll(() => pieceCount(page)).toBe(0);
  });

  test("flag: face-attaches onto a tower top when placed over it, and moves undoably", async ({
    page,
  }) => {
    await openApp(page);

    // A tower on the ground; its top is base + height.
    const towerTop = await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      const id = api.getState().addTower({ position: { x: 0, y: 0 }, base: 0 });
      const t = api.getPieces().find((p: any) => p.id === id);
      return t.base + t.height;
    });
    await expect.poll(() => pieceCount(page)).toBe(1);

    // Place a flag over the tower (the origin is on the tower footprint) → it
    // seats on the tower top via face-attach.
    await page.getByRole("button", { name: "Flag" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(2);

    const flag = (await pieces(page)).find((p) => p.kind === "flag");
    expect(flag.base).toBeCloseTo(towerTop, 6); // planted on the tower top

    // Drag the flag off onto open ground → its base returns to the ground; undoable.
    await page.evaluate((id) => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().beginTransient();
      api.getState().setPiecePositionTransient(id, { x: 60, y: 60 });
      api.getState().commitTransient();
    }, flag.id);
    await expect
      .poll(async () => (await pieces(page)).find((p) => p.id === flag.id).base)
      .toBe(0);

    await page.evaluate(() => (window as any).__CASTLE_E2E__.getState().undo());
    await expect
      .poll(async () => (await pieces(page)).find((p) => p.id === flag.id).base)
      .toBeCloseTo(towerTop, 6);
  });

  test("flag: nothing face-attaches onto a flag (it is not a stackable surface)", async ({
    page,
  }) => {
    await openApp(page);

    // A flag on the ground, then a tower placed at the same anchor: the tower must
    // NOT seat on the flag (a flag has no flat top) — it stays on the ground.
    await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().addFlag({ position: { x: 0, y: 0 }, base: 0 });
    });
    await expect.poll(() => pieceCount(page)).toBe(1);

    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(2);

    const tower = (await pieces(page)).find((p) => p.kind === "tower");
    expect(tower.base).toBe(0); // did not climb onto the flag
  });

  test("Export → Import round-trips a flag with its embedded design (validated load)", async ({
    page,
  }) => {
    await openApp(page);

    // Place a flag.
    await page.getByRole("button", { name: "Flag" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    const before = (await pieces(page))[0];

    // Serialize the design (what Export writes), stash it, then reload. On reload
    // the app loads it through the SAME validated path Import uses
    // (parseDesignJSON → validateDesign → migration), so this exercises the real
    // round-trip — not just a JSON copy.
    const json = await page.evaluate(() =>
      JSON.stringify((window as any).__CASTLE_E2E__.getState().design),
    );
    await page.evaluate((raw) => {
      window.localStorage.setItem("castle-builder:autosave", raw);
    }, json);

    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).__CASTLE_E2E__));

    await expect.poll(() => pieceCount(page)).toBe(1);
    const after = (await pieces(page))[0];
    expect(after.kind).toBe("flag");
    // The embedded design survived the validated round-trip verbatim.
    expect(after.design).toEqual(before.design);
    expect(after.poleHeight).toBe(before.poleHeight);
    expect(after.clothWidth).toBe(before.clothWidth);
  });

  test("flag editor: add stripes + a charge, Apply → stored design contains them (undoable)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);

    // Place a flag and select it (the thin pole is awkward to pick by a click).
    await page.getByRole("button", { name: "Flag" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    await page.getByRole("button", { name: "Select" }).click();
    await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().selectPiece(api.getPieces()[0].id);
    });
    await expect.poll(() => selectedId(page)).not.toBeNull();

    const layerCountBefore = (await pieces(page))[0].design.layers.length;

    // Open the editor.
    await page.getByRole("button", { name: "Edit design…" }).click();
    await expect(page.getByRole("dialog", { name: "Flag design editor" })).toBeVisible();

    // Add a stripes layer and a charge layer.
    await page.getByRole("button", { name: "Add stripes" }).click();
    await page.getByRole("button", { name: "Add charge" }).click();

    // Apply → the stored embedded design gains both layers, in ONE undoable edit.
    await page.locator('[data-action="flag-editor-apply"]').click();
    await expect(page.getByRole("dialog", { name: "Flag design editor" })).toBeHidden();

    const design = (await pieces(page))[0].design;
    expect(design.layers.length).toBe(layerCountBefore + 2);
    expect(design.layers.some((l: any) => l.kind === "stripes")).toBe(true);
    expect(design.layers.some((l: any) => l.kind === "charge")).toBe(true);

    // One undo reverses the whole applied edit (coalesced).
    await page.evaluate(() => (window as any).__CASTLE_E2E__.getState().undo());
    await expect
      .poll(async () => (await pieces(page))[0].design.layers.length)
      .toBe(layerCountBefore);

    expect(errors).toEqual([]);
  });

  test("flag editor: drag a charge on the preview updates its (x,y) and the sliders", async ({
    page,
  }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Flag" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    await page.getByRole("button", { name: "Select" }).click();
    await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().selectPiece(api.getPieces()[0].id);
    });
    await expect.poll(() => selectedId(page)).not.toBeNull();

    await page.getByRole("button", { name: "Edit design…" }).click();
    // Add a charge (defaults to the flag center, so a center press grabs it).
    await page.getByRole("button", { name: "Add charge" }).click();

    // The X slider starts at 0.5 (the default charge position).
    const xSlider = page.getByLabel("Charge X");
    expect(Number(await xSlider.inputValue())).toBeCloseTo(0.5, 2);

    // Drag the charge from the preview center toward the left edge (a DOM pointer
    // drag — never reading canvas pixels).
    const canvas = page.locator(".flag-editor__canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("preview canvas has no box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();

    // The slider (single source of truth for the charge's x) reflects the drag.
    await expect
      .poll(async () => Number(await xSlider.inputValue()))
      .toBeLessThan(0.4);

    // Apply → the stored charge's x moved to match the dragged value.
    const sliderX = Number(await xSlider.inputValue());
    await page.locator('[data-action="flag-editor-apply"]').click();

    const charge = (await pieces(page))[0].design.layers.find(
      (l: any) => l.kind === "charge",
    );
    expect(charge).toBeTruthy();
    expect(charge.x).toBeCloseTo(sliderX, 2);
    expect(charge.x).toBeLessThan(0.4); // it really moved off center
  });

  test("flag editor: Esc discards the working copy (flag design unchanged)", async ({
    page,
  }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Flag" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    await page.getByRole("button", { name: "Select" }).click();
    await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().selectPiece(api.getPieces()[0].id);
    });
    await expect.poll(() => selectedId(page)).not.toBeNull();

    const layersBefore = (await pieces(page))[0].design.layers.length;

    await page.getByRole("button", { name: "Edit design…" }).click();
    await page.getByRole("button", { name: "Add charge" }).click();
    await page.getByRole("button", { name: "Add stripes" }).click();

    // Esc discards: the modal closes, the flag stays selected, design untouched.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Flag design editor" })).toBeHidden();
    expect(await selectedId(page)).not.toBeNull();
    expect((await pieces(page))[0].design.layers.length).toBe(layersBefore);
  });

  test("flag editor: aspect edit reshapes the design on Apply", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Flag" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    await page.getByRole("button", { name: "Select" }).click();
    await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().selectPiece(api.getPieces()[0].id);
    });
    await expect.poll(() => selectedId(page)).not.toBeNull();

    const aspectBefore = (await pieces(page))[0].design.aspect;

    await page.getByRole("button", { name: "Edit design…" }).click();
    // Nudge the aspect slider to its max, then Apply.
    await page.getByLabel("Aspect").fill("3");
    await page.locator('[data-action="flag-editor-apply"]').click();

    const aspectAfter = (await pieces(page))[0].design.aspect;
    expect(aspectAfter).not.toBe(aspectBefore);
    expect(aspectAfter).toBeCloseTo(3, 6);
  });

  // --- Saved-flags library (2Fd) --------------------------------------------

  // Place N flags and return their ids (the thin pole is awkward to click; the
  // e2e accessor never reads canvas pixels, so place + select via the store).
  async function placeFlags(page: import("@playwright/test").Page, n: number) {
    return page.evaluate((count) => {
      const api = (window as any).__CASTLE_E2E__;
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        ids.push(api.getState().addFlag({ position: { x: i * 4, y: 0 }, base: 0 }));
      }
      return ids;
    }, n);
  }

  const openEditorFor = async (
    page: import("@playwright/test").Page,
    id: string,
  ) => {
    await page.evaluate((fid) => {
      (window as any).__CASTLE_E2E__.getState().selectPiece(fid);
    }, id);
    await page.getByRole("button", { name: "Edit design…" }).click();
    await expect(
      page.getByRole("dialog", { name: "Flag design editor" }),
    ).toBeVisible();
  };

  const library = (page: import("@playwright/test").Page) =>
    page.evaluate(() => (window as any).__CASTLE_E2E__.getFlagLibrary());

  test("library: save a design, apply it to a different flag (copied into its embedded design)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);
    const [flagA, flagB] = await placeFlags(page, 2);
    await page.getByRole("button", { name: "Select" }).click();

    // Author a distinctive design on flag A and SAVE it to the library.
    await openEditorFor(page, flagA);
    await page.getByRole("button", { name: "Add charge" }).click();
    await page.getByLabel("Library entry name").fill("War Banner");
    await page.getByRole("button", { name: "Save as new" }).click();
    await expect
      .poll(async () => (await library(page)).length)
      .toBe(1);
    const saved = (await library(page))[0];
    expect(saved.name).toBe("War Banner");
    expect(saved.design.layers.some((l: any) => l.kind === "charge")).toBe(true);
    await page.locator('[data-action="flag-editor-apply"]').click();

    // Flag B starts on its default design (no charge). Apply the saved one.
    const bBefore = (await pieces(page)).find((p) => p.id === flagB);
    expect(bBefore.design.layers.some((l: any) => l.kind === "charge")).toBe(false);

    await openEditorFor(page, flagB);
    await page.locator('[data-action="apply-flag-library"]').first().click();
    await page.locator('[data-action="flag-editor-apply"]').click();

    // Flag B's embedded design now MATCHES the saved entry (copied in).
    const bAfter = (await pieces(page)).find((p) => p.id === flagB);
    expect(bAfter.design).toEqual(saved.design);
    // Flag A is untouched by any of this.
    const aAfter = (await pieces(page)).find((p) => p.id === flagA);
    expect(aAfter.design.layers.some((l: any) => l.kind === "charge")).toBe(true);

    expect(errors).toEqual([]);
  });

  test("library: applying copies (no live link) — editing the flag leaves the library entry unchanged", async ({
    page,
  }) => {
    await openApp(page);
    const [flagA, flagB] = await placeFlags(page, 2);
    await page.getByRole("button", { name: "Select" }).click();

    // Save flag A's (default) design, then apply it to flag B.
    await openEditorFor(page, flagA);
    await page.getByLabel("Library entry name").fill("Base");
    await page.getByRole("button", { name: "Save as new" }).click();
    await expect.poll(async () => (await library(page)).length).toBe(1);
    await page.locator('[data-action="flag-editor-apply"]').click();

    const entryLayers = (await library(page))[0].design.layers.length;

    await openEditorFor(page, flagB);
    await page.locator('[data-action="apply-flag-library"]').first().click();
    // Now edit flag B's working copy (add layers) and Apply.
    await page.getByRole("button", { name: "Add stripes" }).click();
    await page.getByRole("button", { name: "Add charge" }).click();
    await page.locator('[data-action="flag-editor-apply"]').click();

    // Flag B changed...
    const bAfter = (await pieces(page)).find((p) => p.id === flagB);
    expect(bAfter.design.layers.length).toBe(entryLayers + 2);
    // ...but the library entry is UNCHANGED (copy, not link).
    expect((await library(page))[0].design.layers.length).toBe(entryLayers);
  });

  test("library: overwrite vs save-as both behave", async ({ page }) => {
    await openApp(page);
    const [flagA] = await placeFlags(page, 1);
    await page.getByRole("button", { name: "Select" }).click();

    // Save an initial entry.
    await openEditorFor(page, flagA);
    await page.getByLabel("Library entry name").fill("Crest");
    await page.getByRole("button", { name: "Save as new" }).click();
    await expect.poll(async () => (await library(page)).length).toBe(1);
    const firstId = (await library(page))[0].id;

    // The design is now sourced from "Crest" → an Overwrite button appears. Change
    // the working design and Overwrite: same entry id, updated design, still ONE.
    await page.getByRole("button", { name: "Add charge" }).click();
    await page.locator('[data-action="overwrite-flag-library"]').click();
    await expect
      .poll(async () => (await library(page)).length)
      .toBe(1); // no new entry
    const overwritten = (await library(page))[0];
    expect(overwritten.id).toBe(firstId); // same entry, in place
    expect(overwritten.design.layers.some((l: any) => l.kind === "charge")).toBe(
      true,
    );

    // Save as new → a SECOND entry, the first left intact.
    await page.getByLabel("Library entry name").fill("Crest v2");
    await page.getByRole("button", { name: "Save as new" }).click();
    await expect.poll(async () => (await library(page)).length).toBe(2);
    const names = (await library(page)).map((e: any) => e.name).sort();
    expect(names).toEqual(["Crest", "Crest v2"]);
  });

  test("library: delete an entry doesn't affect a flag that already embedded a copy", async ({
    page,
  }) => {
    await openApp(page);
    const [flagA, flagB] = await placeFlags(page, 2);
    await page.getByRole("button", { name: "Select" }).click();

    await openEditorFor(page, flagA);
    await page.getByRole("button", { name: "Add charge" }).click();
    await page.getByLabel("Library entry name").fill("Doomed");
    await page.getByRole("button", { name: "Save as new" }).click();
    await expect.poll(async () => (await library(page)).length).toBe(1);
    await page.locator('[data-action="flag-editor-apply"]').click();

    // Apply it into flag B, commit.
    await openEditorFor(page, flagB);
    await page.locator('[data-action="apply-flag-library"]').first().click();
    await page.locator('[data-action="flag-editor-apply"]').click();
    const bDesign = (await pieces(page)).find((p) => p.id === flagB).design;

    // Delete the entry from the picker (two-step confirm).
    await openEditorFor(page, flagB);
    await page
      .getByTestId("flag-library-row")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await page.locator('[data-action="confirm-delete-flag-library"]').click();
    await expect.poll(async () => (await library(page)).length).toBe(0);
    await page.getByRole("button", { name: "Cancel" }).click();

    // Flag B still carries its embedded copy — deleting the library entry did
    // nothing to it.
    const bStill = (await pieces(page)).find((p) => p.id === flagB).design;
    expect(bStill).toEqual(bDesign);
  });

  test("library: New Castle leaves the saved-flags library intact", async ({
    page,
  }) => {
    await openApp(page);
    const [flagA] = await placeFlags(page, 1);
    await page.getByRole("button", { name: "Select" }).click();

    await openEditorFor(page, flagA);
    await page.getByLabel("Library entry name").fill("Survivor");
    await page.getByRole("button", { name: "Save as new" }).click();
    await expect.poll(async () => (await library(page)).length).toBe(1);
    await page.locator('[data-action="flag-editor-apply"]').click();

    // New Castle clears the castle...
    await page.getByRole("button", { name: "New Castle" }).click();
    await page.getByRole("button", { name: "Start new" }).click();
    await expect.poll(() => pieceCount(page)).toBe(0);
    // ...but the library survives (separate per-origin store).
    expect((await library(page)).length).toBe(1);
    expect((await library(page))[0].name).toBe("Survivor");
  });

  // --- Auto-place flags along a host (2Fe) -----------------------------------

  test("add flags along a wall: N independent flags, one undo removes them all", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);

    // A wall of length 12 (top at base + height = 4), selected via the accessor.
    const { wallId, wallTop } = await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      const id = api
        .getState()
        .addWallRun({ position: { x: -6, y: 0 }, end: { x: 6, y: 0 }, base: 0 });
      const w = api.getPieces().find((p: any) => p.id === id);
      api.getState().selectPiece(id);
      return { wallId: id, wallTop: w.base + w.height };
    });
    await expect.poll(() => pieceCount(page)).toBe(1);
    await expect(page.getByRole("heading", { name: "Wall" })).toBeVisible();

    // Default spacing (4) over usable length 10 → 3 flags. Open the chooser and
    // pick "Use last design" (no last design yet → a sensible default).
    await page.getByRole("button", { name: "Add flags along" }).click();
    await page.getByRole("button", { name: "Use last design" }).click();
    await expect.poll(() => pieceCount(page)).toBe(4); // wall + 3 flags

    const flagPieces = (await pieces(page)).filter((p) => p.kind === "flag");
    expect(flagPieces).toHaveLength(3);
    // Each generated flag is a real flag seated on the wall top, on its edge line.
    for (const f of flagPieces) {
      expect(f.base).toBeCloseTo(wallTop, 6);
      expect(Math.abs(f.position.y)).toBeLessThan(1e-6); // on z = 0 (the wall line)
      expect(f.design).toBeTruthy();
    }

    // ONE undo removes all three flags together (the wall remains).
    await page.evaluate(() => (window as any).__CASTLE_E2E__.getState().undo());
    await expect.poll(() => pieceCount(page)).toBe(1);
    expect((await pieces(page))[0].id).toBe(wallId);

    expect(errors).toEqual([]);
  });

  test("generated flags are generate-once: resizing the wall does not move them", async ({
    page,
  }) => {
    await openApp(page);

    const wallId = await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      const id = api
        .getState()
        .addWallRun({ position: { x: -6, y: 0 }, end: { x: 6, y: 0 }, base: 0 });
      api.getState().selectPiece(id);
      return id;
    });
    await expect(page.getByRole("heading", { name: "Wall" })).toBeVisible();

    await page.getByRole("button", { name: "Add flags along" }).click();
    await page.getByRole("button", { name: "Use last design" }).click();
    await expect.poll(() => pieceCount(page)).toBe(4);

    const before = (await pieces(page))
      .filter((p) => p.kind === "flag")
      .map((f) => f.position)
      .sort((a, b) => a.x - b.x);

    // Move the wall's end far away — the flags must stay exactly where they were.
    await page.evaluate((id) => {
      (window as any).__CASTLE_E2E__
        .getState()
        .setWallEndpoint(id, "end", { x: 40, y: 40 });
    }, wallId);

    const after = (await pieces(page))
      .filter((p) => p.kind === "flag")
      .map((f) => f.position)
      .sort((a, b) => a.x - b.x);
    expect(after).toEqual(before); // generate-once: no live follow
  });

  test("a generated flag is an ordinary piece: selectable, editable, deletable", async ({
    page,
  }) => {
    await openApp(page);

    await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      const id = api
        .getState()
        .addWallRun({ position: { x: -6, y: 0 }, end: { x: 6, y: 0 }, base: 0 });
      api.getState().selectPiece(id);
    });
    await page.getByRole("button", { name: "Add flags along" }).click();
    await page.getByRole("button", { name: "Use last design" }).click();
    await expect.poll(() => pieceCount(page)).toBe(4);

    // Select one generated flag and confirm its panel behaves like any flag.
    const flagId = (await pieces(page)).find((p) => p.kind === "flag").id;
    await page.evaluate((id) => {
      (window as any).__CASTLE_E2E__.getState().selectPiece(id);
    }, flagId);
    await expect(page.getByRole("heading", { name: "Flag" })).toBeVisible();

    // Edit a param.
    await page.getByLabel("Pole height").fill("9");
    await expect
      .poll(async () => (await pieces(page)).find((p) => p.id === flagId).poleHeight)
      .toBe(9);

    // It has its own editable embedded design (open + close the editor).
    await page.getByRole("button", { name: "Edit design…" }).click();
    await expect(
      page.getByRole("dialog", { name: "Flag design editor" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Flag design editor" }),
    ).toBeHidden();

    // Delete just this one flag; the others (and the wall) remain.
    await page.getByRole("button", { name: "Delete flag" }).click();
    await expect.poll(() => pieceCount(page)).toBe(3); // wall + 2 flags left
  });

  // --- 2Fe.1: chooser, re-run-replace, editor dimensions --------------------

  const addWallAndSelect = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      const id = api
        .getState()
        .addWallRun({ position: { x: -6, y: 0 }, end: { x: 6, y: 0 }, base: 0 });
      api.getState().selectPiece(id);
      return id;
    });

  test('chooser "Design new": author a design, place flags embedding it', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await openApp(page);
    await addWallAndSelect(page);
    await expect(page.getByRole("heading", { name: "Wall" })).toBeVisible();

    // Open the chooser → Design new → the flag editor opens.
    await page.getByRole("button", { name: "Add flags along" }).click();
    await page.getByRole("button", { name: "Design new" }).click();
    await expect(
      page.getByRole("dialog", { name: "Flag design editor" }),
    ).toBeVisible();

    // Author a distinctive design (add a charge), then Apply → flags are placed.
    await page.getByRole("button", { name: "Add charge" }).click();
    await page.locator('[data-action="flag-editor-apply"]').click();
    await expect(
      page.getByRole("dialog", { name: "Flag design editor" }),
    ).toBeHidden();

    const flagPieces = (await pieces(page)).filter((p) => p.kind === "flag");
    expect(flagPieces.length).toBe(3);
    // Every generated flag embeds the authored design (a charge present).
    for (const f of flagPieces) {
      expect(f.design.layers.some((l: any) => l.kind === "charge")).toBe(true);
      expect(f.autoFlagHostId).toBeTruthy(); // tagged to the host
    }

    expect(errors).toEqual([]);
  });

  test('chooser "Use last design": reuses the last-edited design', async ({
    page,
  }) => {
    await openApp(page);

    // Place a flag, edit its design (add a charge), Apply → sets lastFlagDesign.
    await page.getByRole("button", { name: "Flag" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().selectPiece(api.getPieces()[0].id);
    });
    await page.getByRole("button", { name: "Edit design…" }).click();
    await page.getByRole("button", { name: "Add charge" }).click();
    await page.locator('[data-action="flag-editor-apply"]').click();

    // Now a wall, and "Add flags along" → Use last design.
    await addWallAndSelect(page);
    await expect(page.getByRole("heading", { name: "Wall" })).toBeVisible();
    await page.getByRole("button", { name: "Add flags along" }).click();
    await page.getByRole("button", { name: "Use last design" }).click();

    const flagPieces = (await pieces(page)).filter(
      (p) => p.kind === "flag" && p.autoFlagHostId,
    );
    expect(flagPieces.length).toBeGreaterThan(0);
    // The generated flags reuse the last-edited design (the charge is present).
    for (const f of flagPieces) {
      expect(f.design.layers.some((l: any) => l.kind === "charge")).toBe(true);
    }
  });

  test('chooser "Pick from library": places flags with a saved design', async ({
    page,
  }) => {
    await openApp(page);

    // Save a distinctive design to the library from a flag editor.
    await page.getByRole("button", { name: "Flag" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().selectPiece(api.getPieces()[0].id);
    });
    await page.getByRole("button", { name: "Edit design…" }).click();
    await page.getByRole("button", { name: "Add charge" }).click();
    await page.getByLabel("Library entry name").fill("Row Banner");
    await page.getByRole("button", { name: "Save as new" }).click();
    await page.locator('[data-action="flag-editor-apply"]').click();

    // A wall → Add flags along → Pick from library → the saved entry.
    await addWallAndSelect(page);
    await page.getByRole("button", { name: "Add flags along" }).click();
    await page.getByRole("button", { name: "Pick from library" }).click();
    await page.locator('[data-action="flags-along-library-entry"]').first().click();

    const flagPieces = (await pieces(page)).filter(
      (p) => p.kind === "flag" && p.autoFlagHostId,
    );
    expect(flagPieces.length).toBeGreaterThan(0);
    for (const f of flagPieces) {
      expect(f.design.layers.some((l: any) => l.kind === "charge")).toBe(true);
    }
  });

  test("re-run on a resized wall REPLACES the set (one undo restores prior)", async ({
    page,
  }) => {
    await openApp(page);
    const wallId = await addWallAndSelect(page);

    // First run at the default spacing.
    await page.getByRole("button", { name: "Add flags along" }).click();
    await page.getByRole("button", { name: "Use last design" }).click();
    await expect.poll(() => pieceCount(page)).toBe(4); // wall + 3 flags
    const firstIds = (await pieces(page))
      .filter((p) => p.kind === "flag")
      .map((f) => f.id)
      .sort();

    // Resize the wall much longer, then re-run → a fresh set REPLACES the old one.
    await page.evaluate((id) => {
      (window as any).__CASTLE_E2E__
        .getState()
        .setWallEndpoint(id, "end", { x: 30, y: 0 });
      (window as any).__CASTLE_E2E__.getState().selectPiece(id);
    }, wallId);
    await page.getByRole("button", { name: "Add flags along" }).click();
    await page.getByRole("button", { name: "Use last design" }).click();

    const secondFlags = (await pieces(page)).filter((p) => p.kind === "flag");
    // A longer wall → more flags, and NONE of the first ids survive.
    expect(secondFlags.length).toBeGreaterThan(3);
    const secondIds = secondFlags.map((f) => f.id);
    for (const id of firstIds) expect(secondIds).not.toContain(id);

    // ONE undo restores exactly the first set (3 flags, the original ids).
    await page.evaluate(() => (window as any).__CASTLE_E2E__.getState().undo());
    const restored = (await pieces(page))
      .filter((p) => p.kind === "flag")
      .map((f) => f.id)
      .sort();
    expect(restored).toEqual(firstIds);
  });

  test("flag editor: edit pole height → Apply persists it (Cancel discards)", async ({
    page,
  }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Flag" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    const flagId = (await pieces(page))[0].id;
    const pole0 = (await pieces(page))[0].poleHeight;
    await page.evaluate((id) => {
      (window as any).__CASTLE_E2E__.getState().selectPiece(id);
    }, flagId);

    // Open the editor and change the pole height INSIDE the dialog, then Cancel.
    await page.getByRole("button", { name: "Edit design…" }).click();
    const dialog = page.getByRole("dialog", { name: "Flag design editor" });
    await dialog.getByLabel("Pole height").fill("11");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    // Cancel discarded the dimension change.
    expect((await pieces(page))[0].poleHeight).toBe(pole0);

    // Re-open, change pole height, and Apply → it persists on the flag piece.
    await page.getByRole("button", { name: "Edit design…" }).click();
    await dialog.getByLabel("Pole height").fill("11");
    await page.locator('[data-action="flag-editor-apply"]').click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(async () => (await pieces(page))[0].poleHeight)
      .toBe(11);
  });

  test("flag editor: changing aspect keeps the preview width fixed (no control reflow)", async ({
    page,
  }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Flag" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);
    await page.evaluate(() => {
      const api = (window as any).__CASTLE_E2E__;
      api.getState().selectPiece(api.getPieces()[0].id);
    });
    await page.getByRole("button", { name: "Edit design…" }).click();
    await expect(page.getByRole("dialog", { name: "Flag design editor" })).toBeVisible();

    const canvas = page.locator(".flag-editor__canvas");
    const stripesBtn = page.getByRole("button", { name: "Add stripes" });

    const widthAt = async () => (await canvas.boundingBox())!.width;
    const controlXAt = async () => (await stripesBtn.boundingBox())!.x;

    const w0 = await widthAt();
    const x0 = await controlXAt();

    // Drive the aspect across its full range; the preview WIDTH and the neighboring
    // control's X must not move (only the preview height varies). DOM/layout only —
    // never canvas pixels.
    await page.getByLabel("Aspect").fill("3");
    expect(Math.abs((await widthAt()) - w0)).toBeLessThan(1);
    expect(Math.abs((await controlXAt()) - x0)).toBeLessThan(1);

    await page.getByLabel("Aspect").fill("0.5");
    expect(Math.abs((await widthAt()) - w0)).toBeLessThan(1);
    expect(Math.abs((await controlXAt()) - x0)).toBeLessThan(1);
  });

  test("New Castle: Esc dismisses the dialog with no change", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Tower" }).click();
    await clickCanvasCenter(page);
    await expect.poll(() => pieceCount(page)).toBe(1);

    await page.getByRole("button", { name: "New Castle" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await pieceCount(page)).toBe(1); // unchanged
  });
});
