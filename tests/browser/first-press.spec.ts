import { expect, test } from "@playwright/test";

/**
 * B4 — THE FIRST PRESS OF BEGIN FROZE THE MAIN THREAD FOR TWO SECONDS
 *
 * An in-page rAF recorder on a cold profile, headed, on a real GPU: the worst
 * frame gap after the first press was 2236, 1956 and 2140 ms over three cold
 * runs, beginning about 140 ms after the press. A CDP screenshot asked for at
 * +40 ms did not come back until +2392 ms. In a *warm* browser process the same
 * press costs 33 ms — so the freeze belonged to the first-time player alone,
 * which is the only player whose next decision is whether to continue.
 *
 * Instrumenting the GL context named it exactly. Four programs are linked in
 * answer to the press, and the bead glass — whose fragment shader solves a
 * sphere, marches a refracted chord through it and draws an authored figure
 * inside — blocks for 1914 ms inside `getProgramInfoLog`: three.js at the first
 * draw, waiting for a link the driver has not finished.
 *
 * WHY THIS TEST WATCHES THE LINK AND NOT ONLY THE CLOCK.
 *
 * The freeze is a *cold* phenomenon, and a Playwright run shares one warm
 * browser process across its tests, so a wall-clock assertion alone would pass
 * against the broken build about as often as against the fixed one. What is
 * true on every renderer, warm or cold, headed or software, is the *ordering*:
 * the program the arena is drawn with is either linked while the title is up or
 * it is linked in answer to the press. This asserts the ordering, and keeps a
 * frame-gap assertion beside it scaled to the frame rate this machine actually
 * managed before the press, so it means the same thing at 60 fps and at 3.
 */

/** Only the bead glass's fragment shader contains this. See scene/glass.ts. */
const GLASS_MARK = "gbgSphereDeviation";

/**
 * How much of the press is "the opening". The freeze began 140 ms after the
 * press and ran for two seconds, so two seconds is comfortably the whole of it.
 */
const OPENING_MS = 2000;

/**
 * Frames the opening must contain before its worst gap is worth asserting on.
 * The ordering check below is renderer-independent and is the actual guard; a
 * frame-gap budget is only meaningful on a renderer that paints often enough to
 * have gaps. Headless, on the software rasteriser, the whole opening contained
 * a single frame — there is no gap to measure there, and pretending otherwise
 * would be a flaky test rather than a strict one.
 */
const SAMPLEABLE_FRAMES = 5;

interface PressReport {
  /** Glass programs linked before the press — the warm-up's whole purpose. */
  readonly glassLinkedBeforePress: number;
  /**
   * Glass programs linked during the opening that the title had *already*
   * linked — the defect, and nothing else.
   *
   * Not simply "links during the opening": the quality tier answers the device
   * from sustained frame samples, and on a renderer slow enough to earn a
   * demotion it rebuilds the glass with different `#define`s. Measured headless
   * on the software rasteriser, that lands 617 ms after the press, with
   * `GBG_STEPS 1 … GBG_ENGRAVED 1` against the title's `GBG_STEPS 9 …
   * GBG_ENGRAVED 0`. That is a device being answered, which is a mechanism the
   * arena is supposed to have. Re-linking a build the title already made is
   * not.
   */
  readonly openingRelinks: number;
  readonly worstGapInOpeningMs: number;
  readonly medianGapBeforePressMs: number;
  readonly medianGapSettledMs: number;
  readonly framesInOpening: number;
  /** Every glass link, as (ms from the press, tier defines). For the report. */
  readonly glassLinks: ReadonlyArray<readonly [number, string]>;
}

declare global {
  interface Window {
    __gbgPress?: {
      frames: number[];
      glassLinks: number[];
      glassDefines: string[];
      press: number | null;
    };
  }
}

