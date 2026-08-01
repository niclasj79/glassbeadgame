import { createSessionEvent } from "../../events/createSessionEvent";
import type {
  GestureProfile,
  RelationIntention,
  SessionEventV1,
} from "../../events";
import {
  toContentPackVersion,
  toConceptId,
  toMotifCompletionId,
  toMotifKindId,
  toSessionId,
  toThreadId,
  toWorldId,
  type ConceptId,
  type ThreadId,
} from "../../ids";
import type { SessionStateV1 } from "../../model/sessionState";
import { reduceSession } from "../../reducer/reduceSession";

/**
 * Builds a real session by replaying real events through the real reducer.
 *
 * Nothing here fabricates a `SessionStateV1` literal. If a fixture is
 * expressible, the accepted event vocabulary and reducer rules permitted it, so
 * every test in this campaign is a test against a session the game could
 * actually produce. Event times advance by a fixed step, so replay is
 * bit-identical on every run and on every machine.
 */

export interface ThreadFixtureSpec {
  readonly a: ConceptId;
  readonly b: ConceptId;
  readonly intention: RelationIntention;
  readonly gesture?: GestureProfile;
  /** Overrides the generated `thread:<n>` identity. */
  readonly threadId?: string;
}

export interface MotifFixtureSpec {
  readonly kind: string;
  readonly conceptIds: readonly ConceptId[];
  /** Indices into the fixture's thread list. */
  readonly threadIndices: readonly number[];
  readonly completionId?: string;
}

export interface SessionFixtureSpec {
  readonly sessionId?: string;
  readonly seed?: string;
  readonly conceptIds: readonly ConceptId[];
  readonly threads?: readonly ThreadFixtureSpec[];
  readonly motifs?: readonly MotifFixtureSpec[];
  readonly attunement?: boolean;
  readonly concluded?: boolean;
}

export interface SessionFixture {
  readonly state: SessionStateV1;
  readonly events: readonly SessionEventV1[];
  readonly threadIds: readonly ThreadId[];
}

const DEFAULT_GESTURE: GestureProfile = Object.freeze({
  inputModality: "mouse",
  durationMs: 900,
  pathLengthViewport: 0.6,
  curvature: 0.3,
  averageSpeedViewportPerSecond: 0.7,
  speedVariance: 0.2,
  pressure: 0.5,
});

const STEP_MS = 1000;

export function buildSessionFixture(spec: SessionFixtureSpec): SessionFixture {
  const sessionId = toSessionId(spec.sessionId ?? "session.fixture");
  const events: SessionEventV1[] = [];
  const threadIds: ThreadId[] = [];
  let sequence = 0;

  const push = (
    build: (sequence: number, at: number) => SessionEventV1
  ): void => {
    events.push(build(sequence, sequence * STEP_MS));
    sequence += 1;
  };

  push((seq, at) =>
    createSessionEvent({
      sessionId,
      sequence: seq,
      at,
      type: "session.started",
      payload: {
        seed: spec.seed ?? "castalia-fixture-001",
        contentPackVersion: toContentPackVersion("fixture-1"),
        worldId: toWorldId("castalia"),
        conceptIds: spec.conceptIds,
      },
    })
  );

  (spec.threads ?? []).forEach((thread, index) => {
    const threadId = toThreadId(thread.threadId ?? `thread:${index}`);
    threadIds.push(threadId);
    const pair = [thread.a, thread.b] as const;

    push((seq, at) =>
      createSessionEvent({
        sessionId,
        sequence: seq,
        at,
        type: "bead.attended",
        payload: { conceptId: thread.a },
      })
    );
    push((seq, at) =>
      createSessionEvent({
        sessionId,
        sequence: seq,
        at,
        type: "pair.selected",
        payload: { pair },
      })
    );
    push((seq, at) =>
      createSessionEvent({
        sessionId,
        sequence: seq,
        at,
        type: "relation.hypothesized",
        payload: { pair, intention: thread.intention },
      })
    );
    push((seq, at) =>
      createSessionEvent({
        sessionId,
        sequence: seq,
        at,
        type: "thread.committed",
        payload: {
          threadId,
          pair,
          intention: thread.intention,
          gesture: thread.gesture ?? DEFAULT_GESTURE,
        },
      })
    );
  });

  (spec.motifs ?? []).forEach((completion, index) => {
    push((seq, at) =>
      createSessionEvent({
        sessionId,
        sequence: seq,
        at,
        type: "motif.completed",
        payload: {
          completionId: toMotifCompletionId(
            completion.completionId ?? `motif:${index}`
          ),
          motifKindId: toMotifKindId(completion.kind),
          conceptIds: completion.conceptIds,
          threadIds: completion.threadIndices.map((threadIndex) => {
            const found = threadIds[threadIndex];
            if (found === undefined) {
              throw new RangeError(`fixture motif references thread ${threadIndex}`);
            }
            return found;
          }),
        },
      })
    );
  });

  if (spec.attunement === true) {
    push((seq, at) =>
      createSessionEvent({
        sessionId,
        sequence: seq,
        at,
        type: "attunement.entered",
        payload: {},
      })
    );
    push((seq, at) =>
      createSessionEvent({
        sessionId,
        sequence: seq,
        at,
        type: "attunement.exited",
        payload: {},
      })
    );
  }

  if (spec.concluded === true) {
    push((seq, at) =>
      createSessionEvent({
        sessionId,
        sequence: seq,
        at,
        type: "session.concluded",
        payload: {},
      })
    );
  }

  let state: SessionStateV1 | null = null;
  for (const event of events) {
    state = reduceSession(state, event);
  }
  if (state === null) {
    throw new Error("a session fixture must produce state");
  }

  return Object.freeze({
    state,
    events: Object.freeze(events),
    threadIds: Object.freeze(threadIds),
  });
}

/** An empty session over the given concepts — the "nothing woven yet" case. */
export function buildEmptySessionFixture(
  conceptIds: readonly string[]
): SessionFixture {
  return buildSessionFixture({
    conceptIds: conceptIds.map(toConceptId),
  });
}
