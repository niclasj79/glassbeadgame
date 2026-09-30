import type { InputModality, RelationIntention } from "../../domain/events";
import type { ConceptId, ThreadId } from "../../domain/ids";
import { INTENTION_LABELS } from "../../domain/outcomes";
import type { FacetId } from "../../content/castalia/schema";
import type { DomainSessionStore } from "../../state/domainSession";
import type { InterpretationDraftStore } from "../../state/interactionDraft";
import type {
  FocusPresentationStore,
  InterpretationPresentationStore,
} from "../../state/interpretationPresentation";
import type { NormalizedGestureSample } from "../gestureProfile";
import type { CuePlan } from "../cues";
import {
  planAttention,
  planAttentionCleared,
  planPairLocked,
  planReadingPreviewed,
  planSighting,
  planThreadReopened,
} from "../cues";
import type { InterpretationDraft } from "../interactionDraft";
import {
  createInterpretationAttentionCoordinator,
  type ResolveCandidateEvidence,
} from "./createInterpretationAttentionCoordinator";
import { createInterpretationCommitCoordinator } from "./createInterpretationCommitCoordinator";
import { createInterpretationThreadId } from "./createInterpretationThreadId";

const MAX_GESTURE_SAMPLES = 128;

/** First-use phrases accepted in I-007, spoken once, the same everywhere. */
const READING_PHRASE: Readonly<Record<RelationIntention, string>> = Object.freeze({
  echo: "shares a form",
  passage: "carries or transforms",
  tension: "opposes or complicates",
  ground: "supports or embodies",
});

export interface GesturePoint {
  readonly xViewport: number;
  readonly yViewport: number;
  readonly pressure?: number;
}

/** The weave's hold: from pressing a reading's sigil to releasing it (I-020). */
interface HoldCapture {
  readonly inputModality: InputModality;
  readonly startedAtMs: number;
  readonly messageBeforeCapture: string;
  readonly samples: NormalizedGestureSample[];
}

/** The lens path from Attend to Lock: where the expressive sweep now lives. */
interface ApproachCapture {
  readonly inputModality: InputModality;
  readonly samples: NormalizedGestureSample[];
}

export interface ProductionInterpretationDependencies {
  readonly domainStore: DomainSessionStore;
  readonly draftStore: InterpretationDraftStore;
  readonly presentationStore: InterpretationPresentationStore;
  /** What the player is looking at: sighting, dwell, hovered reading, reopened thread. */
  readonly focusStore: FocusPresentationStore;
  readonly now: () => number;
  readonly resolveCandidateEvidence: ResolveCandidateEvidence;
  /**
   * Facets both concepts genuinely carry — public structure, the same thing a
   * player can read on the two cards (I-018). Never a documented flag.
   */
  readonly sharedFacets: (a: ConceptId, b: ConceptId) => readonly FacetId[];
  readonly setInspection: (conceptId: ConceptId | null) => void;
  /**
   * Stages one coordinated response for a draft or focus transition. Every
   * moment of the loop that never touches the durable log — attending,
   * sighting, locking, hearing a reading, reopening — reaches the directors
   * through here, so the world can answer before anything is committed.
   */
  readonly publishCuePlan: (plan: CuePlan) => void;
  /**
   * Runs immediately after a commit has been published, in the same turn.
   *
   * Deliberately a dependency rather than a store subscription. Resolving a
   * thread's outcome is part of the commit moment, not a reaction to it — and
   * a subscription would put the outcome one microtask behind the thread,
   * which is exactly the drift the cue boundary exists to prevent (ADR-009).
   */
  readonly onCommitted?: (threadId: ThreadId) => void;
}

/**
 * THE LIVE INTERACTION LOOP — the focus view (I-015 … I-020).
 *
 *   roam ─activate─▶ attend ─sight…─▶ ─activate─▶ lock ─choose─▶ read ─hold─▶ weave
 *     ▲    (dwell)        (lens path = approach)       (hover = hear)          │
 *     └──────────────── Cancel steps back one stage at a time ◀────────────────┘
 *
 * Three kinds of state, never mixed. The *draft* holds decisions (attended
 * bead, locked pair, chosen reading). The *focus store* holds looks (the
 * sighted bead, a dwelt-on bead, a hovered reading, a reopened thread). The
 * *captures* hold the gesture: the approach from Attend to Lock and the hold
 * on the reading's sigil. Only a commit reaches the durable log, and it
 * publishes the same atomic three-event batch it always has.
 */
