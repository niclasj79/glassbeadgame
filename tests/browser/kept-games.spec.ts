import { expect, test, type Page } from "@playwright/test";
import type { DisciplineId } from "../../src/content/types";
import type { TestSessionSnapshot } from "../../src/runtime/testMode";

/**
 * A GAME IS KEPT, AND CAN BE TAKEN DOWN AGAIN.
 *
 * DESIGN-REVIEW-SCHELL §2: the IndexedDB repository was complete, tested, and
 * consumed by nothing, so every Game was destroyed when the tab closed. This
 * proves the path a player actually walks: conclude, be told the Game is
 * kept, leave for the title, find it on the shelf, open it, and read the
 * register it left — whole, with no performance to sit through.
 *
 * Deterministic test mode keeps Games in memory rather than IndexedDB, so
 * the shelf here is this page's alone; the flow is identical on either store.
 */

const PICKS: DisciplineId[] = ["mathematics", "music", "art"];
const SOURCE_ID = "measure.fibonacci-sequence";
const TARGET_ID = "sound.counterpoint";

async function snapshot(page: Page): Promise<TestSessionSnapshot> {
  return page.evaluate(() => window.__gbgTest!.snapshot());
}

async function beadPoint(page: Page, id: string): Promise<{ x: number; y: number }> {
  await expect
    .poll(async () => {
      const result = await page.evaluate(
        (conceptId) => window.__gbgTest!.beadScreen(conceptId),
        id
      );
      return result === null || result.behind;
    })
    .toBe(false);
  const result = await page.evaluate(
    (conceptId) => window.__gbgTest!.beadScreen(conceptId),
    id
  );
  if (!result || result.behind) throw new Error(`bead ${id} is not on screen`);
  return { x: result.x, y: result.y };
}

async function weaveOne(page: Page): Promise<void> {
  const source = await beadPoint(page, SOURCE_ID);
  await page.mouse.click(source.x, source.y);
  await expect.poll(async () => (await snapshot(page)).draftStage).toBe("attending");
  await page.getByTestId("intention-echo").click();
  await expect.poll(async () => (await snapshot(page)).draftStage).toBe("armed");
  const from = await beadPoint(page, SOURCE_ID);
  const to = await beadPoint(page, TARGET_ID);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).weaving).toBe(true);
  await page.evaluate(() => window.__gbgTest!.advanceClock(125));
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await expect.poll(async () => (await snapshot(page)).sightedConceptId).toBe(TARGET_ID);
  await page.evaluate(() => window.__gbgTest!.advanceClock(125));
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).draftStage).toBe("inactive");
}

test("a concluded Game is kept, shelved at the title, and reads back whole", async ({
  page,
}) => {
  await page.goto("/?testMode=1&seed=castalia-golden-001&quality=potato&reducedMotion=1");
  await page.waitForFunction(() => Boolean(window.__gbgTest));

  // Nothing has been kept yet, so there is no shelf.
  await expect(page.getByTestId("kept-games")).toHaveCount(0);

  await page.evaluate((picks) => window.__gbgTest!.startSession(picks), PICKS);
  await weaveOne(page);
  await page.getByRole("button", { name: "Conclude" }).click();
  await expect(page.getByText("The Game concludes")).toBeVisible({ timeout: 15_000 });

  // The plate says the Game is kept — in words, never as a count. Test mode
  // keeps in memory, and the plate says that truthfully: for this visit.
  const kept = page.getByTestId("conclusion-kept");
  await expect(kept).toContainText(/kept for this visit/i, { timeout: 10_000 });
  await expect(kept).not.toContainText(/\d/);
  await expect(page.getByTestId("conclusion-copy")).toBeVisible();

  // Leave, and the shelf now exists at the title.
  await page.getByRole("button", { name: "Leave" }).click();
  const toggle = page.getByTestId("kept-games-toggle");
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  await toggle.click();
  const entries = page.getByTestId("kept-games-list").locator("li");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("Fibonacci Sequence");
  await expect(entries.first()).not.toContainText(/\d+ threads/);

  // Open it: the reading it left, whole, with no performance to sit through.
  await entries.first().getByRole("button").click();
  await expect(page.getByText("The Game concludes")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("thread-register")).toContainText("Counterpoint");
  await expect(page.getByTestId("portrait-reading").first()).toBeVisible();
  await expect(page.getByTestId("conclusion-take-whole")).toHaveCount(0);
  await expect(page.getByTestId("conclusion-kept")).toContainText(/kept on this device/i);

  // Reading it again did not keep it again: still one Game on the shelf.
  await page.getByRole("button", { name: "Leave" }).click();
  await page.getByTestId("kept-games-toggle").click();
  await expect(page.getByTestId("kept-games-list").locator("li")).toHaveCount(1);
});
