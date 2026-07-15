import type { InputModality, RelationIntention } from "../../domain/events";
import type { ConceptId } from "../../domain/ids";
import type { DomainSessionStore } from "../../state/domainSession";
import type { InterpretationDraftStore } from "../../state/interactionDraft";
import type { InterpretationPresentationStore } from "../../state/interpretationPresentation";
import type { NormalizedGestureSample } from "../gestureProfile";
import type { InterpretationDraft } from "../interactionDraft";
import { createInterpretationAttentionCoordinator } from "./createInterpretationAttentionCoordinator";
import { createInterpretationCommitCoordinator } from "./createInterpretationCommitCoordinator";
import { createInterpretationThreadId } from "./createInterpretationThreadId";
import type { ResolveProvisionalCandidateEvidence } from "./resolveProvisionalCandidateEvidence";

const MAX_GESTURE_SAMPLES = 128;

export interface GesturePoint {
  readonly xViewport: number;
  readonly yViewport: number;
  readonly pressure?: number;
}

interface ActiveGestureCapture {
  readonly inputModality: InputModality;
  readonly startedAtMs: number;
  readonly messageBeforeCapture: string;
  readonly samples: NormalizedGestureSample[];
}

export interface ProductionInterpretationDependencies {
  readonly domainStore: DomainSessionStore;
  readonly draftStore: InterpretationDraftStore;
  readonly presentationStore: InterpretationPresentationStore;
  readonly now: () => number;
  readonly resolveCandidateEvidence: ResolveProvisionalCandidateEvidence;
  readonly setInspection: (conceptId: ConceptId | null) => void;
}

export interface ProductionInterpretation {
  readonly activateConcept: (conceptId: ConceptId) => InterpretationDraft;
  readonly armIntention: (intention: RelationIntention) => InterpretationDraft;
  readonly cancel: () => InterpretationDraft;
  readonly beginWeave: (
    inputModality: InputModality,
    point?: GesturePoint
  ) => void;
  readonly beginDirectionalWeave: (
    inputModality: InputModality,
    point?: GesturePoint
  ) => void;
  readonly updateWeave: (point: GesturePoint) => void;
  readonly commitWeave: (point?: GesturePoint) => void;
  readonly commitDirectionalWeave: (
    candidateConceptId: ConceptId,
    point?: GesturePoint
  ) => void;
  readonly commitAssistively: () => void;
  readonly cancelWeave: () => void;
  readonly isWeaving: () => boolean;
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
  let capture: ActiveGestureCapture | null = null;

  const requireSessionConceptIds = (): readonly ConceptId[] => {
    const session = dependencies.domainStore.getState().session;
    if (!session) throw new Error("an active canonical session is required");
    return session.conceptIds;
  };

  const attend = (conceptId: ConceptId): InterpretationDraft => {
    const result = attendInterpretively(conceptId);
    dependencies.presentationStore
      .getState()
      .publishAttention(result.candidateResonance);
    dependencies.setInspection(null);
    return result.draft;
  };

  const appendPoint = (point: GesturePoint, atMs: number): void => {
    if (!capture || capture.samples.length >= MAX_GESTURE_SAMPLES) return;
    const previous = capture.samples[capture.samples.length - 1];
    if (previous && atMs <= previous.atMs) return;
    capture.samples.push(sampleAt(atMs, point));
  };

  const beginCapture = (
    inputModality: InputModality,
    point?: GesturePoint
  ): void => {
    const startedAtMs = dependencies.now();
    capture = {
      inputModality,
      startedAtMs,
      messageBeforeCapture: dependencies.presentationStore.getState().message,
      samples: point ? [sampleAt(startedAtMs, point)] : [],
    };
    dependencies.presentationStore.getState().setWeaving(true);
  };

  const commitCapture = (point?: GesturePoint): void => {
    if (!capture) return;
    const endedAtMs = dependencies.now();
    if (point) appendPoint(point, endedAtMs);
    const activeCapture = capture;
    try {
      const session = dependencies.domainStore.getState().session;
      if (!session) throw new Error("an active canonical session is required");
      const threadId = createInterpretationThreadId(session);
      commitInterpretively({
        threadId,
        gesture: {
          inputModality: activeCapture.inputModality,
          startedAtMs: activeCapture.startedAtMs,
          endedAtMs,
          ...(activeCapture.samples.length === 0
            ? {}
            : { samples: Object.freeze([...activeCapture.samples]) }),
        },
      });
      dependencies.setInspection(null);
      dependencies.presentationStore.getState().publishCommit(threadId);
    } catch (error) {
      dependencies.presentationStore.getState().setWeaving(false);
      dependencies.presentationStore
        .getState()
        .announce(activeCapture.messageBeforeCapture);
      dependencies.presentationStore
        .getState()
        .announceFailure(commitFailureMessage(error));
      throw error;
    } finally {
      capture = null;
    }
  };

