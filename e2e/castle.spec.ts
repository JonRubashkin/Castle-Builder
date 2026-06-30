import { test, expect } from "@playwright/test";
import {
  clickCanvasCenter,
  openApp,
  pieceCount,
  selectedId,
} from "./helpers";

test.describe("Castle Builder — phase 1a", () => {
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
});
