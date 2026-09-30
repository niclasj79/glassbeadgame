import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { DisciplineId } from "../../src/content/types";

const PICKS: DisciplineId[] = ["mathematics", "music"];
/**
 * The idle arena, and the same arena in the focus view (I-017): a bead
 * attended, so the fog pass runs — dim and blur on the base tier, dim only on
 * the low tier under reduced motion. The focus profiles attend through the
 * keyboard mirror so the measurement does not depend on where a bead lands.
 */
const profiles = [
  { name: "desktop-base", viewport: { width: 1280, height: 720 }, quality: "base", reducedMotion: false, focus: false },
  { name: "mobile-potato", viewport: { width: 390, height: 844 }, quality: "potato", reducedMotion: true, focus: false },
  { name: "desktop-base-focus", viewport: { width: 1280, height: 720 }, quality: "base", reducedMotion: false, focus: true },
  { name: "mobile-potato-focus", viewport: { width: 390, height: 844 }, quality: "potato", reducedMotion: true, focus: true },
] as const;

test.describe("hardware-reference frame measurements", () => {
  for (const profile of profiles) {
    test(profile.name, async ({ browser }) => {
      const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const query = new URLSearchParams({
        testMode: "1",
        seed: "castalia-golden-001",
        quality: profile.quality,
        reducedMotion: profile.reducedMotion ? "1" : "0",
      });
      await page.goto(`/?${query}`);
      await page.waitForFunction(() => Boolean(window.__gbgTest));
      const session = await page.evaluate((picks) => window.__gbgTest!.startSession(picks), PICKS);
      if (profile.focus) {
        await page.getByTestId(`bead-control-${session.beadIds[0]}`).focus();
        await page.keyboard.press("Enter");
        await expect
          .poll(async () => (await page.evaluate(() => window.__gbgTest!.snapshot())).focus)
          .toMatchObject({ mode: "focus", fogActive: true, blurActive: !profile.reducedMotion });
      }
      await page.waitForTimeout(2_000);
      await page.evaluate(() => window.__gbgTest!.startFrameSample());
      await page.waitForTimeout(5_000);
      const result = await page.evaluate(() => ({
        frames: window.__gbgTest!.finishFrameSample(),
        renderer: window.__gbgTest!.rendererInfo(),
        presentation: window.__gbgTest!.presentationProfile(),
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      }));
      expect(result.frames.sampleCount).toBeGreaterThan(10);
      expect(result.presentation).toEqual({ qualityTier: profile.quality, reducedMotion: profile.reducedMotion });
      const report = {
        schemaVersion: 1,
        commit: process.env.GITHUB_SHA ?? "local-working-tree",
        browserVersion: browser.version(),
        profile,
        reducedMotion: profile.reducedMotion,
        ...result,
        methodology: {
          warmupMs: 2_000,
          sampleMs: 5_000,
          animationState: profile.focus ? "arena-focus" : "arena-idle",
        },
      };
      await mkdir("artifacts/performance", { recursive: true });
      await writeFile(`artifacts/performance/${profile.name}.json`, `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify(report));
      await context.close();
    });
  }
});
