import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useStore as useVanillaStore } from "zustand";
import {
  threadingEnv,
  advancePointerFrame,
  handlePointerMove,
  handlePointerUp,
  handlePointerCancel,
  handleKeyDown,
  handleWindowBlur,
} from "./threading";
import { emitBurst, frameState, frameStateStage } from "./frameState";
import { arcPoint } from "./curves";
import { threadCurves } from "./threadPicking";
import { attunementInvitation } from "@/audio/sfx";
import { conductor } from "@/audio/conductor";
import { idleClock, kindling } from "./idle";
import { DISPERSION_SPLIT } from "./glass";
import { sceneBudget } from "./quality";
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
import {
  focusPresentationStore,
  interpretationPresentationStore,
  readFocusView,
} from "@/state/interpretationPresentation";
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
  type TestStudySnapshot,
} from "@/runtime/testMode";
import { isStudyMode, studyStore, useStudy } from "@/state/studies";

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
  const focus = focusPresentationStore.getState();
  const view = readFocusView();
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
    draftIntention: draft.stage === "reading" ? draft.intention : null,
    draftCandidateConceptId:
      draft.stage === "locked" || draft.stage === "reading"
        ? String(draft.candidateConceptId)
        : null,
    candidateResonance: presentation.candidateResonance.map((candidate) => ({
      candidateId: String(candidate.candidateId),
      band: candidate.band,
    })),
    weaving: presentation.weaving,
    sightedConceptId: focus.sightedConceptId === null ? null : String(focus.sightedConceptId),
    previewIntention: focus.previewIntention,
    reopenedThreadId: focus.reopened === null ? null : String(focus.reopened.threadId),
    focus: {
      mode: view.mode,
      fogActive: view.fog.active,
      blurActive: view.fog.blur,
      lensActive: view.lensActive,
      sigilsVisible: view.sigilsVisible,
      attendedCardOpen:
        view.column.top.kind === "bead" && view.column.top.role !== "dwell",
      gapOpen: view.column.second.kind === "gap",
      sightedCardOpen:
        view.column.second.kind === "bead" && view.column.second.role === "sighted",
      dwellCardConceptId:
        view.column.top.kind === "bead" && view.column.top.role === "dwell"
          ? String(view.column.top.conceptId)
          : null,
    },
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

/**
 * The Studies load with the Studies (`scripts/bundle-budgets.json`), so the
 * adapter reaches them through the same dynamic import the screens use.
 */
async function startTestStudy(studyId: string): Promise<TestSessionSnapshot> {
  const { studies } = await import("@/runtime/studies");
  resetTestRuntime();
  studies.start(studyId);
  return testSnapshot();
}

function testStudySnapshot(): TestStudySnapshot {
  const state = studyStore.getState();
  const status = state.status;
  return {
    studyId: state.studyId,
    kind: status === null ? null : status.kind,
    by: status !== null && status.kind === "solved" ? status.by : null,
    threadIds:
      status !== null && status.kind === "solved" ? status.threadIds.map(String) : [],
    marks: status !== null && status.kind === "solved" ? [...status.marks] : [],
    notYet: state.notYet?.kind ?? null,
    plateOpen: state.plateOpen,
  };
}

