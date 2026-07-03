import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  threadingEnv,
  handlePointerMove,
  handlePointerUp,
  handleKeyDown,
  devCommit,
  pointerMotion,
} from "./threading";
import { frameState } from "./frameState";
import { useStore } from "@/state/store";
import { connectionByPair } from "@/content/connections";
import { pairKey } from "@/content/types";
import { audio } from "@/audio/engine";
import { ambient } from "@/audio/ambient";
import { updateSilk, updateSympathy } from "@/audio/sfx";

/** Wires the pointer state machine to the live camera, canvas, and controls. */
export function ThreadingDriver() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls);

  useEffect(() => {
    threadingEnv.camera = camera;
    threadingEnv.dom = gl.domElement;
    threadingEnv.controls = controls as unknown as { enabled: boolean } | null;
  }, [camera, gl, controls]);

  // Dev-only E2E hook: lets tests locate beads in screen space and drive the
  // real pointer pipeline with synthetic events. Stripped from production.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const v = new THREE.Vector3();
    (window as unknown as Record<string, unknown>).__gbgTest = {
      beadScreen: (id: string) => {
        const i = frameState.beadIndex.get(id);
        if (i === undefined) return null;
        v.set(
          frameState.rendered[i * 3],
          frameState.rendered[i * 3 + 1],
          frameState.rendered[i * 3 + 2]
        );
        v.project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return {
          x: rect.left + ((v.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - v.y) / 2) * rect.height,
          behind: v.z > 1,
        };
      },
      beadIds: () => [...frameState.beadIndex.keys()],
      canvas: () => gl.domElement,
      curatedPairs: () => {
        const ids = useStore.getState().session?.beadIds ?? [];
        const out: [string, string][] = [];
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            if (connectionByPair.has(pairKey(ids[i], ids[j]))) out.push([ids[i], ids[j]]);
          }
        }
        return out;
      },
      weave: (a: string, b: string) => devCommit(a, b),
    };
  }, [camera, gl]);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // The ~15 Hz frame→audio bridge: breath, silk, sympathy, and the air
  // bed's camera-following pan. One throttle, four whispers.
  const acc = useRef(0);
  useFrame((state, dt) => {
    acc.current += dt;
    if (acc.current < 0.066) return;
    acc.current = 0;

    audio.applyBreath(frameState.breathPhase, frameState.breathDepth);

    const mode = useStore.getState().session?.interaction.mode;
    if (mode === "threading") {
      updateSilk(pointerMotion.speed);
      updateSympathy(frameState.sympathy);
    }
    pointerMotion.speed *= 0.82; // decay between events so stillness = silence

    const az = Math.atan2(state.camera.position.x, state.camera.position.z);
    ambient.setAirPan(Math.sin(az) * 0.5);
  });

  return null;
}
