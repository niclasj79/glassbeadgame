import { expect, test, type Page } from "@playwright/test";
import type { DisciplineId } from "../../src/content/types";

/**
 * B5 — THE RESTING FRAME ABANDONED THE RIGHT 40 PERCENT.
 *
 * A Harsh AAA Critic judged the running build headed, on a real GPU, with a
 * fresh profile and no test mode, and measured the arena's rest frame at
 * 1440x810 on the golden seed:
 *
 *   luminance-energy centroid x = 38.8% of the width
 *   left half                   = 74.3% of the signal
 *   rightmost third             = 11.2%
 *   bead extent x 238-754 of 1440, spanning y 170-720 of 810
 *
 * — a subject scaled to the frame's *height*, seated at its *left*, with 40%
 * of the width carrying two nav pills, a mute button, the page's rule and
 * three stray light streaks. Left-over space, not used space.
 *
 * `scene/framing.test.ts` holds the half of that which is a property of the
 * fit: where the subject is seated, and that no axis is cropped while the
 * other is abandoned. It cannot hold the other half. Whether the width the
 * composition *reserves* is a page or a hole is a fact about rendered pixels,
 * and the only honest place to assert it is on a rendered frame.
 *
 * HOW IT IS MEASURED. Exactly as the critic measured it, and the reason the
 * thresholds survive a change of renderer: the floor is the frame's own 90th
 * percentile of luminance, so what is being weighed is the tenth of the page
 * that is *drawn on* rather than an absolute brightness. A software rasteriser
 * and a real GPU disagree about the value of a pixel; they agree about which
 * pixels carry the picture.
 */

const PICKS: DisciplineId[] = ["mathematics", "music", "art"];

interface Energy {
  readonly centroidX: number;
  readonly centroidY: number;
  readonly thirds: readonly number[];
  readonly leftHalf: number;
}

/** The composition laws, as fractions of the frame. */
const CENTROID_X = { min: 0.4, max: 0.6 } as const;
const CENTROID_Y = { min: 0.4, max: 0.6 } as const;
/** No third of the page may be abandoned. */
const THIRD_FLOOR = 0.12;
/** Nor may one half of it carry the whole picture. */
const HALF_CEILING = 0.68;

/** Where the bead shell may sit, as a fraction of the frame. */
const SHELL_CENTRE_X = { min: 0.33, max: 0.47 } as const;
/** And how much frame it must keep between itself and every edge. */
const SHELL_CLEARANCE = 0.06;

async function measureEnergy(page: Page): Promise<Energy> {
  const shot = await page.screenshot({ type: "png", timeout: 120_000 });
  return page.evaluate(
    (dataUrl) =>
      new Promise<Energy>((resolve, reject) => {
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
          const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
          const count = canvas.width * canvas.height;
          const luminance = new Float64Array(count);
          for (let i = 0; i < count; i++) {
            luminance[i] =
              0.2126 * data[i * 4] +
              0.7152 * data[i * 4 + 1] +
              0.0722 * data[i * 4 + 2];
          }
          const sorted = Float64Array.from(luminance).sort();
          const floor = sorted[Math.floor(count * 0.9)];
          let total = 0;
          let sumX = 0;
          let sumY = 0;
          let leftHalf = 0;
          const thirds = [0, 0, 0];
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const energy = Math.max(0, luminance[y * canvas.width + x] - floor);
              if (energy <= 0) continue;
              total += energy;
              sumX += energy * x;
              sumY += energy * y;
              thirds[Math.min(2, Math.floor((x / canvas.width) * 3))] += energy;
              if (x < canvas.width / 2) leftHalf += energy;
            }
          }
          if (total <= 0) {
            reject(new Error("the frame carried no signal at all"));
            return;
          }
          resolve({
            centroidX: sumX / total / canvas.width,
            centroidY: sumY / total / canvas.height,
            thirds: thirds.map((value) => value / total),
            leftHalf: leftHalf / total,
          });
        };
        image.src = dataUrl;
      }),
    `data:image/png;base64,${shot.toString("base64")}`
  );
}

