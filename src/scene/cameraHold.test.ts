import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * GAP-2 — A DRAG FROM A BEAD THREW THE WHOLE INSTRUMENT OUT OF FRAME
 *
 * Reproduced deterministically against the running build at 1280x720: press a
 * bead, drag 40 px, hold. The camera was carried from (0.02, 0.94, 11.14) to
 * (12.25, 4.29, -2.17) — a hundred degrees round the instrument — and *kept the
 * orientation it had*. All twelve beads left the frame, the intention plate's
 * element measured 0x0 because drei hides an `Html` whose anchor is behind the
 * lens, and `document.elementFromPoint` under the finger returned the bare
 * canvas. Everything came back on release. A 90 px drag from empty sky did
 * nothing of the kind.
 *
 * The cause is one line of drei: `useFrame(() => { if (controls.enabled)
 * controls.update() })`. `OrbitControls.update()` is the only thing in the
 * scene that calls `camera.lookAt(target)`, and `threading.beginGesture`
 * disables the controls for the whole of every scene gesture — so a pose
 * written between the press and the release translates the camera without ever
 * re-aiming it. Attending is exactly such a pose: pulling on an unarmed bead
 * opens it, and opening it performs the attend lean.
 *
 * The camera is therefore *held* for as long as a gesture owns it, which is the
 * hold the weaving branch has always taken through `frameState.aim.active`,
 * now stated once and applied to every gesture.
 *
 * M2-012 — THE HOLD DEFERS; IT NO LONGER ABANDONS.
 *
 * A pose queued during the hold used to be dropped, so the intention plate
 * opened round the pressed bead in the pose the press was made in. The plate
 * has left the attended bead (I-016), and under the focus view a tap *is* the
 * Attend the camera must answer by closing in (I-017) — dropping the pose left
 * every pointer Attend unanswered. So the pose now waits for the hand: nothing
 * moves the camera while the hold stands, which is all GAP-2 ever needed, and
 * the move is made once the controls are aiming the camera again.
 */

const rigSource = (): string =>
  readFileSync(new URL("./CameraRig.tsx", import.meta.url), "utf8");

describe("the camera while a gesture owns it", () => {
  it("states the hold as one law, over both ways of owning the sightline", () => {
    // The controls being off is the new half: nothing is calling `lookAt`, so
    // nothing may move the camera. Weaving is the half that already existed,
    // and it still holds with the controls back on — that is the recoil.
    //
    // Stated against the source rather than by calling it: importing the rig
    // pulls the whole renderer, the post-processing stack and a GPU probe into
    // a node suite, which costs nine seconds and answers nothing this does not.
    // The behaviour itself is held by `tests/browser/gesture-holds-the-world`.
    expect(rigSource()).toMatch(
      /function cameraIsHeld\([\s\S]{0,220}return !controlsEnabled \|\| aiming;/
    );
  });

  it("takes the hold before anything in the frame can move the camera", () => {
    const source = rigSource();
    const hold = source.indexOf("cameraIsHeld(ctl.enabled");
    const write = source.indexOf("state.camera.position.copy");
    expect(hold).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(hold);
  });

  it("keeps a pose queued during the gesture for when the hand lets go", () => {
    // The hold block moves nothing and drops nothing: it returns before the
    // transit, and the goal it leaves in place is travelled on release.
    const source = rigSource();
    const hold = source.indexOf("cameraIsHeld(ctl.enabled");
    const closes = source.indexOf("return;", hold);
    const block = source.slice(hold, closes);
    expect(block).not.toContain("goal.current = null");
    expect(block).not.toContain("camera.position.copy");
    // …and the transit that makes the move comes after the hold, so it can
    // only ever run with the controls aiming the camera again.
    expect(source.indexOf("dampOrbitToward(", closes)).toBeGreaterThan(closes);
  });

  it("reports a held camera as settled only when no move is waiting", () => {
    // Everything that measures the arena asks whether the camera it is
    // measuring from is the final one. A deliberately frozen sightline is; one
    // with a move waiting to be made on release is not.
    const source = rigSource();
    const hold = source.indexOf("cameraIsHeld(ctl.enabled");
    const settled = source.indexOf(
      "frameState.cameraSettled = goal.current === null",
      hold
    );
    const closes = source.indexOf("return;", hold);
    expect(settled).toBeGreaterThan(hold);
    expect(settled).toBeLessThan(closes);
  });
});

/**
 * I-017 — THE FOCUS VIEW CARRIES THE FRAME, AND A LOOK NEVER MOVES IT.
 *
 * Stated against the source for the same reason as the hold: the behaviour is
 * the browser's to prove, and importing the rig costs a renderer.
 */
describe("the camera under the focus view", () => {
  it("takes its pose from the one focus view, never from a look", () => {
    const source = rigSource();
    // The pose is chosen by the pure request (framing.ts), which ignores the
    // sighted bead; the rig re-renders on the request's key alone.
    expect(source).toContain("focusPoseKey(focusPoseRequest(sampleFocusView()))");
    expect(source).toContain("useSyncExternalStore(");
    expect(source).toMatch(/focusFraming\(\{[\s\S]{0,400}phrase: "lean"/);
    expect(source).toMatch(/pairFraming\(\{[\s\S]{0,400}phrase: "frame"/);
  });

  it("does not travel under reduced motion", () => {
    // I-017: no camera travel; the attended bead is set apart by scale and
    // brightness instead. The pose is still owned, and nothing is queued.
    const source = rigSource();
    const owned = source.indexOf("focusHeld.current = focusPose;");
    const bail = source.indexOf("if (reducedMotion) return;", owned);
    const solve = source.indexOf("focusFraming({", owned);
    expect(owned).toBeGreaterThan(-1);
    expect(bail).toBeGreaterThan(owned);
    expect(solve).toBeGreaterThan(bail);
  });

  it("goes home only once the commit has been performed", () => {
    const source = rigSource();
    expect(source).toMatch(
      /cue\.type === "thread\.woven"[\s\S]{0,400}performingUntil\.current = presentationNow\(\) \+ plan\.duration \* 1000/
    );
    expect(source).toMatch(
      /releaseOwed\.current && presentationNow\(\) >= performingUntil\.current/
    );
  });

  it("lets one finger move the lens and two fingers orbit while attending", () => {
    const source = rigSource();
    expect(source).toContain("ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE");
    expect(source).toContain("touches={lensTouch ? LENS_TOUCHES : ROAMING_TOUCHES}");
    // …and the pan the finger is handed is one the controls never perform.
    expect(source).toContain("enablePan={false}");
  });
});
