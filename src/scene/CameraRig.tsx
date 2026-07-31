import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { easing } from "maath";
import { useStore } from "@/state/store";
import { useStore as useVanillaStore } from "zustand";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { ARENA_RADIUS } from "@/game/layout";
import { frameState } from "./frameState";
import { ARENA_FOV, attendedFraming } from "./framing";
import { presentationNow } from "@/runtime/testMode";

/**
 * CAMERA AS PHRASING
 *
 * Two authorities: the player's orbit, and scripted transits. A transit damps
 * position and target toward a pose with its own smoothing time, so an Attend
 * reads as a different gesture from a return home — the sequence of moves is
 * the player's performance, and the camera phrases it (INTERACTION-DECISIONS,
 * "Camera traversal as performance phrasing").
 *
 * The attended posture is a *rotation of the whole instrument*, not a pan off
 * the arena: the armillary's centre stays at the centre of frame and the
 * attended bead is carried into a lower corner, so intimacy costs no overview
 * (I-012). Under reduced motion no transit is issued at all — the same state
 * is carried by the gold rule on the setting, the intention plate, and the
 * recession of everything else.
 */

interface Pose {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
  /** Damping time in seconds. This is the phrasing. */
  readonly smoothTime: number;
}

/**
 * The orbit ceiling, shared by the controls and by every scripted pose. A
 * transit aimed past it can never arrive — the controls clamp the camera back
 * every frame — and a transit that never arrives leaves the arena permanently
 * "in motion" for anything that measures it.
 */
const maxOrbit = (aspect: number): number => (aspect < 0.75 ? 26 : 18);

/** A transit is abandoned if it has not arrived in this long. */
const TRANSIT_TIMEOUT_S = 3.5;

const IDLE_ORBIT_AFTER_MS = 10_000;
const ORIGIN = new THREE.Vector3(0, 0, 0);

/** Where the attended bead is asked to sit, in NDC. Lower corner, both axes. */
const ATTEND_NDC_X = 0.34;
const ATTEND_NDC_Y = -0.28;
const ATTEND_NDC_X_PORTRAIT = 0.3;
const ATTEND_NDC_Y_PORTRAIT = -0.32;

const POSES: Record<string, Pose> = {
  title: {
    position: new THREE.Vector3(0, 0.5, 15.2),
    target: ORIGIN.clone(),
    smoothTime: 1.1,
  },
  setup: {
    position: new THREE.Vector3(0, 0.7, 12.6),
    target: ORIGIN.clone(),
    smoothTime: 0.95,
  },
  arena: {
    position: new THREE.Vector3(0, 0.85, 10.4),
    target: ORIGIN.clone(),
    smoothTime: 0.85,
  },
  conclusion: {
    position: new THREE.Vector3(0.01, 9.6, 0.01),
    target: ORIGIN.clone(),
    smoothTime: 1.3,
  },
};

/**
 * A portrait viewport is framed by its *width*: the armillary is as wide as it
 * is tall, so a distance chosen for the short axis crops the instrument in
 * half. This is why the phone pose stands so much further back.
 */
function arenaHomePose(aspect: number): Pose {
  if (aspect >= 0.75) return POSES.arena;
  const halfSpan = ARENA_RADIUS * 1.24;
  const distance = Math.min(
    21,
    halfSpan / (Math.max(aspect, 0.3) * Math.tan((ARENA_FOV * Math.PI) / 360))
  );
  return {
    position: new THREE.Vector3(0, 0.7, distance),
    target: ORIGIN.clone(),
    smoothTime: 0.85,
  };
}

const beadVec = new THREE.Vector3();
const screenVec = new THREE.Vector3();

