import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STATION_SIZE, UTILITY_SIZE, plateGeometry } from "./framing";

/**
 * GAP-12 and IMP-3 — WHAT THE PLATE IS AIMED AT, AND WHAT IT SITS ON
 *
 * Both were measured against the running build at 1280x720, seed
 * castalia-golden-001, with Fibonacci Sequence attended.
 *
 * GAP-12. The plate appeared 18 ms after the press at (170, 201), was carried
 * to (-18, 258) — more than half of it off the left edge of the viewport — and
 * only came to rest at (423, 293) after three and a half seconds, 294 px from
 * where it opened and 622 px along its path. Everything the player could aim at
 * was travelling for the whole of that, because attending performs a camera
 * lean and the plate is anchored to a bead in the world.
 *
 * IMP-3. The Prime Numbers bead sat 53 px from the attended bead — inside the
 * 86 px graduated ring, and 33 px from the centre of the Ground station, whose
 * own hit box is 48 px across. The ring's engraving ran straight through it.
 * And the two utilities were 44 px chips against the verbs' 48 px, with the
 * same rule, the same fill and the same blur: six near-identical discs of which
 * four were the interpretation and two were housekeeping.
 */

const source = (): string =>
  readFileSync(new URL("./IntentionConstellation.tsx", import.meta.url), "utf8");

describe("the intention plate", () => {
  it("opens in the pose it will be aimed at, not while the camera travels", () => {
    const text = source();
    // The gate itself, and the only thing that opens it.
    expect(text).toContain("frameState.cameraSettled");
    expect(text).toMatch(/if \(!posed\) return <group ref=\{anchor\} \/>;/);
    // Latched: once open it may not be taken away again by a later phrase —
    // the breath on arming would otherwise close the plate mid-interpretation.
    expect(text).toMatch(/if \(!posed\) \{[\s\S]{0,320}setPosed\(true\)/);
    expect(text).toMatch(/\}, \[attendedId\]\);/);
  });

  it("waits more than one frame, because the flag it reads is a frame old", () => {
    // `CameraRig` writes `cameraSettled` from its own frame callback and this
    // component's runs first, so on the frame an attend is committed the flag
    // still carries the previous frame's answer. Reading it once would open the
    // plate exactly where the defect wanted it.
    const text = source();
    expect(text).toMatch(/POSE_SETTLE_FRAMES = ([2-9]|\d\d)/);
    expect(text).toContain("settledFrames.current >= POSE_SETTLE_FRAMES");
  });

  it("clears a radius rather than being struck over the beads inside it", () => {
    const text = source();
    // A ground of the world's own colour, drawn before the engraving so the
    // engraving is not dimmed by it.
    expect(text).toContain("radialGradient");
    expect(text).toContain('data-testid="intention-plate-ground"');
    const ground = text.indexOf('data-testid="intention-plate-ground"');
    const engraved = text.indexOf("stroke={rule}");
    expect(ground).toBeGreaterThan(-1);
    expect(ground).toBeLessThan(engraved);
    // Transparent where the attended bead is: the plate dims its neighbours,
    // never its subject.
    expect(text).toMatch(/offset="0%"[\s\S]{0,80}stopOpacity=\{0\}/);
  });

  it("draws the two utilities as a smaller, quieter class than the verbs", () => {
    const text = source();
    // The mark is materially smaller than a verb station …
    const mark = /h-\[(\d+)px\] w-\[(\d+)px\]/.exec(text);
    expect(mark).not.toBeNull();
    const drawn = Number(mark![1]);
    expect(drawn).toBeLessThan(STATION_SIZE * 0.7);
    // … and does not carry the verb's fill, shadow or blur.
    expect(text).not.toMatch(
      /world-cancel-interpretation[\s\S]{0,600}shadow-\[/
    );
    expect(text).not.toMatch(
      /world-cancel-interpretation[\s\S]{0,600}backdrop-blur/
    );
    // The *target* is untouched: the clearance law in framing.ts is measured
    // against a fingertip, and shrinking a hit box to make a hierarchy read is
    // how two targets become one.
    expect(text).toContain("...utilitySize");
    const plate = plateGeometry(1280, false);
    expect(plate.utility).toBe(UTILITY_SIZE);
    expect(drawn).toBeLessThan(plate.utility);
  });
});
