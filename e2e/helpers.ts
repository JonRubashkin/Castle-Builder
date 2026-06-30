import type { Page } from "@playwright/test";

/** Open the app with the test-only store accessor enabled and wait for it. */
export async function openApp(page: Page): Promise<void> {
  await page.goto("/?e2e=1");
  await page.waitForFunction(() => Boolean((window as any).__CASTLE_E2E__));
  // Wait for the canvas to be present (the 3D scene mounted).
  await page.locator("canvas").first().waitFor({ state: "visible" });
}

export async function pieceCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__CASTLE_E2E__.getPieceCount());
}

export async function selectedId(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as any).__CASTLE_E2E__.getSelectedId());
}

/** Read the pieces array straight from the store via the ?e2e=1 accessor. */
export async function pieces(page: Page): Promise<any[]> {
  return page.evaluate(() => (window as any).__CASTLE_E2E__.getPieces());
}

/** Click the center of the 3D canvas (over the world origin / a tower at origin). */
export async function clickCanvasCenter(page: Page): Promise<void> {
  await page.locator("canvas").first().click();
}

/** Click the canvas at a position (px) relative to its top-left corner. */
export async function clickCanvasAt(page: Page, x: number, y: number): Promise<void> {
  await page.locator("canvas").first().click({ position: { x, y } });
}
