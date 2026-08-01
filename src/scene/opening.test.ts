import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACKNOWLEDGE_FRAMES,
  ACKNOWLEDGE_MS,
  HOME_ELEVATION,
  OPENING_DURATION_MS,
  OPENING_LINES,
  TITLE_AZIMUTH,
  TITLE_DOLLY,
  TITLE_ELEVATION,
  acknowledgementMs,
  openingStep,
} from "./opening";

/**
 * A4 — PRESSING BEGIN HAS TO DO SOMETHING
 *
 * Frame-diffed from a CDP screencast of the shipped build: 0.3% of pixels
 * changed in the first 808 ms after the press, 2.2% by 2200 ms, and every one
 * of the largest deltas in that window was a star twinkling. The title began to
 * dim at about 2.6 seconds. Two and a half seconds of nothing, in answer to the
 * only decision the title screen asks the player to make.
 */

const read = (file: string): string =>
  readFileSync(new URL(file, import.meta.url), "utf8");

const appSource = (): string => read("../App.tsx");
const titleSource = (): string => read("../ui/screens/TitleScreen.tsx");
const rigSource = (): string => read("./CameraRig.tsx");

describe("the opening", () => {
  it("answers the press well inside the window a player allows", () => {
    expect(ACKNOWLEDGE_MS).toBeLessThanOrEqual(120);
    // The form of the budget that survives contact with hardware: the press is
    // answered on the next painted frame, whatever the frame rate is.
    expect(ACKNOWLEDGE_FRAMES).toBeLessThanOrEqual(2);
    // The first line starts moving on the frame the press is painted.
    expect(acknowledgementMs()).toBe(0);
    expect(acknowledgementMs()).toBeLessThan(ACKNOWLEDGE_MS);
    // …and the whole block is in motion inside a fifth of a second, so the
    // stagger reads as one gesture unthreading rather than as five decisions.
    expect(openingStep(OPENING_LINES - 1).delay * 1000).toBeLessThan(200);
  });

  it("answers the press on the way down, not on the release", () => {
    // Traced on the running build: `pointerdown` at 0 ms, a frame painted at
    // 4 ms with nothing changed, and `click` — which cannot be dispatched until
    // the finger comes up — not until 227 ms. A fifth of a second of silence in
    // answer to a decision the player had already made.
    const source = titleSource();
    expect(source).toMatch(/onPointerDown=\{[\s\S]{0,200}answer\(\)/);
    // The keyboard's door is still the click, and arriving twice is a no-op.
    expect(source).toContain("onClick={answer}");
    expect(source).toContain("if (pressed.current) return;");
  });

  it("answers it with an animation the compositor owns, not a transition", () => {
    // Measured six ways against the running build, and every route through
    // React, the motion library, or a CSS transition lost the frame: scheduling
    // `startSession` from the handler answered after 741 ms, deferring two
    // frames 725 ms, waiting for the library's own Web Animation 600 ms — and a
    // plain inline-style transition committed alongside `setOpening(true)` had
    // *still not started* two painted frames and 467 ms after the style landed,
    // because a transition is begun by the main thread during a rendering
    // update and the rendering update is what the session build is standing on.
    //
    // `Element.animate()` is timed from the moment it is created and handed to
    // the compositor, so it is already running before the draw is built.
    const source = titleSource();
    expect(source).toContain("strike.current");
    expect(source).toMatch(/element\.animate\(/);
    // Nothing that answers the press may be a style React commits: no inline
    // transition anywhere, and no `willChange` left behind to imply one.
    expect(source).not.toMatch(/transition:\s*[`"']transform/);
    expect(source).not.toContain("willChange");
    // The answer comes before the state change, and the draw comes after both.
    // Measured against the code and not the commentary, which names all three.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const ack = code.indexOf("strikeNow(strike.current)");
    const flip = code.indexOf("setOpening(true)");
    const build = code.indexOf("startSession()");
    expect(ack).toBeGreaterThan(-1);
    expect(flip).toBeGreaterThan(ack);
    expect(build).toBeGreaterThan(flip);
    // …and the draw is still deferred behind a paint, so the departure of the
    // type is under way before the main thread is taken.
    expect(source).toContain("requestAnimationFrame");
    expect(source).not.toMatch(/onClick=\{\(\) => startSession\(\)\}/);
  });

  it("starts that animation at the press rather than at the next commit", () => {
    // A new Web Animation is *pending* until the compositor takes it, and until
    // then it has no start time and contributes nothing. Traced on the running
    // build: two frames painted, at 8 ms and 257 ms, with both animations
    // `running` and `startTime: null` — they were only started around 475 ms,
    // when the main thread came back from building the draw. Anchoring the
    // start time resolves the pending play at once, and the first frame painted
    // after the press then showed the rule already 96% struck.
    const source = titleSource();
    expect(source).toContain("document.timeline.currentTime");
    expect(source).toContain("animation.startTime = now");
  });

  it("degrades to silence where there is no animation to give", () => {
    // A refusal, not a throw: `Element.animate` is absent in more places than
    // it is worth pretending otherwise, and an acknowledgement that crashes the
    // door is worse than one that does not appear.
    const source = titleSource();
    expect(source).toContain('typeof element.animate !== "function"');
  });

  it("carries the type out instead of dissolving it", () => {
    // One opacity ramp on the whole block reads as the page being switched off.
    // Every line travels, every line is scaled, and they leave in order.
    let previousDelay = -1;
    for (let i = 0; i < OPENING_LINES; i++) {
      const step = openingStep(i);
      expect(step.lift).toBeGreaterThan(0);
      expect(step.scale).toBeGreaterThan(1);
      expect(step.delay).toBeGreaterThan(previousDelay);
      previousDelay = step.delay;
    }
    // The block unthreads: the epigraph at the top goes furthest.
    expect(openingStep(0).lift).toBeGreaterThan(
      openingStep(OPENING_LINES - 1).lift
    );
    expect(titleSource()).toContain("y: `-${step.lift}rem`");
  });

  it("does not queue the two halves of one move", () => {
    // `AnimatePresence mode="wait"` held the arena's chrome until the title had
    // finished leaving, so the camera arrived at an empty page.
    const source = appSource();
    expect(source).toContain("<AnimatePresence>");
    expect(source).not.toContain('mode="wait"');
  });

  it("gives the opening an azimuth, not just a dolly", () => {
    // (0, 0.5, 15.2) to (0, 0.85, 10.4) is a pure push-in — the one camera move
    // a viewer is worst at perceiving, and it was performed behind an empty sky
    // with nothing in it that had parallax.
    expect(Math.abs(TITLE_AZIMUTH)).toBeGreaterThan(0.35);
    expect(TITLE_DOLLY).toBeGreaterThan(1.15);
    // The move changes the level as well as the bearing, so the lattice opens
    // rather than sliding.
    expect(Math.abs(TITLE_ELEVATION - HOME_ELEVATION)).toBeGreaterThan(0.05);
    expect(rigSource()).toContain("TITLE_AZIMUTH * away");
    // And the old hard-coded poses are gone: every pose is solved from the
    // composition now, so the title and the arena cannot disagree about where
    // the world is.
    expect(rigSource()).not.toContain("new THREE.Vector3(0, 0.5, 15.2)");
    expect(rigSource()).not.toContain("new THREE.Vector3(0, 0.85, 10.4)");
  });

  it("stands the instrument in the title frame for the move to act on", () => {
    // The armillary used to return null until a session had beads.
    const armillary = read("./Armillary.tsx");
    expect(armillary).not.toContain("if (!beadIds || beadIds.length === 0) return null;");
    expect(armillary).toContain("THE INSTRUMENT EXISTS BEFORE THE DRAW DOES");
  });

  it("keeps the departure short enough to be one gesture", () => {
    // Long enough to be a move, short enough that the arena is not waited for.
    expect(OPENING_DURATION_MS).toBeGreaterThan(500);
    expect(OPENING_DURATION_MS).toBeLessThan(1200);
  });
});
