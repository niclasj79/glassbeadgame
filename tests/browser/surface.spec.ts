import { expect, test, type Page } from "@playwright/test";
import type { DisciplineId } from "../../src/content/types";

/**
 * M4-003 — THE VOID READS AS DEPTH, NOT AS STEPS.
 *
 * Castalia's void is a gradient only a few 8-bit steps tall across the whole
 * vault (ground `#070912` to depth `#0d1226`). Quantised straight to the
 * screen it bands; the composer's final pass now dithers it (`scene/dither.ts`).
 *
 * HOW IT IS MEASURED. The rest frame at the base tier, still (reduced motion),
 * on the golden seed. One vertical line at 10% of the width — the vault, away
 * from the beads — from 5% to 95% of the height, and along it:
 *
 *  - how many distinct 8-bit luminance values it carries (Rec. 709 weights
 *    over the 8-bit channels, rounded) — a sanity check that the line crosses
 *    a gradient at all. It does not tell a dithered line from a banded one:
 *    three's dither moves red and blue against green, so a pixel's rounded
 *    luminance barely changes when its channels do;
 *  - how many distinct 8-bit colours, and how often a pixel's colour differs
 *    from the one above it;
 *  - the longest run of one colour, and how many runs are 8 px or taller —
 *    the bands themselves. A banded gradient is a handful of values in long
 *    runs; a dithered one changes pixel to pixel.
 *
 * Not in `test:browser`: it is evidence for a look, run by hand beside the
 * rest-frame spec, and a software rasteriser's pixels are not a display's.
 */

const PICKS: DisciplineId[] = ["mathematics", "music", "art"];

/** A run of one colour this tall is a band the eye can see as a step. */
const BAND_PX = 8;
/** The longest run a dithered vault may keep. Measured: 7 on, 34 off. */
const LONGEST_DITHERED_RUN = 16;

interface Line {
  readonly x: number;
  readonly from: number;
  readonly to: number;
  readonly lumaValues: number;
  readonly lumaMin: number;
  readonly lumaMax: number;
  readonly colours: number;
  readonly changes: number;
  readonly longestRun: number;
  readonly bands: number;
}

async function openArena(page: Page): Promise<void> {
  await page.goto("/?testMode=1&seed=castalia-golden-001&quality=base&reducedMotion=1");
  await page.waitForFunction(() => Boolean(window.__gbgTest));
  await page.evaluate((picks) => window.__gbgTest!.startSession(picks), PICKS);
  await expect
    .poll(async () => (await page.evaluate(() => window.__gbgTest!.snapshot())).phase, {
      timeout: 30_000,
    })
    .toBe("arena");
  // A bead reported on screen is a frame whose camera has settled (see
  // `rest-frame.spec.ts`).
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const ids = window.__gbgTest!.beadIds();
          if (ids.length === 0) return 0;
          return ids.filter((id) => {
            const point = window.__gbgTest!.beadScreen(id);
            return Boolean(point && !point.behind);
          }).length;
        }),
      { timeout: 60_000 }
    )
    .toBeGreaterThan(6);
  await page.waitForTimeout(1_200);
}

async function measureLine(page: Page, shot: Buffer): Promise<Line> {
  return page.evaluate(
    ({ dataUrl, bandPx }) =>
      new Promise<Line>((resolve, reject) => {
        const image = new Image();
        image.onerror = () => reject(new Error("frame did not decode"));
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("no 2d context"));
            return;
          }
          context.drawImage(image, 0, 0);
          const x = Math.floor(canvas.width * 0.1);
          const from = Math.floor(canvas.height * 0.05);
          const to = Math.floor(canvas.height * 0.95);
          const { data } = context.getImageData(x, from, 1, to - from);
          const lumas = new Set<number>();
          const colours = new Set<number>();
          let lumaMin = 255;
          let lumaMax = 0;
          let changes = 0;
          let run = 0;
          let longestRun = 0;
          let bands = 0;
          let previous = -1;
          for (let i = 0; i < to - from; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            const luma = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
            lumas.add(luma);
            lumaMin = Math.min(lumaMin, luma);
            lumaMax = Math.max(lumaMax, luma);
            const colour = (r << 16) | (g << 8) | b;
            colours.add(colour);
            if (colour === previous) {
              run += 1;
            } else {
              if (previous >= 0) {
                changes += 1;
                if (run >= bandPx) bands += 1;
              }
              run = 1;
            }
            longestRun = Math.max(longestRun, run);
            previous = colour;
          }
          if (run >= bandPx) bands += 1;
          resolve({
            x,
            from,
            to,
            lumaValues: lumas.size,
            lumaMin,
            lumaMax,
            colours: colours.size,
            changes,
            longestRun,
            bands,
          });
        };
        image.src = dataUrl;
      }),
    { dataUrl: `data:image/png;base64,${shot.toString("base64")}`, bandPx: BAND_PX }
  );
}

test("the vault's gradient is dithered, not banded, at the base tier", async ({ page }, testInfo) => {
  await openArena(page);
  // The frame measured is the frame kept, for a person to look at.
  const frame = testInfo.outputPath("rest-frame.png");
  const shot = await page.screenshot({ type: "png", path: frame, timeout: 120_000 });
  await testInfo.attach("rest-frame", { path: frame, contentType: "image/png" });
  const line = await measureLine(page, shot);
  const report = [
    `x ${line.x}, y ${line.from}-${line.to}`,
    `distinct luma ${line.lumaValues} (${line.lumaMin}-${line.lumaMax})`,
    `distinct colours ${line.colours}`,
    `colour changes ${line.changes}`,
    `longest run ${line.longestRun} px`,
    `bands >= ${BAND_PX} px ${line.bands}`,
  ].join(" · ");
  console.log(`[surface] ${report}`);
  await testInfo.attach("vault-line", { body: report, contentType: "text/plain" });

  // The line crosses a gradient at all.
  expect(line.lumaValues, report).toBeGreaterThanOrEqual(12);
  // And the gradient is not in steps: no run of one colour tall enough to
  // read as a band.
  expect(line.longestRun, report).toBeLessThanOrEqual(LONGEST_DITHERED_RUN);
});
