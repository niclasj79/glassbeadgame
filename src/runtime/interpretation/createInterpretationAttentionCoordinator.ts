import {
  evaluateCandidateResonance,
  type CandidateResonance,
  type CandidateResonanceEvidence,
} from "../../domain/relations/resonance";
import type { ConceptId } from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";
import type { SessionEventLogV1 } from "../../domain/replay";
import type { DomainSessionStore } from "../../state/domainSession";
import type { InterpretationDraftStore } from "../../state/interactionDraft";
import {
  createAttendConceptPreparation,
  type BeadAttendedEventV1,
} from "../commands/attention/createAttendConceptCommand";
import {
  attendDraft,
  type AttendingInterpretationDraft,
} from "../interactionDraft";

export interface CandidateEvidenceResolutionRequest {
  readonly attendedConceptId: ConceptId;
  readonly session: SessionStateV1;
}

export type ResolveCandidateEvidence = (
  request: CandidateEvidenceResolutionRequest
) => readonly CandidateResonanceEvidence[];

export interface InterpretationAttentionCoordinatorDependencies {
  readonly domainStore: DomainSessionStore;
  readonly draftStore: InterpretationDraftStore;
  readonly now: () => number;
  readonly resolveCandidateEvidence: ResolveCandidateEvidence;
}

export interface InterpretiveAttendResult {
  readonly event: BeadAttendedEventV1;
  readonly eventLog: SessionEventLogV1;
  readonly session: SessionStateV1;
  readonly draft: AttendingInterpretationDraft;
  readonly candidateResonance: readonly CandidateResonance[];
}

export type AttendInterpretively = (
  conceptId: ConceptId
) => InterpretiveAttendResult;

export function createInterpretationAttentionCoordinator(
  dependencies: InterpretationAttentionCoordinatorDependencies
): AttendInterpretively {
  const attendCommand = createAttendConceptPreparation({
    domainStore: dependencies.domainStore,
    now: dependencies.now,
  });

  return (conceptId) => {
    const preparedAttend = attendCommand.prepare(conceptId);
    const sessionConceptIds = preparedAttend.activeSession.conceptIds;
    attendDraft(
      dependencies.draftStore.getState().draft,
      conceptId,
      sessionConceptIds
    );
    const evidenceRequest = Object.freeze({
      attendedConceptId: conceptId,
      session: preparedAttend.activeSession,
    });
    const evidence = dependencies.resolveCandidateEvidence(evidenceRequest);
    const candidateResonance = evaluateCandidateResonance({
      attendedConceptId: conceptId,
      sessionConceptIds,
      candidates: evidence,
    });

    dependencies.draftStore.getState().attend(conceptId, sessionConceptIds);
    const draft = dependencies.draftStore.getState()
      .draft as AttendingInterpretationDraft;

    const attended = attendCommand.publish(preparedAttend);

    return Object.freeze({
      event: attended.event,
      eventLog: attended.eventLog,
      session: attended.session,
      draft,
      candidateResonance,
    });
  };
}
