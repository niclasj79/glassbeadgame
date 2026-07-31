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

  it("answers the press from the DOM, not from a scheduler", () => {
    // Measured four ways against the running build, every route through React
    // or the motion library lost the frame: scheduling `startSession` from the
    // handler answered after 741 ms, deferring two frames 725 ms, and waiting
    // for the library's own Web Animation 600 ms — because the animation is
    // created on a frame the session build is already sitting in.
    //
    // The answer is a style write in the handler itself, on an element the
    // motion library does not own, with a CSS transition on it. That starts at
    // the next style flush and runs on the compositor, and nothing on the main
    // thread afterwards can delay it.
    const source = titleSource();
    expect(source).toContain('rule.style.transform = "scaleX(1)"');
    expect(source).toContain("strike.current");
    // The write comes before the state change, and the draw comes after both.
    const write = source.indexOf("rule.style.transform");
    const flip = source.indexOf("setOpening(true)");
    const build = source.indexOf("startSession()");
    expect(write).toBeGreaterThan(-1);
    expect(flip).toBeGreaterThan(write);
    expect(build).toBeGreaterThan(flip);
    // …and the draw is still deferred behind a paint, so the departure of the
    // type is under way before the main thread is taken.
    expect(source).toContain("requestAnimationFrame");
    expect(source).not.toMatch(/onClick=\{\(\) => startSession\(\)\}/);
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
