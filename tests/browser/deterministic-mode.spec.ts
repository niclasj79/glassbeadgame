import { expect, test } from "@playwright/test";
import {
  PICKS,
  SOURCE_ID,
  TARGET_ID,
  advanceClock,
  attendWithMouse,
  beadPoint,
  holdSigil,
  lockWithMouse,
  openSession,
  restOn,
  sigilPoint,
  snapshot,
  sweepTo,
  waitForDraft,
  weaveGoldenPairWithMouse,
} from "./support/focusView";

/**
 * THE LOOP, END TO END, IN A REAL BROWSER — pair before reading (I-016).
 *
 * Every input route expresses the same decisions: attend a bead, find and lock
 * a second, choose how to read the pair, and hold to weave. The durable record
 * is the same atomic batch whichever hand made it; only the gesture profile
 * says which hand it was (I-009, I-020).
 */

test("direct mouse weaving commits a deterministic canonical interpretation", async ({
  page,
}) => {
  const initial = await openSession(page);
  expect(initial.draftStage).toBe("inactive");
  expect(initial.focus.mode).toBe("roaming");

  await attendWithMouse(page, SOURCE_ID);
  const attended = await snapshot(page);
  expect(attended.focus).toMatchObject({
    mode: "focus",
    fogActive: true,
    // Reduced motion and the engraved tier: the fog is dim-only (I-017).
    blurActive: false,
    lensActive: true,
    attendedCardOpen: true,
    gapOpen: true,
    sightedCardOpen: false,
  });
  expect(attended.candidateResonance).toHaveLength(initial.beadIds.length - 1);
  for (const candidate of attended.candidateResonance) {
    expect(Object.keys(candidate).sort()).toEqual(["band", "candidateId"]);
    expect(candidate.band).toMatch(/^(weak|medium|high)$/);
  }
  expect(JSON.stringify(attended.candidateResonance)).not.toMatch(
    /documented|endpoint|strength|support/i
  );
  await expect(page.getByTestId(`bead-control-${TARGET_ID}`)).toHaveAccessibleName(
    /^Counterpoint, (weak|medium|high) resonance$/
  );

  await sweepTo(page, SOURCE_ID, TARGET_ID);
  const sighted = await snapshot(page);
  expect(sighted.focus).toMatchObject({ gapOpen: false, sightedCardOpen: true });
  // Looking is not deciding: nothing about the second bead is in the draft.
  expect(sighted.draftStage).toBe("attending");
  expect(sighted.domainSession.eventCount).toBe(2);

  await lockWithMouse(page, TARGET_ID);
  const locked = await snapshot(page);
  expect(locked.draftCandidateConceptId).toBe(TARGET_ID);
  expect(locked.focus).toMatchObject({
    mode: "locked",
    sigilsVisible: true,
    lensActive: false,
  });
  await expect(page.getByRole("radio")).toHaveCount(4);
  await expect(page.getByTestId("intention-echo")).toHaveAccessibleName(
    "Echo: shares a form"
  );
  await expect(page.getByTestId("intention-echo")).toContainText("◌");
  await expect(page.getByTestId("intention-passage")).toContainText("→");
  await expect(page.getByTestId("intention-tension")).toContainText("≋");
  await expect(page.getByTestId("intention-ground")).toContainText("□");

  // Hovering a sigil lets the reading be heard without choosing it.
  const echo = await sigilPoint(page, "echo");
  await page.mouse.move(echo.x, echo.y);
  await expect.poll(async () => (await snapshot(page)).previewIntention).toBe("echo");
  expect((await snapshot(page)).draftStage).toBe("locked");

  await holdSigil(page, "echo", 250);
  const first = await snapshot(page);
  // The commit resolves its own outcome in the same turn. Fibonacci and
  // Counterpoint have an authored relation, so the log gains a documented
  // reveal; nothing provisional was written before the batch.
  expect(first.domainSession.eventTypes).toEqual([
    "session.started",
    "bead.attended",
    "pair.selected",
    "relation.hypothesized",
    "thread.committed",
    "documented-relation.revealed",
  ]);
  expect(first.domainSession.threads).toHaveLength(1);
  expect(first.domainSession.threads[0]).toMatchObject({
    pair: [SOURCE_ID, TARGET_ID],
    intention: "echo",
    inputModality: "mouse",
  });
  expect(first.domainSession.threads[0].id).toBe(
    `thread:${first.domainSession.sessionId.length}:${first.domainSession.sessionId}:1`
  );
  // The hold supplies the duration; the lens path supplies the geometry.
  expect(first.domainSession.threads[0].gesture).toMatchObject({
    inputModality: "mouse",
    durationMs: 250,
  });
  expect(first.domainSession.threads[0].gesture.pathLengthViewport).toBeGreaterThan(0);
  expect(
    first.domainSession.threads[0].gesture.averageSpeedViewportPerSecond
  ).toBeGreaterThan(0);
  expect(first.draftStage).toBe("inactive");
  expect(first.focus.mode).toBe("roaming");
  expect(first.focus.fogActive).toBe(false);
  expect(first.threads).toHaveLength(0);
  expect(first.discoveries).toHaveLength(0);
  expect(first.score).toBe(0);
});