test.describe("the first press of BEGIN", () => {
  test("does not pay for what the title could have paid for", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    await page.addInitScript((mark: string) => {
      const state = {
        frames: [] as number[],
        glassLinks: [] as number[],
        glassDefines: [] as string[],
        press: null as number | null,
      };
      window.__gbgPress = state;

      const tick = (): void => {
        state.frames.push(performance.now());
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      window.addEventListener(
        "pointerdown",
        () => {
          if (state.press === null) state.press = performance.now();
        },
        { capture: true }
      );

      // Which program is which, by the source that was attached to it.
      const sources = new WeakMap<WebGLShader, string>();
      const shaders = new WeakMap<WebGLProgram, WebGLShader[]>();
      const proto = WebGL2RenderingContext.prototype;
      const shaderSource = proto.shaderSource;
      proto.shaderSource = function (shader: WebGLShader, source: string) {
        sources.set(shader, source);
        return shaderSource.call(this, shader, source);
      };
      const attachShader = proto.attachShader;
      proto.attachShader = function (program: WebGLProgram, shader: WebGLShader) {
        const list = shaders.get(program) ?? [];
        list.push(shader);
        shaders.set(program, list);
        return attachShader.call(this, program, shader);
      };
      const linkProgram = proto.linkProgram;
      proto.linkProgram = function (program: WebGLProgram) {
        const attached = shaders.get(program) ?? [];
        const glass = attached
          .map((shader) => sources.get(shader) ?? "")
          .find((source) => source.includes(mark));
        if (glass !== undefined) {
          state.glassLinks.push(performance.now());
          // The tier's `#define`s, so a rebuild can be told from a first build.
          state.glassDefines.push((glass.match(/#define GBG_\w+ \d+/g) ?? []).join(" "));
        }
        return linkProgram.call(this, program);
      };
    }, GLASS_MARK);

    // No test mode: this is the door a stranger is offered, not the adapter.
    await page.goto("/");

    // The door is not offered until the world behind it exists, so waiting for
    // it *is* waiting for the warm-up. It carries `aria-hidden` until then, so
    // a role query cannot find it early.
    const begin = page.getByRole("button", { name: /begin/i });
    await begin.waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(750);

    const box = await begin.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();

    await page.waitForTimeout(4_000);

    const report = await page.evaluate((opening: number): PressReport => {
      const state = window.__gbgPress;
      if (!state || state.press === null) {
        throw new Error("the press was never recorded");
      }
      const press = state.press;
      const gapsOf = (times: number[]): number[] => {
        const gaps: number[] = [];
        for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
        return gaps;
      };
      const median = (values: number[]): number => {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      };
      const before = state.frames.filter((t) => t < press);
      const inOpening = state.frames.filter(
        (t) => t >= press && t <= press + opening
      );
      // The frame before the press belongs to the opening's first gap: it is
      // the gap the player is waiting through.
      const last = before[before.length - 1];
      const spanning = last === undefined ? inOpening : [last, ...inOpening];
      // What this machine manages once the arena is up and settled — the honest
      // yardstick on a renderer that cannot hold 60 Hz in the first place.
      const settled = state.frames.filter((t) => t > press + opening);
      // Every build of the glass the title had already paid for.
      const warmed = new Set(
        state.glassDefines.filter((_, i) => state.glassLinks[i] < press)
      );
      return {
        glassLinkedBeforePress: state.glassLinks.filter((t) => t < press).length,
        openingRelinks: state.glassLinks.filter(
          (t, i) =>
            t >= press &&
            t <= press + opening &&
            warmed.has(state.glassDefines[i] ?? "")
        ).length,
        worstGapInOpeningMs: Math.max(0, ...gapsOf(spanning)),
        medianGapBeforePressMs: median(gapsOf(before)),
        medianGapSettledMs: median(gapsOf(settled)),
        framesInOpening: inOpening.length,
        glassLinks: state.glassLinks.map(
          (t, i) => [Math.round(t - press), state.glassDefines[i] ?? ""] as const
        ),
      };
    }, OPENING_MS);

    console.log(`first press: ${JSON.stringify(report)}`);

    // The title was live and the press landed.
    expect(report.medianGapBeforePressMs).toBeGreaterThan(0);
    expect(report.framesInOpening).toBeGreaterThan(0);

    // THE ORDERING, which holds on every renderer. The glass is linked while
    // the title is up…
    expect(report.glassLinkedBeforePress).toBeGreaterThan(0);
    // …and the opening re-links none of it: the arena is drawn with programs
    // that already exist.
    expect(report.openingRelinks).toBe(0);

    // AND THE CLOCK, where there is a clock worth reading — scaled to what this
    // machine was managing on either side of the opening, so the assertion
    // means the same thing on a GPU and on a software renderer. On the broken
    // build this was 1956–2236 ms against a 16.7 ms median.
    if (report.framesInOpening >= SAMPLEABLE_FRAMES) {
      const pace = Math.max(
        report.medianGapBeforePressMs,
        report.medianGapSettledMs
      );
      expect(report.worstGapInOpeningMs).toBeLessThanOrEqual(
        Math.max(250, pace * 6)
      );
    }

    await context.close();
  });
});
