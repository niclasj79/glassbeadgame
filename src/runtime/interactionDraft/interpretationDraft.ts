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
  AttendingInterpretationDraft,
  InactiveInterpretationDraft,
  InterpretationDraft,
  LockedInterpretationDraft,
  ReadingInterpretationDraft,
} from "./types";

/**
 * THE EPHEMERAL INTERPRETATION DRAFT — pair first (I-016).
 *
 *   inactive ──Attend──▶ attending ──Lock──▶ locked ──Choose──▶ reading
 *       ▲                   │  ▲                │  ▲                │
 *       └──────Cancel───────┘  └────Cancel──────┘  └────Cancel──────┘
 *
 * One Cancel steps back exactly one stage (I-010 as adapted by I-016), and
 * nothing here ever reaches the durable log: the pair, the hypothesis and the
 * thread are published together, later, by the commit coordinator.
 *
 * Re-locking from `locked` or `reading` replaces the second bead and drops any
 * chosen reading — a reading belongs to a pair, and I-008 forbids silently
 * carrying one across to another.
 */
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
    case "locked":
    case "reading":
      return;
    default:
      fail("invalid-transition-order", "the draft stage is not supported");
  }
}

export function createInterpretationDraft(): InactiveInterpretationDraft {
  return INACTIVE_INTERPRETATION_DRAFT;
}

/** Attend from any stage. A new Attend discards the whole draft (I-004). */
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

/**
 * Fix the second bead. Allowed while attending, and while locked or reading
 * to replace the second bead — which drops the chosen reading.
 */
export function lockDraftCandidate(
  draft: InterpretationDraft,
  candidateConceptId: ConceptId,
  sessionConceptIds: readonly ConceptId[]
): LockedInterpretationDraft {
  if (draft.stage === "inactive") {
    return fail(
      "invalid-transition-order",
      "a second bead can only be locked after attending"
    );
  }
  assertKnownDraft(draft);

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
    stage: "locked",
    attendedConceptId: draft.attendedConceptId,
    candidateConceptId,
    pair,
  });
}

/** Choose — or change — the reading of a locked pair. */
export function chooseDraftReading(
  draft: InterpretationDraft,
  intention: RelationIntention
): ReadingInterpretationDraft {
  if (draft.stage !== "locked" && draft.stage !== "reading") {
    return fail(
      "invalid-transition-order",
      "a reading can only be chosen once a second bead is locked"
    );
  }
  if (!isRelationIntention(intention)) {
    return fail("unsupported-intention", "the relation intention is not supported");
  }

  return Object.freeze({
    stage: "reading",
    attendedConceptId: draft.attendedConceptId,
    candidateConceptId: draft.candidateConceptId,
    intention,
    pair: draft.pair,
  });
}

/** One step back: reading → locked → attending → inactive. */
export function cancelDraft(draft: InterpretationDraft): InterpretationDraft {
  switch (draft.stage) {
    case "inactive":
      return INACTIVE_INTERPRETATION_DRAFT;
    case "attending":
      return INACTIVE_INTERPRETATION_DRAFT;
    case "locked":
      return Object.freeze({
        stage: "attending",
        attendedConceptId: draft.attendedConceptId,
      });
    case "reading":
      return Object.freeze({
        stage: "locked",
        attendedConceptId: draft.attendedConceptId,
        candidateConceptId: draft.candidateConceptId,
        pair: draft.pair,
      });
    default:
      return fail("invalid-transition-order", "the draft stage is not supported");
  }
}
