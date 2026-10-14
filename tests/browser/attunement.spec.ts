import { expect, test, type Page } from "@playwright/test";
import type { BrowserTestAdapter } from "../../src/runtime/testMode";
import { advanceClock, openSession, snapshot, waitForDraft } from "./support/focusView";

/**
 * ATTUNEMENT IS THE HELD STATE THE WORLD ANSWERS (M6-001, ADR-018).
 *
 * Entered the way a player enters it: six threads woven by keyboard until the
 * invitation is offered, and the invitation accepted. The held state moves on
 * the conductor's clock, which in test mode is the controlled clock, so every
 * reading here is taken after the harness moves it and a frame has been drawn.
 *
 * What is measured is what the scene handed its readers (`attunement()` on the
 * adapter): the glass's index, the depth's scale, the drawn figures' gain and
 * the drift — at rest, held, and across the release, which waits for the slot
 * boundary the bed's cadence resolves on and lifts the world over one slot.
 * Whether it reads as the world rising to meet the attention is the director's
 * judgement on a real display, not this file's.
 */

type Held = ReturnType<BrowserTestAdapter["attunement"]>;
type Musical = ReturnType<BrowserTestAdapter["musicalTime"]>;

/** Castalia's index of refraction (themes/worlds.ts) and the bounds (scene/attuned.ts). */
const REFRACTION = 1.52;
const IOR_RISE = 0.06;
const DEPTH_FALL = 0.2;

async function held(page: Page): Promise<Held> {
  return page.evaluate(() => window.__gbgTest!.attunement());
}

async function musical(page: Page): Promise<Musical> {
  return page.evaluate(() => window.__gbgTest!.musicalTime());
}

/** Let the scene draw: the held state is stepped in the frame loop, not on the clock. */
async function frames(page: Page, count = 2): Promise<void> {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let left = n;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    count
  );
}

/** Move the controlled clock in steps, drawing between them, as time passing would. */
async function pass(page: Page, milliseconds: number, stepMs = 250): Promise<void> {
  for (let left = milliseconds; left > 0; left -= stepMs) {
    await advanceClock(page, Math.min(stepMs, left));
    await frames(page);
  }
}

/**
 * Attend, lock, and hold Echo to weave — the keyboard's whole route.
 *
 * This file weaves only to reach the invitation; the route itself is asserted
 * in `deterministic-mode.spec.ts`. So a few frames are drawn after each weave
 * before the next begins: the plate hands the keyboard back to the bead it was
 * last on from its own effect, and on a software renderer that can land after
 * a harness that moves faster than any hand has already focused the next bead
 * — which leaves the lock without the focus the plate keys its arrival on.
 */
async function weaveByKeyboard(page: Page, fromId: string, toId: string): Promise<void> {
  await page.getByTestId(`bead-control-${fromId}`).focus();
  await page.keyboard.press("Enter");
  await waitForDraft(page, "attending");
  await page.getByTestId(`bead-control-${toId}`).focus();
  await page.keyboard.press("Enter");
  await waitForDraft(page, "locked");
  await expect(page.getByTestId("intention-echo")).toBeFocused({ timeout: 15_000 });
  await page.keyboard.down("Enter");
  await expect.poll(async () => (await snapshot(page)).weaving).toBe(true);
  await advanceClock(page, 250);
  await page.keyboard.up("Enter");
  await waitForDraft(page, "inactive");
  // The commit is performed before the next can begin, and the plate's
  // hand-back of the keyboard is let land.
  await advanceClock(page, 4_000);
  await frames(page, 6);
  await expect(page.getByTestId(`bead-control-${toId}`)).toBeFocused({ timeout: 15_000 });
}

/** Weave a chain through the draw until Attunement is offered, and accept it. */
async function enterAttunement(page: Page, beadIds: readonly string[]): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await test.step(`weave ${beadIds[i]} → ${beadIds[i + 1]}`, () =>
      weaveByKeyboard(page, beadIds[i], beadIds[i + 1])
    );
  }
  expect((await snapshot(page)).domainSession.threads).toHaveLength(6);
  const invitation = page.getByTestId("world-attunement");
  await expect(invitation).toBeVisible({ timeout: 15_000 });
  await expect(invitation).toHaveAttribute("aria-pressed", "false");
  const atRest = await held(page);
  expect(atRest).toMatchObject({ held: false, phase: "rest", value: 0, depthScale: 1, figureGain: 1 });
  expect(atRest.ior).toBeCloseTo(REFRACTION, 9);
  await invitation.click();
  await expect(invitation).toHaveAttribute("aria-pressed", "true");
}

test.use({ viewport: { width: 800, height: 600 } });
test.describe.configure({ timeout: 300_000 });

