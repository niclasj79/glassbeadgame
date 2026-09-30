import { expect, test, type Page } from "@playwright/test";
import { PICKS, weaveGoldenPairWithMouse } from "./support/focusView";

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

/** One documented thread, woven with the mouse, exactly as a player would. */
async function weaveOne(page: Page): Promise<void> {
  await weaveGoldenPairWithMouse(page, "echo");
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
  // A quick Leave can bring back the title that was still fading out, shelf
  // and all — the screens share one presence — so open the shelf only if it
  // is closed rather than pressing a toggle whose state this test did not set.
  await page.getByRole("button", { name: "Leave" }).click();
  const again = page.getByTestId("kept-games-toggle");
  await expect(again).toBeVisible({ timeout: 10_000 });
  if ((await again.getAttribute("aria-expanded")) !== "true") await again.click();
  await expect(page.getByTestId("kept-games-list").locator("li")).toHaveCount(1);
});
