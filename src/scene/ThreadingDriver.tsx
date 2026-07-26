import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  threadingEnv,
  handlePointerMove,
  handlePointerUp,
  handlePointerCancel,
  handleKeyDown,
  handleWindowBlur,
} from "./threading";
import { frameState } from "./frameState";
import { startSession } from "@/runtime/session";
import { domainSessionStore } from "@/state/domainSession";
import {
  parseSessionEventLogV1,
  serializeSessionEventLogV1,
} from "@/domain/replay";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { interpretationPresentationStore } from "@/state/interpretationPresentation";
import { useStore } from "@/state/store";
import type { DisciplineId } from "@/content/types";
import { audio } from "@/audio/engine";
import { ambient } from "@/audio/ambient";
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
  const draft = interpretationDraftStore.getState().draft;
  const presentation = interpretationPresentationStore.getState();
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
    focusedBeadId: state.focusedBeadId,
    draftStage: draft.stage,
    draftAttendedConceptId:
      draft.stage === "inactive" ? null : String(draft.attendedConceptId),
    draftIntention:
      draft.stage === "armed" || draft.stage === "candidate-selected"
        ? draft.intention
        : null,
    draftCandidateConceptId:
      draft.stage === "candidate-selected"
        ? String(draft.candidateConceptId)
        : null,
    candidateResonance: presentation.candidateResonance.map((candidate) => ({
      candidateId: String(candidate.candidateId),
      band: candidate.band,
    })),
    weaving: presentation.weaving,
    snappedConceptId: frameState.snapId,
    message: presentation.message,
    failureMessage: presentation.failureMessage,
    now: gameNow(),
    domainSession: {
      eventCount: domain.eventLog.events.length,
      sessionId: domain.session.sessionId,
      seed: domain.session.seed,
      worldId: domain.session.worldId,
      conceptIds: [...domain.session.conceptIds],
      attendedConceptId: domain.session.attendedConceptId,
      eventTypes: domain.eventLog.events.map((event) => event.type),
      threads: domain.session.threads.map((thread) => ({
        id: thread.id,
        pair: [String(thread.pair[0]), String(thread.pair[1])],
        intention: thread.intention,
        inputModality: thread.gesture.inputModality,
        gesture: { ...thread.gesture },
      })),
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
  const phase = useStore((state) => state.phase);
  const sessionStartedAt = useStore(
    (state) => state.session?.startedAt ?? null
  );
  const lensActive = useStore((state) => state.lensActive);

  useEffect(() => {
    threadingEnv.camera = camera;
    threadingEnv.dom = gl.domElement;
    threadingEnv.controls = controls as unknown as { enabled: boolean } | null;
    return () => {
      handleWindowBlur();
      if (threadingEnv.dom === gl.domElement) threadingEnv.dom = null;
      if (threadingEnv.camera === camera) threadingEnv.camera = null;
      threadingEnv.controls = null;
    };
  }, [camera, gl, controls]);

  // A session/phase/lens replacement can reset the controller before the
  // physical pointer releases. Abort the scene-owned half in the same turn.
  useEffect(() => {
    handleWindowBlur();
  }, [phase, sessionStartedAt, lensActive]);

  // Explicit test-mode adapter: absent from ordinary development and production.
  useEffect(() => {
    if (!testMode.enabled) return;
    const v = new THREE.Vector3();
    const view = new THREE.Vector3();
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
        view.copy(v).applyMatrix4(camera.matrixWorldInverse);
        v.project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return {
          x: rect.left + ((v.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - v.y) / 2) * rect.height,
          behind:
            view.z >= 0 ||
            v.z < -1 ||
            v.z > 1 ||
            Math.abs(v.x) > 1 ||
            Math.abs(v.y) > 1,
        };
      },
      beadIds: () => [...frameState.beadIndex.keys()],
      canonicalEventLog: () => {
        const eventLog = domainSessionStore.getState().eventLog;
        if (!eventLog) throw new Error("canonical event log is unavailable");
        return serializeSessionEventLogV1(eventLog);
      },
      reloadCanonical: () => {
        const eventLog = domainSessionStore.getState().eventLog;
        if (!eventLog) throw new Error("canonical event log is unavailable");
        const serialized = serializeSessionEventLogV1(eventLog);
        domainSessionStore
          .getState()
          .loadEventLog(parseSessionEventLogV1(serialized));
        return testSnapshot();
      },
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
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") handleWindowBlur();
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("keydown", handleKeyDown);
    gl.domElement.addEventListener("lostpointercapture", handlePointerCancel);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("keydown", handleKeyDown);
      gl.domElement.removeEventListener("lostpointercapture", handlePointerCancel);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      handleWindowBlur();
    };
  }, [gl]);

  // The ~15 Hz frame→audio bridge: breath, silk, sympathy, and the air
  // bed's camera-following pan. One throttle, four whispers.
  const acc = useRef(0);
  useFrame((state, dt) => {
    if (testMode.enabled) recordFrameSample(dt);
    acc.current += dt;
    if (acc.current < 0.066) return;
    acc.current = 0;

    audio.applyBreath(frameState.breathPhase, frameState.breathDepth);

    const az = Math.atan2(state.camera.position.x, state.camera.position.z);
    ambient.setAirPan(Math.sin(az) * 0.5);
  });

  return null;
}
