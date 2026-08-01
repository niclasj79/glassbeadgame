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

  it("abandons a pose queued during the gesture rather than deferring it", () => {
    // "Open the plate in the pose the camera already has": resuming the transit
    // on release would move the world out from under a finger that is still
    // aiming at the plate the transit was queued for.
    const source = rigSource();
    expect(source).toMatch(
      /if \(!ctl\.enabled\) \{[\s\S]{0,240}goal\.current = null;/
    );
  });

  it("still reports a held camera as settled", () => {
    // Everything that measures the arena asks whether the camera it is
    // measuring from is the final one. A deliberately frozen sightline is.
    const source = rigSource();
    const hold = source.indexOf("cameraIsHeld(ctl.enabled");
    const settled = source.indexOf("frameState.cameraSettled = true", hold);
    const closes = source.indexOf("return;", hold);
    expect(settled).toBeGreaterThan(hold);
    expect(settled).toBeLessThan(closes);
  });
});