async function declareTestSilence(): Promise<TestStudySnapshot> {
  const { studies } = await import("@/runtime/studies");
  studies.declareSilence();
  return testStudySnapshot();
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
 *
 * A Study is not invited at all (STUDIES-SPEC §7): no mark, and no sky, glint
 * or notes announcing one.
 */
function AttunementInvitation() {
  const [available, setAvailable] = useState(false);
  const studying = useStudy((state) => state.studyId !== null);
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
        if (!next || isStudyMode()) return;
        // The world notices before the interface does: the sky answers, the
        // arena's centre breathes out once, and two quiet notes rise. Nothing
        // interrupts, and nothing waits for a response.
        frameState.flare = Math.min(1, frameState.flare + 0.5);
        emitBurst([0, 0, 0], currentTheme().palette.gold, 18, 0.5);
        attunementInvitation();
      }),
    []
  );

  if (studying || composing) return null;
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
    /**
     * A world point on the page, or "behind" while it cannot be trusted. A
     * camera mid-transit, or a layout the scene has not drawn yet, would
     * report a point that is already wrong by the time anyone acts on it —
     * and on a slow software renderer "not yet" can be a second.
     */
    const screenOf = (
      point: THREE.Vector3,
      evenIfUnsettled = false
    ): { x: number; y: number; behind: boolean } => {
      if (
        frameState.framesSinceLayout < 3 ||
        (!frameState.cameraSettled && !evenIfUnsettled)
      ) {
        return { x: 0, y: 0, behind: true };
      }
      view.copy(point).applyMatrix4(camera.matrixWorldInverse);
      point.project(camera);
      const rect = gl.domElement.getBoundingClientRect();
      return {
        x: rect.left + ((point.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - point.y) / 2) * rect.height,
        behind:
          view.z >= 0 ||
          point.z < -1 ||
          point.z > 1 ||
          Math.abs(point.x) > 1 ||
          Math.abs(point.y) > 1,
      };
    };
    window.__gbgTest = {
      seedText: testMode.seedText!,
      seed: testMode.seed!,
      startSession: startTestSession,
      startStudy: startTestStudy,
      studyStatus: testStudySnapshot,
      declareSilence: declareTestSilence,
      snapshot: testSnapshot,
      advanceClock: advanceTestClock,
      beadScreen: (id: string, options?: { readonly evenIfUnsettled?: boolean }) => {
        const i = frameState.beadIndex.get(id);
        if (i === undefined) return null;
        v.set(
          frameState.rendered[i * 3],
          frameState.rendered[i * 3 + 1],
          frameState.rendered[i * 3 + 2]
        );
        return screenOf(v, options?.evenIfUnsettled === true);
      },
      threadScreen: (threadId: string, at = 0.5) => {
        const curve = threadCurves.get(threadId);
        if (curve === undefined) return null;
        arcPoint(curve.a, curve.m, curve.b, Math.min(1, Math.max(0, at)), v);
        return screenOf(v);
      },
      beadIds: () => [...frameState.beadIndex.keys()],
      musicalTime: () => ({ now: conductor.now(), ...conductor.report() }),
      conduct: ({ conceptId, inMs, durationMs, weight = 1 }) =>
        conductor.sound({
          conceptId,
          at: conductor.now() + inMs / 1000,
          duration: durationMs / 1000,
          weight,
        }),
      beadLight: (id: string) => {
        const i = frameState.beadIndex.get(id);
        if (i === undefined) return null;
        // The idle score's kindling is a pure function of the idle clock and
        // the draw, so whether it has had this bead lately can be asked again
        // here — the eased lane it leaves behind lasts about a second.
        const ids = useStore.getState().session?.beadIds ?? [];
        const instance = ids.indexOf(id);
        const now = idleClock();
        let kindled = false;
        for (let back = 0; back <= 1.5; back += 0.25) {
          if (kindling(now - back, ids.length).index === instance) {
            kindled = true;
            break;
          }
        }
        return { written: frameState.kindling[i], note: conductor.light(id), kindled };
      },
      attunement: () => {
        const state = frameState.attuned;
        const answers = frameState.attunedAnswers;
        const tier = useStore.getState().settings.qualityTier;
        return {
          held: domainSessionStore.getState().session?.attunementActive ?? false,
          phase: state.phase,
          value: state.value,
          voices: state.voices,
          cadenceAt: frameState.attunement.cadenceAt,
          ior: currentTheme().refraction + answers.ior,
          dispersion: sceneBudget(tier).dispersion
            ? DISPERSION_SPLIT * answers.dispersionScale
            : null,
          depthScale: answers.depthScale,
          figureGain: answers.figureGain,
          driftRate: answers.driftRate,
          driftApplied: frameState.driftApplied,
        };
      },
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

    // The pointer layer's own tick: the camera hold after a press is counted
    // in frames of the world, and the lens is put down the frame the focus
    // view stops sighting, not on the next move of a hand that may not move.
    advancePointerFrame();

    acc.current += dt;
    if (acc.current < 0.066) return;
    acc.current = 0;

    audio.applyBreath(frameState.breathPhase, frameState.breathDepth);

    const az = Math.atan2(state.camera.position.x, state.camera.position.z);
    ambient.setAirPan(Math.sin(az) * 0.5);
  });

  return <AttunementInvitation />;
}
