import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { easing } from "maath";
import { useStore } from "@/state/store";
import { useStore as useVanillaStore } from "zustand";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { domainSessionStore } from "@/state/domainSession";
import { cueBus } from "@/runtime/cues";
import { ARENA_RADIUS } from "@/game/layout";
import { isCoarsePointer } from "@/lib/device";
import { frameState } from "./frameState";
import {
  beginConclusionPerformance,
  conclusionPerformanceStore,
  createConclusionCamera,
  readScenePerformance,
  runningConclusionFor,
  type PerformedPose,
  type Vec3,
} from "./conclusionPerformance";
import {
  ARENA_FOV,
  PORTRAIT_ASPECT,
  attendedFraming,
  createDamped,
  createOrbitDamper,
  createOrbitPose,
  dampOrbitToward,
  dampScalar,
  homeComposition,
  orbitFromPosition,
  phraseSmoothTime,
  plateGeometry,
  plateSafeArea,
  positionFromOrbit,
  titleComposition,
  unshiftArea,
  unshiftNdc,
  type CameraPhrase,
  type HomeComposition,
} from "./framing";
import {
  HOME_ELEVATION,
  HOME_ELEVATION_PORTRAIT,
  TITLE_AZIMUTH,
  TITLE_DOLLY,
  TITLE_ELEVATION,
} from "./opening";
import { presentationNow } from "@/runtime/testMode";

/**
 * CAMERA AS PHRASING
 *
 * Two authorities: the player's orbit, and scripted moves. A move is a *named
 * phrase* — lean, release, breath, square, settle, dwell, crown — and every
 * phrase is a whole or half multiple of one beat (scene/framing.ts §4). The
 * sequence of moves is the player's performance, and the camera phrases it
 * (INTERACTION-DECISIONS, "Camera traversal as performance phrasing").
 *
 * Two things changed here, and both were the same mistake in different
 * clothes — treating a camera move as a property change rather than as an
 * authored moment:
 *
 *   A move is damped in ORBIT coordinates, not in Cartesian ones. Damping a
 *   position drags the camera along a chord, straight through the instrument,
 *   so the elevation changed fastest in the middle of the move and the horizon
 *   whipped across the frame. Every phrase is now a turn of the instrument at
 *   a controlled rate, and the level is bounded (framing.MAX_ELEVATION) so a
 *   composing move can never throw it out of frame.
 *
 *   REDUCED MOTION SUPPRESSES THE ANIMATION, NOT THE FRAMING. It used to
 *   return early from the attend, the reveal and the conclusion, so the plate
 *   stayed wherever the bead happened to be — which put "ECHO" off the top of
 *   an 810 px viewport. The same poses are computed and applied instantly.
 *   Reduced motion is a first-class path, not a fallback.
 *
 * The attended posture is a lean toward an idea that still preserves the whole
 * arena (I-012), and it is now checked against the plate's safe area: if the
 * intention plate would not fit at the composed distance, the camera stands
 * back until it does.
 *
 * THE CONCLUSION IS NOW PERFORMED (BLOCK-1, spec §14).
 *
 * `compileConclusion` emits an ordered `CameraHint[]` — answer, traverse, hold,
 * settle, gather, widen, rest — each with the sentence that justifies it. It had
 * no consumer anywhere in the application: this rig sent the conclusion to one
 * fixed crown pose and never moved it again, so "topology variables shape
 * camera, density, orchestration, and climax" was compiled in full and performed
 * by nothing. The rig now subscribes to the conclusion cue on the `camera`
 * channel — the channel every plan has always declared — and executes the hints
 * at the seconds the compiler gave them, which are the same seconds the reading
 * assembles on. `scene/conclusionPerformance.ts` holds the law and the
 * reasoning; this file gives it a frame and a world.
 *
 * It is a performance, not a cutscene: the first touch of the orbit ends it for
 * good and the player keeps the camera. Measured on the running build, that
 * touch does not currently reach the canvas — `ConclusionScreen`'s scroller
 * covers the whole viewport, so `document.elementFromPoint` anywhere over the
 * arena returns the reading and OrbitControls never sees a press. The hold
 * below is therefore right and reachable from every state the arena is
 * draggable in, and unreachable from the one state this performance runs in
 * until that surface releases its margins. That surface is not this file's.
 */

