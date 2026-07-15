import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { easing } from "maath";
import { useStore } from "@/state/store";
import { useStore as useVanillaStore } from "zustand";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { frameState } from "./frameState";
import { presentationNow } from "@/runtime/testMode";

interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const POSES: Record<string, Pose> = {
  title: { position: new THREE.Vector3(0, 0.5, 13.8), target: new THREE.Vector3(0, 0, 0) },
  setup: { position: new THREE.Vector3(0, 0.7, 11.5), target: new THREE.Vector3(0, 0, 0) },
  arena: { position: new THREE.Vector3(0, 0.7, 8.9), target: new THREE.Vector3(0, 0, 0) },
  conclusion: {
    position: new THREE.Vector3(0.01, 8.6, 0.01),
    target: new THREE.Vector3(0, 0, 0),
  },
};

const IDLE_ORBIT_AFTER_MS = 10_000;
const ORIGIN = new THREE.Vector3(0, 0, 0);

/**
 * One camera, two authorities: the user's orbit, and scripted transits.
 * A transit damps both camera position and controls target toward a pose;
 * any user gesture instantly returns authority to the user.
 */
export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const transit = useRef<Pose | null>(null);
  const camera = useThree((s) => s.camera);
  const phase = useStore((s) => s.phase);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);
  const lensActive = useStore((s) => s.lensActive);
  const lensView = useStore((s) => s.lensView);

  const aspect = useThree((s) => s.viewport.aspect);

  // M2 situated attention: lean toward the attended bead without losing the sphere.
  useEffect(() => {
    if (phase !== "arena" || lensActive || draft.stage === "inactive") return;
    const index = frameState.beadIndex.get(String(draft.attendedConceptId));
    if (index === undefined) return;
    const rendered = frameState.rendered;
    const bead = new THREE.Vector3(
      rendered[index * 3],
      rendered[index * 3 + 1],
      rendered[index * 3 + 2]
    );
    const pose = {
      position: POSES.arena.position.clone().addScaledVector(bead, 0.08),
      target: bead.multiplyScalar(0.28).add(new THREE.Vector3(0.45, 0.2, 0)),
    };
    if (reducedMotion) {
      camera.position.copy(pose.position);
      controls.current?.target.copy(pose.target);
    } else {
      transit.current = pose;
    }
  }, [draft, phase, lensActive, reducedMotion, camera]);

  useEffect(() => {
    let pose = POSES[phase] ?? POSES.title;
    // Portrait phones: pull in so the sphere fills the narrow frame.
    if (phase === "arena" && aspect < 0.75) {
      pose = {
        position: new THREE.Vector3(0, 0.6, 8.2),
        target: new THREE.Vector3(0, 0, 0),
      };
    }
    if (reducedMotion) {
      camera.position.copy(pose.position);
      controls.current?.target.copy(pose.target);
      transit.current = null;
    } else {
      transit.current = pose;
    }
  }, [phase, reducedMotion, camera, aspect]);

  // The Lens: square up to whichever transcendental plane is showing, so
  // each view of the triptych reads as a true chart. Leaving returns home.
  const wasLensed = useRef(false);
  useEffect(() => {
    if (lensActive) {
      wasLensed.current = true;
      const pose = {
        position: new THREE.Vector3(0, 0, aspect < 0.75 ? 11 : 9.4),
        target: new THREE.Vector3(0, 0, 0),
      };
      if (reducedMotion) {
        camera.position.copy(pose.position);
        controls.current?.target.copy(pose.target);
      } else {
        transit.current = pose;
      }
    } else if (wasLensed.current && phase === "arena") {
      wasLensed.current = false;
      const pose =
        aspect < 0.75
          ? { position: new THREE.Vector3(0, 0.6, 8.2), target: new THREE.Vector3(0, 0, 0) }
          : POSES.arena;
      if (reducedMotion) {
        camera.position.copy(pose.position);
        controls.current?.target.copy(pose.target);
      } else {
        transit.current = pose;
      }
    }
  }, [lensActive, lensView, phase, reducedMotion, camera, aspect]);

  // The concluding cinematic: rise to the pole and crown the finished web,
  // framed to the web's actual reach (the Lens may have spread it wide).
  const mode = useStore((s) => s.session?.interaction.mode ?? "idle");
  useEffect(() => {
    if (mode === "concluding" && !reducedMotion) {
      const r = frameState.rendered;
      let maxSq = 0;
      for (let i = 0; i < r.length; i += 3) {
        maxSq = Math.max(maxSq, r[i] * r[i] + r[i + 1] * r[i + 1] + r[i + 2] * r[i + 2]);
      }
      const radius = Math.sqrt(maxSq) || 3;
      transit.current = {
        position: new THREE.Vector3(0.01, radius * 2.4 + 3, 0.01),
        target: new THREE.Vector3(0, 0, 0),
      };
    }
  }, [mode, reducedMotion]);

  // The reveal moment: dolly along the current sightline to frame the pair.
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
    const dist = Math.max(3.1, span * 1.15 + 1.6);
    transit.current = {
      position: mid.clone().addScaledVector(dir, dist),
      target: mid,
    };
  }, [revealId, reducedMotion, camera]);

  useFrame((state, dt) => {
    const ctl = controls.current;
    if (!ctl) return;

    // Impact kick: a quick FOV punch on curated discoveries — no position
    // meddling, so OrbitControls never fights it.
    if (frameState.kick > 0.001) {
      frameState.kick *= Math.exp(-dt * 5);
      const cam = state.camera as THREE.PerspectiveCamera;
      cam.fov = 42 * (1 - 0.045 * Math.sin(frameState.kick * Math.PI));
      cam.updateProjectionMatrix();
    }

    if (transit.current) {
      frameState.recenter = false; // a transit owns the target
      easing.damp3(state.camera.position, transit.current.position, 0.85, dt);
      easing.damp3(ctl.target, transit.current.target, 0.85, dt);
      if (state.camera.position.distanceTo(transit.current.position) < 0.04) {
        transit.current = null;
      }
    } else if (frameState.recenter) {
      // Post-reveal homecoming: pan the orbit target back to the arena's
      // heart without touching the camera — the world re-centers itself.
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
        phase === "conclusion"); // the mandala turns slowly under the Annotation
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      minDistance={4.2}
      maxDistance={aspect < 0.75 ? 20 : 16}
      autoRotateSpeed={0.35}
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