test("held, the room answers; released, it lifts back over one slot on the grid", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const initial = await openSession(
    page,
    "testMode=1&seed=castalia-golden-001&quality=base&reducedMotion=0"
  );
  await enterAttunement(page, initial.beadIds);

  // Held: the scalar eases in on the room's 0.9 s ease.
  await pass(page, 5_000);
  const full = await held(page);
  expect(full.held).toBe(true);
  expect(full.phase).toBe("entering");
  expect(full.value).toBeGreaterThan(0.99);
  expect(full.ior).toBeCloseTo(REFRACTION + IOR_RISE, 2);
  expect(full.depthScale).toBeCloseTo(1 - DEPTH_FALL, 2);
  // The base tier compiles no dispersion, so there is no split to widen.
  expect(full.dispersion).toBeNull();
  // Nothing is heard in test mode, and nothing heard brightens nothing.
  expect(full.voices).toBe(0);
  expect(full.figureGain).toBe(1);
  // The drift runs, and the camera actually turns: a bead moves on the page.
  expect(full.driftRate).toBeGreaterThan(0);
  expect(full.driftApplied).toBeGreaterThan(0);
  const anchor = initial.beadIds[0];
  const before = await page.evaluate(
    (id) => window.__gbgTest!.beadScreen(id, { evenIfUnsettled: true }),
    anchor
  );
  await pass(page, 8_000, 500);
  const after = await page.evaluate(
    (id) => window.__gbgTest!.beadScreen(id, { evenIfUnsettled: true }),
    anchor
  );
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.hypot(after!.x - before!.x, after!.y - before!.y)).toBeGreaterThan(1);

  // Released: the world holds until the cadence's slot boundary…
  const slot = (await musical(page)).slotSeconds;
  await page.getByTestId("world-attunement").click();
  await frames(page);
  const released = await held(page);
  expect(released.held).toBe(false);
  expect(released.phase).toBe("awaiting");
  expect(released.cadenceAt).not.toBeNull();
  const now = (await musical(page)).now;
  const wait = released.cadenceAt! - now;
  expect(wait).toBeGreaterThan(0);
  expect(wait).toBeLessThanOrEqual(slot + 0.06);
  // …on a slot boundary of the grid.
  const boundary = await page.evaluate(
    (at) => {
      const t = window.__gbgTest!.musicalTime();
      // The slot phase advances one turn a slot; at the boundary it is whole.
      const turns = t.slotPhase + (at - t.now) / t.slotSeconds;
      return Math.abs(turns - Math.round(turns));
    },
    released.cadenceAt!
  );
  expect(boundary).toBeLessThan(1e-6);
  if (wait > 0.1) {
    await advanceClock(page, Math.floor((wait - 0.05) * 1000));
    await frames(page);
    const waiting = await held(page);
    expect(waiting.phase).toBe("awaiting");
    expect(waiting.value).toBeGreaterThan(0.99);
  }
  // …then lifts back: half a slot past the boundary it is half way down.
  const toMiddle = released.cadenceAt! + slot / 2 - (await musical(page)).now;
  await advanceClock(page, Math.round(toMiddle * 1000));
  await frames(page);
  const middle = await held(page);
  expect(middle.phase).toBe("releasing");
  expect(middle.value).toBeGreaterThan(0.4);
  expect(middle.value).toBeLessThan(0.6);
  expect(middle.depthScale).toBeGreaterThan(1 - DEPTH_FALL);
  expect(middle.depthScale).toBeLessThan(1);
  // …and is at rest one slot after the boundary.
  await advanceClock(page, Math.round((slot / 2 + 0.05) * 1000));
  await frames(page);
  const rested = await held(page);
  expect(rested).toMatchObject({ phase: "rest", value: 0, depthScale: 1, figureGain: 1, driftRate: 0 });
  expect(rested.ior).toBeCloseTo(REFRACTION, 9);
  expect(errors).toEqual([]);
});

test("reduced motion keeps the glass and the depth, and has no drift and no brightening", async ({
  page,
}) => {
  const initial = await openSession(
    page,
    "testMode=1&seed=castalia-golden-001&quality=potato&reducedMotion=1"
  );
  await enterAttunement(page, initial.beadIds);
  await pass(page, 5_000);
  const full = await held(page);
  expect(full.value).toBeGreaterThan(0.99);
  // Reduced motion keeps the material and the depth, and drops the drift.
  expect(full.ior).toBeCloseTo(REFRACTION + IOR_RISE, 2);
  expect(full.depthScale).toBeCloseTo(1 - DEPTH_FALL, 2);
  expect(full.driftRate).toBe(0);
  expect(full.driftApplied).toBe(0);
  // Reduced bloom (implied by reduced motion and by the engraved tier) drops the brightening.
  expect(full.figureGain).toBe(1);
  // The engraved tier has no dispersion.
  expect(full.dispersion).toBeNull();
});

test("on the base tier, a key takes the camera back for the rest of the hold", async ({ page }) => {
  const initial = await openSession(
    page,
    "testMode=1&seed=castalia-golden-001&quality=base&reducedMotion=0"
  );
  await enterAttunement(page, initial.beadIds);
  await pass(page, 3_000);
  expect((await held(page)).driftApplied).toBeGreaterThan(0);
  await page.keyboard.press("Shift");
  await pass(page, 1_000);
  const taken = await held(page);
  // The answers still allow it; the rig has let go.
  expect(taken.driftRate).toBeGreaterThan(0);
  expect(taken.driftApplied).toBe(0);
  await pass(page, 4_000, 500);
  expect((await held(page)).driftApplied).toBe(0);
});
