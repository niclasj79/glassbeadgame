import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { easing } from "maath";
import { useStore } from "@/state/store";
import { useStore as useVanillaStore } from "zustand";
import { domainSessionStore } from "@/state/domainSession";
import { useCurrentTheme } from "@/themes/useTheme";
import { cueBus } from "@/runtime/cues";
import { ARENA_RADIUS } from "@/game/layout";
import { frameState } from "./frameState";
import { driftAngle, driftGateAfter } from "./attuned";
import { sampleFocusView, subscribeFocusView } from "./focusFrame";
import type * as FocusPosture from "./focusPosture";
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
  PORTRAIT_ASPECT,
  arenaFov,
  cameraBreath,
  createDamped,
  createOrbitDamper,
  createOrbitPose,
  dampOrbitToward,
  dampScalar,
  focusPoseKey,
  focusPoseRequest,
  homeComposition,
  orbitFromPosition,
  phraseSmoothTime,
  positionFromOrbit,
  titleComposition,
  type CameraPhrase,
  type HomeComposition,
} from "./framing";
import { sceneBudget } from "./quality";
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
 * THE FOCUS VIEW CARRIES THE FRAME (I-017).
 *
 * Attend closes the camera in — as close as the whole bead shell allows — and
 * turns the instrument so the attended bead sits lower-left; Lock turns it
 * once more so the pair is framed, the attended bead lower-left and the second
 * up and to the right; a reopened thread is framed as a locked pair. The poses
 * are solved in `framing.ts` §6 from the one focus view every surface reads,
 * and a *look* — the bead under the lens — never moves the camera. After a
 * commit the pair stays framed while the commit is performed, and the camera
 * returns to rest when the performance ends.
 *
 * REDUCED MOTION: NO TRAVEL. I-017 is explicit, and it is narrower than the
 * law above: for the focus view the camera does not move at all, and the
 * attended bead is set apart by scale and brightness instead (`Beads.tsx`).
 * The phase poses keep the instant framing described above.
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

/**
 * A field of view nearer than this to the one drawn is the one drawn: a lens
 * at rest re-derives no projection, and one that breathes re-derives it once a
 * frame.
 */
const FOV_STILL_DEGREES = 1e-4;

const IDLE_ORBIT_AFTER_MS = 10_000;
const ORIGIN = new THREE.Vector3(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const driftOffset = new THREE.Vector3();

/**
 * WHAT A FINGER DOES TO THE ORBIT.
 *
 * Roaming, one finger orbits and two dolly. While a bead is attended the
 * pointer is a lens (I-017): a one-finger drag over the arena moves the lens —
 * the pointer layer's business — and must not also turn the world under it, so
 * one finger is handed to a pan the controls never perform (`enablePan` is
 * off), and two fingers orbit and dolly instead (INTERACTION-DECISIONS, input
 * equivalence: "one-finger drag over the arena; two-finger drag orbits").
 */
const ROAMING_TOUCHES = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
const LENS_TOUCHES = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };

/**
 * The focus view's request, as a key. Equal keys ask for the same pose, so a
 * look — which changes the view but not the request — renders nothing here.
 */
const readFocusPoseKey = (): string =>
  focusPoseKey(focusPoseRequest(sampleFocusView()));

const readLensTouch = (): boolean => sampleFocusView().mode === "focus";

/**
 * The focus postures' solvers (`focusPosture.ts`), fetched once, after the
 * first paint: nothing in them is needed until a bead is attended, and the
 * first download is a budget. The rig asks for them the moment it mounts, so
 * they are in hand long before anyone can attend.
 */
