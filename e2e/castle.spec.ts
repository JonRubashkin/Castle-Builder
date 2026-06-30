import { test, expect } from "@playwright/test";
import {
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
