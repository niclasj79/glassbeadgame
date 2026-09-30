import { expect, type Page } from "@playwright/test";
import type { DisciplineId } from "../../../src/content/types";
import type { TestSessionSnapshot } from "../../../src/runtime/testMode";

/**
 * THE FOCUS VIEW, DRIVEN AS A PLAYER DRIVES IT (I-015 … I-020).
 *
 * One set of moves for every spec that needs a woven thread, so the flow is
 * written once: attend a bead, sweep the lens across the arena to the second,
 * lock it, hear a reading, and hold its sigil to weave. The deterministic clock
 * only moves when the harness moves it, so the sweep advances it between
 * steps — otherwise every sample of the approach would share a timestamp and
 * the path would carry no geometry at all (I-020).
 */

export const PICKS: DisciplineId[] = ["mathematics", "music", "art"];
export const SOURCE_ID = "measure.fibonacci-sequence";
export const TARGET_ID = "sound.counterpoint";

/**
 * How long a sigil must stay put before a hand reaches for it, and how far it
 * may creep between reads and still count as put. A plate that jumps (a pose
 * arriving) is waited out; a plate that creeps a pixel as the world eases is
 * pressed, because a pixel is nothing on a sigil the width of a fingertip.
 */
const SIGIL_REST_MS = 600;
const SIGIL_READ_INTERVAL_MS = 150;
const SIGIL_CREEP_PX = 2;
/** First frames on a software renderer, after a cold compile, can be slow. */
const SETTLE_TIMEOUT_MS = 15_000;

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export async function snapshot(page: Page): Promise<TestSessionSnapshot> {
  return page.evaluate(() => window.__gbgTest!.snapshot());
}

export async function waitForDraft(page: Page, stage: string): Promise<void> {
  await expect.poll(async () => (await snapshot(page)).draftStage).toBe(stage);
}

export async function advanceClock(page: Page, milliseconds: number): Promise<void> {
  await page.evaluate((ms) => window.__gbgTest!.advanceClock(ms), milliseconds);
}

export async function beadPoint(page: Page, id: string): Promise<ScreenPoint> {
  await expect
    .poll(
      async () => {
        const result = await page.evaluate(
          (conceptId) => window.__gbgTest!.beadScreen(conceptId),
          id
        );
        return result === null || result.behind;
      },
      { timeout: SETTLE_TIMEOUT_MS }
    )
    .toBe(false);
  const result = await page.evaluate(
    (conceptId) => window.__gbgTest!.beadScreen(conceptId),
    id
  );
  if (!result || result.behind) throw new Error(`bead ${id} is not on screen`);
  return { x: result.x, y: result.y };
}

export async function openSession(
  page: Page,
  query = "testMode=1&seed=castalia-golden-001&quality=potato&reducedMotion=1"
): Promise<TestSessionSnapshot> {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => Boolean(window.__gbgTest));
  const initial = await page.evaluate(
    (picks) => window.__gbgTest!.startSession(picks),
    PICKS
  );
  expect(initial.beadIds).toContain(SOURCE_ID);
  expect(initial.beadIds).toContain(TARGET_ID);
  return initial;
}

/** Attend a bead with the mouse. */
export async function attendWithMouse(page: Page, id: string): Promise<void> {
  const point = await beadPoint(page, id);
  await page.mouse.click(point.x, point.y);
  await waitForDraft(page, "attending");
}

/**
 * How long the lens rests on the second bead before the sighting settles
 * (I-017, I-018), with a margin. The harness moves the clock past it and then
 * nudges the pointer by a pixel inside the bead, so the settle completes
 * whether the pointer layer measures it on the next frame or the next move.
 */
export const SIGHTING_SETTLE_MARGIN_MS = 300;

/**
 * Sweep the lens from one bead to another in small steps, moving the clock
 * between them, rest on the second, and wait until it is sighted.
 */
export async function sweepTo(
  page: Page,
  fromId: string,
  toId: string,
  steps = 6,
  clockStepMs = 40
): Promise<void> {
  const from = await beadPoint(page, fromId);
  const to = await beadPoint(page, toId);
  await page.mouse.move(from.x, from.y);
  for (let step = 1; step <= steps; step += 1) {
    await advanceClock(page, clockStepMs);
    await page.mouse.move(
      from.x + ((to.x - from.x) * step) / steps,
      from.y + ((to.y - from.y) * step) / steps
    );
  }
  await restOn(page, to);
  await expect.poll(async () => (await snapshot(page)).sightedConceptId).toBe(toId);
}

/** Let the pointer rest where it is long enough for a settle to complete. */
export async function restOn(
  page: Page,
  point: ScreenPoint,
  restMs = SIGHTING_SETTLE_MARGIN_MS
): Promise<void> {
  await advanceClock(page, restMs);
  await page.mouse.move(point.x + 1, point.y);
  await page.mouse.move(point.x, point.y);
}

/** Lock the sighted bead with the mouse. */
export async function lockWithMouse(page: Page, id: string): Promise<void> {
  const point = await beadPoint(page, id);
  await page.mouse.click(point.x, point.y);
  await waitForDraft(page, "locked");
}


/**
 * The centre of a sigil once the plate has come to rest. The plate is carried
 * by a world anchor, so it can appear before the camera and the anchor have
 * settled and then move; a hand reaching for where it first appeared would
 * find nothing there. Unchanged reads across a short window are the rest.
 */
export async function sigilPoint(
  page: Page,
  intention: "echo" | "passage" | "tension" | "ground"
): Promise<ScreenPoint> {
  const sigil = page.getByTestId(`intention-${intention}`);
  await expect(sigil).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
  const needed = Math.ceil(SIGIL_REST_MS / SIGIL_READ_INTERVAL_MS);
  let point: ScreenPoint | null = null;
  let unchanged = 0;
  await expect
    .poll(
      async () => {
        const box = await sigil.boundingBox();
        const next = box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
        unchanged =
          next !== null &&
          point !== null &&
          Math.hypot(next.x - point.x, next.y - point.y) < SIGIL_CREEP_PX
            ? unchanged + 1
            : 0;
        point = next;
        return unchanged >= needed;
      },
      { intervals: [SIGIL_READ_INTERVAL_MS], timeout: SETTLE_TIMEOUT_MS }
    )
    .toBe(true);
  if (!point) throw new Error(`sigil ${intention} has no box`);
  return point;
}

/** Press a reading's sigil, hold it on the deterministic clock, release. */
export async function holdSigil(
  page: Page,
  intention: "echo" | "passage" | "tension" | "ground",
  holdMs = 250
): Promise<void> {
  const point = await sigilPoint(page, intention);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).weaving).toBe(true);
  await advanceClock(page, holdMs);
  await page.mouse.up();
  await waitForDraft(page, "inactive");
}

/** The whole golden-path weave, by mouse: Fibonacci —Echo→ Counterpoint. */
export async function weaveGoldenPairWithMouse(
  page: Page,
  intention: "echo" | "passage" | "tension" | "ground" = "echo"
): Promise<TestSessionSnapshot> {
  await attendWithMouse(page, SOURCE_ID);
  await sweepTo(page, SOURCE_ID, TARGET_ID);
  await lockWithMouse(page, TARGET_ID);
  await holdSigil(page, intention);
  return snapshot(page);
}
