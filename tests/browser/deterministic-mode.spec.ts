import { expect, test, type Page } from "@playwright/test";
import type { DisciplineId } from "../../src/content/types";
import type { TestSessionSnapshot } from "../../src/runtime/testMode";

const PICKS: DisciplineId[] = ["mathematics", "music"];

async function openSession(page: Page): Promise<TestSessionSnapshot> {
  await page.goto("/?testMode=1&seed=castalia-golden-001&quality=potato&reducedMotion=1");
  await page.waitForFunction(() => Boolean(window.__gbgTest));
  return page.evaluate((picks) => window.__gbgTest!.startSession(picks), PICKS);
}

async function composeWithMouse(page: Page, initial: TestSessionSnapshot): Promise<TestSessionSnapshot> {
  await page.getByTestId(`bead-control-${initial.beadIds[0]}`).click({ force: true });
  await page.getByRole("radio", { name: /Echo/ }).click({ force: true });
  await page.getByTestId(`bead-control-${initial.beadIds[1]}`).click({ force: true });
  await page.evaluate(() => window.__gbgTest!.advanceClock(250));
  await page.getByTestId("weave-control").click({ force: true });
  return page.evaluate(() => window.__gbgTest!.snapshot());
}

test("mouse controls commit a deterministic canonical interpretation", async ({ page }) => {
  const first = await composeWithMouse(page, await openSession(page));
  expect(first.domainSession.eventCount).toBe(5);
  expect(first.domainSession.eventTypes).toEqual([
    "session.started", "bead.attended", "pair.selected", "relation.hypothesized", "thread.committed",
  ]);
  expect(first.domainSession.threads).toHaveLength(1);
  expect(first.domainSession.threads[0].pair).toEqual([first.beadIds[0], first.beadIds[1]]);
  expect(first.domainSession.threads[0].id).toBe(
    `thread:${first.domainSession.sessionId.length}:${first.domainSession.sessionId}:1`
  );
  expect(first.domainSession.threads[0].inputModality).toBe("mouse");
  expect(first.draftStage).toBe("inactive");
});

test("keyboard controls provide the same complete action path", async ({ page }) => {
  const initial = await openSession(page);
  await page.getByTestId(`bead-control-${initial.beadIds[0]}`).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("radio", { name: /Passage/ }).focus();
  await page.keyboard.press("Space");
  await page.getByTestId(`bead-control-${initial.beadIds[1]}`).focus();
  await page.keyboard.press("Enter");
  await page.getByTestId("weave-control").focus();
  await page.keyboard.press("Space");
  const snapshot = await page.evaluate(() => window.__gbgTest!.snapshot());
  expect(snapshot.domainSession.threads[0]).toMatchObject({ intention: "passage", inputModality: "keyboard" });
});

test("touch-emulated controls commit the same decisions honestly", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 768, height: 900 } });
  const page = await context.newPage();
  const initial = await openSession(page);
  await page.getByTestId(`bead-control-${initial.beadIds[0]}`).click({ force: true });
  await page.getByRole("radio", { name: /Ground/ }).click({ force: true });
  await page.getByTestId(`bead-control-${initial.beadIds[1]}`).click({ force: true });
  await page.getByTestId("weave-control").tap({ force: true });
  const snapshot = await page.evaluate(() => window.__gbgTest!.snapshot());
  expect(snapshot.domainSession.threads[0]).toMatchObject({ intention: "ground", inputModality: "touch" });
});

test("Escape cancels one draft stage without writing canonical events", async ({ page }) => {
  const initial = await openSession(page);
  await page.getByTestId(`bead-control-${initial.beadIds[0]}`).click({ force: true });
  await page.getByRole("radio", { name: /Tension/ }).click({ force: true });
  await page.keyboard.press("Escape");
  const snapshot = await page.evaluate(() => window.__gbgTest!.snapshot());
  expect(snapshot.draftStage).toBe("attending");
  expect(snapshot.domainSession.eventCount).toBe(2);
});

test("canonical replay reload preserves the committed web", async ({ page }) => {
  const committed = await composeWithMouse(page, await openSession(page));
  const reloaded = await page.evaluate(() => window.__gbgTest!.reloadCanonical());
  expect(reloaded.domainSession).toEqual(committed.domainSession);
});

test("ordinary development exposes no test adapter", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  expect(await page.evaluate(() => window.__gbgTest)).toBeUndefined();
});
