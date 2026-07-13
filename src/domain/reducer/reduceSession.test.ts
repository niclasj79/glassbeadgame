import { describe, expect, it } from "vitest";
import { createSessionEvent, type SessionEventV1 } from "../events";
import {
  toConceptId,
  toOpenThreadId,
  toSessionId,
  toThreadId,
} from "../ids";
import type { SessionStateV1 } from "../model";
import { SessionTransitionError, type SessionTransitionErrorCode } from "./SessionTransitionError";
import { FULL_SESSION_FIXTURE_IDS, createFullSessionEventSequenceV1 } from "./fixtures";
import { reduceSession } from "./reduceSession";

const events = createFullSessionEventSequenceV1();
const ids = FULL_SESSION_FIXTURE_IDS;

function reduceEvents(input: readonly SessionEventV1[]): SessionStateV1 {
  const state = input.reduce<SessionStateV1 | null>(
    (previous, event) => reduceSession(previous, event),
    null
  );
  if (!state) throw new Error("fixture did not start a session");
  return state;
}

function stateThrough(index: number): SessionStateV1 {
  return reduceEvents(events.slice(0, index + 1));
}

function expectTransitionError(
  operation: () => unknown,
  code: SessionTransitionErrorCode,
  eventId: string
): void {
  let caught: unknown;
  try {
    operation();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(SessionTransitionError);
  expect(caught).toMatchObject({ code, eventId });
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

describe("pure session reducer", () => {
  it("reduces a complete deterministic sequence covering all eleven event types", () => {
    const state = reduceEvents(events);

    expect(new Set(events.map((event) => event.type))).toEqual(
      new Set([
        "session.started",
        "bead.attended",
        "pair.selected",
        "relation.hypothesized",
        "thread.committed",
        "documented-relation.revealed",
        "open-thread.created",
        "motif.completed",
        "attunement.entered",
        "attunement.exited",
        "session.concluded",
      ])
    );
    expect(state).toMatchObject({
      sessionId: ids.sessionId,
      seed: "castalia-golden-001",
      lastSequence: 13,
      at: 1_300,
      attendedConceptId: ids.fibonacciId,
      selectedPair: null,
      hypothesis: null,
      attunementActive: false,
      concluded: true,
    });
    expect(state.threads.map((thread) => thread.id)).toEqual([
      ids.firstThreadId,
      ids.secondThreadId,
    ]);
    expect(state.outcomes.map((outcome) => outcome.type)).toEqual([
      "documented-relation",
      "open-thread",
    ]);
    expect(state.completedMotifs).toHaveLength(1);
    expect(state.completedMotifs[0]).toMatchObject({
      completionId: ids.motifCompletionId,
      motifKindId: ids.motifKindId,
    });
    expect(state).not.toHaveProperty("score");
    expect(state).not.toHaveProperty("startedAt");
    expect(state).not.toHaveProperty("interaction");
  });

  it("returns deterministic deeply immutable states without mutating prior state or events", () => {
    let state: SessionStateV1 | null = null;
    for (const event of events) {
      const previousSnapshot = state && JSON.stringify(state);
      const eventSnapshot = JSON.stringify(event);
      const next = reduceSession(state, event);

      if (state) {
        expect(next).not.toBe(state);
        expect(JSON.stringify(state)).toBe(previousSnapshot);
      }
      expect(JSON.stringify(event)).toBe(eventSnapshot);
      expectDeeplyFrozen(next);
      state = next;
    }

    expect(reduceEvents(events)).toEqual(reduceEvents(events));
    expect(reduceEvents(events)).not.toBe(reduceEvents(events));
  });

  it("replaces attention and clears an old hypothesis when a new pair is selected", () => {
    const attentionReplacement = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 2,
      at: 100,
      type: "bead.attended",
      payload: { conceptId: ids.counterpointId },
    });
    const afterAttention = reduceSession(stateThrough(1), attentionReplacement);
    expect(afterAttention.attendedConceptId).toBe(ids.counterpointId);

    const before = stateThrough(3);
    const replacementPair = [ids.primeNumbersId, ids.counterpointId] as const;
    const replacement = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 4,
      at: 400,
      type: "pair.selected",
      payload: { pair: replacementPair },
    });

    const after = reduceSession(before, replacement);
    expect(after.selectedPair).toEqual(replacementPair);
    expect(after.hypothesis).toBeNull();
    expect(after.attendedConceptId).toBe(ids.fibonacciId);
  });

  it("accepts equal game-relative times and deactivates Attunement on conclusion", () => {
    const equalTimeAttention = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 2,
      at: 100,
      type: "bead.attended",
      payload: { conceptId: ids.counterpointId },
    });
    expect(reduceSession(stateThrough(1), equalTimeAttention).at).toBe(100);

    const conclusion = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 12,
      at: 1_200,
      type: "session.concluded",
      payload: {},
    });
    const concluded = reduceSession(stateThrough(11), conclusion);
    expect(concluded).toMatchObject({ attunementActive: false, concluded: true });
  });

  it("permits the same authored documented relation to be revealed for multiple threads", () => {
    let state = stateThrough(5);
    const secondPair = [ids.primeNumbersId, ids.counterpointId] as const;
    const additions = [
      createSessionEvent({
        sessionId: ids.sessionId,
        sequence: 6,
        at: 600,
        type: "pair.selected",
        payload: { pair: secondPair },
      }),
      createSessionEvent({
        sessionId: ids.sessionId,
        sequence: 7,
        at: 700,
        type: "relation.hypothesized",
        payload: { pair: secondPair, intention: "ground" },
      }),
      createSessionEvent({
        sessionId: ids.sessionId,
        sequence: 8,
        at: 800,
        type: "thread.committed",
        payload: {
          threadId: ids.secondThreadId,
          pair: secondPair,
          intention: "ground",
          gesture: { inputModality: "keyboard" },
        },
      }),
      createSessionEvent({
        sessionId: ids.sessionId,
        sequence: 9,
        at: 900,
        type: "documented-relation.revealed",
        payload: {
          threadId: ids.secondThreadId,
          documentedRelationId: ids.documentedRelationId,
        },
      }),
    ] satisfies readonly SessionEventV1[];

    for (const event of additions) state = reduceSession(state, event);
    expect(
      state.outcomes.filter((outcome) => outcome.type === "documented-relation")
    ).toHaveLength(2);
  });

  it("requires session.started first and rejects a second start or post-conclusion event", () => {
    expectTransitionError(
      () => reduceSession(null, events[1]),
      "invalid-lifecycle",
      events[1].id
    );
    expectTransitionError(
      () => reduceSession(stateThrough(0), events[0]),
      "invalid-lifecycle",
      events[0].id
    );

    const afterConclusion = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 14,
      at: 1_400,
      type: "bead.attended",
      payload: { conceptId: ids.counterpointId },
    });
    expectTransitionError(
      () => reduceSession(stateThrough(13), afterConclusion),
      "invalid-lifecycle",
      afterConclusion.id
    );
  });

  it("rejects invalid initial concept sets", () => {
    const start = events[0];
    if (start.type !== "session.started") throw new Error("invalid fixture");

    for (const conceptIds of [[], [ids.fibonacciId, ids.fibonacciId]]) {
      const invalidStart = createSessionEvent({
        sessionId: ids.sessionId,
        sequence: 0,
        at: 0,
        type: "session.started",
        payload: {
          seed: "castalia-golden-001",
          contentPackVersion: start.payload.contentPackVersion,
          worldId: start.payload.worldId,
          conceptIds,
        },
      });
      expectTransitionError(
        () => reduceSession(null, invalidStart),
        "invalid-session-concepts",
        invalidStart.id
      );
    }
  });

  it("rejects a nonzero initial sequence", () => {
    if (events[0].type !== "session.started") throw new Error("invalid fixture");
    const invalidStart = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 1,
      at: 0,
      type: "session.started",
      payload: events[0].payload,
    });
    expectTransitionError(
      () => reduceSession(null, invalidStart),
      "sequence-mismatch",
      invalidStart.id
    );
  });

  it("rejects session identity, sequence, and relative-time mismatches", () => {
    const foreign = createSessionEvent({
      sessionId: toSessionId("session.foreign"),
      sequence: 1,
      at: 100,
      type: "bead.attended",
      payload: { conceptId: ids.fibonacciId },
    });
    expectTransitionError(
      () => reduceSession(stateThrough(0), foreign),
      "session-identity-mismatch",
      foreign.id
    );

    const skipped = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 2,
      at: 100,
      type: "bead.attended",
      payload: { conceptId: ids.fibonacciId },
    });
    expectTransitionError(
      () => reduceSession(stateThrough(0), skipped),
      "sequence-mismatch",
      skipped.id
    );

    const backwards = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 2,
      at: 99,
      type: "pair.selected",
      payload: { pair: [ids.fibonacciId, ids.counterpointId] },
    });
    expectTransitionError(
      () => reduceSession(stateThrough(1), backwards),
      "relative-time-regression",
      backwards.id
    );
  });

  it("rejects unknown concept and thread references", () => {
    const unknownConcept = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 1,
      at: 100,
      type: "bead.attended",
      payload: { conceptId: toConceptId("unknown.concept") },
    });
    expectTransitionError(
      () => reduceSession(stateThrough(0), unknownConcept),
      "unknown-concept",
      unknownConcept.id
    );

    const unknownThread = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 5,
      at: 500,
      type: "open-thread.created",
      payload: {
        threadId: toThreadId("thread.unknown"),
        openThreadId: toOpenThreadId("open-thread.unknown"),
      },
    });
    expectTransitionError(
      () => reduceSession(stateThrough(4), unknownThread),
      "unknown-thread",
      unknownThread.id
    );
  });

  it("rejects pair and hypothesis mismatches", () => {
    const reversedPair = [ids.counterpointId, ids.fibonacciId] as const;
    const wrongPair = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 3,
      at: 300,
      type: "relation.hypothesized",
      payload: { pair: reversedPair, intention: "echo" },
    });
    expectTransitionError(
      () => reduceSession(stateThrough(2), wrongPair),
      "pair-mismatch",
      wrongPair.id
    );

    const firstPair = [ids.fibonacciId, ids.counterpointId] as const;
    const wrongHypothesis = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 4,
      at: 400,
      type: "thread.committed",
      payload: {
        threadId: ids.firstThreadId,
        pair: firstPair,
        intention: "ground",
        gesture: { inputModality: "mouse" },
      },
    });
    expectTransitionError(
      () => reduceSession(stateThrough(3), wrongHypothesis),
      "hypothesis-mismatch",
      wrongHypothesis.id
    );
  });

  it("rejects duplicate thread, Open Thread, and motif identities", () => {
    const secondPair = [ids.primeNumbersId, ids.counterpointId] as const;
    let state = stateThrough(5);
    state = reduceSession(state, createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 6,
      at: 600,
      type: "pair.selected",
      payload: { pair: secondPair },
    }));
    state = reduceSession(state, createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 7,
      at: 700,
      type: "relation.hypothesized",
      payload: { pair: secondPair, intention: "ground" },
    }));
    const duplicateThread = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 8,
      at: 800,
      type: "thread.committed",
      payload: {
        threadId: ids.firstThreadId,
        pair: secondPair,
        intention: "ground",
        gesture: { inputModality: "mouse" },
      },
    });
    expectTransitionError(
      () => reduceSession(state, duplicateThread),
      "duplicate-identity",
      duplicateThread.id
    );

    const duplicateMotif = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 11,
      at: 1_100,
      type: "motif.completed",
      payload: {
        completionId: ids.motifCompletionId,
        motifKindId: ids.motifKindId,
        conceptIds: [ids.fibonacciId],
        threadIds: [ids.firstThreadId],
      },
    });
    expectTransitionError(
      () => reduceSession(stateThrough(10), duplicateMotif),
      "duplicate-identity",
      duplicateMotif.id
    );

    const thirdPair = [ids.fibonacciId, ids.primeNumbersId] as const;
    const thirdThreadId = toThreadId("thread.castalia-golden-001.3");
    let afterOpenThread = stateThrough(9);
    afterOpenThread = reduceSession(afterOpenThread, createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 10,
      at: 1_000,
      type: "pair.selected",
      payload: { pair: thirdPair },
    }));
    afterOpenThread = reduceSession(afterOpenThread, createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 11,
      at: 1_100,
      type: "relation.hypothesized",
      payload: { pair: thirdPair, intention: "passage" },
    }));
    afterOpenThread = reduceSession(afterOpenThread, createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 12,
      at: 1_200,
      type: "thread.committed",
      payload: {
        threadId: thirdThreadId,
        pair: thirdPair,
        intention: "passage",
        gesture: { inputModality: "touch" },
      },
    }));
    const duplicateOpenThread = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 13,
      at: 1_300,
      type: "open-thread.created",
      payload: { threadId: thirdThreadId, openThreadId: ids.openThreadId },
    });
    expectTransitionError(
      () => reduceSession(afterOpenThread, duplicateOpenThread),
      "duplicate-identity",
      duplicateOpenThread.id
    );
  });

  it("rejects a second outcome for one thread", () => {
    const duplicateOutcome = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 6,
      at: 600,
      type: "open-thread.created",
      payload: {
        threadId: ids.firstThreadId,
        openThreadId: toOpenThreadId("open-thread.second-outcome"),
      },
    });
    expectTransitionError(
      () => reduceSession(stateThrough(5), duplicateOutcome),
      "duplicate-outcome",
      duplicateOutcome.id
    );
  });

  it("rejects invalid Attunement transitions", () => {
    const exitWhileInactive = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 11,
      at: 1_100,
      type: "attunement.exited",
      payload: {},
    });
    expectTransitionError(
      () => reduceSession(stateThrough(10), exitWhileInactive),
      "attunement-state",
      exitWhileInactive.id
    );

    const enterTwice = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 12,
      at: 1_200,
      type: "attunement.entered",
      payload: {},
    });
    expectTransitionError(
      () => reduceSession(stateThrough(11), enterTwice),
      "attunement-state",
      enterTwice.id
    );
  });

  it("preserves the rejected event ID on every domain transition error", () => {
    const previous = stateThrough(0);
    const event = createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 1,
      at: 100,
      type: "bead.attended",
      payload: { conceptId: toConceptId("unknown.concept") },
    });
    const previousSnapshot = JSON.stringify(previous);
    const eventSnapshot = JSON.stringify(event);

    try {
      reduceSession(previous, event);
      throw new Error("expected transition to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SessionTransitionError);
      expect(error).toMatchObject({ code: "unknown-concept", eventId: event.id });
    }
    expect(JSON.stringify(previous)).toBe(previousSnapshot);
    expect(JSON.stringify(event)).toBe(eventSnapshot);
  });
});
