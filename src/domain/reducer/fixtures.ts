import { createSessionEvent, type SessionEventV1 } from "../events";
import {
  toConceptId,
  toContentPackVersion,
  toDocumentedRelationId,
  toMotifCompletionId,
  toMotifKindId,
  toOpenThreadId,
  toSessionId,
  toThreadId,
  toWorldId,
} from "../ids";

export const FULL_SESSION_FIXTURE_IDS = Object.freeze({
  sessionId: toSessionId("session.castalia-golden-001"),
  fibonacciId: toConceptId("math.fibonacci-sequence"),
  counterpointId: toConceptId("music.counterpoint"),
  primeNumbersId: toConceptId("math.prime-numbers"),
  firstThreadId: toThreadId("thread.castalia-golden-001.1"),
  secondThreadId: toThreadId("thread.castalia-golden-001.2"),
  documentedRelationId: toDocumentedRelationId(
    "math.fibonacci-sequence+music.counterpoint"
  ),
  openThreadId: toOpenThreadId("open-thread.castalia-golden-001.1"),
  motifCompletionId: toMotifCompletionId("motif-completion.castalia-golden-001.1"),
  motifKindId: toMotifKindId("canon"),
});

export function createFullSessionEventSequenceV1(): readonly SessionEventV1[] {
  const ids = FULL_SESSION_FIXTURE_IDS;
  const firstPair = [ids.fibonacciId, ids.counterpointId] as const;
  const secondPair = [ids.primeNumbersId, ids.counterpointId] as const;

  return Object.freeze([
    createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 0,
      at: 0,
      type: "session.started",
      payload: {
        seed: "castalia-golden-001",
        contentPackVersion: toContentPackVersion("castalia.v1"),
        worldId: toWorldId("castalia"),
        conceptIds: [ids.fibonacciId, ids.counterpointId, ids.primeNumbersId],
      },
    }),
    createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 1,
      at: 100,
      type: "bead.attended",
      payload: { conceptId: ids.fibonacciId },
    }),
    createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 2,
      at: 200,
      type: "pair.selected",
      payload: { pair: firstPair },
    }),
    createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 3,
      at: 300,
      type: "relation.hypothesized",
      payload: { pair: firstPair, intention: "echo" },
    }),
    createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 4,
      at: 400,
      type: "thread.committed",
      payload: {
        threadId: ids.firstThreadId,
        pair: firstPair,
        intention: "echo",
        gesture: {
          inputModality: "pen",
          durationMs: 800,
          pathLengthViewport: 0.45,
          curvature: 0.2,
          averageSpeedViewportPerSecond: 0.56,
          speedVariance: 0.04,
          pressure: 0.65,
        },
      },
    }),
    createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 5,
      at: 500,
      type: "documented-relation.revealed",
      payload: {
        threadId: ids.firstThreadId,
        documentedRelationId: ids.documentedRelationId,
      },
    }),
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
      payload: { pair: secondPair, intention: "tension" },
    }),
    createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 8,
      at: 800,
      type: "thread.committed",
      payload: {
        threadId: ids.secondThreadId,
        pair: secondPair,
        intention: "tension",
        gesture: { inputModality: "keyboard" },
      },
    }),
    createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 9,
      at: 900,
      type: "open-thread.created",
      payload: {
        threadId: ids.secondThreadId,
        openThreadId: ids.openThreadId,
      },
    }),
    createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 10,
      at: 1_000,
      type: "motif.completed",
      payload: {
        completionId: ids.motifCompletionId,
        motifKindId: ids.motifKindId,
        conceptIds: [ids.fibonacciId, ids.counterpointId, ids.primeNumbersId],
        threadIds: [ids.firstThreadId, ids.secondThreadId],
      },
    }),
    createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 11,
      at: 1_100,
      type: "attunement.entered",
      payload: {},
    }),
    createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 12,
      at: 1_200,
      type: "attunement.exited",
      payload: {},
    }),
    createSessionEvent({
      sessionId: ids.sessionId,
      sequence: 13,
      at: 1_300,
      type: "session.concluded",
      payload: {},
    }),
  ] satisfies readonly SessionEventV1[]);
}
