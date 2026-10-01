import { expect, test, type Page } from "@playwright/test";
import type { TestSessionSnapshot } from "../../src/runtime/testMode";
import {
  PICKS,
  SECOND_SOURCE_ID,
  SECOND_TARGET_ID,
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
  weaveGoldenPairByKeyboard,
  SETTLE_TIMEOUT_MS,
} from "./support/focusView";

/**
 * THE LOOP, END TO END, IN A REAL BROWSER — pair before reading (I-016).
 *
 * Every input route expresses the same decisions: attend a bead, find and lock
 * a second, choose how to read the pair, and hold to weave. The durable record
 * is the same atomic batch whichever hand made it; only the gesture profile
 * says which hand it was (I-009, I-020).
 *
 * CI renders this in software. The focus view's waits are counted in frames,
 * so the page is kept small enough to draw several a second (800x600 is still
 * the desktop layout, column beside the arena), each test is allowed ninety
 * seconds, and sessions are shared where the question allows.
 */
test.use({ viewport: { width: 800, height: 600 } });
test.describe.configure({ timeout: 90_000 });

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
  // The plate waits for the pose, counted in frames; the software renderer
    // draws a few a second, so allow it the helpers' settle time.
    await expect(page.getByRole("radio")).toHaveCount(4, { timeout: 30_000 });
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

  // The canonical log reloads to the same web, byte for byte.
  const canonicalBefore = await page.evaluate(() => window.__gbgTest!.canonicalEventLog());
  const reloaded = await page.evaluate(() => window.__gbgTest!.reloadCanonical());
  const canonicalAfter = await page.evaluate(() => window.__gbgTest!.canonicalEventLog());
  expect(canonicalAfter).toBe(canonicalBefore);
  expect(reloaded.domainSession).toEqual(first.domainSession);
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
  await expect(page.getByTestId("intention-echo")).toBeFocused({ timeout: 30_000 });
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

  // The assistive route, on the golden path's second pair: Space chooses the
  // reading, and the mirror's confirm weaves it with a hold of its own that a
  // pointer press elsewhere can neither finish nor steal.
  await page.getByTestId(`bead-control-${SECOND_SOURCE_ID}`).focus();
  await page.keyboard.press("Enter");
  await waitForDraft(page, "attending");
  await page.getByTestId(`bead-control-${SECOND_TARGET_ID}`).focus();
  await page.keyboard.press("Enter");
  await waitForDraft(page, "locked");
  await expect(page.getByTestId("keyboard-weave-confirm")).toBeDisabled();
  await expect(page.getByTestId("intention-echo")).toBeFocused({ timeout: 30_000 });
  await page.keyboard.press("Space");
  await waitForDraft(page, "reading");
  expect((await snapshot(page)).draftIntention).toBe("echo");
  await expect(page.getByTestId("keyboard-weave-confirm")).toBeEnabled();
  await page.getByTestId("keyboard-weave-confirm").focus();
  await page.keyboard.down("Space");
  await expect.poll(async () => (await snapshot(page)).weaving).toBe(true);
  const elsewhere = await beadPoint(page, SOURCE_ID);
  await page.mouse.click(elsewhere.x, elsewhere.y);
  expect((await snapshot(page)).weaving).toBe(true);
  expect((await snapshot(page)).draftStage).toBe("reading");
  await advanceClock(page, 250);
  await page.keyboard.up("Space");
  await waitForDraft(page, "inactive");
  expect((await snapshot(page)).domainSession.threads[1]).toMatchObject({
    pair: [SECOND_SOURCE_ID, SECOND_TARGET_ID],
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
  /**
   * The column test is the longest in the set: it walks attend, sweep, lock
   * and weave by mouse, and on GitHub's software renderer it has taken 54 s on
   * an ordinary runner and over 90 s on a slow one, where every test in the
   * set ran at about 1.8× its usual length. Its budget is sized for the slow
   * runner, not the ordinary one.
   */
  test.describe.configure({ timeout: 150_000 });
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
    const initial = await openSession(page);
    const other = SHARES_NOTHING_WITH_SOURCE.find((id) => initial.beadIds.includes(id));
    expect(other, "the golden draw holds a bead that shares nothing").toBeTruthy();
    await expect(page.getByTestId("focus-card-top")).toHaveCount(0);

    // The hesitation line waits (I-013): never at once. It keeps real time,
    // and a slow runner can take longer than its delay to ask, so the page
    // itself notes when the gap opened and when the line arrived.
    await page.evaluate(() => {
      const marks: { gap?: number; hint?: number } = {};
      (window as unknown as { __gapMarks: typeof marks }).__gapMarks = marks;
      new MutationObserver(() => {
        const now = performance.now();
        if (marks.gap === undefined && document.querySelector('[data-testid="focus-gap"]')) {
          marks.gap = now;
        }
        if (
          marks.hint === undefined &&
          document.querySelector('[data-testid="focus-gap-hint"]')
        ) {
          marks.hint = now;
        }
      }).observe(document.body, { childList: true, subtree: true });
    });
    await attendWithMouse(page, SOURCE_ID);
    const top = page.getByTestId("focus-card-top");
    await expect(top).toBeVisible();
    await expect(top).toHaveAttribute("data-role", "attended");
    await expect(top).toHaveAttribute("data-concept-id", SOURCE_ID);
    await expect(page.getByTestId("focus-gap")).toBeVisible();
    await expect(page.getByTestId("focus-gap-hint")).toHaveText("Find a second bead.", {
      timeout: 15_000,
    });
    const marks = await page.evaluate(
      () => (window as unknown as { __gapMarks: { gap?: number; hint?: number } }).__gapMarks
    );
    expect(marks.gap).toBeDefined();
    expect(marks.hint! - marks.gap!).toBeGreaterThanOrEqual(2_900);

    // A pair that shares nothing says so plainly, and claims nothing else.
    await sweepTo(page, SOURCE_ID, other!);
    await expect(page.getByTestId("focus-nothing-shared")).toHaveText(
      "These two share no facet Castalia knows."
    );
    await expect(page.getByTestId("focus-shared-facets")).toHaveCount(0);

    await sweepTo(page, other!, TARGET_ID);
    const second = page.getByTestId("focus-card-second");
    await expect(second).toBeVisible();
    await expect(second).toHaveAttribute("data-role", "sighted");
    await expect(second).toHaveAttribute("data-concept-id", TARGET_ID);
    await expect(page.getByTestId("focus-nothing-shared")).toHaveCount(0);
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

  test("a woven thread can be taken up again, from the mirror and from the world", async ({
    page,
  }) => {
    const initial = await openSession(page);
    const woven = await weaveGoldenPairByKeyboard(page, "tension");
    const threadId = woven.domainSession.threads[0].id;
    const eventCount = woven.domainSession.eventCount;

    // From the accessible mirror, by keyboard.
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
    expect((await snapshot(page)).focus.mode).toBe("roaming");

    // From the world: a click on the strand, clear of every bead and of every
    // page control above the canvas, so the press can only mean the strand.
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
        { timeout: 30_000 }
      )
      .toBe(true);
    await page.mouse.click(target!.x, target!.y);
    await expect.poll(async () => (await snapshot(page)).reopenedThreadId).toBe(threadId);
    expect((await snapshot(page)).focus.mode).toBe("held");
    expect((await snapshot(page)).draftStage).toBe("inactive");
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await snapshot(page)).reopenedThreadId).toBe(null);
    // Nothing durable changed either time.
    expect((await snapshot(page)).domainSession.eventCount).toBe(eventCount);
  });

  test("full motion on the base tier fogs with blur and turns the bead to the left", async ({
    page,
  }) => {
    await openSession(page, "testMode=1&seed=castalia-golden-001&quality=base&reducedMotion=0");
    const roaming = await beadPoint(page, SOURCE_ID);
    await page.getByTestId(`bead-control-${SOURCE_ID}`).focus();
    await page.keyboard.press("Enter");
    await waitForDraft(page, "attending");
    expect((await snapshot(page)).focus).toMatchObject({
      mode: "focus",
      fogActive: true,
      blurActive: true,
    });
    // The world turns until the attended bead sits to the left of the frame
    // (I-017). How far down it can come depends on where it sits on the
    // sphere, so the test holds the part every bead is promised.
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    await expect
      .poll(
        async () => {
          const point = await page.evaluate(
            (id) => window.__gbgTest!.beadScreen(id),
            SOURCE_ID
          );
          return (
            point !== null &&
            !point.behind &&
            point.x < viewport.width * 0.5 &&
            roaming.x - point.x > 100
          );
        },
        { timeout: 20_000 }
      )
      .toBe(true);
  });
});

