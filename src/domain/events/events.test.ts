import { describe, expect, expectTypeOf, it } from "vitest";
import {
  eventIdFor,
  toConceptId,
  toContentPackVersion,
  toDocumentedRelationId,
  toEventId,
  toMotifCompletionId,
  toMotifKindId,
  toOpenThreadId,
  toSessionId,
  toThreadId,
  toWorldId,
  type ConceptId,
  type SessionId,
} from "../ids";
import { createSessionEvent } from "./createSessionEvent";
import {
  INPUT_MODALITIES,
  RELATION_INTENTIONS,
  type AnyCreateSessionEventInputV1,
  type InputModality,
  type SessionEventTypeV1,
  type SessionEventV1,
} from "./types";

const sessionId = toSessionId("session.castalia-001");
const fibonacciId = toConceptId("math.fibonacci-sequence");
const counterpointId = toConceptId("music.counterpoint");
const pair = [fibonacciId, counterpointId] as const;
const threadId = toThreadId("thread.castalia-001.1");

describe("stable domain identifiers", () => {
  it("preserves valid authored strings while keeping identifier meanings distinct", () => {
    expect(toConceptId("math.fibonacci-sequence")).toBe("math.fibonacci-sequence");
    expectTypeOf<SessionId>().not.toEqualTypeOf<ConceptId>();
  });

  it.each([
    ["session", toSessionId],
    ["event", toEventId],
    ["concept", toConceptId],
    ["thread", toThreadId],
    ["documented relation", toDocumentedRelationId],
    ["Open Thread", toOpenThreadId],
    ["motif completion", toMotifCompletionId],
    ["motif kind", toMotifKindId],
    ["world", toWorldId],
    ["content pack", toContentPackVersion],
  ] as const)("rejects an empty %s ID", (_label, factory) => {
    expect(() => factory(" \t ")).toThrow(TypeError);
  });

  it("derives collision-safe event IDs deterministically from session and sequence", () => {
    expect(eventIdFor(sessionId, 12)).toBe("event:20:session.castalia-001:12");
    expect(eventIdFor(sessionId, 12)).toBe(eventIdFor(sessionId, 12));
    expect(eventIdFor(toSessionId("session.castalia-001:1"), 2)).not.toBe(
      eventIdFor(toSessionId("session.castalia-001"), 12)
    );
    expect(() => eventIdFor(sessionId, -1)).toThrow(RangeError);
  });
});

