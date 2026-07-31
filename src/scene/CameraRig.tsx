import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { easing } from "maath";
import { useStore } from "@/state/store";
import { useStore as useVanillaStore } from "zustand";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { ARENA_RADIUS } from "@/game/layout";
import { isCoarsePointer } from "@/lib/device";
import { frameState } from "./frameState";
import {
  ARENA_FOV,
  attendedFraming,
  createOrbitDamper,
  createOrbitPose,
  dampOrbitToward,
  orbitFromPosition,
  phraseSmoothTime,
  plateGeometry,
  plateSafeArea,
  type CameraPhrase,
} from "./framing";
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

const POSES: Record<string, Goal> = {
  title: {
    position: new THREE.Vector3(0, 0.5, 15.2),
    target: ORIGIN.clone(),
    phrase: "settle",
  },
  setup: {
    position: new THREE.Vector3(0, 0.7, 12.6),
    target: ORIGIN.clone(),
    phrase: "settle",
  },
  arena: {
    position: new THREE.Vector3(0, 0.85, 10.4),
    target: ORIGIN.clone(),
    phrase: "settle",
  },
  conclusion: {
    position: new THREE.Vector3(0.01, 9.6, 0.01),
    target: ORIGIN.clone(),
    phrase: "crown",
  },
};

/**
 * A portrait viewport is framed by its *width*: the armillary is as wide as it
 * is tall, so a distance chosen for the short axis crops the instrument in
 * half. This is why the phone pose stands so much further back.
 */
function arenaHomePose(aspect: number, phrase: CameraPhrase): Goal {
  if (aspect >= 0.75) {
    return { ...POSES.arena, phrase };
  }
  const halfSpan = ARENA_RADIUS * 1.24;
  const distance = Math.min(
    21,
    halfSpan / (Math.max(aspect, 0.3) * Math.tan((ARENA_FOV * Math.PI) / 360))
  );
  return {
    position: new THREE.Vector3(0, 0.7, distance),
    target: ORIGIN.clone(),
    phrase,
  };
}

const beadVec = new THREE.Vector3();
const screenVec = new THREE.Vector3();

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
   * Every scripted move enters here. One door, so a move is always a named
   * phrase and never an object literal invented at the call site.
   */
  const perform = useCallback((next: Goal): void => {
    goal.current = next;
    orbitFromPosition(next.position, goalOrbit.current);
    transitAge.current = 0;
  }, []);

  /** Attend: swing the instrument so the bead comes to a lower corner. */
  useLayoutEffect(() => {
    if (phase !== "arena" || lensActive) {
      previousAttendedId.current = null;
      return;
    }
    if (!attendedId) {
      if (previousAttendedId.current) {
        perform(arenaHomePose(aspect, "release"));
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

    const home = arenaHomePose(aspect, "lean");
    const portrait = aspect < 0.75;
    // Keep the bead on the side of the frame it is already on: the phrase is
    // a lean toward the idea, never a lurch across it.
    screenVec.copy(beadVec).project(camera);
    const side = screenVec.x >= 0 ? 1 : -1;
    const ndcX = side * (portrait ? ATTEND_NDC_X_PORTRAIT : ATTEND_NDC_X);
    const ndcY = portrait ? ATTEND_NDC_Y_PORTRAIT : ATTEND_NDC_Y;
    const ceiling = maxOrbit(aspect);
    const distance = Math.min(home.position.length() * 1.18, ceiling);

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

    const framing = attendedFraming({
      bead: beadVec,
      distance,
      aspect,
      ndcX,
      ndcY,
      safeArea,
      maxDistance: ceiling,
    });
    perform(
      framing
        ? { position: framing.position, target: framing.target, phrase: "lean" }
        : home
    );
  }, [
    attendedId,
    phase,
    lensActive,
    camera,
    aspect,
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
    perform(
      phase === "arena"
        ? arenaHomePose(aspect, "settle")
        : (POSES[phase] ?? POSES.title)
    );
  }, [phase, aspect, perform]);

  // The Lens: square up to whichever plane reading is showing.
  const wasLensed = useRef(false);
  useEffect(() => {
    if (lensActive) {
      wasLensed.current = true;
      perform({
        position: new THREE.Vector3(0, 0, aspect < 0.75 ? 16.5 : 10.6),
        target: ORIGIN.clone(),
        phrase: "square",
      });
    } else if (wasLensed.current && phase === "arena") {
      wasLensed.current = false;
      perform(arenaHomePose(aspect, "square"));
    }
  }, [lensActive, lensView, phase, aspect, perform]);

  /**
   * The concluding cinematic: rise to the pole and crown the finished web.
   * The one phrase that deliberately leaves the level behind, which is why it
   * takes two beats — and why reduced motion still performs it. Seeing the
   * whole web from above is information, not decoration.
   */
  const mode = useStore((s) => s.session?.interaction.mode ?? "idle");
  useEffect(() => {
    if (mode !== "concluding") return;
    const r = frameState.rendered;
    let maxSq = 0;
    for (let i = 0; i < r.length; i += 3) {
      maxSq = Math.max(maxSq, r[i] * r[i] + r[i + 1] * r[i + 1] + r[i + 2] * r[i + 2]);
    }
    const radius = Math.sqrt(maxSq) || ARENA_RADIUS;
    perform({
      position: new THREE.Vector3(0.01, radius * 2.6 + 3, 0.01),
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

  useFrame((state, dt) => {
    const ctl = controls.current;
    if (!ctl) return;

    // Impact kick: a quick FOV punch, no position meddling, so OrbitControls
    // never fights it.
    if (frameState.kick > 0.001) {
      frameState.kick *= Math.exp(-dt * 5);
      const cam = state.camera as THREE.PerspectiveCamera;
      cam.fov = ARENA_FOV * (1 - 0.04 * Math.sin(frameState.kick * Math.PI));
      cam.updateProjectionMatrix();
    }

    // Directional weaving owns the sightline until release; suspending the
    // move keeps a latched bead from drifting out from under a finger. A
    // weaving gesture deliberately freezes the sightline, so it counts as
    // settled for anything measuring the arena.
    if (frameState.aim.active) {
      ctl.autoRotate = false;
      frameState.cameraSettled = true;
      return;
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
    // is not: anything measured from it is already out of date.
    frameState.cameraSettled = goal.current === null;

    const mode = useStore.getState().session?.interaction.mode ?? "idle";
    const idle = presentationNow() - frameState.idleSince > IDLE_ORBIT_AFTER_MS;
    ctl.autoRotate =
      !reducedMotion &&
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
