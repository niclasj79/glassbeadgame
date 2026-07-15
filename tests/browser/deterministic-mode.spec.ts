import { expect, test, type Page } from "@playwright/test";
import type { DisciplineId } from "../../src/content/types";
import type { TestSessionSnapshot } from "../../src/runtime/testMode";

const PICKS: DisciplineId[] = ["mathematics", "music", "art"];
const SOURCE_ID = "math.fibonacci-sequence";
const TARGET_ID = "music.counterpoint";

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

interface MouseComposition {
  readonly snapshot: TestSessionSnapshot;
  readonly sourceId: string;
  readonly targetId: string;
}

async function snapshot(page: Page): Promise<TestSessionSnapshot> {
  return page.evaluate(() => window.__gbgTest!.snapshot());
}

async function waitForDraft(page: Page, stage: string): Promise<void> {
  await expect.poll(async () => (await snapshot(page)).draftStage).toBe(stage);
}

async function beadPoint(page: Page, id: string): Promise<ScreenPoint> {
  await expect
    .poll(async () => {
      const result = await page.evaluate(
        (conceptId) => window.__gbgTest!.beadScreen(conceptId),
        id
      );
      return result === null || result.behind;
    })
    .toBe(false);
  const result = await page.evaluate(
    (conceptId) => window.__gbgTest!.beadScreen(conceptId),
    id
  );
  if (!result || result.behind) throw new Error(`bead ${id} is not on screen`);
  return { x: result.x, y: result.y };
}

async function openSession(page: Page): Promise<TestSessionSnapshot> {
  await page.goto(
    "/?testMode=1&seed=castalia-golden-001&quality=potato&reducedMotion=1"
  );
  await page.waitForFunction(() => Boolean(window.__gbgTest));
  const initial = await page.evaluate(
    (picks) => window.__gbgTest!.startSession(picks),
    PICKS
  );
  expect(initial.beadIds).toContain(SOURCE_ID);
  expect(initial.beadIds).toContain(TARGET_ID);
  return initial;
}

async function composeWithMouse(
  page: Page,
  initial: TestSessionSnapshot
): Promise<MouseComposition> {
  expect(initial.draftStage).toBe("inactive");
  const sourceId = SOURCE_ID;
  const targetId = TARGET_ID;
  const initialSource = await beadPoint(page, sourceId);
  await page.mouse.click(initialSource.x, initialSource.y);
  await waitForDraft(page, "attending");

  const attended = await snapshot(page);
  expect(attended.candidateResonance).toHaveLength(initial.beadIds.length - 1);
  expect(
    attended.candidateResonance.map((candidate) => candidate.candidateId)
  ).toEqual(expect.arrayContaining(initial.beadIds.filter((id) => id !== sourceId)));
  for (const candidate of attended.candidateResonance) {
    expect(Object.keys(candidate).sort()).toEqual(["band", "candidateId"]);
    expect(candidate.band).toMatch(/^(weak|medium|high)$/);
  }
  expect(JSON.stringify(attended.candidateResonance)).not.toMatch(
    /documented|endpoint|strength|support/i
  );
  await expect(page.getByTestId(`bead-control-${targetId}`)).toHaveAccessibleName(
    /^Counterpoint, (weak|medium|high) resonance$/
  );

  const intentions = page.getByRole("radio");
  await expect(intentions).toHaveCount(4);
  await expect(page.getByTestId("intention-echo")).toHaveAccessibleName(
    "Echo: shares a form"
  );
  await expect(page.getByTestId("intention-echo")).toContainText("◌");
  await expect(page.getByTestId("intention-passage")).toContainText("→");
  await expect(page.getByTestId("intention-tension")).toContainText("≋");
  await expect(page.getByTestId("intention-ground")).toContainText("□");
  await page.getByTestId("intention-echo").click();
  await waitForDraft(page, "armed");

  const source = await beadPoint(page, sourceId);
  const target = await beadPoint(page, targetId);
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).weaving).toBe(true);
  await page.evaluate(() => window.__gbgTest!.advanceClock(125));
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await expect
    .poll(async () => (await snapshot(page)).snappedConceptId)
    .toBe(targetId);
  const latched = await snapshot(page);
  expect(latched.draftStage).toBe("armed");
  expect(latched.draftIntention).toBe("echo");
  await page.evaluate(() => window.__gbgTest!.advanceClock(125));
  await page.mouse.up();
  await waitForDraft(page, "inactive");
  await expect
    .poll(async () => {
      const home = await beadPoint(page, sourceId);
      return Math.hypot(home.x - initialSource.x, home.y - initialSource.y);
    })
    .toBeLessThan(3);
  return { snapshot: await snapshot(page), sourceId, targetId };
}