test("keyboard controls mirror the complete action path", async ({ page }) => {
  await openSession(page);
  await page.getByTestId(`bead-control-${SOURCE_ID}`).focus();
  expect((await snapshot(page)).focusedBeadId).toBe(SOURCE_ID);
  await page.keyboard.press("Enter");
  await waitForDraft(page, "attending");

  // Focusing a bead while attending is the keyboard's lens.
  await page.getByTestId(`bead-control-${TARGET_ID}`).focus();
  await expect.poll(async () => (await snapshot(page)).sightedConceptId).toBe(TARGET_ID);
  expect((await snapshot(page)).draftStage).toBe("attending");
  await page.keyboard.press("Enter");
  await waitForDraft(page, "locked");

  // After a keyboard lock the first reading receives focus; a radiogroup's
  // selection follows its focus, so the arrow chooses the reading.
  await expect(page.getByTestId("intention-echo")).toBeFocused({ timeout: 15_000 });
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("intention-passage")).toBeFocused();
  await waitForDraft(page, "reading");
  expect((await snapshot(page)).draftIntention).toBe("passage");
  expect((await snapshot(page)).domainSession.eventCount).toBe(2);

  await page.keyboard.down("Enter");
  await expect.poll(async () => (await snapshot(page)).weaving).toBe(true);
  await advanceClock(page, 250);
  await page.keyboard.up("Enter");
  await waitForDraft(page, "inactive");
  const committed = (await snapshot(page)).domainSession.threads[0];
  expect(committed).toMatchObject({
    pair: [SOURCE_ID, TARGET_ID],
    intention: "passage",
    inputModality: "keyboard",
  });
  // No pointer path is lent to a keyboard hold (I-009).
  expect(committed.gesture).toEqual({ inputModality: "keyboard", durationMs: 250 });
});

test("the assistive confirm weaves the chosen reading without a hold", async ({
  page,
}) => {
  await openSession(page);
  await page.getByTestId(`bead-control-${SOURCE_ID}`).focus();
  await page.keyboard.press("Enter");
  await waitForDraft(page, "attending");
  await page.getByTestId(`bead-control-${TARGET_ID}`).focus();
  await page.keyboard.press("Enter");
  await waitForDraft(page, "locked");
  await expect(page.getByTestId("keyboard-weave-confirm")).toBeDisabled();
  await expect(page.getByTestId("intention-echo")).toBeFocused({ timeout: 15_000 });
  await page.keyboard.press("Space");
  await waitForDraft(page, "reading");
  expect((await snapshot(page)).draftIntention).toBe("echo");

  await expect(page.getByTestId("keyboard-weave-confirm")).toBeEnabled();
  await page.getByTestId("keyboard-weave-confirm").focus();
  await page.keyboard.down("Space");
  await expect.poll(async () => (await snapshot(page)).weaving).toBe(true);
  // A pointer press elsewhere cannot finish or steal a keyboard hold.
  const source = await beadPoint(page, SOURCE_ID);
  await page.mouse.click(source.x, source.y);
  expect((await snapshot(page)).weaving).toBe(true);
  expect((await snapshot(page)).draftStage).toBe("reading");
  await advanceClock(page, 250);
  await page.keyboard.up("Space");
  await waitForDraft(page, "inactive");
  expect((await snapshot(page)).domainSession.threads[0]).toMatchObject({
    pair: [SOURCE_ID, TARGET_ID],
    intention: "echo",
    inputModality: "keyboard",
  });
});