  const announceHeldDraft = (): void => {
    const draft = dependencies.draftStore.getState().draft;
    dependencies.presentationStore
      .getState()
      .announce(
        draft.stage === "armed"
          ? "Intention held. Draw toward another bead."
          : "Candidate held. Weave when ready."
      );
  };

  return Object.freeze({
    activateConcept: (conceptId: ConceptId) => {
      const draft = dependencies.draftStore.getState().draft;
      if (draft.stage === "armed") {
        if (conceptId === draft.attendedConceptId) return draft;
        dependencies.draftStore
          .getState()
          .selectCandidate(conceptId, requireSessionConceptIds());
        dependencies.presentationStore
          .getState()
          .announce("Candidate selected. Weave to Commit, or Cancel to reconsider.");
        return dependencies.draftStore.getState().draft;
      }
      if (draft.stage === "candidate-selected") {
        if (
          conceptId === draft.attendedConceptId ||
          conceptId === draft.candidateConceptId
        ) {
          return draft;
        }
        return attend(conceptId);
      }
      if (
        draft.stage === "attending" &&
        conceptId === draft.attendedConceptId
      ) {
        return draft;
      }
      return attend(conceptId);
    },

    armIntention: (intention: RelationIntention) => {
      dependencies.draftStore.getState().armIntention(intention);
      dependencies.presentationStore
        .getState()
        .announce(`${intention} armed. Draw toward another bead.`);
      return dependencies.draftStore.getState().draft;
    },

    cancel: () => {
      if (capture) {
        capture = null;
        dependencies.presentationStore.getState().setWeaving(false);
        announceHeldDraft();
        return dependencies.draftStore.getState().draft;
      }
      dependencies.draftStore.getState().cancel();
      const draft = dependencies.draftStore.getState().draft;
      if (draft.stage === "inactive") {
        dependencies.presentationStore.getState().clearAttention();
      } else if (draft.stage === "attending") {
        dependencies.presentationStore
          .getState()
          .announce("Attention held. Choose an intention.");
      } else {
        dependencies.presentationStore
          .getState()
          .announce("Intention held. Draw toward another bead.");
      }
      return draft;
    },

    beginWeave: (inputModality: InputModality, point?: GesturePoint) => {
      if (capture) return;
      const draft = dependencies.draftStore.getState().draft;
      if (draft.stage !== "candidate-selected") {
        throw new Error("a candidate-selected draft is required to Weave");
      }
      beginCapture(inputModality, point);
    },

    beginDirectionalWeave: (
      inputModality: InputModality,
      point?: GesturePoint
    ) => {
      if (capture) return;
      const draft = dependencies.draftStore.getState().draft;
      if (draft.stage !== "armed") {
        throw new Error("an armed draft is required to begin a directional Weave");
      }
      beginCapture(inputModality, point);
    },

    updateWeave: (point: GesturePoint) => {
      if (!capture) return;
      appendPoint(point, dependencies.now());
    },

    commitWeave: (point?: GesturePoint) => {
      commitCapture(point);
    },

    commitDirectionalWeave: (
      candidateConceptId: ConceptId,
      point?: GesturePoint
    ) => {
      if (!capture) return;
      const activeCapture = capture;
      const draft = dependencies.draftStore.getState().draft;
      if (draft.stage !== "armed") {
        capture = null;
        dependencies.presentationStore.getState().setWeaving(false);
        throw new Error("an armed draft is required to finish a directional Weave");
      }
      try {
        dependencies.draftStore
          .getState()
          .selectCandidate(candidateConceptId, requireSessionConceptIds());
        commitCapture(point);
      } catch (error) {
        if (
          dependencies.draftStore.getState().draft.stage ===
          "candidate-selected"
        ) {
          dependencies.draftStore.getState().cancel();
        }
        capture = null;
        dependencies.presentationStore.getState().setWeaving(false);
        dependencies.presentationStore
          .getState()
          .announce(activeCapture.messageBeforeCapture);
        dependencies.presentationStore
          .getState()
          .announceFailure(commitFailureMessage(error));
        throw error;
      }
    },

    commitAssistively: () => {
      const startedAtMs = dependencies.now();
      const session = dependencies.domainStore.getState().session;
      if (!session) throw new Error("an active canonical session is required");
      const threadId = createInterpretationThreadId(session);
      commitInterpretively({
        threadId,
        gesture: {
          inputModality: "unknown",
          startedAtMs,
          endedAtMs: startedAtMs,
        },
      });
      capture = null;
      dependencies.setInspection(null);
      dependencies.presentationStore.getState().publishCommit(threadId);
    },

    cancelWeave: () => {
      if (!capture) return;
      capture = null;
      dependencies.presentationStore.getState().setWeaving(false);
      announceHeldDraft();
    },

    isWeaving: () => capture !== null,

    inspect: (conceptId: ConceptId) => dependencies.setInspection(conceptId),

    closeInspection: () => dependencies.setInspection(null),

    reset: () => {
      capture = null;
      dependencies.draftStore.getState().reset();
      dependencies.presentationStore.getState().reset();
      dependencies.setInspection(null);
    },
  });
}