test("direct mouse weaving commits a deterministic canonical interpretation", async ({
  page,
}) => {
  const composition = await composeWithMouse(page, await openSession(page));
  const first = composition.snapshot;
  expect(first.domainSession.eventCount).toBe(5);
  expect(first.domainSession.eventTypes).toEqual([
    "session.started",
    "bead.attended",
    "pair.selected",
    "relation.hypothesized",
    "thread.committed",
  ]);
  expect(first.domainSession.threads).toHaveLength(1);
  expect(first.domainSession.threads[0]).toMatchObject({
    pair: [composition.sourceId, composition.targetId],
    intention: "echo",
    inputModality: "mouse",
  });
  expect(first.domainSession.threads[0].id).toBe(
    `thread:${first.domainSession.sessionId.length}:${first.domainSession.sessionId}:1`
  );
  expect(first.domainSession.threads[0].gesture).toMatchObject({
    inputModality: "mouse",
    durationMs: 250,
  });
  expect(
    first.domainSession.threads[0].gesture.pathLengthViewport
  ).toBeGreaterThan(0);
  expect(
    first.domainSession.threads[0].gesture.averageSpeedViewportPerSecond
  ).toBeGreaterThan(0);
  expect(first.draftStage).toBe("inactive");
  expect(first.threads).toHaveLength(0);
  expect(first.discoveries).toHaveLength(0);
  expect(first.score).toBe(0);
});

test("keyboard controls mirror the complete action path", async ({ page }) => {
  await openSession(page);
  const sourceId = SOURCE_ID;
  const targetId = TARGET_ID;
  await page.getByTestId(`bead-control-${sourceId}`).focus();
  expect((await snapshot(page)).focusedBeadId).toBe(sourceId);
  await page.keyboard.press("Enter");
  await waitForDraft(page, "attending");

  await expect(page.getByTestId("intention-echo")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("intention-passage")).toBeFocused();
  await page.keyboard.press("Space");
  await waitForDraft(page, "armed");
  await expect(page.getByTestId(`bead-control-${sourceId}`)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId(`bead-control-${targetId}`)).toBeFocused();
  expect((await snapshot(page)).focusedBeadId).toBe(targetId);
  await page.keyboard.press("Enter");
  await waitForDraft(page, "candidate-selected");

  const source = await beadPoint(page, sourceId);
  await page.mouse.click(source.x, source.y);
  expect((await snapshot(page)).draftStage).toBe("candidate-selected");
  expect((await snapshot(page)).domainSession.eventCount).toBe(2);

  await page.getByTestId("keyboard-weave-confirm").focus();
  await page.keyboard.down("Space");
  await expect.poll(async () => (await snapshot(page)).weaving).toBe(true);
  await page.mouse.click(source.x, source.y);
  expect((await snapshot(page)).weaving).toBe(true);
  expect((await snapshot(page)).draftStage).toBe("candidate-selected");
  await page.evaluate(() => window.__gbgTest!.advanceClock(250));
  await page.keyboard.up("Space");
  await waitForDraft(page, "inactive");
  const committed = (await snapshot(page)).domainSession.threads[0];
  expect(committed).toMatchObject({
    pair: [sourceId, targetId],
    intention: "passage",
    inputModality: "keyboard",
  });
  expect(committed.gesture).toEqual({
    inputModality: "keyboard",
    durationMs: 250,
  });
});

