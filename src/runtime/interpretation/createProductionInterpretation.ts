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
  readonly updateWeave: (point: GesturePoint) => void;
  readonly commitWeave: (point?: GesturePoint) => void;
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
        .announce(`${intention} armed. Choose another bead.`);
      return dependencies.draftStore.getState().draft;
    },

    cancel: () => {
      if (capture) {
        capture = null;
        dependencies.presentationStore.getState().setWeaving(false);
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
          .announce("Intention held. Choose another bead.");
      }
      return draft;
    },

    beginWeave: (inputModality: InputModality, point?: GesturePoint) => {
      if (capture) return;
      const draft = dependencies.draftStore.getState().draft;
      if (draft.stage !== "candidate-selected") {
        throw new Error("a candidate-selected draft is required to Weave");
      }
      const startedAtMs = dependencies.now();
      capture = {
        inputModality,
        startedAtMs,
        samples: point ? [sampleAt(startedAtMs, point)] : [],
      };
      dependencies.presentationStore.getState().setWeaving(true);
    },

    updateWeave: (point: GesturePoint) => {
      if (!capture) return;
      appendPoint(point, dependencies.now());
    },

    commitWeave: (point?: GesturePoint) => {
      if (!capture) return;
      const endedAtMs = dependencies.now();
      if (point) appendPoint(point, endedAtMs);
      const activeCapture = capture;
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
      capture = null;
      dependencies.setInspection(null);
      dependencies.presentationStore.getState().publishCommit(threadId);
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
