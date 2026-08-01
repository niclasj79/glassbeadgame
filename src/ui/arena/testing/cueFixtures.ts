import type { DocumentedRelation, EvidenceClass } from "@/content/castalia/schema";
import { toConceptId, toEventId, toThreadId } from "@/domain/ids";
import { toFacetId } from "@/content/castalia/schema";
import { toMotifKindId } from "@/domain/ids";
import {
  planCommitMoment,
  planMotifCompleted,
  type IntentionReception,
  type PresentationCue,
} from "@/runtime/cues";

/**
 * Real cues, built by the real planner, for the UI surfaces that read them.
 * Hand-rolled cue literals would let a test pass against a shape the planner no
 * longer produces, which is the one thing a presentation test must not do.
 */

const A = toConceptId("measure.fibonacci-sequence");
const B = toConceptId("sound.counterpoint");
const PAIR = Object.freeze([A, B]) as readonly [typeof A, typeof B];
const THREAD = toThreadId("thread:1:s:1");
const EVENT = toEventId("event:1");

export const relationFixture = (
  overrides: Partial<DocumentedRelation> = {}
): DocumentedRelation =>
  ({
    id: "measure.fibonacci-sequence~sound.counterpoint",
    pair: [String(A), String(B)],
    title: "The Most Rational and the Least",
    relationType: "opposition",
    evidence: "interpretive",
    fit: {
      echo: "primary",
      passage: "partial",
      tension: "unsupported",
      ground: "supported",
    },
    insight: "Both use proportion; one to lock, one never to lock.",
    counterpoint: "The opposition is the Game's own reading.",
    sharedFacets: [],
    sources: ["src.douady-couder-1992", "src.barbour-1951"],
    ...overrides,
  }) as DocumentedRelation;

const outcomeCue = (
  outcome: Parameters<typeof planCommitMoment>[0]["outcome"]
): PresentationCue =>
  planCommitMoment({
    woven: {
      threadId: THREAD,
      pair: PAIR,
      intention: "echo",
      gesture: { inputModality: "mouse", durationMs: 500 },
    },
    wovenEventId: EVENT,
    outcome,
  }).cues[1];

/** The `thread.woven` cue that precedes every outcome. */
export const wovenCue = (): PresentationCue =>
  planCommitMoment({
    woven: {
      threadId: THREAD,
      pair: PAIR,
      intention: "echo",
      gesture: { inputModality: "mouse", durationMs: 500 },
    },
    wovenEventId: EVENT,
    outcome: {
      kind: "unresolved",
      payload: {
        threadId: THREAD,
        pair: PAIR,
        intention: "echo",
        statement: "Nothing is grounded here yet.",
      },
    },
  }).cues[0];

export const documentedCue = (
  evidence: EvidenceClass,
  reception: IntentionReception = "confirmed",
  relation: DocumentedRelation = relationFixture({ evidence })
): PresentationCue =>
  outcomeCue({
    kind: "documented",
    eventId: EVENT,
    payload: {
      threadId: THREAD,
      pair: PAIR,
      intention: "echo",
      relation,
      evidence,
      reception,
    },
  });

export const openThreadCue = (): PresentationCue =>
  outcomeCue({
    kind: "open-thread",
    eventId: EVENT,
    payload: {
      threadId: THREAD,
      pair: PAIR,
      intention: "echo",
      question: "Does either proportion survive being heard rather than counted?",
      sharedFacet: toFacetId("proportion"),
    },
  });

export const unresolvedCue = (): PresentationCue =>
  outcomeCue({
    kind: "unresolved",
    payload: {
      threadId: THREAD,
      pair: PAIR,
      intention: "echo",
      statement: "The Game has no grounded relation here yet.",
    },
  });

export const motifCue = (): PresentationCue =>
  planMotifCompleted(
    {
      motifKindId: toMotifKindId("canon"),
      conceptIds: [A, B],
      threadIds: [THREAD],
      reason: "Recursion returned three times and never in the same shape.",
    },
    EVENT
  ).cues[0];