interface Goal {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
  /** The phrasing. Never a bare number. */
  readonly phrase: CameraPhrase;
}

/**
 * The orbit ceiling and floor, shared by the controls and by every scripted
 * pose. A move aimed past either can never arrive — the controls clamp the
 * camera back every frame — and a move that never arrives leaves the arena
 * permanently "in motion" for anything that measures it.
 */
const maxOrbit = (aspect: number): number => (aspect < 0.75 ? 26 : 18);
const MIN_ORBIT = 5.2;

/** A move is abandoned if it has not arrived in this long. */
const TRANSIT_TIMEOUT_S = 3.5;

const IDLE_ORBIT_AFTER_MS = 10_000;
const ORIGIN = new THREE.Vector3(0, 0, 0);

/** Where the attended bead is asked to sit, in NDC. Lower corner, both axes. */
const ATTEND_NDC_X = 0.34;
const ATTEND_NDC_Y = -0.28;
const ATTEND_NDC_X_PORTRAIT = 0.3;
const ATTEND_NDC_Y_PORTRAIT = -0.32;

/**
 * THE REST POSTURE, AND THE ONE BEFORE IT
 *
 * Elevation is authored; distance and lens shift are solved by
 * `framing.homeComposition` from the viewport itself. The title stands further
 * back **and round to one side**: the opening move therefore has an azimuth,
 * so the armillary assembles into view — a lattice turning toward the player —
 * instead of a pure axial dolly, which is a move no player can perceive because
 * nothing in an empty sky has parallax to reveal it.
 */
const homeElevation = (aspect: number): number =>
  aspect < PORTRAIT_ASPECT ? HOME_ELEVATION_PORTRAIT : HOME_ELEVATION;

const orbitPosition = (
  distance: number,
  azimuth: number,
  elevation: number,
  out: THREE.Vector3
): THREE.Vector3 =>
  positionFromOrbit({ distance, azimuth, elevation }, out);

/** The composed rest pose: off-centre by lens shift, solved for this frame. */
function arenaHomePose(
  home: HomeComposition,
  aspect: number,
  phrase: CameraPhrase
): Goal {
  return {
    position: orbitPosition(
      home.distance,
      0,
      homeElevation(aspect),
      new THREE.Vector3()
    ),
    target: ORIGIN.clone(),
    phrase,
  };
}

function phasePose(
  phase: string,
  home: HomeComposition,
  aspect: number,
  phrase: CameraPhrase
): Goal {
  if (phase === "conclusion") {
    return {
      position: new THREE.Vector3(0.01, ARENA_RADIUS * 3.2, 0.01),
      target: ORIGIN.clone(),
      phrase: "crown",
    };
  }
  if (phase === "title" || phase === "setup") {
    const away = phase === "title" ? 1 : 0.42;
    return {
      position: orbitPosition(
        home.distance * (1 + (TITLE_DOLLY - 1) * away),
        TITLE_AZIMUTH * away,
        homeElevation(aspect) + (TITLE_ELEVATION - homeElevation(aspect)) * away,
        new THREE.Vector3()
      ),
      target: ORIGIN.clone(),
      phrase,
    };
  }
  return arenaHomePose(home, aspect, phrase);
}

/**
 * THE LENS SHIFT, APPLIED.
 *
 * An asymmetric frustum, refreshed only when the frame or the composition
 * actually changes. `setViewOffset` re-derives the projection itself, and the
 * offset survives every later `updateProjectionMatrix` — including the impact
 * kick's FOV punch — because three keeps it on the camera.
 *
 * It takes a *centre* rather than a composition, because the centre is now
 * something that moves: the title is composed concentrically and the arena is
 * composed off-centre (VC-05, `framing.titleComposition`), so the shift is
 * racked between them over the opening phrase instead of cutting.
 */
function applyLensShift(
  camera: THREE.Camera,
  centre: { readonly x: number; readonly y: number },
  width: number,
  height: number
): void {
  const cam = camera as THREE.PerspectiveCamera;
  if (!cam.isPerspectiveCamera) return;
  const offsetX = (-centre.x * width) / 2;
  const offsetY = (centre.y * height) / 2;
  const view = cam.view;
  if (
    view?.enabled &&
    view.fullWidth === width &&
    view.fullHeight === height &&
    Math.abs(view.offsetX - offsetX) < 0.01 &&
    Math.abs(view.offsetY - offsetY) < 0.01
  ) {
    return;
  }
  cam.setViewOffset(width, height, offsetX, offsetY, width, height);
}