/**
 * STUDIES (M9-001), BY KEYBOARD, IN A REAL BROWSER.
 *
 * A Study is an ordinary session over authored beads (STUDIES-SPEC §8), so the
 * same verbs weave it; what it adds is a brief, a rule that checks it, the
 * silence answer and one solved moment. Everything here is reached by the
 * keyboard, and the adapter only starts the session and reads what the
 * evaluator said.
 */
test.describe("Studies", () => {
  const MOBIUS = "measure.mobius-band";
  const CONTINUOUS_SYMMETRY = "measure.continuous-symmetry";
  const COUNTERPOINT = "sound.counterpoint";
  const ESCHHOLZ_1_BEADS = [
    "measure.fibonacci-sequence",
    CONTINUOUS_SYMMETRY,
    MOBIUS,
    "measure.cantor-diagonal",
    COUNTERPOINT,
    "sound.just-intonation",
    "matter.conservation-of-energy",
    "image.chiaroscuro",
  ];
  const STUDY_SURFACE_FORBIDDEN = /\d|%|\bscore\b|\bpoints?\b|\brank\b|\bwrong\b/i;

  async function openStudy(page: Page, studyId: string): Promise<TestSessionSnapshot> {
    await page.goto("/?testMode=1&seed=castalia-golden-001&quality=potato&reducedMotion=1");
    await page.waitForFunction(() => Boolean(window.__gbgTest));
    return page.evaluate((id) => window.__gbgTest!.startStudy(id), studyId);
  }

  async function studyStatus(page: Page) {
    return page.evaluate(() => window.__gbgTest!.studyStatus());
  }

  /**
   * Uncaught errors on the page, from now on. Leaving a Study discards its
   * session while the arena is still fading out, and the director's first play
   * met a black page there: React had stopped. Every Study path ends by
   * asserting that nothing on the page threw.
   */
  function watchErrors(page: Page): () => readonly string[] {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    return () => errors;
  }

  /** Attend, lock, and hold Echo to weave — the keyboard's whole route. */
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
  }

  test("a passage is woven by keyboard, and the plate reads both lines", async ({ page }) => {
    const errors = watchErrors(page);
    const started = await openStudy(page, "study.eschholz-1");
    // An ordinary session, built without the draw (§8).
    expect(started.beadIds).toEqual(ESCHHOLZ_1_BEADS);
    expect(started.domainSession.seed).toBe("study:study.eschholz-1");
    expect(started.domainSession.sessionId).toBe("session:castalia.v1:study:study.eschholz-1");
    expect(started.domainSession.eventTypes).toEqual(["session.started"]);

    // Study mode: the brief is pinned, and there is no Conclude and no Lens.
    await expect(page.getByTestId("study-brief")).toContainText(
      "From The Möbius Band to Counterpoint in two threads"
    );
    await expect(page.getByRole("button", { name: "Conclude" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Lens/ })).toHaveCount(0);

    await weaveByKeyboard(page, MOBIUS, CONTINUOUS_SYMMETRY);
    await advanceClock(page, 5_000);
    expect((await studyStatus(page)).kind).toBe("not-yet");
    await expect(page.getByTestId("study-plate")).toHaveCount(0);

    await weaveByKeyboard(page, CONTINUOUS_SYMMETRY, COUNTERPOINT);
    // The solved moment follows the commit's own moment on the cue clock.
    await advanceClock(page, 8_000);
    await expect(page.getByTestId("study-plate")).toBeVisible({ timeout: 15_000 });
    expect(await studyStatus(page)).toMatchObject({ kind: "solved", by: "threads", plateOpen: true });
    await expect(page.getByTestId("study-plate-player-line")).toContainText("Continuous Symmetry");
    await expect(page.getByTestId("study-plate-magister-line")).toContainText("Counterpoint");
    await expect(page.getByTestId("study-plate-counts")).toBeVisible();
    await expect(page.getByTestId("study-plate-marks")).toContainText(/economical/i);
    await expect(page.getByTestId("study-plate-marks")).not.toContainText(STUDY_SURFACE_FORBIDDEN);

    // Keep weaving (§7): Escape sets the plate aside, the session goes on, and
    // the answer stays a press away in the brief's note.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("study-plate")).toHaveCount(0);
    expect((await studyStatus(page)).plateOpen).toBe(false);
    const solvedCount = (await snapshot(page)).domainSession.eventCount;
    await expect(page.getByTestId("study-solved")).toContainText("Solved.");
    await page.getByTestId("study-see-answer").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("study-plate")).toBeVisible();
    await page.getByTestId("study-plate-keep").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("study-plate")).toHaveCount(0);
    expect((await snapshot(page)).domainSession.eventCount).toBe(solvedCount);
    expect((await studyStatus(page)).kind).toBe("solved");
    await page.getByTestId("study-see-answer").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("study-plate")).toBeVisible();

    // Again: a new session with the same seed, and nothing carried over.
    await page.getByTestId("study-plate-again").focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await snapshot(page)).domainSession.eventCount).toBe(1);
    const again = await snapshot(page);
    expect(again.domainSession.sessionId).toBe(started.domainSession.sessionId);
    expect(again.domainSession.seed).toBe(started.domainSession.seed);
    expect((await studyStatus(page)).plateOpen).toBe(false);
    expect(errors()).toEqual([]);
  });

  test("silence answers a Study that cannot be done, and only that one", async ({ page }) => {
    const errors = watchErrors(page);
    await openStudy(page, "study.eschholz-1");
    await page.getByTestId("study-declare-silence-mirror").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("study-not-yet")).toHaveText(
      "Not yet — it can be done with these beads."
    );
    expect(await studyStatus(page)).toMatchObject({
      kind: "not-yet",
      notYet: "can-be-done",
      plateOpen: false,
    });
    await advanceClock(page, 5_000);
    await expect(page.getByTestId("study-plate")).toHaveCount(0);

    await openStudy(page, "study.eschholz-4");
    await page.getByTestId("study-declare-silence-mirror").focus();
    await page.keyboard.press("Enter");
    await advanceClock(page, 5_000);
    await expect(page.getByTestId("study-plate")).toBeVisible({ timeout: 15_000 });
    expect(await studyStatus(page)).toMatchObject({ kind: "solved", by: "silence" });
    await expect(page.getByTestId("study-plate-player-line")).toContainText("Proportion");
    await expect(page.getByTestId("study-plate-counts")).toHaveCount(0);

    // Next Study, from the plate: the following Study opens in its own session.
    await page.getByTestId("study-plate-next").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("study-brief")).toContainText(
      "From The Möbius Band to Polyrhythm in three threads",
      { timeout: 15_000 }
    );
    expect((await studyStatus(page)).studyId).toBe("study.waldzell-1");
    await expect.poll(async () => (await snapshot(page)).domainSession.eventCount).toBe(1);

    // Leave, from the arena: the list again, and no fault on the way out.
    await page.getByTestId("study-leave").click();
    await expect(page.getByTestId("studies-screen")).toBeVisible({ timeout: 15_000 });
    expect(errors()).toEqual([]);
  });

  test("the Studies door leads to the list, a Study opens without the threshold, and Back returns", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto("/?testMode=1&seed=castalia-golden-001&quality=potato&reducedMotion=1");
    await page.waitForFunction(() => Boolean(window.__gbgTest));
    // The second door is held shut with the first until the world is ready.
    const door = page.getByTestId("title-studies");
    await expect(door).toBeEnabled({ timeout: 30_000 });
    await door.focus();
    await page.keyboard.press("Enter");
    const list = page.getByTestId("studies-screen");
    await expect(list).toBeVisible({ timeout: 15_000 });
    for (const chapter of ["Eschholz", "Waldzell", "Vicus Lusorum"]) {
      await expect(list).toContainText(chapter);
    }
    await expect(list).not.toContainText(STUDY_SURFACE_FORBIDDEN);
    // Begin from the list: the arena opens without the threshold.
    await page.getByTestId("study-begin-study.eschholz-4").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("study-brief")).toContainText(
      "Carry Proportion into Matter",
      { timeout: 15_000 }
    );
    await expect(page.getByTestId("bead-control-measure.fibonacci-sequence")).toBeAttached();
    expect((await studyStatus(page)).studyId).toBe("study.eschholz-4");

    // It cannot be done, from the margin, by mouse: solved by silence.
    await page.getByTestId("study-declare-silence").click();
    await advanceClock(page, 5_000);
    await expect(page.getByTestId("study-plate")).toBeVisible({ timeout: 15_000 });
    expect(await studyStatus(page)).toMatchObject({ kind: "solved", by: "silence" });

    // Back to the Studies, from the plate, by mouse: the list again, and no
    // fault on the way out. The director's first play met a black page here.
    await page.getByTestId("study-plate-back").click();
    await expect(page.getByTestId("studies-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("study-begin-study.eschholz-1")).toBeVisible();
    expect(errors()).toEqual([]);
  });
});