test("touch-emulated direct weaving preserves the same decisions", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 768, height: 900 },
  });
  const page = await context.newPage();
  try {
    await openSession(page);
    const sourceId = SOURCE_ID;
    const targetId = TARGET_ID;
    const initialSource = await beadPoint(page, sourceId);
    await page.touchscreen.tap(initialSource.x, initialSource.y);
    await waitForDraft(page, "attending");
    await page.getByTestId("intention-ground").tap();
    await waitForDraft(page, "armed");

    const source = await beadPoint(page, sourceId);
    const target = await beadPoint(page, targetId);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: source.x, y: source.y, id: 1, force: 0.5 }],
    });
    await expect.poll(async () => (await snapshot(page)).weaving).toBe(true);
    await page.evaluate(() => window.__gbgTest!.advanceClock(140));
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: target.x, y: target.y, id: 1, force: 0.7 }],
    });
    await expect
      .poll(async () => (await snapshot(page)).snappedConceptId)
      .toBe(targetId);
    await page.evaluate(() => window.__gbgTest!.advanceClock(140));
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await waitForDraft(page, "inactive");
    const committed = (await snapshot(page)).domainSession.threads[0];
    expect(committed).toMatchObject({
      pair: [sourceId, targetId],
      intention: "ground",
      inputModality: "touch",
    });
    expect(committed.gesture).toMatchObject({
      inputModality: "touch",
      durationMs: 280,
    });
    expect(committed.gesture.pathLengthViewport).toBeGreaterThan(0);
    expect(committed.gesture.pressure).toBeGreaterThanOrEqual(0);
    expect(committed.gesture.pressure).toBeLessThanOrEqual(1);
  } finally {
    await context.close();
  }
});

test("cancellation steps back and pointer loss never commits", async ({ page }) => {
  await openSession(page);
  const sourceId = SOURCE_ID;
  await page.getByTestId(`bead-control-${sourceId}`).focus();
  await page.keyboard.press("Enter");
  await page.getByTestId("intention-tension").click();
  await waitForDraft(page, "armed");

  const source = await beadPoint(page, sourceId);
  await page.evaluate(() => {
    window.addEventListener(
      "pointerdown",
      (event) => {
        document.documentElement.dataset.testPointerId = String(event.pointerId);
      },
      { capture: true, once: true }
    );
  });
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).weaving).toBe(true);
  const pointerId = Number(
    await page.locator("html").getAttribute("data-test-pointer-id")
  );
  await page.evaluate((activePointerId) => {
    window.dispatchEvent(
      new PointerEvent("pointercancel", { pointerId: activePointerId })
    );
  }, pointerId);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).weaving).toBe(false);
  expect((await snapshot(page)).draftStage).toBe("armed");
  expect((await snapshot(page)).domainSession.eventCount).toBe(2);

  await page.getByTestId(`bead-control-${TARGET_ID}`).focus();
  await page.keyboard.press("Enter");
  await waitForDraft(page, "candidate-selected");
  const candidateEventCount = (await snapshot(page)).domainSession.eventCount;
  await page.keyboard.press("Escape");
  await waitForDraft(page, "armed");
  expect((await snapshot(page)).domainSession.eventCount).toBe(
    candidateEventCount
  );
  await page.keyboard.press("Escape");
  await waitForDraft(page, "attending");
  await page.keyboard.press("Escape");
  await waitForDraft(page, "inactive");
  expect((await snapshot(page)).domainSession.eventCount).toBe(2);
});

test("canonical replay reload preserves the committed web", async ({ page }) => {
  const committed = (await composeWithMouse(page, await openSession(page))).snapshot;
  const canonicalBefore = await page.evaluate(() =>
    window.__gbgTest!.canonicalEventLog()
  );
  const reloaded = await page.evaluate(() => window.__gbgTest!.reloadCanonical());
  const canonicalAfter = await page.evaluate(() =>
    window.__gbgTest!.canonicalEventLog()
  );
  expect(canonicalAfter).toBe(canonicalBefore);
  expect(reloaded.domainSession).toEqual(committed.domainSession);
});

test("the declared seed and disciplines reproduce the same draw", async ({
  page,
}) => {
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
