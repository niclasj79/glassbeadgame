import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { easing } from "maath";
import { useStore } from "@/state/store";
import { frameState } from "./frameState";

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

  useEffect(() => {
    const pose = POSES[phase] ?? POSES.title;
    if (reducedMotion) {
      camera.position.copy(pose.position);
      controls.current?.target.copy(pose.target);
      transit.current = null;
    } else {
      transit.current = pose;
    }
  }, [phase, reducedMotion, camera]);

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

    if (transit.current) {
      easing.damp3(state.camera.position, transit.current.position, 0.85, dt);
      easing.damp3(ctl.target, transit.current.target, 0.85, dt);
      if (state.camera.position.distanceTo(transit.current.position) < 0.04) {
        transit.current = null;
      }
    }

    const mode = useStore.getState().session?.interaction.mode ?? "idle";
    const idle = performance.now() - frameState.idleSince > IDLE_ORBIT_AFTER_MS;
    ctl.autoRotate =
      !reducedMotion &&
      mode !== "reveal" &&
      mode !== "concluding" &&
      ((phase === "arena" && idle && !frameState.aim.active) || phase === "title" || phase === "setup");
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
      maxDistance={13}
      autoRotateSpeed={0.35}
      onStart={() => {
        frameState.idleSince = performance.now();
        transit.current = null;
      }}
      onChange={() => {
        frameState.idleSince = performance.now();
      }}
    />
  );
}
