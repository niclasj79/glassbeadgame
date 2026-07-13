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
import { startSession } from "@/runtime/session";
import { domainSessionStore } from "@/state/domainSession";
import { useStore } from "@/state/store";
import type { DisciplineId } from "@/content/types";
import { audio } from "@/audio/engine";
import { ambient } from "@/audio/ambient";
import { updateSilk, updateSympathy } from "@/audio/sfx";
import {
  advanceTestClock,
  gameNow,
  finishFrameSample,
  recordFrameSample,
  resetTestRuntime,
  startFrameSample,
  testMode,
  type TestSessionSnapshot,
} from "@/runtime/testMode";

function testSnapshot(): TestSessionSnapshot {
  const state = useStore.getState();
  const session = state.session;
  const domain = domainSessionStore.getState();
  if (
    !testMode.enabled ||
    !testMode.seedText ||
    !session ||
    !domain.eventLog ||
    !domain.session
  ) {
    throw new Error("test session is not active");
  }
  return {
    phase: state.phase,
    seed: session.seed,
    seedText: testMode.seedText,
    disciplines: [...session.disciplines],
    beadIds: [...session.beadIds],
    themeId: session.themeId,
    startedAt: session.startedAt,
    score: session.score,
    threads: session.threads.map(({ id, a, b, kind, tier, createdAt }) => ({
      id,
      a,
      b,
      kind,
      tier,
      createdAt,
    })),
    discoveries: session.discoveries.map(({ id, kind, points }) => ({ id, kind, points })),
    interactionMode: session.interaction.mode,
    now: gameNow(),
    domainSession: {
      eventCount: domain.eventLog.events.length,
      sessionId: domain.session.sessionId,
      seed: domain.session.seed,
      worldId: domain.session.worldId,
      conceptIds: [...domain.session.conceptIds],
    },
  };
}

function startTestSession(picks: DisciplineId[]): TestSessionSnapshot {
  resetTestRuntime();
  startSession(picks, { seed: testMode.seed! });
  return testSnapshot();
}

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

  // Explicit test-mode adapter: absent from ordinary development and production.
  useEffect(() => {
    if (!testMode.enabled) return;
    const v = new THREE.Vector3();
    window.__gbgTest = {
      seedText: testMode.seedText!,
      seed: testMode.seed!,
      startSession: startTestSession,
      snapshot: testSnapshot,
      advanceClock: advanceTestClock,
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
      weave: (a: string, b: string) => devCommit(a, b),
      startFrameSample,
      finishFrameSample,
      rendererInfo: () => {
        const context = gl.getContext();
        const extension = context.getExtension("WEBGL_debug_renderer_info");
        const renderer = extension ? String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : "unavailable";
        const vendor = extension ? String(context.getParameter(extension.UNMASKED_VENDOR_WEBGL)) : "unavailable";
        return { renderer, vendor, software: /swiftshader|llvmpipe|software/iu.test(`${renderer} ${vendor}`) };
      },
      presentationProfile: () => {
        const { qualityTier, reducedMotion } = useStore.getState().settings;
        return { qualityTier, reducedMotion };
      },
    };
    return () => {
      delete window.__gbgTest;
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
    if (testMode.enabled) recordFrameSample(dt);
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
