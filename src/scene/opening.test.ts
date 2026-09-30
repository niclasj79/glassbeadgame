import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { CASTALIA_CONCEPTS } from "@/content/castalia/concepts";
import {
  ACKNOWLEDGE_FRAMES,
  ACKNOWLEDGE_MS,
  ARRIVAL_DURATION_MS,
  HOME_ELEVATION,
  OPENING_ALPHABET,
  OPENING_CORNER_MS,
  OPENING_DEPARTURE_MS,
  OPENING_DOOR_DEADLINE_MS,
  OPENING_DURATION_MS,
  OPENING_LINES,
  TITLE_AZIMUTH,
  TITLE_DOLLY,
  TITLE_ELEVATION,
  acknowledgementMs,
  arenaChromeVisible,
  arrivalDurationMs,
  beadArrival,
  openingDepartureMs,
  openingStep,
  openingWorld,
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
const canvasSource = (): string => read("./ArenaCanvas.tsx");
const beadsSource = (): string => read("./Beads.tsx");
const hudSource = (): string => read("../ui/arena/ArenaHud.tsx");
const soundSource = (): string => read("../ui/components/SoundToggle.tsx");

/**
 * Source with its commentary removed. These files explain themselves at
 * length and name every mistake they were written to answer, so a test that
 * greps the raw text is testing the prose. (`[^:]` so a URL survives.)
 */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

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
    // The answer comes before the state change, and the phase change after
    // both. Measured against the code and not the commentary, which names all
    // three.
    //
    // What follows the flip used to be `startSession()`. The draw now happens
    // one screen later, on the threshold, because a page explaining what the
    // Game is for cannot be read by someone the Game has already started — so
    // the law this test protects is asserted against the threshold's press in
    // `threshold.test.ts`, where the expensive work now is. What stays true
    // here is the ordering, and that this press is still deferred behind a
    // paint rather than taken synchronously.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const ack = code.indexOf("strikeNow(strike.current)");
    const flip = code.indexOf("setOpening(true)");
    const cross = code.indexOf("crossToThreshold()");
    expect(ack).toBeGreaterThan(-1);
    expect(flip).toBeGreaterThan(ack);
    expect(cross).toBeGreaterThan(flip);
    expect(source).toContain("requestAnimationFrame");
    // The title must not build a draw at all any more.
    expect(code).not.toContain("startSession(");
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

/**
 * BLOCK-3 — THE OPENING WAS TWO SCREENS AT ONCE
 *
 * A real BEGIN press at 1280x720, CDP screencast, 277 frames over 4.7 s. At
 * 206 ms the title stood at full opacity over an empty armature. Eighty-two
 * milliseconds later, at 288 ms, all twelve beads were at full size and full
 * opacity, drawn straight through the letterforms of "The Glass Bead Game",
 * with THE LENS and CONCLUDE already struck top right and the headphone note
 * still in the corner. A DOM trace put the nav pill at 0.144 opacity 132 ms
 * after the press and at 1.0 by 412 ms — while the block's own departure does
 * not finish for nearly a second.
 */
describe("one screen at a time", () => {
  it("knows how long the block takes to leave", () => {
    // Derived from the steps, not written down beside them: a change to the
    // stagger that left this behind would silently un-gate everything below.
    let latest = 0;
    for (let i = 0; i < OPENING_LINES; i++) {
      const step = openingStep(i);
      latest = Math.max(latest, (step.delay + step.duration) * 1000);
    }
    expect(openingDepartureMs()).toBe(latest);
    expect(OPENING_DEPARTURE_MS).toBe(latest);
    // The measured window: the pill was fully struck at 412 ms and the block
    // was still going. Whatever else changes, the gate must outlast that.
    expect(OPENING_DEPARTURE_MS).toBeGreaterThan(412);
  });

  it("does not draw the arena's chrome until the type has gone", () => {
    expect(arenaChromeVisible(0)).toBe(false);
    expect(arenaChromeVisible(132)).toBe(false);
    expect(arenaChromeVisible(412)).toBe(false);
    expect(arenaChromeVisible(OPENING_DEPARTURE_MS - 1)).toBe(false);
    expect(arenaChromeVisible(OPENING_DEPARTURE_MS)).toBe(true);
    // Late is the safe side and early is the defect: the arena is mounted after
    // the press, so its own age can only ever undercount the departure.
    expect(arenaChromeVisible(OPENING_DEPARTURE_MS * 4)).toBe(true);
  });

  it("is what the HUD actually waits on", () => {
    const source = hudSource();
    expect(source).toContain("arenaChromeVisible");
    expect(source).toContain("OPENING_DEPARTURE_MS");
    // Held out of sight *and* out of reach: an invisible control that can still
    // be clicked or announced is a worse defect than a visible one.
    expect(source).toMatch(/visibility: shown \? undefined : "hidden"/);
    // The two verbs the critic photographed over the title are inside the gate.
    const code = stripComments(source);
    const gate = code.indexOf('data-testid="arena-chrome"');
    expect(gate).toBeGreaterThan(-1);
    expect(code.indexOf("The Lens")).toBeGreaterThan(gate);
    expect(code.indexOf("Conclude")).toBeGreaterThan(gate);
  });

  it("carries the title's corner note out with the title", () => {
    // "Headphones deepen the bed" was still in the corner at 288 ms, by which
    // time the arena had drawn all twelve beads. It left on its own 400 ms
    // clock; it now leaves on the block's axis and curve, and sooner.
    expect(OPENING_CORNER_MS).toBeLessThan(OPENING_DEPARTURE_MS);
    const source = soundSource();
    expect(source).toContain("OPENING_CORNER_MS");
    expect(source).toContain("ACKNOWLEDGE_LIFT_REM");
    expect(source).not.toMatch(/exit=\{\{ opacity: 0, transition: \{ duration: 0\.4 \} \}\}/);
  });

  it("assembles the world instead of switching it on", () => {
    // The finding, exactly: at 288 ms every bead was at full size and full
    // opacity on the frame it first appeared. Nothing may be arrived at zero.
    for (let rank = 0; rank < 12; rank++) {
      const first = beadArrival(rank, 12, 0, false);
      expect(first.scale).toBeLessThan(1);
      expect(first.light).toBe(0);
    }
    // …and it is an order, not a switch: a bead the hierarchy ranks second is
    // behind the first for the whole of the first's condensation.
    const midway = ARRIVAL_DURATION_MS / 2;
    expect(beadArrival(0, 12, midway, false).light).toBeGreaterThan(
      beadArrival(1, 12, midway, false).light
    );
    expect(beadArrival(1, 12, midway, false).light).toBeGreaterThan(
      beadArrival(11, 12, midway, false).light
    );
    // Every bead does arrive, and none of them overshoots.
    for (let rank = 0; rank < 12; rank++) {
      const done = beadArrival(rank, 12, arrivalDurationMs(12), false);
      expect(done.scale).toBe(1);
      expect(done.light).toBe(1);
      expect(done.gather).toBe(0);
    }
  });

  it("fits the assembly inside the departure it plays under", () => {
    // A world still arriving after the type has gone is a second opening.
    for (const count of [1, 2, 6, 12, 24]) {
      expect(arrivalDurationMs(count)).toBeLessThanOrEqual(
        OPENING_DEPARTURE_MS + 1e-9
      );
    }
    // And a two-bead draw is not paced like a two-dozen one.
    expect(arrivalDurationMs(2)).toBeLessThan(arrivalDurationMs(12));
  });

  it("expresses the arrival in luminance when motion is not wanted", () => {
    // Reduced motion suppresses the condensation, exactly as it suppresses the
    // invitation's reach — and it does not remove the arrival, because an
    // arrival that is deleted is the switch this was written to replace.
    let lit = 0;
    let gathered = 0;
    for (let ms = 0; ms <= arrivalDurationMs(12); ms += 20) {
      for (let rank = 0; rank < 12; rank++) {
        const still = beadArrival(rank, 12, ms, true);
        expect(still.scale).toBe(1);
        const moving = beadArrival(rank, 12, ms, false);
        expect(still.light).toBe(moving.light);
        if (still.light > 0 && still.light < 1) lit++;
        if (still.gather > 0) gathered++;
      }
    }
    expect(lit).toBeGreaterThan(0);
    expect(gathered).toBeGreaterThan(0);
  });

  it("is what the arena's beads actually do", () => {
    const source = stripComments(beadsSource());
    expect(source).toContain("beadArrival(");
    // The condensation is applied to what is drawn, not folded into the eased
    // interaction scale, so the authored curve is the curve on the screen.
    expect(source).toMatch(/const drawn = next \* condensing\.scale/);
    expect(source).toMatch(/BEAD_RADIUS \* GLASS_SCALE \* drawn/);
    // The tier — haze, specular, rim, label weight — is the luminance half.
    expect(source).toMatch(/focal\.tierTarget\[i\] \* focal\.light\[i\]/);
    // The order is the hierarchy's, taken once and then held.
    expect(source).toContain("focal.arrivalRank[focal.order[rank]] = rank");
    expect(source).toContain("arrival.current.ranked");
  });
});

/**
 * B4 — THE FIRST PRESS FROZE THE MAIN THREAD FOR TWO SECONDS
 *
 * An in-page rAF recorder on a cold profile, headed, on a GTX 1080 Ti: the
 * worst frame gap after the first BEGIN was 2236, 1956 and 2140 ms across three
 * cold runs, beginning about 140 ms after the press. In a warm browser process
 * the same press costs 33 ms, so this was precisely and only the first-time
 * player's experience — the one whose next decision is whether to continue.
 *
 * Instrumenting the GL context named it exactly: four programs are linked in
 * answer to the press, and the bead glass blocks for 1914 ms inside
 * `getProgramInfoLog` — three.js at the first draw, waiting for a link the
 * driver has not finished. A link cannot be made cheaper or split across
 * frames. It can only be started earlier, and then waited for.
 */
describe("the world behind the door", () => {
  afterEach(() => openingWorld.reset());

  it("starts shut, opens once, and stays open", () => {
    openingWorld.reset();
    expect(openingWorld.isReady()).toBe(false);

    let opened = 0;
    const stop = openingWorld.subscribe(() => {
      opened += 1;
    });
    openingWorld.open();
    expect(openingWorld.isReady()).toBe(true);
    expect(opened).toBe(1);

    // A canvas that remounts after a lost context must not re-announce a door
    // the player has already been given.
    openingWorld.open();
    expect(opened).toBe(1);

    stop();
    openingWorld.reset();
    openingWorld.open();
    expect(opened).toBe(1);
  });

  it("cuts every letter the pack can ask for before any name needs one", () => {
    // The first live arena frame captioned one bead with garbage, because the
    // glyph atlas was half built when the frame was drawn. The draw is not
    // known until BEGIN is pressed, so the whole pack's alphabet is preloaded.
    for (const concept of CASTALIA_CONCEPTS) {
      for (const character of concept.name) {
        expect(OPENING_ALPHABET).toContain(character);
      }
    }
    // Derived, not hand-kept: the pack has an ö in it and the next concept
    // added may have something else.
    expect(OPENING_ALPHABET).toContain("ö");
    expect(new Set(OPENING_ALPHABET).size).toBe(OPENING_ALPHABET.length);
    expect(canvasSource()).toContain("OPENING_ALPHABET");
  });

  it("builds the glass and the label while the title is up", () => {
    const source = canvasSource();
    // The two expensive constructions, made here rather than at the press.
    expect(source).toContain("createBeadGlassMaterial");
    expect(source).toContain("gl.compile(");
    expect(source).toMatch(/<Text[\s\S]{0,400}characters=\{OPENING_ALPHABET\}/);
    // And the gate is opened from here, once a frame has actually been drawn
    // with them — a link that has never been used has not been paid for.
    expect(source).toContain("openingWorld.open()");
    expect(source).toContain("useFrame");
  });

  it("compiles under the conditions the frame is actually drawn in", () => {
    // three keys its program cache on `parameters.outputColorSpace`, which is
    // the renderer's own when drawing to the canvas and linear when drawing to
    // a render target — and the composer owns the frame, so the arena is always
    // drawn to a target. Traced with the compile unbound: the glass was linked
    // at 3119 ms, `compileAsync` waited 2.8 s for it, and the first draw then
    // linked the glass a *second* time and blocked 1985 ms doing it.
    const source = stripComments(canvasSource());
    const bind = source.indexOf("gl.setRenderTarget(asIfComposed)");
    const compile = source.indexOf("gl.compile(");
    const restore = source.indexOf("gl.setRenderTarget(previous)");
    expect(bind).toBeGreaterThan(-1);
    expect(compile).toBeGreaterThan(bind);
    expect(restore).toBeGreaterThan(compile);
  });

  it("compiles its own group, and waits in a way a disposed material cannot break", () => {
    // The glass is remade with the theme, and the theme is the session's, so
    // the warm-up runs again while a Game is up. A compile of the whole scene
    // then collects the live beads' materials, which the arena disposes when
    // the Game is left — and three's `compileAsync` throws from its timer at a
    // material whose program is gone. The group alone is compiled, under the
    // scene's own lights and fog, and the wait is the tolerant one.
    const source = stripComments(canvasSource());
    expect(source).toContain("gl.compile(group.current ?? scene, camera, scene)");
    expect(source).toContain("awaitLinks(gl, linked)");
    expect(source).not.toContain("gl.compileAsync(");
  });

  it("does not draw the warm-up until the link is finished", () => {
    // A draw is the blocking call being avoided; drawing before the wait moves
    // the freeze into the title instead of removing it.
    const source = stripComments(canvasSource());
    expect(source).toContain('visible={stage === "drawing"}');
    // Drawable only downstream of the compile: one place arms it, and it is
    // after the wait rather than beside it.
    const arm = source.indexOf('setStage("drawing")');
    expect(arm).toBeGreaterThan(source.indexOf("Promise.all([compileInto()"));
    expect(source.lastIndexOf('setStage("drawing")')).toBe(arm);
    // Off-stage rather than hidden: an invisible object is never drawn, and a
    // program that is never drawn with is never paid for.
    expect(source).toContain("OFF_STAGE");
    expect(source).toContain("frustumCulled={false}");
  });

  it("holds the door on the world, without saying so", () => {
    const source = titleSource();
    expect(source).toContain("useDoorArmed");
    expect(source).toContain("openingWorld.subscribe");
    expect(source).toContain("disabled={!armed}");
    // Out of the accessibility tree while it is not a door, so nothing offers
    // the player a control that cannot answer.
    expect(source).toContain("aria-hidden={armed ? undefined : true}");
    // The block keeps its place in the layout, so nothing above it moves when
    // the world finishes building.
    expect(source).not.toMatch(/\{armed &&/);
    // And nothing tells the player they are waiting: no spinner, no progress,
    // no word for it. SILENCE BEATS FABRICATED SIGNIFICANCE.
    expect(stripComments(source)).not.toMatch(
      /loading|Loading|progress|spinner|Preparing/
    );
  });

  it("insures the door without reintroducing the freeze on slow hardware", () => {
    // The deadline is the failure case, not a budget: firing early is the
    // freeze back again, on the devices that can least afford it. Measured
    // from the title's first paint on a cold profile: ready in 3.4, 3.7 and
    // 4.8 s; warm, 0.85 and 1.3 s.
    expect(OPENING_DOOR_DEADLINE_MS).toBeGreaterThanOrEqual(10_000);
    expect(titleSource()).toContain("OPENING_DOOR_DEADLINE_MS");
  });
});