/**
 * THE CAMERA IS ONLY EVER *AIMED* BY THE CONTROLS.
 *
 * `OrbitControls.update()` is the one thing in the whole scene that calls
 * `camera.lookAt(target)`, and drei runs it from a frame callback guarded by
 * `if (controls.enabled)`. Every scene gesture disables the controls for its
 * whole duration (`threading.beginGesture`), so any pose written between the
 * press and the release *translates* the camera without re-aiming it.
 *
 * Measured on the running build, pressing a bead and dragging 40 px: the camera
 * was teleported from (0.02, 0.94, 11.14) to (12.25, 4.29, -2.17) — a hundred
 * degrees round the instrument — while still facing the way it had been. All
 * twelve beads left the frame, the intention plate's element went to 0x0
 * because drei hides an `Html` whose anchor is behind the lens, and
 * `elementFromPoint` under the finger was the bare canvas. It came back on
 * release only because `endGesture` re-enables the controls and the next
 * `update()` re-aims. A drag from empty sky never did this: there the controls
 * stay enabled, so the camera is still being aimed.
 *
 * So the camera is *held* for as long as the gesture owns it. This is the same
 * hold the weaving branch has always taken through `frameState.aim.active`,
 * stated once and applied to every gesture — and a pose queued during the hold
 * is abandoned rather than deferred, because the answer to "the player is
 * pulling on this bead" is to open the plate in the pose the camera already has,
 * not to move the world out from under the finger and then move it back.
 */
function cameraIsHeld(controlsEnabled: boolean, aiming: boolean): boolean {
  return !controlsEnabled || aiming;
}

const beadVec = new THREE.Vector3();
const screenVec = new THREE.Vector3();

/**
 * How far the finished web actually reaches. The crown has to clear whatever
 * the player built, not whatever the layout was nominally sized for.
 */
function webRadius(): number {
  const rendered = frameState.rendered;
  let maxSq = 0;
  for (let i = 0; i < rendered.length; i += 3) {
    const x = rendered[i];
    const y = rendered[i + 1];
    const z = rendered[i + 2];
    maxSq = Math.max(maxSq, x * x + y * y + z * z);
  }
  return Math.sqrt(maxSq) || ARENA_RADIUS;
}

/** Where a concept is being drawn, for the hints that name one. */
function beadAt(conceptId: string): Vec3 | null {
  const index = frameState.beadIndex.get(conceptId);
  if (index === undefined) return null;
  const rendered = frameState.rendered;
  if (rendered.length < (index + 1) * 3) return null;
  return {
    x: rendered[index * 3],
    y: rendered[index * 3 + 1],
    z: rendered[index * 3 + 2],
  };
}

