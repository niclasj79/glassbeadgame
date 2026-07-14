import {
  RELATION_INTENTIONS,
  type ConceptPair,
  type RelationIntention,
} from "../../domain/events";
import type { ConceptId } from "../../domain/ids";
import {
  InterpretationDraftError,
  type InterpretationDraftErrorCode,
} from "./InterpretationDraftError";
import type {
  ArmedInterpretationDraft,
  AttendingInterpretationDraft,
  CandidateSelectedInterpretationDraft,
  InactiveInterpretationDraft,
  InterpretationDraft,
} from "./types";

export const INACTIVE_INTERPRETATION_DRAFT: InactiveInterpretationDraft =
  Object.freeze({ stage: "inactive" });

function fail(code: InterpretationDraftErrorCode, message: string): never {
  throw new InterpretationDraftError(code, message);
}

function isConceptId(value: unknown): value is ConceptId {
  return typeof value === "string" && value.trim().length > 0;
}

function validateSessionConcepts(
  sessionConceptIds: readonly ConceptId[]
): ReadonlySet<ConceptId> {
  if (!Array.isArray(sessionConceptIds) || sessionConceptIds.length < 2) {
    return fail(
      "invalid-session-concepts",
      "an interpretation draft requires at least two session concepts"
    );
  }

  const concepts = new Set<ConceptId>();
  for (const conceptId of sessionConceptIds) {
    if (!isConceptId(conceptId) || concepts.has(conceptId)) {
      return fail(
        "invalid-session-concepts",
        "session concepts must be unique valid concept identifiers"
      );
    }
    concepts.add(conceptId);
  }
  return concepts;
}

function requireSessionConcept(
  concepts: ReadonlySet<ConceptId>,
  conceptId: ConceptId
): void {
  if (!isConceptId(conceptId) || !concepts.has(conceptId)) {
    fail("unknown-concept", "the concept must belong to the supplied session");
  }
}

function isRelationIntention(value: unknown): value is RelationIntention {
  return (RELATION_INTENTIONS as readonly unknown[]).includes(value);
}

function assertKnownDraft(draft: InterpretationDraft): void {
  switch (draft.stage) {
    case "inactive":
    case "attending":
    case "armed":
    case "candidate-selected":
      return;
    default:
      fail("invalid-transition-order", "the draft stage is not supported");
  }
}

export function createInterpretationDraft(): InactiveInterpretationDraft {
  return INACTIVE_INTERPRETATION_DRAFT;
}

export function attendDraft(
  draft: InterpretationDraft,
  attendedConceptId: ConceptId,
  sessionConceptIds: readonly ConceptId[]
): AttendingInterpretationDraft {
  assertKnownDraft(draft);
  const concepts = validateSessionConcepts(sessionConceptIds);
  requireSessionConcept(concepts, attendedConceptId);

  return Object.freeze({ stage: "attending", attendedConceptId });
}

export function armDraftIntention(
  draft: InterpretationDraft,
  intention: RelationIntention
): ArmedInterpretationDraft {
  if (draft.stage !== "attending" && draft.stage !== "armed") {
    return fail(
      "invalid-transition-order",
      "an intention can only be armed after attending and before candidate selection"
    );
  }
  if (!isRelationIntention(intention)) {
    return fail("unsupported-intention", "the relation intention is not supported");
  }

  return Object.freeze({
    stage: "armed",
    attendedConceptId: draft.attendedConceptId,
    intention,
  });
}

export function selectDraftCandidate(
  draft: InterpretationDraft,
  candidateConceptId: ConceptId,
  sessionConceptIds: readonly ConceptId[]
): CandidateSelectedInterpretationDraft {
  if (draft.stage !== "armed") {
    return fail(
      "invalid-transition-order",
      "a candidate can only be selected after arming an intention"
    );
  }

  const concepts = validateSessionConcepts(sessionConceptIds);
  requireSessionConcept(concepts, draft.attendedConceptId);
  if (candidateConceptId === draft.attendedConceptId) {
    return fail("identical-concepts", "attended and candidate concepts must differ");
  }
  requireSessionConcept(concepts, candidateConceptId);

  const pair: ConceptPair = Object.freeze([
    draft.attendedConceptId,
    candidateConceptId,
  ]);
  return Object.freeze({
    stage: "candidate-selected",
    attendedConceptId: draft.attendedConceptId,
    candidateConceptId,
    intention: draft.intention,
    pair,
  });
}

export function cancelDraft(draft: InterpretationDraft): InterpretationDraft {
  switch (draft.stage) {
    case "inactive":
      return INACTIVE_INTERPRETATION_DRAFT;
    case "attending":
      return INACTIVE_INTERPRETATION_DRAFT;
    case "armed":
      return Object.freeze({
        stage: "attending",
        attendedConceptId: draft.attendedConceptId,
      });
    case "candidate-selected":
      return Object.freeze({
        stage: "armed",
        attendedConceptId: draft.attendedConceptId,
        intention: draft.intention,
      });
    default:
      return fail("invalid-transition-order", "the draft stage is not supported");
  }
}