async function openArena(page: Page): Promise<void> {
  await page.goto("/?testMode=1&seed=castalia-golden-001&quality=base");
  await page.waitForFunction(() => Boolean(window.__gbgTest));
  await page.evaluate((picks) => window.__gbgTest!.startSession(picks), PICKS);
  // The rest pose is a phrase, and the lens shift racks with it. Nothing may
  // be measured until both have arrived — and `beadScreen` is exactly that
  // condition: the adapter refuses to report a point from a camera still in
  // transit, so a bead that is *on screen* is a frame that has settled. A
  // fixed wait is not the same thing, and was measurably flaky at 1280x720.
  await expect
    .poll(async () => (await page.evaluate(() => window.__gbgTest!.snapshot())).phase, {
      timeout: 30_000,
    })
    .toBe("arena");
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
  // One breath more, so the room's own idle motion is not caught mid-stride.
  await page.waitForTimeout(1_200);
}

const VIEWPORTS = [
  { name: "1440x810", width: 1440, height: 810 },
  { name: "1280x720", width: 1280, height: 720 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`the resting frame uses the whole page at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openArena(page);

    const energy = await measureEnergy(page);
    const report = [
      `centroid ${energy.centroidX.toFixed(3)}, ${energy.centroidY.toFixed(3)}`,
      `thirds ${energy.thirds.map((value) => value.toFixed(3)).join("/")}`,
      `left ${energy.leftHalf.toFixed(3)}`,
    ].join(" · ");

    expect(report && energy.centroidX).toBeGreaterThanOrEqual(CENTROID_X.min);
    expect(energy.centroidX).toBeLessThanOrEqual(CENTROID_X.max);
    expect(energy.centroidY).toBeGreaterThanOrEqual(CENTROID_Y.min);
    expect(energy.centroidY).toBeLessThanOrEqual(CENTROID_Y.max);

    // The measurement the finding was written from: no third abandoned, and
    // no half carrying three quarters of the picture.
    for (const [index, share] of energy.thirds.entries()) {
      expect(
        `third ${index} ${share >= THIRD_FLOOR ? "carried" : share.toFixed(3)} (${report})`
      ).toBe(`third ${index} carried (${report})`);
    }
    expect(energy.leftHalf).toBeLessThanOrEqual(HALF_CEILING);
  });

  test(`the bead shell is neither cropped nor stranded at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openArena(page);

    // Geometry, read from the adapter rather than from pixels: this half of
    // the finding is renderer-independent and should never be allowed to drift
    // even on a machine whose luminance measurement is noisy.
    const box = await page.evaluate(() => {
      const ids = window.__gbgTest!.beadIds();
      const points = ids
        .map((id) => window.__gbgTest!.beadScreen(id))
        .filter((point): point is { x: number; y: number; behind: boolean } =>
          Boolean(point && !point.behind)
        );
      return {
        seen: points.length,
        minX: Math.min(...points.map((point) => point.x)),
        maxX: Math.max(...points.map((point) => point.x)),
        minY: Math.min(...points.map((point) => point.y)),
        maxY: Math.max(...points.map((point) => point.y)),
      };
    });
    expect(box.seen).toBeGreaterThan(6);

    const centreX = (box.minX + box.maxX) / 2 / viewport.width;
    expect(centreX).toBeGreaterThanOrEqual(SHELL_CENTRE_X.min);
    expect(centreX).toBeLessThanOrEqual(SHELL_CENTRE_X.max);

    // Clearance on every side. The shipped build left 89 px under the lowest
    // bead of an 810 px frame — 11% — while 40% of the width stood empty.
    expect(box.minX / viewport.width).toBeGreaterThanOrEqual(SHELL_CLEARANCE);
    expect(1 - box.maxX / viewport.width).toBeGreaterThanOrEqual(SHELL_CLEARANCE);
    expect(box.minY / viewport.height).toBeGreaterThanOrEqual(SHELL_CLEARANCE);
    expect(1 - box.maxY / viewport.height).toBeGreaterThanOrEqual(SHELL_CLEARANCE);
  });
}