export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef<Goal | null>(null);
  const goalOrbit = useRef(createOrbitPose());
  const scratchOrbit = useRef(createOrbitPose());
  const damper = useRef(createOrbitDamper());
  const nextPosition = useRef(new THREE.Vector3());
  const transitAge = useRef(0);
  const camera = useThree((s) => s.camera);
  const viewportWidth = useThree((s) => s.size.width);
  const viewportHeight = useThree((s) => s.size.height);
  const phase = useStore((s) => s.phase);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);
  const attendedId =
    draft.stage === "inactive" ? null : String(draft.attendedConceptId);
  const armed = draft.stage === "armed" || draft.stage === "candidate-selected";
  const lensActive = useStore((s) => s.lensActive);
  const lensView = useStore((s) => s.lensView);

  const aspect = useThree((s) => s.viewport.aspect);
  const previousAttendedId = useRef<string | null>(null);

  /**
   * The composition this frame is being made in: where the arena's centre is
   * carried to, how far back the camera has to stand for the bead shell to fit
   * inside the page's ruling, and the lens shift that does the carrying.
   */
  const home = useMemo(
    () => homeComposition({ width: viewportWidth, height: viewportHeight }),
    [viewportWidth, viewportHeight]
  );

  /**
   * THE TITLE IS COMPOSED CONCENTRICALLY; THE ARENA IS NOT.
   *
   * The arena leans off the page's centre because a column down its right is
   * held for the readings. The title has no column, and inheriting the arena's
   * lead room is what made its two halves seesaw — the wordmark centred on the
   * page, the armillary at 34% of it, and a collision between them (VC-05).
   * The fit is the same on both; only where the frame is *carried to* differs,
   * and that is racked below rather than cut.
   */
  const title = useMemo(
    () => titleComposition({ width: viewportWidth, height: viewportHeight }),
    [viewportWidth, viewportHeight]
  );
  const composed = phase === "title" || phase === "setup" ? title : home;
  const wantedShift = useRef({ x: composed.centre.x, y: composed.centre.y });
  wantedShift.current.x = composed.centre.x;
  wantedShift.current.y = composed.centre.y;
  const shift = useRef<{ x: number; y: number } | null>(null);
  const shiftDamper = useRef({ x: createDamped(), y: createDamped() });

  // A layout effect, so the very first frame is already composed: applying the
  // shift from the frame loop would publish one centred frame first. It is
  // deliberately *not* keyed on the composition — a phase change racks the
  // shift in the frame loop, and only a resize re-strikes it at once.
  useLayoutEffect(() => {
    const at = wantedShift.current;
    shift.current = { x: at.x, y: at.y };
    applyLensShift(camera, shift.current, viewportWidth, viewportHeight);
    return () => {
      (camera as THREE.PerspectiveCamera).clearViewOffset?.();
    };
  }, [camera, viewportWidth, viewportHeight]);

  /**
   * Every scripted move enters here. One door, so a move is always a named
   * phrase and never an object literal invented at the call site.
   */
  const perform = useCallback((next: Goal): void => {
    goal.current = next;
    orbitFromPosition(next.position, goalOrbit.current);
    transitAge.current = 0;
  }, []);

  /* ── THE CONCLUSION, PERFORMED ────────────────────────────────────────── */

  /**
   * The camera director's subscription. The conclusion cue has always been
   * published on the `camera` channel with the compiled performance on it; this
   * is the first thing in the application to listen. `presentationNow()` is
   * stamped at delivery — the same clock the reading measures itself against —
   * so a strand, its voice and its line in the register are one moment rather
   * than three approximations of it.
   */
  useEffect(
    () =>
      cueBus.subscribe("camera", (cue) => {
        if (cue.type !== "conclusion.perform") return;
        const performance = readScenePerformance(cue.payload.performance);
        // Silence beats fabricated significance: a performance the scene
        // cannot read leaves the conclusion exactly as it was.
        if (performance === null) return;
        beginConclusionPerformance(performance, presentationNow());
      }),
    []
  );

  const conclusionCamera = useRef(createConclusionCamera());
  const running = useVanillaStore(conclusionPerformanceStore, (s) => s.running);
  const sessionId = useVanillaStore(domainSessionStore, (s) =>
    s.session ? String(s.session.sessionId) : null
  );
  /** Last Game's performance may not play over this one's arena. */
  const conclusion = useMemo(
    () => runningConclusionFor(running, sessionId),
    [running, sessionId]
  );

  const poseOrbit = useRef(createOrbitPose());
  const fromOrbit = useRef(createOrbitPose());
  const performPose = useCallback(
    (pose: PerformedPose): void => {
      poseOrbit.current.distance = pose.distance;
      poseOrbit.current.azimuth = pose.azimuth;
      poseOrbit.current.elevation = pose.elevation;
      perform({
        position: positionFromOrbit(poseOrbit.current, new THREE.Vector3()),
        target: new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z),
        phrase: pose.phrase,
      });
    },
    [perform]
  );

  /** Attend: swing the instrument so the bead comes to a lower corner. */
  useLayoutEffect(() => {
    if (phase !== "arena" || lensActive) {
      previousAttendedId.current = null;
      return;
    }
    if (!attendedId) {
      if (previousAttendedId.current) {
        perform(arenaHomePose(home, aspect, "release"));
      }
      previousAttendedId.current = null;
      return;
    }
    previousAttendedId.current = attendedId;
    const index = frameState.beadIndex.get(attendedId);
    if (index === undefined) return;
    const rendered = frameState.rendered;
    beadVec.set(
      rendered[index * 3],
      rendered[index * 3 + 1],
      rendered[index * 3 + 2]
    );

    const rest = arenaHomePose(home, aspect, "lean");
    const portrait = aspect < PORTRAIT_ASPECT;
    // Keep the bead on the side of the frame it is already on: the phrase is
    // a lean toward the idea, never a lurch across it.
    screenVec.copy(beadVec).project(camera);
    const side = screenVec.x >= 0 ? 1 : -1;
    const ndcX = side * (portrait ? ATTEND_NDC_X_PORTRAIT : ATTEND_NDC_X);
    const ndcY = portrait ? ATTEND_NDC_Y_PORTRAIT : ATTEND_NDC_Y;
    const ceiling = maxOrbit(aspect);
    const distance = Math.min(rest.position.length() * 1.18, ceiling);

    // The plate is drawn in screen space around this bead, so the pose is only
    // acceptable if the plate fits. This is the whole of B1: under reduced
    // motion this solve simply never ran.
    const plate = plateGeometry(
      viewportWidth,
      typeof window === "undefined" ? false : isCoarsePointer()
    );
    const safeArea = plateSafeArea(plate, {
      width: viewportWidth,
      height: viewportHeight,
    });

    // The plate is placed on the *screen*, and the lens shift stands between
    // the screen and the projection the solver works in. Both the target and
    // the box it is judged against are carried back through the shift, so a
    // composed frame cannot quietly move the plate off the edge it was solved
    // to stay inside.
    const wanted = unshiftNdc(ndcX, ndcY, home);
    const framing = attendedFraming({
      bead: beadVec,
      distance,
      aspect,
      ndcX: wanted.x,
      ndcY: wanted.y,
      safeArea: unshiftArea(safeArea, home),
      maxDistance: ceiling,
    });
    perform(
      framing
        ? { position: framing.position, target: framing.target, phrase: "lean" }
        : rest
    );
  }, [
    attendedId,
    phase,
    lensActive,
    camera,
    aspect,
    home,
    viewportWidth,
    viewportHeight,
    perform,
  ]);

  /**
   * Arming is a smaller phrase: a short breath inward, no re-framing. It is
   * the one move reduced motion drops entirely, because it carries nothing the
   * gold rule on the plate has not already said — suppressing an animation is
   * exactly what reduced motion is for.
   */
  useEffect(() => {
    if (!armed || reducedMotion || phase !== "arena" || lensActive) return;
    const current = goal.current;
    const from = current ? current.position : camera.position;
    perform({
      position: from.clone().multiplyScalar(0.965),
      target: (current ? current.target : ORIGIN).clone(),
      phrase: "breath",
    });
  }, [armed, reducedMotion, phase, lensActive, camera, perform]);

  // A layout effect: the pose must land in the same commit that publishes the
  // bead layout, before anything can measure the arena. As a passive effect it
  // ran a task later, and for that task the world reported bead positions from
  // a camera that had already been replaced.
  useLayoutEffect(() => {
    // The attend effect is declared above this one and therefore runs first;
    // while it owns the pose this one must not re-home the camera, or a resize
    // during an interpretation would throw the plate back to the middle.
    if (phase === "arena" && previousAttendedId.current) return;
    // The conclusion is *performed*, not posed. While a compiled performance
    // owns the camera the hints are the only thing allowed to move it — and its
    // own last hint is the crown, so nothing is lost by standing aside.
    if (phase === "conclusion" && conclusion !== null) return;
    perform(phasePose(phase, home, aspect, "settle"));
  }, [phase, aspect, home, perform, conclusion]);

  // The Lens: square up to whichever plane reading is showing.
  const wasLensed = useRef(false);
  useEffect(() => {
    if (lensActive) {
      wasLensed.current = true;
      perform({
        position: new THREE.Vector3(0, 0, home.distance * 0.99),
        target: ORIGIN.clone(),
        phrase: "square",
      });
    } else if (wasLensed.current && phase === "arena") {
      wasLensed.current = false;
      perform(arenaHomePose(home, aspect, "square"));
    }
  }, [lensActive, lensView, phase, aspect, home, perform]);

  /**
   * The concluding cinematic: rise to the pole and crown the finished web.
   * The one phrase that deliberately leaves the level behind, which is why it
   * takes two beats — and why reduced motion still performs it. Seeing the
   * whole web from above is information, not decoration.
   *
   * This is the *fallback* crown, for an arena that entered the concluding
   * interaction without a compiled performance. When there is one, its own
   * final `rest` hint brings the same pose, at the second the compiler chose.
   */
  const mode = useStore((s) => s.session?.interaction.mode ?? "idle");
  useEffect(() => {
    if (mode !== "concluding") return;
    perform({
      position: new THREE.Vector3(0.01, webRadius() * 2.6 + 3, 0.01),
      target: ORIGIN.clone(),
      phrase: "crown",
    });
  }, [mode, perform]);

  /** The reveal: dolly along the current sightline to frame the pair. */
  const revealId = useStore((s) => s.session?.interaction.reveal?.id ?? null);
  useEffect(() => {
    if (!revealId) return;
    const reveal = useStore.getState().session?.interaction.reveal;
    if (!reveal) return;
    const ia = frameState.beadIndex.get(reveal.a);
    const ib = frameState.beadIndex.get(reveal.b);
    if (ia === undefined || ib === undefined) return;
    const r = frameState.rendered;
    const mid = new THREE.Vector3(
      (r[ia * 3] + r[ib * 3]) / 2,
      (r[ia * 3 + 1] + r[ib * 3 + 1]) / 2 + 0.15,
      (r[ia * 3 + 2] + r[ib * 3 + 2]) / 2
    );
    const span = Math.hypot(
      r[ia * 3] - r[ib * 3],
      r[ia * 3 + 1] - r[ib * 3 + 1],
      r[ia * 3 + 2] - r[ib * 3 + 2]
    );
    const dir = camera.position.clone().sub(mid).normalize();
    // Never inside the orbit floor: the controls clamp the camera back out of
    // any pose nearer than this, so a move aimed there could never arrive.
    const dist = Math.max(MIN_ORBIT, span * 1.15 + 2.0);
    perform({
      position: mid.clone().addScaledVector(dir, dist),
      target: mid,
      phrase: "dwell",
    });
  }, [revealId, camera, perform]);

  /**
   * Idleness is the *player's* idleness. OrbitControls fires `change` for its
   * own auto-rotation too, so refreshing the idle clock from every change made
   * the arena stutter: one frame of drift, then the drift reset the clock that
   * had permitted it. Only a gesture the player started counts.
   */
  const dragging = useRef(false);

  /**
   * THE SHIFT RACK. One phrase, in the same tempo as everything else the
   * camera does — the composition changing is a move, not a property change,
   * and a 182 px jump in the projection at the title's exit would be a cut.
   * Reduced motion arrives instantly, exactly as every other pose does.
   */
  const rackShift = useCallback(
    (cam: THREE.Camera, dt: number, instant: boolean): boolean => {
      const at = shift.current;
      if (!at) return true;
      const want = wantedShift.current;
      if (Math.abs(at.x - want.x) < 2e-4 && Math.abs(at.y - want.y) < 2e-4) {
        at.x = want.x;
        at.y = want.y;
        return true;
      }
      if (instant) {
        at.x = want.x;
        at.y = want.y;
      } else {
        const smoothTime = phraseSmoothTime("settle");
        shiftDamper.current.x.value = at.x;
        shiftDamper.current.y.value = at.y;
        at.x = dampScalar(shiftDamper.current.x, want.x, smoothTime, dt);
        at.y = dampScalar(shiftDamper.current.y, want.y, smoothTime, dt);
      }
      applyLensShift(cam, at, viewportWidth, viewportHeight);
      return false;
    },
    [viewportWidth, viewportHeight]
  );

  useFrame((state, dt) => {
    const ctl = controls.current;
    if (!ctl) return;

    const racked = rackShift(state.camera, dt, reducedMotion);

    // Impact kick: a quick FOV punch, no position meddling, so OrbitControls
    // never fights it.
    if (frameState.kick > 0.001) {
      frameState.kick *= Math.exp(-dt * 5);
      const cam = state.camera as THREE.PerspectiveCamera;
      cam.fov = ARENA_FOV * (1 - 0.04 * Math.sin(frameState.kick * Math.PI));
      cam.updateProjectionMatrix();
    }

    // A gesture owns the sightline until release: suspending the move keeps a
    // latched bead from drifting out from under a finger, and — see
    // `cameraIsHeld` — moving the camera while the controls are off moves it
    // without aiming it. A held sightline is deliberately frozen, so it counts
    // as settled for anything measuring the arena.
    if (cameraIsHeld(ctl.enabled, frameState.aim.active)) {
      if (!ctl.enabled) {
        // The plate opens in the pose the camera already has.
        goal.current = null;
        transitAge.current = 0;
      }
      ctl.autoRotate = false;
      frameState.cameraSettled = true;
      return;
    }

    /*
     * THE PERFORMANCE, EXECUTED.
     *
     * Whatever hint has come due by now, in the compiler's own seconds, becomes
     * this frame's move. It is taken *after* the gesture hold above, so the
     * conclusion can never move the world out from under a finger, and *before*
     * the transit below, so the pose it queues is travelled this same frame.
     */
    if (conclusion !== null) {
      const pose = conclusionCamera.current.advance({
        running: conclusion,
        nowMs: presentationNow(),
        from: orbitFromPosition(state.camera.position, fromOrbit.current),
        beadAt,
        webRadius: webRadius(),
        minDistance: MIN_ORBIT,
        maxDistance: maxOrbit(aspect),
      });
      if (pose !== null) performPose(pose);
    }

    const current = goal.current;
    if (current) {
      frameState.recenter = false;
      if (reducedMotion) {
        // The framing, instantly. No interpolation, no easing, no travel.
        state.camera.position.copy(current.position);
        ctl.target.copy(current.target);
        goal.current = null;
        transitAge.current = 0;
      } else {
        transitAge.current += dt;
        const smoothTime = phraseSmoothTime(current.phrase);
        dampOrbitToward(
          damper.current,
          state.camera.position,
          goalOrbit.current,
          smoothTime,
          dt,
          scratchOrbit.current,
          nextPosition.current
        );
        state.camera.position.copy(nextPosition.current);
        easing.damp3(ctl.target, current.target, smoothTime, dt);
        if (
          state.camera.position.distanceTo(current.position) < 0.04 ||
          transitAge.current > TRANSIT_TIMEOUT_S
        ) {
          goal.current = null;
          transitAge.current = 0;
        }
      }
    } else if (frameState.recenter) {
      if (reducedMotion) {
        ctl.target.set(0, 0, 0);
        frameState.recenter = false;
      } else {
        easing.damp3(ctl.target, ORIGIN, phraseSmoothTime("release"), dt);
        if (ctl.target.lengthSq() < 0.002) {
          ctl.target.set(0, 0, 0);
          frameState.recenter = false;
        }
      }
    }

    // Everything that measures the arena needs to know whether the camera it
    // is measuring from is the final one. A move still easing toward its pose
    // is not: anything measured from it is already out of date — and neither
    // is a projection whose shift is still racking, because the shift moves
    // every bead on the screen without moving the camera at all.
    frameState.cameraSettled = goal.current === null && racked;

    const mode = useStore.getState().session?.interaction.mode ?? "idle";
    const now = presentationNow();
    const idle = now - frameState.idleSince > IDLE_ORBIT_AFTER_MS;
    // The drift may not turn the instrument under a move that is being
    // performed: two authorities on one orbit is a camera that fights itself.
    // It returns of its own accord once the crown has settled.
    const performing =
      conclusion !== null && conclusionCamera.current.owns(now);
    ctl.autoRotate =
      !reducedMotion &&
      !performing &&
      mode !== "reveal" &&
      mode !== "concluding" &&
      ((phase === "arena" && idle && !frameState.aim.active) ||
        phase === "title" ||
        phase === "setup" ||
        phase === "conclusion");
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.7}
      minDistance={MIN_ORBIT}
      maxDistance={maxOrbit(aspect)}
      autoRotateSpeed={0.28}
      onStart={() => {
        dragging.current = true;
        frameState.idleSince = presentationNow();
        goal.current = null;
        // A performance, not a cutscene. The player has taken the camera, so
        // the remaining hints are dropped rather than queued to snatch it back.
        conclusionCamera.current.interrupt();
      }}
      onEnd={() => {
        dragging.current = false;
        frameState.idleSince = presentationNow();
      }}
      onChange={() => {
        if (dragging.current) frameState.idleSince = presentationNow();
      }}
    />
  );
}