test("touch-emulated weaving preserves the same decisions", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 768, height: 900 },
  });
  const page = await context.newPage();
  try {
    await openSession(page);
    const source = await beadPoint(page, SOURCE_ID);
    await page.touchscreen.tap(source.x, source.y);
    await waitForDraft(page, "attending");

    // One finger over the arena moves the lens; it does not orbit (I-017).
    const from = await beadPoint(page, SOURCE_ID);
    const to = await beadPoint(page, TARGET_ID);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: from.x, y: from.y, id: 1, force: 0.5 }],
    });
    for (let step = 1; step <= 6; step += 1) {
      await advanceClock(page, 40);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: from.x + ((to.x - from.x) * step) / 6,
            y: from.y + ((to.y - from.y) * step) / 6,
            id: 1,
            force: 0.6,
          },
        ],
      });
    }
    await advanceClock(page, 300);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: to.x + 1, y: to.y, id: 1, force: 0.6 }],
    });
    await expect.poll(async () => (await snapshot(page)).sightedConceptId).toBe(TARGET_ID);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect((await snapshot(page)).draftStage).toBe("attending");
    // The finger swept the lens; the world did not turn under it.
    const settledTarget = await beadPoint(page, TARGET_ID);
    expect(Math.hypot(settledTarget.x - to.x, settledTarget.y - to.y)).toBeLessThan(3);

    await page.touchscreen.tap(settledTarget.x, settledTarget.y);
    await waitForDraft(page, "locked");

    const ground = await sigilPoint(page, "ground");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: ground.x, y: ground.y, id: 2, force: 0.7 }],
    });
    await expect.poll(async () => (await snapshot(page)).weaving).toBe(true);
    await advanceClock(page, 280);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await waitForDraft(page, "inactive");

    const committed = (await snapshot(page)).domainSession.threads[0];
    expect(committed).toMatchObject({
      pair: [SOURCE_ID, TARGET_ID],
      intention: "ground",
      inputModality: "touch",
    });
    expect(committed.gesture).toMatchObject({ inputModality: "touch", durationMs: 280 });
    expect(committed.gesture.pathLengthViewport).toBeGreaterThan(0);
    expect(committed.gesture.pressure).toBeGreaterThanOrEqual(0);
    expect(committed.gesture.pressure).toBeLessThanOrEqual(1);
  } finally {
    await context.close();
  }
});

test("cancellation steps back one stage at a time and pointer loss never commits", async ({
  page,
}) => {
  await openSession(page);
  await page.getByTestId(`bead-control-${SOURCE_ID}`).focus();
  await page.keyboard.press("Enter");
  await waitForDraft(page, "attending");
  await page.getByTestId(`bead-control-${TARGET_ID}`).focus();
  await page.keyboard.press("Enter");
  await waitForDraft(page, "locked");

  // A pointer hold that is lost commits nothing and keeps the chosen reading.
  const tension = await sigilPoint(page, "tension");
  await page.evaluate(() => {
    window.addEventListener(
      "pointerdown",
      (event) => {
        document.documentElement.dataset.testPointerId = String(event.pointerId);
      },
      { capture: true, once: true }
    );
  });
  await page.mouse.move(tension.x, tension.y);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).weaving).toBe(true);
  const pointerId = Number(await page.locator("html").getAttribute("data-test-pointer-id"));
  await page.evaluate((activePointerId) => {
    document
      .querySelector('[data-testid="intention-tension"]')
      ?.dispatchEvent(
        new PointerEvent("pointercancel", { pointerId: activePointerId, bubbles: true })
      );
  }, pointerId);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).weaving).toBe(false);
  expect((await snapshot(page)).draftStage).toBe("reading");
  expect((await snapshot(page)).draftIntention).toBe("tension");
  expect((await snapshot(page)).domainSession.eventCount).toBe(2);

  // Read → Lock → Attend → Roam, one Escape each, never a durable event.
  await page.keyboard.press("Escape");
  await waitForDraft(page, "locked");
  await page.keyboard.press("Escape");
  await waitForDraft(page, "attending");
  expect((await snapshot(page)).focus.fogActive).toBe(true);
  await page.keyboard.press("Escape");
  await waitForDraft(page, "inactive");
  expect((await snapshot(page)).domainSession.eventCount).toBe(2);
  expect((await snapshot(page)).focus.fogActive).toBe(false);
});

