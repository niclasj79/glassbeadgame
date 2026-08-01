import { expect, test, type Page } from "@playwright/test";
import type { DisciplineId } from "../../src/content/types";
import type { TestSessionSnapshot } from "../../src/runtime/testMode";

/**
 * THREE THINGS A SIGHTED PLAYER COULD NOT DO, MEASURED IN THE RUNNING BUILD
 *
 * All three were found by a critic driving the real thing on a real GPU with a
 * fresh profile, and all three were reproduced here before they were fixed.
 *
 * VC-02. Nothing visible ever told a player what to do. Every string the build
 * owns — "Choose a bead to Attend.", "Hold and release to Weave" — is placed at
 * x = -1 for assistive technology, so the only text on screen was "The Lens"
 * and "Conclude". The world has to make the offer itself: the pointer must
 * change over a bead, and a hover must be an unmissable change at rest scale.
 *
 * B2. The intention plate was unavailable for about 3.5 s after the press that
 * demanded it: a click set attention, the live region said "Choose an
 * intention", and there was nothing on screen to choose from.
 *
 * B1. Two beads rendered as one object — Coupled Pendulums and Diffraction
 * stood 19.7 px apart on a 1280x720 frame with a drawn radius of about 19 px —
 * and the occluded one had no name and could not be clicked. A bead the player
 * cannot reach is a concept removed from the Game without saying so.
 *
 * This suite runs against the deterministic adapter but *without* reduced
 * motion, because the camera phrase and the world's own answer are exactly what
 * is under test.
 */

const PICKS: DisciplineId[] = ["mathematics", "music", "art"];

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
  await settle(page);
  return initial;
}

/** Wait until the arena will answer honestly about where a bead is. */
async function settle(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const test = window.__gbgTest;
          if (!test) return false;
          const screen = test.beadScreen(test.beadIds()[0]);
          return Boolean(screen && !screen.behind);
        }),
      { timeout: 30_000 }
    )
    .toBe(true);
}

async function beadPoint(page: Page, id: string): Promise<Point> {
  await settle(page);
  const result = await page.evaluate(
    (conceptId) => window.__gbgTest!.beadScreen(conceptId),
    id
  );
  if (!result || result.behind) throw new Error(`bead ${id} is not on screen`);
  return { x: result.x, y: result.y };
}

async function onScreen(page: Page): Promise<{ id: string; x: number; y: number }[]> {
  await settle(page);
  return page.evaluate(() =>
    window
      .__gbgTest!.beadIds()
      .map((id) => ({ id, screen: window.__gbgTest!.beadScreen(id) }))
      .filter((bead) => bead.screen !== null && !bead.screen.behind)
      .map((bead) => ({ id: bead.id, x: bead.screen!.x, y: bead.screen!.y }))
  );
}

test("every bead in the draw is a separate thing to look at and to press", async ({
  page,
}) => {
  const initial = await openSession(page);
  const beads = await onScreen(page);
  expect(beads).toHaveLength(initial.beadIds.length);

  /**
   * The drawn silhouette is about 37 px across at this viewport and this
   * distance. Two beads closer than that are one bead whatever the layout
   * intended; the measured pair stood 19.7 px apart on this exact frame.
   */
  for (let i = 0; i < beads.length; i++) {
    for (let j = i + 1; j < beads.length; j++) {
      const apart = Math.hypot(beads[i].x - beads[j].x, beads[i].y - beads[j].y);
      expect(
        apart,
        `${beads[i].id} and ${beads[j].id} are drawn inside one silhouette`
      ).toBeGreaterThan(38);
    }
  }

  // …and every one of them answers the pointer as itself.
  for (const bead of beads) {
    const at = await beadPoint(page, bead.id);
    await page.mouse.move(at.x, at.y, { steps: 3 });
    await page.mouse.down();
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.__gbgTest!.snapshot()))
            .draftAttendedConceptId
      )
      .toBe(bead.id);
    await page.keyboard.press("Escape");
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.__gbgTest!.snapshot())).draftStage
      )
      .toBe("inactive");
  }
});

test("the pointer says a bead is a thing you may touch", async ({ page }) => {
  const initial = await openSession(page);
  const cursor = () =>
    page.evaluate(
      () => document.querySelector("canvas")?.style.cursor || "(none)"
    );

  await page.mouse.move(1240, 700);
  await page.waitForTimeout(120);
  expect(await cursor()).toBe("(none)");

  const at = await beadPoint(page, initial.beadIds[0]);
  await page.mouse.move(at.x, at.y, { steps: 6 });
  await expect.poll(cursor).toBe("pointer");

  // …and it still says so after the press, with the pointer still on the bead.
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(150);
  expect(await cursor()).toBe("pointer");

  await page.mouse.move(1240, 700, { steps: 6 });
  await expect.poll(cursor).toBe("(none)");
});

