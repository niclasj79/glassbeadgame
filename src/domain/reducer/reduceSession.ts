import type { ConceptPair, SessionEventV1 } from "../events";
import type { ConceptId, EventId, ThreadId } from "../ids";
import { cloneAndFreeze } from "../model/immutable";
import type { SessionStateV1 } from "../model/sessionState";
import {
  SessionTransitionError,
  type SessionTransitionErrorCode,
} from "./SessionTransitionError";

function fail(
  code: SessionTransitionErrorCode,
  eventId: EventId,
  message: string
): never {
  throw new SessionTransitionError(code, eventId, message);
}

function pairsEqual(left: ConceptPair, right: ConceptPair): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function requireConcept(
  state: SessionStateV1,
  conceptId: ConceptId,
  eventId: EventId
): void {
  if (!state.conceptIds.includes(conceptId)) {
    fail("unknown-concept", eventId, `concept ${conceptId} is not in this session`);
  }
}

function requirePair(
  state: SessionStateV1,
  pair: ConceptPair,
  eventId: EventId
): void {
  requireConcept(state, pair[0], eventId);
  requireConcept(state, pair[1], eventId);
}

function requireThread(
  state: SessionStateV1,
  threadId: ThreadId,
  eventId: EventId
): void {
  if (!state.threads.some((thread) => thread.id === threadId)) {
    fail("unknown-thread", eventId, `thread ${threadId} is not committed`);
  }
}

function advance(
  state: SessionStateV1,
  event: SessionEventV1,
  changes: Partial<SessionStateV1>
): SessionStateV1 {
  return cloneAndFreeze({
    ...state,
    ...changes,
    lastSequence: event.sequence,
    at: event.at,
  });
}

function startSession(event: Extract<SessionEventV1, { type: "session.started" }>): SessionStateV1 {
  const { conceptIds } = event.payload;
  if (conceptIds.length === 0 || new Set(conceptIds).size !== conceptIds.length) {
    fail(
      "invalid-session-concepts",
      event.id,
      "a session must start with at least one unique concept ID"
    );
  }
  if (event.sequence !== 0) {
    fail("sequence-mismatch", event.id, "the first session event must have sequence 0");
  }

  return cloneAndFreeze({
    sessionId: event.sessionId,
    seed: event.payload.seed,
    contentPackVersion: event.payload.contentPackVersion,
    worldId: event.payload.worldId,
    conceptIds: event.payload.conceptIds,
    lastSequence: event.sequence,
    at: event.at,
    attendedConceptId: null,
    selectedPair: null,
    hypothesis: null,
    threads: [],
    outcomes: [],
    completedMotifs: [],
    attunementActive: false,
    concluded: false,
  });
}