export interface ProductionInterpretation {
  /**
   * Activate a bead: Attend while roaming; Lock it as the second bead while
   * attending; replace the second bead while a pair is held. Activating a
   * bead already in the draft is a no-op.
   */
  readonly activateConcept: (conceptId: ConceptId) => InterpretationDraft;
  /** Attend explicitly, from any stage (I-004). Discards the draft. */
  readonly attendConcept: (conceptId: ConceptId) => InterpretationDraft;
  /** The lens has settled on a bead, or left them all. Attending only. */
  readonly sight: (conceptId: ConceptId | null) => void;
  /** One sample of the lens path while attending (pointer modalities). */
  readonly recordApproach: (point: GesturePoint, inputModality: InputModality) => void;
  /** Hear a reading on the locked pair without choosing it (sigil hover). */
  readonly previewReading: (intention: RelationIntention | null) => void;
  /** Choose — or change — the reading of the locked pair. */
  readonly chooseReading: (intention: RelationIntention) => InterpretationDraft;
  /**
   * Press a reading's sigil: choose that reading if it is not already the
   * chosen one, then begin the hold. Release commits (`commitHold`).
   */
  readonly beginHold: (
    inputModality: InputModality,
    point?: GesturePoint,
    intention?: RelationIntention
  ) => void;
  readonly updateHold: (point: GesturePoint) => void;
  readonly commitHold: (point?: GesturePoint) => void;
  /** Abandon the hold; the chosen reading stays held. */
  readonly cancelHold: () => void;
  /** Commit the chosen reading with a coordinate-free, zero-length gesture. */
  readonly commitAssistively: () => void;
  readonly isHolding: () => boolean;
  /**
   * One step back: a hold, else a reopened thread, else one draft stage —
   * reading → locked → attending → roaming (I-010 as adapted by I-016).
   */
  readonly cancel: () => InterpretationDraft;
  /** Reopen a committed thread for reading (I-019). Roaming only. */
  readonly reopenThread: (threadId: ThreadId) => void;
  readonly closeReopened: () => void;
  /** A bead dwelt on while roaming shows its card (I-015). */
  readonly dwell: (conceptId: ConceptId | null) => void;
  readonly inspect: (conceptId: ConceptId) => void;
  readonly closeInspection: () => void;
  readonly reset: () => void;
}

function sampleAt(atMs: number, point: GesturePoint): NormalizedGestureSample {
  return Object.freeze({ atMs, ...point });
}

function commitFailureMessage(error: unknown): string {
  const reason =
    error instanceof Error
      ? error.message
      : "the gesture could not be validated";
  return `Commit was not completed: ${reason}. Your interpretation is still held.`;
}

function isPointerModality(modality: InputModality): boolean {
  return modality === "mouse" || modality === "touch" || modality === "pen";
}