test("canonical replay reload preserves the committed web", async ({ page }) => {
  await openSession(page);
  await attendWithMouse(page, SOURCE_ID);
  await sweepTo(page, SOURCE_ID, TARGET_ID);
  await lockWithMouse(page, TARGET_ID);
  await holdSigil(page, "echo");
  const committed = await snapshot(page);
  const canonicalBefore = await page.evaluate(() => window.__gbgTest!.canonicalEventLog());
  const reloaded = await page.evaluate(() => window.__gbgTest!.reloadCanonical());
  const canonicalAfter = await page.evaluate(() => window.__gbgTest!.canonicalEventLog());
  expect(canonicalAfter).toBe(canonicalBefore);
  expect(reloaded.domainSession).toEqual(committed.domainSession);
});

test("the declared seed and disciplines reproduce the same draw", async ({ page }) => {
  const first = await openSession(page);
  const second = await page.evaluate(
    (picks) => window.__gbgTest!.startSession(picks),
    PICKS
  );
  expect(second.beadIds).toEqual(first.beadIds);
  expect(second.themeId).toBe(first.themeId);
  expect(second.domainSession.sessionId).toBe(first.domainSession.sessionId);
});

test("ordinary development exposes no test adapter", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  expect(await page.evaluate(() => window.__gbgTest)).toBeUndefined();
});

/**
 * THE FOCUS VIEW (I-015 … I-019), observed where the player observes it: the
 * right column, the fog and lens flags every surface derives from one view,
 * and the woven thread that can be taken up again. These live here rather
 * than in a spec of their own because this file is the one `test:browser`
 * runs.
 */