test.describe("the conductor", () => {
  const SLOT_MS = 2000;
  const TAU = Math.PI * 2;

  async function musicalTime(page: Page) {
    return page.evaluate(() => window.__gbgTest!.musicalTime());
  }

  async function beadLight(page: Page, conceptId: string) {
    return page.evaluate((id) => window.__gbgTest!.beadLight(id), conceptId);
  }

  /** Dark in the glass, or lit by the idle score, which keeps its own clock. */
  async function darkOrKindled(page: Page, conceptId: string): Promise<boolean> {
    const light = await beadLight(page, conceptId);
    return light !== null && (light.written < 0.1 || light.kindled);
  }

  test("the world keeps one time: the grid, a note's light and the breath (ADR-016)", async ({ page }) => {
    await openSession(page);
    // The grid is armed with the world's slot on the controlled clock, by the
    // room lifecycle, once the arena is up.
    await expect.poll(async () => (await musicalTime(page)).armed).toBe(true);
    const armed = await musicalTime(page);
    expect(armed.slotSeconds).toBeCloseTo(SLOT_MS / 1000, 9);
    // The hand grid and the answer grid nest: the next hand point is at least
    // the lead ahead and within a sixteenth of it, the next answer point within
    // an eighth, and the two differ by whole sixteenths.
    expect(armed.nextHandAt - armed.now).toBeGreaterThanOrEqual(0.03 - 1e-9);
    expect(armed.nextHandAt - armed.now).toBeLessThanOrEqual(0.03 + SLOT_MS / 16_000 + 1e-9);
    expect(armed.nextAnswerAt - armed.now).toBeLessThanOrEqual(0.03 + SLOT_MS / 8_000 + 1e-9);
    const sixteenths = (armed.nextAnswerAt - armed.nextHandAt) / (SLOT_MS / 16_000);
    expect(Math.abs(sixteenths - Math.round(sixteenths))).toBeLessThan(1e-6);

    // Half a slot on, the slot phase has advanced by half.
    await advanceClock(page, SLOT_MS / 2);
    const later = await musicalTime(page);
    expect((((later.slotPhase - armed.slotPhase) % 1) + 1) % 1).toBeCloseTo(0.5, 6);

    // The breath crests on a slot boundary: move the clock to the next crest.
    const toCrest = (((Math.PI / 2 - later.breathPhase) % TAU) + TAU) % TAU;
    await advanceClock(page, Math.round((toCrest / TAU) * 4 * SLOT_MS));
    const crest = await musicalTime(page);
    expect(Math.sin(crest.breathPhase)).toBeGreaterThan(0.999);
    expect(Math.min(crest.slotPhase, 1 - crest.slotPhase)).toBeLessThan(0.002);

    // A note scheduled on a concept lights that bead from its onset, and only
    // that bead. The glass takes it through the kindling lane on the next frame.
    await beadPoint(page, SOURCE_ID);
    await expect
      .poll(() => darkOrKindled(page, SOURCE_ID), { timeout: SETTLE_TIMEOUT_MS })
      .toBe(true);
    expect((await beadLight(page, SOURCE_ID))?.note).toBe(0);
    await page.evaluate(
      (id) => window.__gbgTest!.conduct({ conceptId: id, inMs: 200, durationMs: 600 }),
      SOURCE_ID
    );
    await advanceClock(page, 100);
    expect((await beadLight(page, SOURCE_ID))?.note).toBe(0);
    await advanceClock(page, 160);
    expect((await beadLight(page, SOURCE_ID))?.note).toBeCloseTo(1, 6);
    await expect
      .poll(async () => (await beadLight(page, SOURCE_ID))?.written ?? 0, {
        timeout: SETTLE_TIMEOUT_MS,
      })
      .toBeGreaterThan(0.9);
    expect((await beadLight(page, TARGET_ID))?.note).toBe(0);
    // Past its decay the note is dark again, in the model and in the glass.
    await advanceClock(page, 700);
    expect((await beadLight(page, SOURCE_ID))?.note).toBeCloseTo(0, 6);
    await expect
      .poll(() => darkOrKindled(page, SOURCE_ID), { timeout: SETTLE_TIMEOUT_MS })
      .toBe(true);
  });

  test("leaving to the Studies list disarms the grid", async ({ page }) => {
    await page.goto("/?testMode=1&seed=castalia-golden-001&quality=potato&reducedMotion=1");
    await page.waitForFunction(() => Boolean(window.__gbgTest));
    await page.evaluate(() => window.__gbgTest!.startStudy("study.eschholz-1"));
    await expect.poll(async () => (await musicalTime(page)).armed).toBe(true);
    await page.getByTestId("study-leave").click();
    await expect(page.getByTestId("studies-screen")).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => (await musicalTime(page)).armed).toBe(false);
  });
});