export function createProductionInterpretation(
  dependencies: ProductionInterpretationDependencies
): ProductionInterpretation {
  const attendInterpretively = createInterpretationAttentionCoordinator({
    domainStore: dependencies.domainStore,
    draftStore: dependencies.draftStore,
    now: dependencies.now,
    resolveCandidateEvidence: dependencies.resolveCandidateEvidence,
  });
  const commitInterpretively = createInterpretationCommitCoordinator({
    domainStore: dependencies.domainStore,
    draftStore: dependencies.draftStore,
    now: dependencies.now,
  });
  let hold: HoldCapture | null = null;
  let approach: ApproachCapture | null = null;

  const presentation = () => dependencies.presentationStore.getState();
  const focus = () => dependencies.focusStore.getState();
  const currentDraft = () => dependencies.draftStore.getState().draft;

  const requireSessionConceptIds = (): readonly ConceptId[] => {
    const session = dependencies.domainStore.getState().session;
    if (!session) throw new Error("an active canonical session is required");
    return session.conceptIds;
  };

  const bandOf = (conceptId: ConceptId): "weak" | "medium" | "high" =>
    presentation().candidateResonance.find(
      (candidate) => candidate.candidateId === conceptId
    )?.band ?? "weak";

  const attend = (conceptId: ConceptId): InterpretationDraft => {
    const result = attendInterpretively(conceptId);
    hold = null;
    approach = null;
    presentation().publishAttention(result.candidateResonance);
    focus().clearLook();
    focus().closeReopened();
    focus().setDwell(null);
    dependencies.setInspection(null);
    // Relation-neutral bands only, exactly as the store received them: the cue
    // may suggest possibility, never correctness (CAV-004).
    dependencies.publishCuePlan(
      planAttention(
        {
          conceptId,
          candidates: result.candidateResonance.map((candidate) => ({
            conceptId: candidate.candidateId,
            band: candidate.band,
          })),
        },
        null
      )
    );
    return result.draft;
  };

  const lock = (conceptId: ConceptId): InterpretationDraft => {
    dependencies.draftStore
      .getState()
      .lockCandidate(conceptId, requireSessionConceptIds());
    const draft = currentDraft();
    if (draft.stage !== "locked") return draft;
    focus().clearLook();
    presentation().announce(
      "Pair held. Choose how you read them: Echo, Passage, Tension or Ground."
    );
    dependencies.publishCuePlan(
      planPairLocked({
        pair: draft.pair,
        sharedFacets: dependencies.sharedFacets(
          draft.attendedConceptId,
          draft.candidateConceptId
        ),
      })
    );
    return draft;
  };

  const chooseReading = (intention: RelationIntention): InterpretationDraft => {
    const before = currentDraft();
    if (before.stage === "reading" && before.intention === intention) return before;
    dependencies.draftStore.getState().chooseReading(intention);
    const draft = currentDraft();
    if (draft.stage !== "reading") return draft;
    focus().setPreviewIntention(null);
    // The label the sigil shows, not the id the domain stores.
    presentation().announce(
      `${INTENTION_LABELS[intention]} — ${READING_PHRASE[intention]}. Hold to weave.`
    );
    dependencies.publishCuePlan(
      planReadingPreviewed({ pair: draft.pair, intention, chosen: true })
    );
    return draft;
  };

  const appendHoldPoint = (point: GesturePoint, atMs: number): void => {
    if (!hold || hold.samples.length >= MAX_GESTURE_SAMPLES) return;
    const previous = hold.samples[hold.samples.length - 1];
    if (previous && atMs <= previous.atMs) return;
    hold.samples.push(sampleAt(atMs, point));
  };

  const releaseAttention = (): void => {
    hold = null;
    approach = null;
    presentation().clearAttention();
    focus().clearLook();
    dependencies.publishCuePlan(planAttentionCleared());
  };

  const commit = (
    inputModality: InputModality,
    startedAtMs: number,
    endedAtMs: number,
    samples: readonly NormalizedGestureSample[]
  ): void => {
    const session = dependencies.domainStore.getState().session;
    if (!session) throw new Error("an active canonical session is required");
    const threadId = createInterpretationThreadId(session);
    // The approach counts only when the same kind of hand made it: a keyboard
    // hold must not borrow a mouse's path (I-009, I-020).
    const approachSamples =
      approach !== null &&
      approach.inputModality === inputModality &&
      isPointerModality(inputModality) &&
      approach.samples.length >= 2
        ? Object.freeze([...approach.samples])
        : null;
    commitInterpretively({
      threadId,
      gesture: {
        inputModality,
        startedAtMs,
        endedAtMs,
        ...(samples.length === 0 ? {} : { samples: Object.freeze([...samples]) }),
        ...(approachSamples === null ? {} : { approach: approachSamples }),
      },
    });
    hold = null;
    approach = null;
    dependencies.setInspection(null);
    focus().clearLook();
    presentation().publishCommit(threadId);
    dependencies.onCommitted?.(threadId);
  };

  return Object.freeze({
    activateConcept: (conceptId: ConceptId) => {
      if (hold) return currentDraft();
      const draft = currentDraft();
      if (draft.stage === "inactive") {
        focus().closeReopened();
        return attend(conceptId);
      }
      if (draft.stage === "attending") {
        if (conceptId === draft.attendedConceptId) return draft;
        return lock(conceptId);
      }
      if (
        conceptId === draft.attendedConceptId ||
        conceptId === draft.candidateConceptId
      ) {
        return draft;
      }
      return lock(conceptId);
    },

    attendConcept: (conceptId: ConceptId) => {
      if (hold) return currentDraft();
      return attend(conceptId);
    },

    sight: (conceptId: ConceptId | null) => {
      const draft = currentDraft();
      if (draft.stage !== "attending" || hold) return;
      const sighted =
        conceptId !== null && conceptId !== draft.attendedConceptId ? conceptId : null;
      if (focus().sightedConceptId === sighted) return;
      focus().setSighted(sighted);
      dependencies.publishCuePlan(
        planSighting({
          attendedConceptId: draft.attendedConceptId,
          sighted:
            sighted === null
              ? null
              : Object.freeze({
                  conceptId: sighted,
                  band: bandOf(sighted),
                  sharedFacets: dependencies.sharedFacets(
                    draft.attendedConceptId,
                    sighted
                  ),
                }),
        })
      );
    },

    recordApproach: (point: GesturePoint, inputModality: InputModality) => {
      if (currentDraft().stage !== "attending" || !isPointerModality(inputModality)) {
        return;
      }
      if (approach === null || approach.inputModality !== inputModality) {
        approach = { inputModality, samples: [] };
      }
      if (approach.samples.length >= MAX_GESTURE_SAMPLES) return;
      const atMs = dependencies.now();
      const previous = approach.samples[approach.samples.length - 1];
      if (previous && atMs <= previous.atMs) return;
      approach.samples.push(
        Object.freeze({ atMs, xViewport: point.xViewport, yViewport: point.yViewport })
      );
    },

    previewReading: (intention: RelationIntention | null) => {
      const draft = currentDraft();
      if (draft.stage !== "locked") {
        focus().setPreviewIntention(null);
        return;
      }
      if (focus().previewIntention === intention) return;
      focus().setPreviewIntention(intention);
      if (intention !== null) {
        dependencies.publishCuePlan(
          planReadingPreviewed({ pair: draft.pair, intention, chosen: false })
        );
      }
    },

    chooseReading,

    beginHold: (
      inputModality: InputModality,
      point?: GesturePoint,
      intention?: RelationIntention
    ) => {
      if (hold) return;
      if (intention !== undefined) chooseReading(intention);
      if (currentDraft().stage !== "reading") {
        throw new Error("a chosen reading is required to weave");
      }
      const startedAtMs = dependencies.now();
      hold = {
        inputModality,
        startedAtMs,
        messageBeforeCapture: presentation().message,
        samples: point ? [sampleAt(startedAtMs, point)] : [],
      };
      presentation().setWeaving(true);
    },

    updateHold: (point: GesturePoint) => {
      if (!hold) return;
      appendHoldPoint(point, dependencies.now());
    },

    commitHold: (point?: GesturePoint) => {
      if (!hold) return;
      const endedAtMs = dependencies.now();
      if (point) appendHoldPoint(point, endedAtMs);
      const active = hold;
      try {
        commit(active.inputModality, active.startedAtMs, endedAtMs, active.samples);
      } catch (error) {
        hold = null;
        presentation().setWeaving(false);
        presentation().announce(active.messageBeforeCapture);
        presentation().announceFailure(commitFailureMessage(error));
        throw error;
      }
    },

    cancelHold: () => {
      if (!hold) return;
      const active = hold;
      hold = null;
      presentation().setWeaving(false);
      presentation().announce(active.messageBeforeCapture);
    },

    commitAssistively: () => {
      if (hold) return;
      if (currentDraft().stage !== "reading") {
        throw new Error("a chosen reading is required to weave");
      }
      const startedAtMs = dependencies.now();
      commit("unknown", startedAtMs, startedAtMs, []);
    },

    isHolding: () => hold !== null,

    cancel: () => {
      if (hold) {
        const active = hold;
        hold = null;
        presentation().setWeaving(false);
        presentation().announce(active.messageBeforeCapture);
        return currentDraft();
      }
      if (currentDraft().stage === "inactive") {
        if (focus().reopened !== null) {
          focus().closeReopened();
          presentation().clearAttention();
          dependencies.publishCuePlan(planAttentionCleared());
        }
        return currentDraft();
      }
      dependencies.draftStore.getState().cancel();
      const draft = currentDraft();
      if (draft.stage === "inactive") {
        releaseAttention();
      } else if (draft.stage === "attending") {
        focus().clearLook();
        approach = null;
        presentation().announce("Attention held. Find a second bead.");
      } else if (draft.stage === "locked") {
        focus().setPreviewIntention(null);
        presentation().announce(
          "Pair held. Choose how you read them: Echo, Passage, Tension or Ground."
        );
      }
      return draft;
    },

    reopenThread: (threadId: ThreadId) => {
      if (hold || currentDraft().stage !== "inactive") return;
      const session = dependencies.domainStore.getState().session;
      const thread = session?.threads.find((entry) => entry.id === threadId);
      if (!thread) return;
      focus().reopen({ threadId, pair: thread.pair });
      dependencies.setInspection(null);
      presentation().announce("Reopened for reading. Escape returns to the arena.");
      dependencies.publishCuePlan(
        planThreadReopened({
          threadId,
          pair: thread.pair,
          intention: thread.intention,
        })
      );
    },

    closeReopened: () => {
      if (focus().reopened === null) return;
      focus().closeReopened();
      presentation().clearAttention();
      dependencies.publishCuePlan(planAttentionCleared());
    },

    dwell: (conceptId: ConceptId | null) => {
      if (conceptId !== null) {
        if (currentDraft().stage !== "inactive" || focus().reopened !== null) return;
      }
      focus().setDwell(conceptId);
    },

    inspect: (conceptId: ConceptId) => dependencies.setInspection(conceptId),

    closeInspection: () => dependencies.setInspection(null),

    reset: () => {
      hold = null;
      approach = null;
      dependencies.draftStore.getState().reset();
      presentation().reset();
      focus().reset();
      dependencies.setInspection(null);
    },
  });
}
