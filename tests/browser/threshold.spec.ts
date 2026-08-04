import { expect, test } from "@playwright/test";

/**
 * THE OPENING PATH, AS A PLAYER ACTUALLY WALKS IT.
 *
 * Every other browser case starts by calling `window.__gbgTest.startSession()`,
 * which puts the arena on screen directly. That is correct for testing the
 * weave deterministically, and it means the route a real first-time player
 * takes — title, threshold, arena — had no coverage at all.
 *
 * It matters more than usual here because the threshold is where the draw is
 * now built. If its press ever stops calling `startSession`, the door leads
 * nowhere and no unit test would notice: the screen would render perfectly and
 * simply never hand over.
 */

test("the door leads through the threshold to a drawn arena", async ({ page }) => {
  await page.goto("/?testMode=1&seed=castalia-golden-001&quality=potato&reducedMotion=1");
  await page.waitForFunction(() => Boolean(window.__gbgTest));

  // The title holds its door shut until the world reports ready.
  const begin = page.getByRole("button", { name: "Begin" });
  await expect(begin).toBeEnabled({ timeout: 20_000 });
  await begin.click();

  const threshold = page.getByTestId("threshold");
  await expect(threshold).toBeVisible({ timeout: 10_000 });

  // It says what the pieces are and what drawing a connection is for. These are
  // the two claims that stop a silence reading as a failure, so they are
  // asserted rather than assumed.
  await expect(threshold).toContainText("Measure");
  await expect(threshold).toContainText("Echo");
  await expect(threshold).toContainText(/no correct pairing/i);
  await expect(threshold).toContainText(/nothing you do is scored/i);
  await expect(threshold).toContainText(/nobody knows/i);

  /*
   * No session exists yet — the threshold must not have started the Game behind
   * the reader's back. `snapshot()` cannot be used to check this: it *throws*
   * when no session is active, which is a stronger proof than the assertion
   * would have been, so it is used as one.
   */
  await expect(page.getByTestId("arena-chrome")).toHaveCount(0);
  const started = await page.evaluate(() => {
    try {
      window.__gbgTest!.snapshot();
      return true;
    } catch {
      return false;
    }
  });
  expect(started).toBe(false);

  await page.getByTestId("threshold-enter").click();

  // …and now it has, with a real draw.
  await expect(page.getByTestId("arena-chrome")).toHaveCount(1, { timeout: 20_000 });
  const snapshot = await page.evaluate(() => window.__gbgTest!.snapshot());
  expect(snapshot.phase).toBe("arena");
  expect(snapshot.beadIds).toHaveLength(12);
  expect(new Set(snapshot.beadIds.map((id) => id.split(".")[0])).size).toBe(4);

  // The threshold is gone and does not come back.
  await expect(page.getByTestId("threshold")).toHaveCount(0);
});