export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const transit = useRef<Pose | null>(null);
  const transitAge = useRef(0);
  const camera = useThree((s) => s.camera);
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

  /** Attend: swing the instrument so the bead comes to a lower corner. */
  useLayoutEffect(() => {
    if (phase !== "arena" || lensActive) {
      previousAttendedId.current = null;
      return;
    }
    // Reduced motion communicates the same state without forced travel.
    if (reducedMotion) {
      previousAttendedId.current = attendedId;
      return;
    }
    if (!attendedId) {
      if (previousAttendedId.current) {
        transitAge.current = 0;
        transit.current = arenaHomePose(aspect);
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

    const home = arenaHomePose(aspect);
    const portrait = aspect < 0.75;
    // Keep the bead on the side of the frame it is already on: the phrase is
    // a lean toward the idea, never a lurch across it.
    screenVec.copy(beadVec).project(camera);
    const side = screenVec.x >= 0 ? 1 : -1;
    const ndcX = side * (portrait ? ATTEND_NDC_X_PORTRAIT : ATTEND_NDC_X);
    const ndcY = portrait ? ATTEND_NDC_Y_PORTRAIT : ATTEND_NDC_Y;
    const distance = Math.min(home.position.length() * 1.18, maxOrbit(aspect));

    const framing = attendedFraming({
      bead: beadVec,
      distance,
      aspect,
      ndcX,
      ndcY,
    });
    transitAge.current = 0;
    transit.current = framing
      ? { position: framing.position, target: framing.target, smoothTime: 0.9 }
      : home;
  }, [attendedId, phase, lensActive, reducedMotion, camera, aspect]);

  /** Arming is a smaller phrase: a short breath inward, no re-framing. */
  useEffect(() => {
    if (!armed || reducedMotion || phase !== "arena" || lensActive) return;
    const current = transit.current;
    const from = current ? current.position : camera.position;
    transitAge.current = 0;
    transit.current = {
      position: from.clone().multiplyScalar(0.965),
      target: (current ? current.target : ORIGIN).clone(),
      smoothTime: 0.5,
    };
  }, [armed, reducedMotion, phase, lensActive, camera]);

  // A layout effect: the pose must land in the same commit that publishes the
  // bead layout, before anything can measure the arena. As a passive effect it
  // ran a task later, and for that task the world reported bead positions from
  // a camera that had already been replaced.
  useLayoutEffect(() => {
    const pose =
      phase === "arena" ? arenaHomePose(aspect) : (POSES[phase] ?? POSES.title);
    if (reducedMotion) {
      camera.position.copy(pose.position);
      controls.current?.target.copy(pose.target);
      transit.current = null;
    } else {
      transitAge.current = 0;
      transit.current = pose;
    }
  }, [phase, reducedMotion, camera, aspect]);

  // The Lens: square up to whichever transcendental plane is showing.
  const wasLensed = useRef(false);
  useEffect(() => {
    if (lensActive) {
      wasLensed.current = true;
      const pose: Pose = {
        position: new THREE.Vector3(0, 0, aspect < 0.75 ? 16.5 : 10.6),
        target: ORIGIN.clone(),
        smoothTime: 0.8,
      };
      if (reducedMotion) {
        camera.position.copy(pose.position);
        controls.current?.target.copy(pose.target);
      } else {
        transit.current = pose;
      }
    } else if (wasLensed.current && phase === "arena") {
      wasLensed.current = false;
      const pose = arenaHomePose(aspect);
      if (reducedMotion) {
        camera.position.copy(pose.position);
        controls.current?.target.copy(pose.target);
      } else {
        transit.current = pose;
      }
    }
  }, [lensActive, lensView, phase, reducedMotion, camera, aspect]);

  // The concluding cinematic: rise to the pole and crown the finished web.
  const mode = useStore((s) => s.session?.interaction.mode ?? "idle");
  useEffect(() => {
    if (mode === "concluding" && !reducedMotion) {
      const r = frameState.rendered;
      let maxSq = 0;
      for (let i = 0; i < r.length; i += 3) {
        maxSq = Math.max(maxSq, r[i] * r[i] + r[i + 1] * r[i + 1] + r[i + 2] * r[i + 2]);
      }
      const radius = Math.sqrt(maxSq) || ARENA_RADIUS;
      transit.current = {
        position: new THREE.Vector3(0.01, radius * 2.6 + 3, 0.01),
        target: ORIGIN.clone(),
        smoothTime: 1.4,
      };
    }
  }, [mode, reducedMotion]);

  // The reveal: dolly along the current sightline to frame the pair.
  const revealId = useStore((s) => s.session?.interaction.reveal?.id ?? null);
  useEffect(() => {
    if (!revealId || reducedMotion) return;
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
    const dist = Math.max(3.4, span * 1.15 + 2.0);
    transit.current = {
      position: mid.clone().addScaledVector(dir, dist),
      target: mid,
      smoothTime: 1.0,
    };
  }, [revealId, reducedMotion, camera]);

  useFrame((state, dt) => {
    const ctl = controls.current;
    if (!ctl) return;
    // Published before any early return: everything that measures the arena
    // needs to know whether the camera it is measuring from is the final one.
    // A weaving gesture owns the sightline and deliberately freezes it, so it
    // counts as settled; a transit still easing toward its pose does not,
    // because anything measured from it is already out of date.
    frameState.cameraSettled = frameState.aim.active || transit.current === null;

    // Impact kick: a quick FOV punch, no position meddling, so OrbitControls
    // never fights it.
    if (frameState.kick > 0.001) {
      frameState.kick *= Math.exp(-dt * 5);
      const cam = state.camera as THREE.PerspectiveCamera;
      cam.fov = ARENA_FOV * (1 - 0.04 * Math.sin(frameState.kick * Math.PI));
      cam.updateProjectionMatrix();
    }

    // Directional weaving owns the sightline until release; suspending the
    // transit keeps a latched bead from drifting out from under a finger.
    if (frameState.aim.active) {
      ctl.autoRotate = false;
      return;
    }

    if (transit.current) {
      frameState.recenter = false;
      transitAge.current += dt;
      easing.damp3(
        state.camera.position,
        transit.current.position,
        transit.current.smoothTime,
        dt
      );
      easing.damp3(ctl.target, transit.current.target, transit.current.smoothTime, dt);
      if (
        state.camera.position.distanceTo(transit.current.position) < 0.04 ||
        transitAge.current > TRANSIT_TIMEOUT_S
      ) {
        transit.current = null;
        transitAge.current = 0;
      }
    } else if (frameState.recenter) {
      easing.damp3(ctl.target, ORIGIN, 0.7, dt);
      if (ctl.target.lengthSq() < 0.002) {
        ctl.target.set(0, 0, 0);
        frameState.recenter = false;
      }
    }

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
      minDistance={5.2}
      maxDistance={maxOrbit(aspect)}
      autoRotateSpeed={0.28}
      onStart={() => {
        frameState.idleSince = presentationNow();
        transit.current = null;
      }}
      onChange={() => {
        frameState.idleSince = presentationNow();
      }}
    />
  );
}
