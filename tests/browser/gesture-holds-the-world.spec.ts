import { expect, test, type Page } from "@playwright/test";
import type { DisciplineId } from "../../src/content/types";
import type { TestSessionSnapshot } from "../../src/runtime/testMode";

/**
 * TWO THINGS THE PLAYER AIMS AT, AND WHETHER THEY STAY STILL
 *
 * Both were reproduced deterministically against the running build at
 * 1280x720, seed castalia-golden-001, and both are about the same moment: the
 * instant a bead is opened and the plate is what the hand is reaching for.
 *
 * GAP-2. Press a bead, drag 40 px, hold. The camera was carried from
 * (0.02, 0.94, 11.14) to (12.25, 4.29, -2.17) — a hundred degrees round the
 * instrument — while keeping the orientation it had, because
 * `OrbitControls.update()` is the only thing that calls `camera.lookAt` and
 * drei runs it only while the controls are enabled, which a scene gesture turns
 * off for its whole duration. All twelve beads left the frame, the intention
 * plate measured 0x0, and `elementFromPoint` under the finger was the bare
 * canvas. A 90 px drag from empty sky did nothing of the kind, which is what
 * ruled OrbitControls out as the cause and ruled the scripted pose in.
 *
 * GAP-12. Click a bead and watch the plate. It appeared 18 ms later at
 * (170, 201), was carried to (-18, 258) — more than half of it off the left
 * edge — and only came to rest at (423, 293) after three and a half seconds,
 * 294 px from where it opened. The player was asked to aim at it throughout.
 *
 * This runs against the deterministic adapter but *without* reduced motion,
 * because the camera phrase is exactly the thing under test.
 */

const PICKS: DisciplineId[] = ["mathematics", "music", "art"];
const SOURCE_ID = "measure.fibonacci-sequence";

interface Point {
  readonly x: number;
  readonly y: number;
}

async function openSession(page: Page): Promise<TestSessionSnapshot> {
  await page.goto("/?testMode=1&seed=castalia-golden-001&quality=potato");
  await page.waitForFunction(() => Boolean(window.__gbgTest));
  const initial = await page.evaluate(
    (picks) => window.__gbgTest!.startSession(picks),
    PICKS
  );
  expect(initial.beadIds).toContain(SOURCE_ID);
  return initial;
}

async function beadPoint(page: Page, id: string): Promise<Point> {
  await expect
    .poll(
      async () => {
        const result = await page.evaluate(
          (conceptId) =>
            window.__gbgTest ? window.__gbgTest.beadScreen(conceptId) : null,
          id
        );
        return result === null || result.behind;
      },
      { timeout: 30_000 }
    )
    .toBe(false);
  const result = await page.evaluate(
    (conceptId) => window.__gbgTest!.beadScreen(conceptId),
    id
  );
  if (!result || result.behind) throw new Error(`bead ${id} is not on screen`);
  return { x: result.x, y: result.y };
}

/** How many of the draw's beads the camera can currently see. */
async function beadsOnScreen(page: Page): Promise<number> {
  return page.evaluate(() => {
    const ids = window.__gbgTest!.beadIds();
    let seen = 0;
    for (const id of ids) {
      const screen = window.__gbgTest!.beadScreen(id);
      if (screen && !screen.behind) seen += 1;
    }
    return seen;
  });
}

async function plateBox(
  page: Page
): Promise<{ w: number; h: number; cx: number; cy: number } | null> {
  return page.evaluate(() => {
    const element = document.querySelector(
      '[data-testid="intention-constellation"]'
    );
    const rect = element?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      cx: Math.round(rect.x + rect.width / 2),
      cy: Math.round(rect.y + rect.height / 2),
    };
  });
}

test("a drag from a bead never takes the world out from under the finger", async ({
  page,
}) => {
  const initial = await openSession(page);
  const bead = await beadPoint(page, SOURCE_ID);
  expect(await beadsOnScreen(page)).toBe(initial.beadIds.length);

  await page.mouse.move(bead.x, bead.y);
  await page.mouse.down();
  await page.mouse.move(bead.x + 40, bead.y, { steps: 8 });

  // Held down, exactly as the reproduction had it: the bead is opened by the
  // drag and the plate is what the same drag is meant to continue into.
  for (let sample = 0; sample < 6; sample += 1) {
    await page.waitForTimeout(150);
    expect(await beadsOnScreen(page)).toBe(initial.beadIds.length);
  }
  const snapshot = await page.evaluate(() => window.__gbgTest!.snapshot());
  expect(snapshot.draftStage).toBe("attending");
  expect(snapshot.draftAttendedConceptId).toBe(SOURCE_ID);

  // …and the plate the drag is being carried into is a real target under it.
  // The ring's own centre is deliberately empty — the bead is there — so the
  // thing that has to be hittable is a station.
  const box = await plateBox(page);
  expect(box).not.toBeNull();
  expect(box!.w).toBeGreaterThan(0);
  const under = await page.evaluate(() => {
    const station = document
      .querySelector('[data-testid="intention-echo"]')
      ?.getBoundingClientRect();
    if (!station || station.width === 0) return "missing";
    const element = document.elementFromPoint(
      station.x + station.width / 2,
      station.y + station.height / 2
    );
    return element?.closest("[data-world-intention]")?.getAttribute(
      "data-world-intention"
    ) ?? (element ? element.tagName : null);
  });
  expect(under).toBe("echo");

  await page.mouse.up();
});

test("the plate opens where it will stay", async ({ page }) => {
  await openSession(page);
  const bead = await beadPoint(page, SOURCE_ID);

  // Sampled inside the page, on every animation frame from before the press.
  // Asking across the wire would have measured the plate seconds after it
  // opened, which is precisely the window the defect lives in.
  await page.evaluate(() => {
    const samples: Array<{ x: number; y: number; w: number; h: number }> = [];
    (window as unknown as { __plateTrack: typeof samples }).__plateTrack =
      samples;
    const started = performance.now();
    const tick = () => {
      const rect = document
        .querySelector('[data-testid="intention-constellation"]')
        ?.getBoundingClientRect();
      if (rect && rect.width > 0) {
        samples.push({
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          w: rect.width,
          h: rect.height,
        });
      }
      if (performance.now() - started < 12_000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await page.mouse.click(bead.x, bead.y);
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__gbgTest!.snapshot())).draftStage,
      { timeout: 30_000 }
    )
    .toBe("attending");
  await expect
    .poll(async () => (await plateBox(page)) !== null, { timeout: 30_000 })
    .toBe(true);
  await page.waitForTimeout(3000);

  const track = await page.evaluate(
    () => (window as unknown as { __plateTrack: Array<{ x: number; y: number; w: number; h: number }> }).__plateTrack
  );
  expect(track.length).toBeGreaterThan(3);

  // Wherever the plate first appears is where the player will aim, so that is
  // where it has to be when they get there.
  const opened = track[0];
  const rested = track[track.length - 1];
  const travelled = Math.hypot(rested.x - opened.x, rested.y - opened.y);
  expect(travelled).toBeLessThan(8);

  // …and at no point in between was it drawn off the page.
  const viewport = page.viewportSize()!;
  for (const at of track) {
    expect(at.x - at.w / 2).toBeGreaterThan(-1);
    expect(at.x + at.w / 2).toBeLessThan(viewport.width + 1);
    expect(at.y - at.h / 2).toBeGreaterThan(-1);
    expect(at.y + at.h / 2).toBeLessThan(viewport.height + 1);
  }
});