test("the press raises the intention ring, at once and where it will stay", async ({
  page,
}) => {
  const initial = await openSession(page);
  const at = await beadPoint(page, initial.beadIds[0]);
  await page.mouse.move(at.x, at.y, { steps: 3 });

  // Sampled inside the page on every animation frame, from before the press:
  // asking across the wire would measure the plate long after it opened, which
  // is precisely the window the defect lived in.
  await page.evaluate(() => {
    const probe = {
      down: 0,
      downFrame: 0,
      frame: 0,
      /** How long a frame of the world takes on this machine, in ms. */
      interval: [] as number[],
      samples: [] as {
        t: number;
        frame: number;
        x: number;
        y: number;
        w: number;
        h: number;
      }[],
    };
    (window as unknown as { __ring: typeof probe }).__ring = probe;
    window.addEventListener(
      "pointerdown",
      () => {
        probe.down = performance.now();
        probe.downFrame = probe.frame;
      },
      { capture: true, once: true }
    );
    const started = performance.now();
    let previous = started;
    const tick = () => {
      const now = performance.now();
      probe.frame += 1;
      probe.interval.push(now - previous);
      previous = now;
      const rect = document
        .querySelector('[data-testid="intention-constellation"]')
        ?.getBoundingClientRect();
      if (rect && rect.width > 0) {
        probe.samples.push({
          t: now,
          frame: probe.frame,
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          w: rect.width,
          h: rect.height,
        });
      }
      if (now - started < 6_000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await page.mouse.down();
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__gbgTest!.snapshot())).draftStage
    )
    .toBe("attending");
  await page.waitForTimeout(3_500);

  const ring = await page.evaluate(
    () =>
      (
        window as unknown as {
          __ring: {
            down: number;
            downFrame: number;
            interval: number[];
            samples: {
              t: number;
              frame: number;
              x: number;
              y: number;
              w: number;
              h: number;
            }[];
          };
        }
      ).__ring
  );
  expect(ring.samples.length).toBeGreaterThan(3);

  /**
   * THE ASSERTION THE BLOCKER ASKED FOR: the stations are on screen within a
   * fifth of a second of the press that demands them — measured on the real
   * thing at 115 ms, against about 3.5 s before the fix.
   *
   * The bound is stated in frames as well, because CI renders this scene in
   * software at a few frames a second and a promise about milliseconds is a
   * promise about the GPU. Both numbers are the same law: the plate opens in
   * the pose the press was made in, which is the very next frame or two.
   */
  const median = [...ring.interval].sort((a, b) => a - b)[
    Math.floor(ring.interval.length / 2)
  ];
  expect(ring.samples[0].frame - ring.downFrame).toBeLessThanOrEqual(6);
  expect(ring.samples[0].t - ring.down).toBeLessThan(Math.max(200, median * 6));

  // …and they are still where they opened, so the plate is aimable the whole
  // time (GAP-12: it used to travel 294 px over three and a half seconds).
  const opened = ring.samples[0];
  const rested = ring.samples[ring.samples.length - 1];
  expect(Math.hypot(rested.x - opened.x, rested.y - opened.y)).toBeLessThan(8);

  // …and at no point was any of it drawn off the page.
  const viewport = page.viewportSize()!;
  for (const sample of ring.samples) {
    expect(sample.x - sample.w / 2).toBeGreaterThan(-1);
    expect(sample.x + sample.w / 2).toBeLessThan(viewport.width + 1);
    expect(sample.y - sample.h / 2).toBeGreaterThan(-1);
    expect(sample.y + sample.h / 2).toBeLessThan(viewport.height + 1);
  }

  // The four verbs are real targets under the finger, not merely present.
  const under = await page.evaluate(() =>
    ["echo", "passage", "tension", "ground"].map((intention) => {
      const rect = document
        .querySelector(`[data-testid="intention-${intention}"]`)
        ?.getBoundingClientRect();
      if (!rect || rect.width === 0) return `${intention}:missing`;
      const element = document.elementFromPoint(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2
      );
      const owner = element
        ?.closest("[data-world-intention]")
        ?.getAttribute("data-world-intention");
      return `${intention}:${owner ?? "blocked"}`;
    })
  );
  expect(under).toEqual([
    "echo:echo",
    "passage:passage",
    "tension:tension",
    "ground:ground",
  ]);
});

test("the plate stays reachable on a phone, where the page cannot hold it", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 414, height: 896 },
  });
  const page = await context.newPage();
  try {
    const initial = await openSession(page);
    // The bead nearest an edge is the one the plate cannot be centred on.
    const beads = await onScreen(page);
    expect(beads.length).toBe(initial.beadIds.length);
    const edge = beads.reduce((worst, bead) =>
      Math.min(bead.x, 414 - bead.x) < Math.min(worst.x, 414 - worst.x)
        ? bead
        : worst
    );

    await page.touchscreen.tap(edge.x, edge.y);
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.__gbgTest!.snapshot()))
            .draftAttendedConceptId
      )
      .toBe(edge.id);
    await expect(page.getByTestId("intention-echo")).toBeVisible();

    const stations = await page.evaluate(() =>
      ["echo", "passage", "tension", "ground"].map((intention) => {
        const rect = document
          .querySelector(`[data-testid="intention-${intention}"]`)
          ?.getBoundingClientRect();
        if (!rect || rect.width === 0) return `${intention}:missing`;
        const inside =
          rect.x >= 0 &&
          rect.y >= 0 &&
          rect.x + rect.width <= window.innerWidth &&
          rect.y + rect.height <= window.innerHeight;
        const element = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2
        );
        const owner = element
          ?.closest("[data-world-intention]")
          ?.getAttribute("data-world-intention");
        return `${intention}:${owner ?? "blocked"}:${inside ? "on" : "OFF"}`;
      })
    );
    expect(stations).toEqual([
      "echo:echo:on",
      "passage:passage:on",
      "tension:tension:on",
      "ground:ground:on",
    ]);
  } finally {
    await context.close();
  }
});
