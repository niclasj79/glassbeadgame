import { expect, test, type Page } from "@playwright/test";
import { PICKS, SOURCE_ID, TARGET_ID, weaveGoldenPairByKeyboard } from "./support/focusView";

/**
 * THE CONCLUSION IS REACHED IN A REAL BROWSER.
 *
 * Nothing in `deterministic-mode.spec.ts` ever presses Conclude — grep it for
 * the word and you get nothing. Every assertion about the portrait, the
 * annotation and the thread register was made in jsdom or in the domain, so the
 * one screen a player is left looking at had no coverage in a browser at all.
 *
 * That gap became load-bearing the moment `ConclusionScreen` went behind a
 * dynamic import. A lazy chunk that fails to resolve, or a `Suspense` boundary
 * that never settles, produces a blank page and no thrown error — the unit
 * tests would stay green and the game would end on darkness. So this exists to
 * fail if the chunk ever stops arriving.
 *
 * It is deliberately not in `deterministic-mode.spec.ts`: that file is a single
 * long deterministic path and adding a second navigation to it would slow every
 * case in it. This one weaves the minimum and concludes.
 */

/**
 * One documented thread, woven by keyboard exactly as a player would. The
 * keyboard route has no sweep and no pointer hold to wait out, which matters
 * where CI draws this scene in software; the mouse route has its own test.
 */
async function weaveOne(page: Page): Promise<void> {
  await weaveGoldenPairByKeyboard(page, "echo");
}

test.use({ viewport: { width: 800, height: 600 } });
test.describe.configure({ timeout: 120_000 });

test("concluding loads the deferred chunk and reads the session back", async ({
  page,
}) => {
  await page.goto("/?testMode=1&seed=castalia-golden-001&quality=potato&reducedMotion=1");
  await page.waitForFunction(() => Boolean(window.__gbgTest));
  const initial = await page.evaluate(
    (picks) => window.__gbgTest!.startSession(picks),
    PICKS
  );
  expect(initial.beadIds).toContain(SOURCE_ID);
  expect(initial.beadIds).toContain(TARGET_ID);

  await weaveOne(page);

  await page.getByRole("button", { name: "Conclude" }).click();

  // The plate itself. If the dynamic import failed this is where it shows,
  // because Suspense renders null rather than throwing.
  await expect(page.getByText("The Game concludes")).toBeVisible({ timeout: 15_000 });

  // The register names the thread that was actually woven, so a plate that
  // rendered from an empty session would fail here rather than pass silently.
  const register = page.getByTestId("thread-register");
  await expect(register).toBeVisible();
  await expect(register).toContainText("Counterpoint");

  /*
   * The reading assembles over its own performance, so the six dimensions are
   * not on the page at the moment it opens — `PortraitPlate` slices them by
   * `reveal.readings`, and reduced motion shortens the entrance without
   * removing the pacing, because the pacing IS the performance. Taking the
   * whole thing is the honest way to reach them, and it exercises the third
   * control while we are here: a reading that assembles must never become
   * something a player has to sit through.
   */
  const takeWhole = page.getByTestId("conclusion-take-whole");
  if (await takeWhole.isVisible()) await takeWhole.click();

  // Six readings and no total — ADR-010, asserted where a player can see it.
  await expect(page.getByTestId("portrait-reading")).toHaveCount(7, { timeout: 30_000 });
  // `innerText` is the *rendered* text, and the engraved style is uppercase, so
  // every assertion here is case-insensitive on purpose rather than by accident.
  const body = await page.locator("body").innerText();
  expect(body).toMatch(/seven readings, no total/i);
  expect(body).not.toMatch(/\bscore\b/i);
  expect(body).not.toMatch(/\brank\b/i);

  // The way out is never withheld.
  await expect(page.getByRole("button", { name: "Another Game" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave" })).toBeVisible();
});