function describePayload(event: SessionEventV1): string {
  switch (event.type) {
    case "session.started":
      return event.payload.seed;
    case "bead.attended":
      return event.payload.conceptId;
    case "pair.selected":
      return event.payload.pair.join("+");
    case "relation.hypothesized":
      return event.payload.intention;
    case "thread.committed":
      return event.payload.gesture.inputModality;
    case "documented-relation.revealed":
      return event.payload.documentedRelationId;
    case "open-thread.created":
      return event.payload.openThreadId;
    case "motif.completed":
      return event.payload.motifKindId;
    case "attunement.entered":
    case "attunement.exited":
    case "session.concluded":
      return event.type;
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

describe("schema-version-1 session events", () => {
  it("keeps the player-facing relation and input vocabularies closed", () => {
    expect(RELATION_INTENTIONS).toEqual(["echo", "passage", "tension", "ground"]);
    expect(INPUT_MODALITIES).toEqual([
      "mouse",
      "touch",
      "pen",
      "keyboard",
      "controller",
      "unknown",
    ]);
  });

  it("constructs and narrows every event in the initial vocabulary", () => {
    const inputs: AnyCreateSessionEventInputV1[] = [
      {
        sessionId,
        sequence: 0,
        at: 0,
        type: "session.started",
        payload: {
          seed: "castalia-golden-001",
          contentPackVersion: toContentPackVersion("castalia.v1"),
          worldId: toWorldId("castalia"),
          conceptIds: pair,
        },
      },
      {
        sessionId,
        sequence: 1,
        at: 10,
        type: "bead.attended",
        payload: { conceptId: fibonacciId },
      },
      {
        sessionId,
        sequence: 2,
        at: 20,
        type: "pair.selected",
        payload: { pair },
      },
      {
        sessionId,
        sequence: 3,
        at: 30,
        type: "relation.hypothesized",
        payload: { pair, intention: "echo" },
      },
      {
        sessionId,
        sequence: 4,
        at: 40,
        type: "thread.committed",
        payload: {
          threadId,
          pair,
          intention: "echo",
          gesture: {
            inputModality: "pen",
            durationMs: 900,
            pathLengthViewport: 0.4,
            curvature: 0.2,
            averageSpeedViewportPerSecond: 0.44,
            speedVariance: 0.03,
            pressure: 0.7,
          },
        },
      },
      {
        sessionId,
        sequence: 5,
        at: 50,
        type: "documented-relation.revealed",
        payload: {
          threadId,
          documentedRelationId: toDocumentedRelationId(
            "math.fibonacci-sequence+music.counterpoint"
          ),
        },
      },
      {
        sessionId,
        sequence: 6,
        at: 60,
        type: "open-thread.created",
        payload: { threadId, openThreadId: toOpenThreadId("open-thread.castalia-001.1") },
      },
      {
        sessionId,
        sequence: 7,
        at: 70,
        type: "motif.completed",
        payload: {
          completionId: toMotifCompletionId("motif-completion.castalia-001.1"),
          motifKindId: toMotifKindId("canon"),
          conceptIds: pair,
          threadIds: [threadId],
        },
      },
      { sessionId, sequence: 8, at: 80, type: "attunement.entered", payload: {} },
      { sessionId, sequence: 9, at: 90, type: "attunement.exited", payload: {} },
      { sessionId, sequence: 10, at: 100, type: "session.concluded", payload: {} },
    ];

    const events = inputs.map((input) => createSessionEvent(input));
    const expectedTypes: SessionEventTypeV1[] = [
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
    ];

    expect(events.map((event) => event.type)).toEqual(expectedTypes);
    expect(events.map(describePayload)).toHaveLength(expectedTypes.length);
    expect(events.every((event) => event.schemaVersion === 1)).toBe(true);
  });

  it("constructs deterministic immutable values without retaining mutable payload aliases", () => {
    const conceptIds = [fibonacciId, counterpointId];
    const input = {
      sessionId,
      sequence: 0,
      at: 0,
      type: "session.started" as const,
      payload: {
        seed: "castalia-golden-001",
        contentPackVersion: toContentPackVersion("castalia.v1"),
        worldId: toWorldId("castalia"),
        conceptIds,
      },
    };

    const first = createSessionEvent(input);
    const second = createSessionEvent(input);
    conceptIds.push(toConceptId("math.prime-numbers"));

    expect(first).toEqual(second);
    expect(first.payload.conceptIds).toEqual(pair);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.payload)).toBe(true);
    expect(Object.isFrozen(first.payload.conceptIds)).toBe(true);
  });

  it.each([
    ["negative sequence", { sequence: -1, at: 0 }],
    ["fractional sequence", { sequence: 1.5, at: 0 }],
    ["unsafe sequence", { sequence: Number.MAX_SAFE_INTEGER + 1, at: 0 }],
    ["negative time", { sequence: 0, at: -1 }],
    ["infinite time", { sequence: 0, at: Number.POSITIVE_INFINITY }],
    ["NaN time", { sequence: 0, at: Number.NaN }],
  ] as const)("rejects %s", (_label, invalid) => {
    expect(() =>
      createSessionEvent({
        sessionId,
        sequence: invalid.sequence,
        at: invalid.at,
        type: "bead.attended",
        payload: { conceptId: fibonacciId },
      })
    ).toThrow(RangeError);
  });

  it("rejects blank seeds and identical pair endpoints", () => {
    expect(() =>
      createSessionEvent({
        sessionId,
        sequence: 0,
        at: 0,
        type: "session.started",
        payload: {
          seed: "  ",
          contentPackVersion: toContentPackVersion("castalia.v1"),
          worldId: toWorldId("castalia"),
          conceptIds: pair,
        },
      })
    ).toThrow(TypeError);

    expect(() =>
      createSessionEvent({
        sessionId,
        sequence: 1,
        at: 0,
        type: "pair.selected",
        payload: { pair: [fibonacciId, fibonacciId] },
      })
    ).toThrow(RangeError);
  });

  it("allows unavailable gesture measurements and validates supplied summaries", () => {
    const minimal = createSessionEvent({
      sessionId,
      sequence: 1,
      at: 5,
      type: "thread.committed",
      payload: {
        threadId,
        pair,
        intention: "ground",
        gesture: { inputModality: "keyboard" },
      },
    });
    expect(minimal.payload.gesture).toEqual({ inputModality: "keyboard" });

    expect(() =>
      createSessionEvent({
        sessionId,
        sequence: 2,
        at: 6,
        type: "thread.committed",
        payload: {
          threadId,
          pair,
          intention: "tension",
          gesture: { inputModality: "touch", pressure: 1.01 },
        },
      })
    ).toThrow(RangeError);
  });

  it.each([
    ["negative duration", { inputModality: "mouse", durationMs: -1 }],
    ["infinite path", { inputModality: "touch", pathLengthViewport: Infinity }],
    ["unsupported modality", { inputModality: "voice" as InputModality }],
  ] as const)("rejects %s in a gesture profile", (_label, gesture) => {
    expect(() =>
      createSessionEvent({
        sessionId,
        sequence: 3,
        at: 7,
        type: "thread.committed",
        payload: { threadId, pair, intention: "passage", gesture },
      })
    ).toThrow();
  });
});