test.describe("the focus view", () => {
  /** Beads the pack says share no facet with Fibonacci (public structure). */
  const SHARES_NOTHING_WITH_SOURCE = [
    "measure.continuous-symmetry",
    "measure.fourier-series",
    "measure.mobius-band",
    "sound.polyrhythm",
    "image.anamorphosis",
    "image.chiaroscuro",
    "image.camera-obscura",
  ];
  const FORBIDDEN_BEFORE_COMMIT = /documented|\bscore\b|\bpoints?\b|\brank\b|\bcorrect\b|\bwrong\b|%/i;

  test("the column holds the attended card, the gap, and then the pair", async ({
    page,
  }) => {
    await openSession(page);
    await expect(page.getByTestId("focus-card-top")).toHaveCount(0);

    await attendWithMouse(page, SOURCE_ID);
    const top = page.getByTestId("focus-card-top");
    await expect(top).toBeVisible();
    await expect(top).toHaveAttribute("data-role", "attended");
    await expect(top).toHaveAttribute("data-concept-id", SOURCE_ID);
    await expect(page.getByTestId("focus-gap")).toBeVisible();
    // The hesitation line waits (I-013): never at once.
    await expect(page.getByTestId("focus-gap-hint")).toHaveCount(0);
    await advanceClock(page, 3_200);
    await expect(page.getByTestId("focus-gap-hint")).toHaveText("Find a second bead.", {
      timeout: 8_000,
    });

    await sweepTo(page, SOURCE_ID, TARGET_ID);
    const second = page.getByTestId("focus-card-second");
    await expect(second).toBeVisible();
    await expect(second).toHaveAttribute("data-role", "sighted");
    await expect(second).toHaveAttribute("data-concept-id", TARGET_ID);
    await expect(page.getByTestId("focus-gap")).toHaveCount(0);
    // Both carry Recursion; both cards light it, and nothing else is claimed.
    const shared = page.getByTestId("focus-shared-facets");
    await expect(shared).toHaveCount(2);
    await expect(shared.first()).toContainText("Recursion");
    await expect(shared.last()).toContainText("Recursion");
    await expect(page.getByTestId("focus-column")).not.toContainText(FORBIDDEN_BEFORE_COMMIT);

    await lockWithMouse(page, TARGET_ID);
    await expect(second).toHaveAttribute("data-role", "candidate");
    await expect(top).toHaveAttribute("data-role", "attended");
    const passage = await sigilPoint(page, "passage");
    await page.mouse.move(passage.x, passage.y);
    await expect(page.getByTestId("focus-column")).toContainText("Passage");
    await expect(page.getByTestId("focus-column")).not.toContainText(FORBIDDEN_BEFORE_COMMIT);

    await holdSigil(page, "passage");
    // The pair's cards close with the fog; the thread card stays to be read.
    // The outcome is a cue like any other, so it lands on the cue clock.
    await expect(page.getByTestId("focus-card-top")).toHaveCount(0);
    await advanceClock(page, 3_000);
    const more = page.getByTestId("thread-card-more");
    await expect(more).toBeVisible();
    // No timer closes it (I-018): time passes, the card is still there.
    await advanceClock(page, 60_000);
    await page.waitForTimeout(1_500);
    await expect(more).toBeVisible();
    await more.click();
    // The player's next act sets it aside.
    await attendWithMouse(page, TARGET_ID);
    await expect(page.getByTestId("thread-card-more")).toHaveCount(0);
  });

  test("a pair that shares nothing says so plainly", async ({ page }) => {
    const initial = await openSession(page);
    const other = SHARES_NOTHING_WITH_SOURCE.find((id) => initial.beadIds.includes(id));
    expect(other, "the golden draw holds a bead that shares nothing").toBeTruthy();
    await attendWithMouse(page, SOURCE_ID);
    await sweepTo(page, SOURCE_ID, other!);
    await expect(page.getByTestId("focus-nothing-shared")).toHaveText(
      "These two share no facet Castalia knows."
    );
    await expect(page.getByTestId("focus-shared-facets")).toHaveCount(0);
    // It is a statement, not a refusal: the pair can still be held.
    await lockWithMouse(page, other!);
    await expect(page.getByRole("radio")).toHaveCount(4);
  });

  test("resting on a bead opens its card, and leaving closes it", async ({ page }) => {
    await openSession(page);
    const bead = await beadPoint(page, TARGET_ID);
    await page.mouse.move(bead.x, bead.y);
    await restOn(page, bead, 900);
    await expect
      .poll(async () => (await snapshot(page)).focus.dwellCardConceptId, { timeout: 8_000 })
      .toBe(TARGET_ID);
    const card = page.getByTestId("focus-card-top");
    await expect(card).toHaveAttribute("data-role", "dwell");
    await expect(card).toContainText("Counterpoint");
    // Looking is not deciding: nothing durable, no attention.
    expect((await snapshot(page)).draftStage).toBe("inactive");
    expect((await snapshot(page)).domainSession.eventCount).toBe(1);

    const away = { x: 12, y: Math.round((page.viewportSize()?.height ?? 720) / 2) };
    await page.mouse.move(away.x, away.y);
    await restOn(page, away, 600);
    await expect
      .poll(async () => (await snapshot(page)).focus.dwellCardConceptId, { timeout: 8_000 })
      .toBe(null);
    await expect(page.getByTestId("focus-card-top")).toHaveCount(0);
  });

  test("a woven thread can be taken up again, and Escape sets it down", async ({
    page,
  }) => {
    await openSession(page);
    const woven = await weaveGoldenPairWithMouse(page, "tension");
    const threadId = woven.domainSession.threads[0].id;
    const eventCount = woven.domainSession.eventCount;

    const mirror = page.getByTestId(`woven-thread-${threadId}`);
    await expect(mirror).toHaveAccessibleName(/Fibonacci Sequence.*Tension.*Counterpoint/);
    await mirror.focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await snapshot(page)).reopenedThreadId).toBe(threadId);
    const held = await snapshot(page);
    expect(held.focus).toMatchObject({ mode: "held", fogActive: true, sigilsVisible: false });
    await expect(page.getByTestId("focus-card-top")).toHaveAttribute("data-role", "held");
    await expect(page.getByTestId("focus-card-second")).toHaveAttribute("data-role", "held");
    expect(held.domainSession.eventCount).toBe(eventCount);

    await page.keyboard.press("Escape");
    await expect.poll(async () => (await snapshot(page)).reopenedThreadId).toBe(null);
    const after = await snapshot(page);
    expect(after.focus.mode).toBe("roaming");
    expect(after.domainSession.eventCount).toBe(eventCount);
  });

  test("a woven strand in the world can be picked up again", async ({ page }) => {
    const initial = await openSession(page);
    const woven = await weaveGoldenPairWithMouse(page, "ground");
    const threadId = woven.domainSession.threads[0].id;
    const eventCount = woven.domainSession.eventCount;

    // A point on the strand that is clear of every bead and of every page
    // control above the canvas, so the press can only mean the strand.
    const clearOfBeads = async (point: { x: number; y: number }): Promise<boolean> => {
      for (const id of initial.beadIds) {
        const bead = await page.evaluate((conceptId) => window.__gbgTest!.beadScreen(conceptId), id);
        if (bead && !bead.behind && Math.hypot(bead.x - point.x, bead.y - point.y) < 40) {
          return false;
        }
      }
      return page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.tagName === "CANVAS",
        point
      );
    };
    let target: { x: number; y: number } | null = null;
    await expect
      .poll(
        async () => {
          for (const at of [0.5, 0.4, 0.6, 0.3, 0.7]) {
            const point = await page.evaluate(
              ({ id, t }) => window.__gbgTest!.threadScreen(id, t),
              { id: threadId, t: at }
            );
            if (point && !point.behind && (await clearOfBeads(point))) {
              target = { x: point.x, y: point.y };
              return true;
            }
          }
          return false;
        },
        { timeout: 10_000 }
      )
      .toBe(true);
    await page.mouse.click(target!.x, target!.y);
    await expect.poll(async () => (await snapshot(page)).reopenedThreadId).toBe(threadId);
    expect((await snapshot(page)).focus.mode).toBe("held");
    expect((await snapshot(page)).draftStage).toBe("inactive");

    await page.keyboard.press("Escape");
    await expect.poll(async () => (await snapshot(page)).reopenedThreadId).toBe(null);
    expect((await snapshot(page)).domainSession.eventCount).toBe(eventCount);
  });

  test("full motion on the base tier fogs with blur and brings the bead close", async ({
    page,
  }) => {
    await openSession(page, "testMode=1&seed=castalia-golden-001&quality=base&reducedMotion=0");
    await page.getByTestId(`bead-control-${SOURCE_ID}`).focus();
    await page.keyboard.press("Enter");
    await waitForDraft(page, "attending");
    expect((await snapshot(page)).focus).toMatchObject({
      mode: "focus",
      fogActive: true,
      blurActive: true,
    });
    // The attended bead comes to rest in the lower left of the frame.
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    await expect
      .poll(
        async () => {
          await advanceClock(page, 200);
          const point = await page.evaluate(
            (id) => window.__gbgTest!.beadScreen(id),
            SOURCE_ID
          );
          return (
            point !== null &&
            !point.behind &&
            point.x < viewport.width * 0.5 &&
            point.y > viewport.height * 0.5
          );
        },
        { timeout: 15_000 }
      )
      .toBe(true);
  });
});