export function reduceSession(
  previous: SessionStateV1 | null,
  event: SessionEventV1
): SessionStateV1 {
  if (previous === null) {
    if (event.type !== "session.started") {
      fail("invalid-lifecycle", event.id, "a session must begin with session.started");
    }
    return startSession(event);
  }

  if (event.type === "session.started") {
    fail("invalid-lifecycle", event.id, "an existing session cannot start again");
  }
  if (event.sessionId !== previous.sessionId) {
    fail("session-identity-mismatch", event.id, "event belongs to another session");
  }
  if (event.sequence !== previous.lastSequence + 1) {
    fail(
      "sequence-mismatch",
      event.id,
      `expected sequence ${previous.lastSequence + 1}, received ${event.sequence}`
    );
  }
  if (event.at < previous.at) {
    fail("relative-time-regression", event.id, "event time cannot move backwards");
  }
  if (previous.concluded) {
    fail("invalid-lifecycle", event.id, "a concluded session cannot accept events");
  }

  switch (event.type) {
    case "bead.attended":
      requireConcept(previous, event.payload.conceptId, event.id);
      return advance(previous, event, { attendedConceptId: event.payload.conceptId });

    case "pair.selected":
      requirePair(previous, event.payload.pair, event.id);
      return advance(previous, event, {
        selectedPair: event.payload.pair,
        hypothesis: null,
      });

    case "relation.hypothesized":
      requirePair(previous, event.payload.pair, event.id);
      if (!previous.selectedPair || !pairsEqual(previous.selectedPair, event.payload.pair)) {
        fail("pair-mismatch", event.id, "hypothesis does not match the selected pair");
      }
      return advance(previous, event, {
        hypothesis: {
          pair: event.payload.pair,
          intention: event.payload.intention,
        },
      });

    case "thread.committed":
      requirePair(previous, event.payload.pair, event.id);
      if (!previous.selectedPair || !pairsEqual(previous.selectedPair, event.payload.pair)) {
        fail("pair-mismatch", event.id, "committed thread does not match the selected pair");
      }
      if (
        !previous.hypothesis ||
        !pairsEqual(previous.hypothesis.pair, event.payload.pair) ||
        previous.hypothesis.intention !== event.payload.intention
      ) {
        fail("hypothesis-mismatch", event.id, "committed thread has no matching hypothesis");
      }
      if (previous.threads.some((thread) => thread.id === event.payload.threadId)) {
        fail("duplicate-identity", event.id, `thread ${event.payload.threadId} already exists`);
      }
      return advance(previous, event, {
        selectedPair: null,
        hypothesis: null,
        threads: [
          ...previous.threads,
          {
            id: event.payload.threadId,
            pair: event.payload.pair,
            intention: event.payload.intention,
            gesture: event.payload.gesture,
            eventId: event.id,
            sequence: event.sequence,
            committedAt: event.at,
          },
        ],
      });

    case "documented-relation.revealed":
      requireThread(previous, event.payload.threadId, event.id);
      if (previous.outcomes.some((outcome) => outcome.threadId === event.payload.threadId)) {
        fail("duplicate-outcome", event.id, "thread already has an outcome");
      }
      return advance(previous, event, {
        outcomes: [
          ...previous.outcomes,
          {
            type: "documented-relation",
            eventId: event.id,
            sequence: event.sequence,
            revealedAt: event.at,
            threadId: event.payload.threadId,
            documentedRelationId: event.payload.documentedRelationId,
          },
        ],
      });

    case "open-thread.created":
      requireThread(previous, event.payload.threadId, event.id);
      if (previous.outcomes.some((outcome) => outcome.threadId === event.payload.threadId)) {
        fail("duplicate-outcome", event.id, "thread already has an outcome");
      }
      if (
        previous.outcomes.some(
          (outcome) =>
            outcome.type === "open-thread" &&
            outcome.openThreadId === event.payload.openThreadId
        )
      ) {
        fail("duplicate-identity", event.id, `Open Thread ${event.payload.openThreadId} exists`);
      }
      return advance(previous, event, {
        outcomes: [
          ...previous.outcomes,
          {
            type: "open-thread",
            eventId: event.id,
            sequence: event.sequence,
            createdAt: event.at,
            threadId: event.payload.threadId,
            openThreadId: event.payload.openThreadId,
          },
        ],
      });

    case "motif.completed":
      for (const conceptId of event.payload.conceptIds) {
        requireConcept(previous, conceptId, event.id);
      }
      for (const threadId of event.payload.threadIds) {
        requireThread(previous, threadId, event.id);
      }
      if (
        previous.completedMotifs.some(
          (motif) => motif.completionId === event.payload.completionId
        )
      ) {
        fail("duplicate-identity", event.id, `motif ${event.payload.completionId} exists`);
      }
      return advance(previous, event, {
        completedMotifs: [
          ...previous.completedMotifs,
          {
            eventId: event.id,
            sequence: event.sequence,
            completedAt: event.at,
            completionId: event.payload.completionId,
            motifKindId: event.payload.motifKindId,
            conceptIds: event.payload.conceptIds,
            threadIds: event.payload.threadIds,
          },
        ],
      });

    case "attunement.entered":
      if (previous.attunementActive) {
        fail("attunement-state", event.id, "Attunement is already active");
      }
      return advance(previous, event, { attunementActive: true });

    case "attunement.exited":
      if (!previous.attunementActive) {
        fail("attunement-state", event.id, "Attunement is not active");
      }
      return advance(previous, event, { attunementActive: false });

    case "session.concluded":
      return advance(previous, event, {
        attunementActive: false,
        concluded: true,
      });

    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}
