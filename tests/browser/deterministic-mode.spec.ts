import { expect, test, type Browser } from "@playwright/test";
import type { DisciplineId } from "../../src/content/types";
import type { TestSessionSnapshot } from "../../src/runtime/testMode";

const PICKS: DisciplineId[] = ["mathematics", "music"];

async function runScenario(browser: Browser, seedText: string): Promise<TestSessionSnapshot> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/?testMode=1&seed=${encodeURIComponent(seedText)}`);
  await page.waitForFunction(() => Boolean(window.__gbgTest));

  const initial = await page.evaluate((picks) => window.__gbgTest!.startSession(picks), PICKS);
  await page.waitForFunction(
    (id) => window.__gbgTest?.beadScreen(id) !== null,
    initial.beadIds[0]
  );

  const result = await page.evaluate(([a, b]) => {
    window.__gbgTest!.advanceClock(250);
    window.__gbgTest!.weave(a, b);
    return window.__gbgTest!.snapshot();
  }, [initial.beadIds[0], initial.beadIds[1]] as [string, string]);

  await context.close();
  return result;
}

test("same stable seed produces the same session and real commit result", async ({ browser }) => {
  const first = await runScenario(browser, "castalia-golden-001");
  const second = await runScenario(browser, "castalia-golden-001");

  expect(second).toEqual(first);
  expect(first.phase).toBe("arena");
  expect(first.beadIds).toHaveLength(12);
  expect(first.threads).toHaveLength(1);
  expect(first.discoveries).toHaveLength(1);
  expect(first.threads[0].createdAt - first.startedAt).toBe(250);
  expect(first.now - first.startedAt).toBe(250);
});

test("a different stable seed changes the repeatable draw", async ({ browser }) => {
  const first = await runScenario(browser, "castalia-alternate-002");
  const second = await runScenario(browser, "castalia-alternate-002");
  const golden = await runScenario(browser, "castalia-golden-001");

  expect(second).toEqual(first);
  expect(first.seed).not.toBe(golden.seed);
  expect(first.beadIds).not.toEqual(golden.beadIds);
});

test("ordinary development exposes no test adapter", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  expect(await page.evaluate(() => window.__gbgTest)).toBeUndefined();
  expect(await page.evaluate(() => "__gbg" in window)).toBe(false);
});
