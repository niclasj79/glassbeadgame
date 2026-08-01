import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useStore as useVanillaStore } from "zustand";
import {
  threadingEnv,
  advanceRecoil,
  handlePointerMove,
  handlePointerUp,
  handlePointerCancel,
  handleKeyDown,
  handleWindowBlur,
} from "./threading";
import { emitBurst, frameState, frameStateStage } from "./frameState";
import { attunementInvitation } from "@/audio/sfx";
import {
  attachWorldDirectors,
  createHapticsDirector,
  createSceneDirector,
  productionHapticsStage,
} from "@/runtime/scene";
import { sessionProgression } from "@/runtime/progression";
import { currentTheme } from "@/themes/useTheme";
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
import { cueBus } from "@/runtime/cues";
import { audio } from "@/audio/engine";
import { ambient } from "@/audio/ambient";
import {
  advanceTestClock,
  gameNow,
  presentationNow,
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

const worldDirectors = {
  scene: createSceneDirector(frameStateStage),
  haptics: createHapticsDirector(productionHapticsStage),
};

/**
 * THE INVITATION, IN THE WORLD.
 *
 * Attunement was unreachable: `enterAttunement` had no caller anywhere in the
 * application. Spec §13 requires it be explicitly invited and never forced, and
 * §23 step 11 puts it in the golden path — so the invitation is a mark that
 * appears at the centre of the arena, which is the one place that belongs to
 * the web as a whole rather than to any bead in it, and only once the
 * composition has earned it.
 *
 * It is not a HUD button sitting there from the first second: it does not exist
 * until eligibility flips, it steps aside entirely while an interpretation is
 * being composed, and it never counts down toward anything. Accepting it is one
 * click or one Tab and Enter; ignoring it costs nothing and it never asks
 * twice.
 */
function AttunementInvitation() {
  const [available, setAvailable] = useState(false);
  const attuned = useVanillaStore(
    domainSessionStore,
    (state) => state.session?.attunementActive ?? false
  );
  const composing = useVanillaStore(
    interpretationDraftStore,
    (state) => state.draft.stage !== "inactive"
  );

  useEffect(
    () =>
      sessionProgression.onInvitationChanged((next) => {
        setAvailable(next);
        if (!next) return;
        // The world notices before the interface does: the sky answers, the
        // arena's centre breathes out once, and two quiet notes rise. Nothing
        // interrupts, and nothing waits for a response.
        frameState.flare = Math.min(1, frameState.flare + 0.5);
        emitBurst([0, 0, 0], currentTheme().palette.gold, 18, 0.5);
        attunementInvitation();
      }),
    []
  );

  if (composing) return null;
  if (!available && !attuned) return null;

  return (
    <Html center style={{ pointerEvents: "none" }} zIndexRange={[16, 10]}>
      <div className="relative touch-none">
        {available && !attuned && (
          <p role="status" aria-live="polite" className="sr-only">
            The web can carry Attunement now. It is offered, not required.
          </p>
        )}
        <button
          type="button"
          data-testid="world-attunement"
          aria-pressed={attuned}
          aria-label={
            attuned
              ? "Release Attunement and return to composing"
              : "Enter Attunement and listen to the web one thread at a time"
          }
          title={
            attuned
              ? "Release Attunement and go back to composing."
              : "Attunement — the world quietens and the web sounds one thread at a time, so you can hear what you have made. Nothing is added, nothing is scored, and you can leave whenever you like."
          }
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            if (attuned) sessionProgression.exitAttunement();
            else sessionProgression.enterAttunement();
          }}
          className="group pointer-events-auto grid h-14 w-14 place-items-center rounded-full border border-brass/60 bg-void/70 text-bright backdrop-blur-[2px] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow aria-pressed:border-glow aria-pressed:bg-glow/15 [&:focus-visible_.attune-gloss]:opacity-100"
        >
          <span className="font-display text-2xl leading-none" aria-hidden="true">
            {attuned ? "◉" : "◎"}
          </span>
          {/*
            "Attune" is a word, not an explanation. A player who has never met
            it has no way to know whether pressing it costs them anything — and
            in a game with no failure state, hesitating over a button is a
            failure of copy rather than of nerve. The mark keeps its one-word
            name; the sentence that says what happens arrives on hover and on
            focus, and lives in full in the title and the accessible name.
          */}
          <span
            className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 text-center"
            aria-hidden="true"
          >
            <span className="block whitespace-nowrap font-ui text-[9px] uppercase tracking-[0.18em] text-dim">
              {attuned ? "Release" : "Attune"}
            </span>
            <span className="attune-gloss mx-auto mt-1 block w-52 font-ui text-[9px] normal-case leading-relaxed tracking-[0.04em] text-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {attuned
                ? "Go back to composing."
                : "The world quietens and the web sounds one thread at a time. Nothing is added or scored — leave whenever you like."}
            </span>
          </span>
        </button>
      </div>
    </Html>
  );
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
        // A camera mid-transit, or a layout the scene has not drawn yet,
        // would report a point that is already wrong by the time anyone acts
        // on it — and on a slow software renderer "not yet" can be a second.
        if (!frameState.cameraSettled || frameState.framesSinceLayout < 3) {
          return { x: 0, y: 0, behind: true };
        }
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

  /**
   * The world becomes a cue subscriber — on all three of its channels.
   *
   * Every plan in `planCues.ts` declares `scene`, `camera` and `haptics`. Only
   * `scene` was ever subscribed, so `frameState.kick` was decayed every frame
   * and raised only as a side effect of the scene handler, and the haptics
   * channel reached nothing at all. `attachWorldDirectors` takes all three at
   * once so a channel cannot be lost by omission again.
   */
  useEffect(() => attachWorldDirectors(cueBus, worldDirectors), []);

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

    // The cue bus owns no timer of its own, so that a staged cue can never
    // drift from the frame that dresses it. Ticking every frame — not on the
    // throttled path below — is what keeps an outcome landing when the planner
    // said it would.
    cueBus.tick(presentationNow() / 1000);

    // The ribbon falling back out of a missed weave. Driven by frame time, not
    // by a clock, so a controlled test clock cannot leave it hanging in the air.
    advanceRecoil(Math.min(dt, 1 / 20));

    acc.current += dt;
    if (acc.current < 0.066) return;
    acc.current = 0;

    audio.applyBreath(frameState.breathPhase, frameState.breathDepth);

    const az = Math.atan2(state.camera.position.x, state.camera.position.z);
    ambient.setAirPan(Math.sin(az) * 0.5);
  });

  return <AttunementInvitation />;
}
