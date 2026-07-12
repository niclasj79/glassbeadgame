import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { DisciplineId } from "../../src/content/types";

const PICKS: DisciplineId[] = ["mathematics", "music"];
const profiles = [
  { name: "desktop-base", viewport: { width: 1280, height: 720 }, quality: "base", reducedMotion: false },
  { name: "mobile-potato", viewport: { width: 390, height: 844 }, quality: "potato", reducedMotion: true },
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
      await page.evaluate((picks) => window.__gbgTest!.startSession(picks), PICKS);
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
        methodology: { warmupMs: 2_000, sampleMs: 5_000, animationState: "arena-idle" },
      };
      await mkdir("artifacts/performance", { recursive: true });
      await writeFile(`artifacts/performance/${profile.name}.json`, `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify(report));
      await context.close();
    });
  }
});