let posture: typeof FocusPosture | null = null;
let postureArriving: Promise<typeof FocusPosture> | null = null;
function loadPosture(): Promise<typeof FocusPosture> {
  if (!postureArriving) {
    postureArriving = import("./focusPosture").then((module) => {
      posture = module;
      return module;
    });
  }
  return postureArriving;
}

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
  if (phase === "title" || phase === "threshold") {
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
 * stated once and applied to every gesture: nothing moves the camera while the
 * hold stands.
 *
 * A POSE QUEUED DURING THE HOLD NOW WAITS FOR THE HAND. It used to be
 * abandoned, because the plate opened round the pressed bead and the answer to
 * "the player is pulling on this bead" was to open it in the pose the camera
 * already had. The plate has left the attended bead (the sigils bloom on the
 * preview thread after Lock, I-016), and under the focus view the press *is*
 * the act the camera answers (I-017): a tap attends, and the camera must close
 * in. Abandoning the pose would leave every pointer Attend unanswered. So the
 * pose is kept, the camera stays exactly where it is while the finger is down
 * — which is what GAP-2 needed — and the move is made once the hand has let go
 * and the controls are aiming the camera again.
 */
function cameraIsHeld(controlsEnabled: boolean, aiming: boolean): boolean {
  return !controlsEnabled || aiming;
}

const beadVec = new THREE.Vector3();
const secondVec = new THREE.Vector3();

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
  const canvas = useThree((s) => s.gl.domElement);
  /**
   * THE DRIFT (ADR-018). How open it is (eased, 0..1), whether the player has
   * taken the camera during this hold, and whether the session was held on the
   * last frame — a new hold gives the drift back.
   */
  const driftGate = useRef(0);
  const driftTaken = useRef(false);
  const wasHolding = useRef(false);
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
  const tier = useStore((s) => s.settings.qualityTier);
  const lensActive = useStore((s) => s.lensActive);
  const lensView = useStore((s) => s.lensView);
  /**
   * The world's slot: the camera's beat is a share of it (framing.ts §5), so
   * every phrase is counted in the bar the world's music keeps (ADR-016).
   */
  const slotSeconds = useCurrentTheme().music.slotSeconds;
  /**
   * Whether the lens breathes with the world: on the tiers that afford it,
   * and never under reduced motion — a lens that breathes is a camera that
   * moves, and it is stilled from the first frame rather than eased out.
   */
  const breathes = sceneBudget(tier).cameraBreath && !reducedMotion;
  /**
   * What the focus view asks of the camera, as a key: it changes on Attend,
   * Lock, a reopened thread and a return to roaming, and never on a look.
   */
  const focusPose = useSyncExternalStore(
    subscribeFocusView,
    readFocusPoseKey,
    readFocusPoseKey
  );
  /** Whether the pointer is a lens, which is what a finger must not orbit. */
  const lensTouch = useSyncExternalStore(
    subscribeFocusView,
    readLensTouch,
    readLensTouch
  );

  const aspect = useThree((s) => s.viewport.aspect);
  /**
   * The focus pose the camera currently holds, by key — or null at rest. While
   * one is held the phase pose must not re-home the camera under it.
   */
  const focusHeld = useRef<string | null>(null);
  /**
   * The focus view has let go, and the camera owes the rest pose — performed
   * once any commit performance has ended (`performingUntil`).
   */
  const releaseOwed = useRef(false);
  /** When the commit performance being staged ends, on the presentation clock. */
  const performingUntil = useRef(0);

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
  const composed = phase === "title" || phase === "threshold" ? title : home;
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
  // Fetch the focus postures' solvers now, while nothing is being attended.
  useEffect(() => {
    void loadPosture();
  }, []);

  useEffect(
    () =>
      cueBus.subscribe("camera", (cue, plan) => {
        if (cue.type === "thread.woven") {
          // The commit is performed on the pair the camera is holding: the
          // thread grows, the sky answers, and the camera goes home only once
          // the whole plan — the thread and its outcome — has been performed.
          performingUntil.current = presentationNow() + plan.duration * 1000;
          return;
        }
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

  /**
   * THE FOCUS VIEW'S POSTURE (I-017).
   *
   * Attend closes in and turns the instrument so the attended bead sits
   * lower-left; Lock — and a reopened thread — turns it once more to frame the
   * pair. Both are solved from where the beads are *drawn*, because that is
   * where the eye sees them. The old lean stood further back and kept the bead
   * on whichever side it was on; the old arming breath is gone with arming
   * itself, because Lock now answers with a turn of its own.
   *
   * Roaming again, the camera owes the rest pose. It is paid at once after a
   * Cancel, and after a commit only when the commit's performance has ended —
   * the thread grows and the sky answers on the pair it was woven between —
   * which the frame loop below settles.
   *
   * Under reduced motion there is no travel at all (I-017). The pose is still
   * *owned*, so nothing else re-homes the camera under the view, but no move is
   * queued; `Beads.tsx` sets the attended bead apart by scale and brightness.
   */
  useLayoutEffect(() => {
    if (phase !== "arena" || lensActive) {
      focusHeld.current = null;
      releaseOwed.current = false;
      return;
    }
    const request = focusPoseRequest(sampleFocusView());
    // The key this render was made for and the view read now are one moment;
    // if they are not, the render that follows brings the right one.
    if (focusPoseKey(request) !== focusPose) return;
    if (request.kind === "rest") {
      if (focusHeld.current !== null) releaseOwed.current = true;
      focusHeld.current = null;
      return;
    }
    focusHeld.current = focusPose;
    releaseOwed.current = false;
    // A new act ends the old performance's claim on the camera: a Cancel from
    // here goes home at once, not when a commit before it would have finished.
    performingUntil.current = 0;
    if (reducedMotion) return;

    const viewport = { width: viewportWidth, height: viewportHeight };
    const compose = (solvers: typeof FocusPosture): void => {
      const attended = beadAt(request.attended);
      if (!attended) return;
      beadVec.set(attended.x, attended.y, attended.z);
      if (request.kind === "attend") {
        const framing = solvers.focusFraming({
          bead: beadVec,
          viewport,
          minDistance: MIN_ORBIT,
          maxDistance: maxOrbit(aspect),
        });
        if (framing) {
          perform({ position: framing.position, target: framing.target, phrase: "lean" });
        }
        return;
      }
      const second = beadAt(request.second);
      if (!second) return;
      secondVec.set(second.x, second.y, second.z);
      const framing = solvers.pairFraming({
        attended: beadVec,
        second: secondVec,
        viewport,
        from: camera.position,
        minDistance: MIN_ORBIT,
        maxDistance: maxOrbit(aspect),
      });
      if (framing) {
        perform({ position: framing.position, target: framing.target, phrase: "frame" });
      }
    };
    if (posture) {
      compose(posture);
      return;
    }
    // Only if a bead is attended before the solvers have arrived — they are
    // fetched when the rig mounts — does the posture wait for them, and then
    // only if the view still asks for it.
    let current = true;
    void loadPosture().then((solvers) => {
      if (current && focusHeld.current === focusPose) compose(solvers);
    });
    return () => {
      current = false;
    };
  }, [
    focusPose,
    phase,
    lensActive,
    reducedMotion,
    camera,
    aspect,
    viewportWidth,
    viewportHeight,
    perform,
  ]);

  // A layout effect: the pose must land in the same commit that publishes the
  // bead layout, before anything can measure the arena. As a passive effect it
  // ran a task later, and for that task the world reported bead positions from
  // a camera that had already been replaced.
  useLayoutEffect(() => {
    // The focus effect is declared above this one and therefore runs first;
    // while it owns the pose — or still owes the return from one — this one
    // must not re-home the camera, or a resize during an interpretation would
    // throw the attended bead back to wherever rest left it.
    if (phase === "arena" && (focusHeld.current !== null || releaseOwed.current)) {
      return;
    }
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
        const smoothTime = phraseSmoothTime("settle", slotSeconds);
        shiftDamper.current.x.value = at.x;
        shiftDamper.current.y.value = at.y;
        at.x = dampScalar(shiftDamper.current.x, want.x, smoothTime, dt);
        at.y = dampScalar(shiftDamper.current.y, want.y, smoothTime, dt);
      }
      applyLensShift(cam, at, viewportWidth, viewportHeight);
      return false;
    },
    [viewportWidth, viewportHeight, slotSeconds]
  );

  /**
   * The player takes the camera from the drift with anything they do to the
   * world: a press or a wheel on the canvas, or any key. It is theirs for the
   * rest of the hold. A press on the interface (the Release control itself)
   * is not a move of the camera, and leaves the drift to fall with the world.
   */
  useEffect(() => {
    const take = () => {
      if (frameState.attuned.phase !== "rest") driftTaken.current = true;
    };
    canvas.addEventListener("pointerdown", take);
    canvas.addEventListener("wheel", take, { passive: true });
    window.addEventListener("keydown", take);
    return () => {
      canvas.removeEventListener("pointerdown", take);
      canvas.removeEventListener("wheel", take);
      window.removeEventListener("keydown", take);
    };
  }, [canvas]);

  useFrame((state, dt) => {
    const ctl = controls.current;
    if (!ctl) return;

    const racked = rackShift(state.camera, dt, reducedMotion);

    // Impact kick: a quick FOV punch, no position meddling, so OrbitControls
    // never fights it. The world's breath rides the same lens (framing.ts §5):
    // the field of view widens and narrows on the bar, by at most
    // COMFORT.cameraBreath of itself, and the two compose without touching
    // each other. The kick is written every frame it decays, as it always was;
    // otherwise the lens is written only when the breath has moved it.
    const kicking = frameState.kick > 0.001;
    if (kicking) frameState.kick *= Math.exp(-dt * 5);
    const lens = state.camera as THREE.PerspectiveCamera;
    const fov = arenaFov(
      frameState.kick,
      cameraBreath(breathes, frameState.breathDepth, frameState.breathPhase)
    );
    if (kicking || Math.abs(lens.fov - fov) > FOV_STILL_DEGREES) {
      lens.fov = fov;
      lens.updateProjectionMatrix();
    }

    // A gesture owns the sightline until release: suspending the move keeps a
    // bead from drifting out from under a finger, and — see `cameraIsHeld` —
    // moving the camera while the controls are off moves it without aiming it.
    // A pose queued meanwhile waits for the hand rather than being dropped, so
    // a tap that attends is still answered by the camera once it has let go. A
    // held sightline with nothing waiting is deliberately frozen, so it counts
    // as settled for anything measuring the arena; one with a move waiting is
    // about to be replaced, so it does not.
    if (cameraIsHeld(ctl.enabled, frameState.aim.active)) {
      transitAge.current = 0;
      ctl.autoRotate = false;
      frameState.cameraSettled = goal.current === null;
      return;
    }

    // The focus view has let go and the rest pose is owed: at once after a
    // Cancel, and after a commit only once its performance has ended.
    if (releaseOwed.current && presentationNow() >= performingUntil.current) {
      releaseOwed.current = false;
      if (!reducedMotion && phase === "arena" && !lensActive) {
        perform(arenaHomePose(home, aspect, "release"));
      }
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
        const smoothTime = phraseSmoothTime(current.phrase, slotSeconds);
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
        easing.damp3(
          ctl.target,
          ORIGIN,
          phraseSmoothTime("release", slotSeconds),
          dt
        );
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
    // Nor under the focus view: an idle drift would carry the attended bead
    // out of its corner and sweep the lens across beads nobody looked at.
    const composing =
      releaseOwed.current || sampleFocusView().mode !== "roaming";
    ctl.autoRotate =
      !reducedMotion &&
      !performing &&
      mode !== "reveal" &&
      mode !== "concluding" &&
      ((phase === "arena" && idle && !frameState.aim.active && !composing) ||
        phase === "title" ||
        phase === "threshold" ||
        phase === "conclusion");

    /*
     * THE DRIFT (ADR-018, spec §13). While Attunement is held the camera takes
     * a slow orbit of the web — at most four degrees a breath, swelling on the
     * crest (`attuned.ts`) — about the orbit target, which at rest is the web's
     * centre. It is the camera's only authority while it runs: the idle orbit
     * stays off. It never runs under reduced motion (its rate is zero there),
     * in a reveal, under a scripted move, a gesture, the focus view or the
     * conclusion's performance, and the player's first act on the world takes
     * the camera from it for the rest of the hold. It moves on the music's
     * seconds, and falls with the world over the release's slot.
     */
    const attunedNow = frameState.attuned.phase !== "rest";
    const holding = frameState.attuned.phase === "entering";
    if (holding && !wasHolding.current) driftTaken.current = false;
    wasHolding.current = holding;
    const driftMay =
      attunedNow &&
      !driftTaken.current &&
      !reducedMotion &&
      phase === "arena" &&
      mode !== "reveal" &&
      mode !== "concluding" &&
      !performing &&
      !composing &&
      goal.current === null &&
      !frameState.aim.active;
    const musicalDt = frameState.musicalDt;
    driftGate.current = driftGateAfter(driftGate.current, driftMay, musicalDt);
    const angle = driftAngle(
      frameState.attunedAnswers.driftRate,
      driftGate.current,
      musicalDt
    );
    frameState.driftApplied = musicalDt > 0 ? angle / musicalDt : 0;
    if (angle > 0) {
      // The idle orbit's own sense of turn, so a drift that follows it does not reverse.
      driftOffset.copy(state.camera.position).sub(ctl.target).applyAxisAngle(UP, -angle);
      state.camera.position.copy(ctl.target).add(driftOffset);
    }
    if (attunedNow) ctl.autoRotate = false;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      touches={lensTouch ? LENS_TOUCHES : ROAMING_TOUCHES}
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
