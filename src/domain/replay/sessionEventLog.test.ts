import { describe, expect, it } from "vitest";
import type { SessionEventV1 } from "../events";
import type { SessionStateV1 } from "../model";
import {
  createFullSessionEventSequenceV1,
  reduceSession,
  SessionTransitionError,
} from "../reducer";
import {
  decodeSessionEventLogV1,
  parseSessionEventLogV1,
} from "./decodeSessionEventLog";
import { replaySessionEventLogV1 } from "./replaySessionEventLog";
import { serializeSessionEventLogV1 } from "./serializeSessionEventLog";
import {
  SessionEventLogError,
  type SessionEventLogErrorCode,
  type SessionEventLogErrorStage,
} from "./SessionEventLogError";
import {
  SESSION_EVENT_LOG_FORMAT,
  SESSION_EVENT_LOG_SCHEMA_VERSION,
  type SessionEventLogV1,
} from "./types";

type JsonRecord = Record<string, unknown>;

const fixtureEvents = createFullSessionEventSequenceV1();

function makeLog(events: readonly SessionEventV1[] = fixtureEvents): SessionEventLogV1 {
  return Object.freeze({
    format: SESSION_EVENT_LOG_FORMAT,
    schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
    events: Object.freeze([...events]),
  });
}

function rawLog(): JsonRecord {
  return JSON.parse(JSON.stringify(makeLog())) as JsonRecord;
}

function rawEvents(log: JsonRecord): JsonRecord[] {
  return (log.events as unknown[]).map((event) => event as JsonRecord);
}

function payloadAt(log: JsonRecord, index: number): JsonRecord {
  return rawEvents(log)[index].payload as JsonRecord;
}

function reduceDirectly(events: readonly SessionEventV1[]): SessionStateV1 {
  const result = events.reduce<SessionStateV1 | null>(
    (state, event) => reduceSession(state, event),
    null
  );
  if (!result) throw new Error("fixture is empty");
  return result;
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

function expectLogError(
  operation: () => unknown,
  code: SessionEventLogErrorCode,
  stage: SessionEventLogErrorStage,
  expected: Partial<SessionEventLogError> = {}
): SessionEventLogError {
  let caught: unknown;
  try {
    operation();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(SessionEventLogError);
  expect(caught).toMatchObject({ code, stage, ...expected });
  return caught as SessionEventLogError;
}

describe("schema-version-1 session event logs", () => {
  it("rebuilds and deeply freezes a full log covering all eleven event variants", () => {
    const source = rawLog();
    const sourceSnapshot = JSON.stringify(source);
    const decoded = decodeSessionEventLogV1(source);

    expect(new Set(decoded.events.map((event) => event.type))).toEqual(
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
    expect(decoded).toEqual(makeLog());
    expect(decoded).not.toBe(source);
    expectDeeplyFrozen(decoded);
    expect(JSON.stringify(source)).toBe(sourceSnapshot);
  });

  it("serializes, parses, and replays the golden path deterministically", () => {
    const log = makeLog();
    const json = serializeSessionEventLogV1(log);
    const parsed = parseSessionEventLogV1(json);
    const replayed = replaySessionEventLogV1(parsed);

    expect(json).toBe(serializeSessionEventLogV1(log));
    expect(serializeSessionEventLogV1(parsed)).toBe(json);
    expect(replayed).toEqual(reduceDirectly(fixtureEvents));
    expect(replaySessionEventLogV1(parsed)).toEqual(replayed);
    expectDeeplyFrozen(replayed);
  });

  it("replays a valid in-progress log without requiring conclusion", () => {
    const inProgress = makeLog(fixtureEvents.slice(0, 6));
    const state = replaySessionEventLogV1(decodeSessionEventLogV1(inProgress));

    expect(state).toEqual(reduceDirectly(fixtureEvents.slice(0, 6)));
    expect(state.concluded).toBe(false);
    expect(state.lastSequence).toBe(5);
  });

  it("uses fixed canonical property order independent of input insertion order", () => {
    const normal = rawLog();
    const normalEvents = rawEvents(normal);
    const first = normalEvents[0];
    const firstPayload = first.payload as JsonRecord;
    const reorderedFirst = {
      payload: {
        conceptIds: firstPayload.conceptIds,
        worldId: firstPayload.worldId,
        contentPackVersion: firstPayload.contentPackVersion,
        seed: firstPayload.seed,
      },
      type: first.type,
      at: first.at,
      sequence: first.sequence,
      sessionId: first.sessionId,
      id: first.id,
      schemaVersion: first.schemaVersion,
    };
    const reordered = {
      events: [reorderedFirst, ...normalEvents.slice(1)],
      schemaVersion: 1,
      format: SESSION_EVENT_LOG_FORMAT,
    } as unknown as SessionEventLogV1;

    const canonical = serializeSessionEventLogV1(makeLog());
    expect(serializeSessionEventLogV1(reordered)).toBe(canonical);
    expect(canonical.startsWith('{"format":"glass-bead-game.session-event-log","schemaVersion":1,"events":[')).toBe(true);
    expect(canonical).not.toContain("durationMs\":null");
  });

  it("rejects malformed JSON without exposing parser exceptions", () => {
    const error = expectLogError(
      () => parseSessionEventLogV1("{not-json"),
      "malformed-json",
      "parse",
      { path: "$" }
    );
    expect(error.cause).toBeInstanceOf(SyntaxError);
    expectLogError(
      () => parseSessionEventLogV1(42 as unknown as string),
      "malformed-json",
      "parse"
    );
  });

  it.each([
    ["primitive", null, "invalid-envelope-shape"],
    ["array", [], "invalid-envelope-shape"],
    ["extra field", { ...rawLog(), extra: true }, "invalid-envelope-shape"],
    ["wrong format", { ...rawLog(), format: "other" }, "invalid-envelope-shape"],
    ["unknown log version", { ...rawLog(), schemaVersion: 2 }, "unsupported-log-version"],
    ["non-array events", { ...rawLog(), events: {} }, "invalid-envelope-shape"],
    ["empty log", { ...rawLog(), events: [] }, "empty-log"],
  ] as const)("rejects an invalid envelope: %s", (_label, input, code) => {
    expectLogError(
      () => decodeSessionEventLogV1(input),
      code as SessionEventLogErrorCode,
      "decode"
    );
  });

  it("distinguishes event shape, version, type, and deterministic ID failures", () => {
    const extra = rawLog();
    rawEvents(extra)[0].extra = true;
    expectLogError(
      () => decodeSessionEventLogV1(extra),
      "invalid-event-shape",
      "decode",
      { eventIndex: 0, path: "events[0]" }
    );

    const version = rawLog();
    rawEvents(version)[0].schemaVersion = 2;
    expectLogError(
      () => decodeSessionEventLogV1(version),
      "unsupported-event-version",
      "decode",
      { eventIndex: 0 }
    );

    const type = rawLog();
    rawEvents(type)[1].type = "bead.forgotten";
    expectLogError(
      () => decodeSessionEventLogV1(type),
      "unsupported-event-type",
      "decode",
      { eventIndex: 1 }
    );

    const id = rawLog();
    rawEvents(id)[2].id = "event:wrong";
    expectLogError(
      () => decodeSessionEventLogV1(id),
      "invalid-event-id",
      "decode",
      { eventIndex: 2, path: "events[2].id" }
    );
  });

  it.each([
    ["negative sequence", "sequence", -1],
    ["fractional sequence", "sequence", 1.5],
    ["infinite time", "at", Number.POSITIVE_INFINITY],
    ["string time", "at", "100"],
  ] as const)("rejects invalid event envelope values: %s", (_label, field, value) => {
    const log = rawLog();
    rawEvents(log)[1][field] = value;
    expectLogError(
      () => decodeSessionEventLogV1(log),
      "invalid-event-shape",
      "decode",
      { eventIndex: 1 }
    );
  });

  it("rejects missing, extra, and mistyped payload fields", () => {
    const missing = rawLog();
    delete payloadAt(missing, 1).conceptId;
    expectLogError(
      () => decodeSessionEventLogV1(missing),
      "invalid-event-payload",
      "decode",
      { eventIndex: 1 }
    );

    const extra = rawLog();
    payloadAt(extra, 2).hint = true;
    expectLogError(
      () => decodeSessionEventLogV1(extra),
      "invalid-event-payload",
      "decode",
      { eventIndex: 2 }
    );

    const mistyped = rawLog();
    payloadAt(mistyped, 7).pair = "not-an-array";
    expectLogError(
      () => decodeSessionEventLogV1(mistyped),
      "invalid-event-payload",
      "decode",
      { eventIndex: 7 }
    );
  });

  it.each([
    ["blank seed", 0, "seed", "   "],
    ["invalid concept ID", 1, "conceptId", ""],
    ["identical pair", 2, "pair", ["math.fibonacci-sequence", "math.fibonacci-sequence"]],
    ["unsupported intention", 3, "intention", "similar"],
    ["invalid documented relation ID", 5, "documentedRelationId", " "],
    ["invalid Open Thread ID", 9, "openThreadId", 7],
    ["malformed motif concepts", 10, "conceptIds", {}],
  ] as const)("rejects invalid event payload data: %s", (_label, index, field, value) => {
    const log = rawLog();
    payloadAt(log, index)[field] = value;
    expectLogError(
      () => decodeSessionEventLogV1(log),
      "invalid-event-payload",
      "decode",
      { eventIndex: index }
    );
  });

  it.each([
    ["extra gesture field", (gesture: JsonRecord) => { gesture.rawPoints = []; }],
    ["unsupported modality", (gesture: JsonRecord) => { gesture.inputModality = "voice"; }],
    ["negative duration", (gesture: JsonRecord) => { gesture.durationMs = -1; }],
    ["pressure above one", (gesture: JsonRecord) => { gesture.pressure = 1.1; }],
  ] as const)("strictly validates gesture profiles: %s", (_label, mutate) => {
    const log = rawLog();
    const gesture = payloadAt(log, 4).gesture as JsonRecord;
    mutate(gesture);
    expectLogError(
      () => decodeSessionEventLogV1(log),
      "invalid-event-payload",
      "decode",
      { eventIndex: 4 }
    );
  });

  it("requires empty payloads to remain exactly empty", () => {
    for (const index of [11, 12, 13]) {
      const log = rawLog();
      payloadAt(log, index).snapshot = {};
      expectLogError(
        () => decodeSessionEventLogV1(log),
        "invalid-event-payload",
        "decode",
        { eventIndex: index }
      );
    }
  });

  it("reports the failing index and preserves reducer transition details", () => {
    const log = rawLog();
    const events = log.events as unknown[];
    [events[1], events[2]] = [events[2], events[1]];

    const error = expectLogError(
      () => decodeSessionEventLogV1(log),
      "replay-transition",
      "replay",
      {
        eventIndex: 1,
        path: "events[1]",
        transitionCode: "sequence-mismatch",
      }
    );
    expect(error.cause).toBeInstanceOf(SessionTransitionError);
    expect(error.rejectedEventId).toBe((events[1] as JsonRecord).id);
  });

  it("validates serialization inputs and reports the serialize stage", () => {
    const invalid = { ...makeLog(), events: [] } as SessionEventLogV1;
    const error = expectLogError(
      () => serializeSessionEventLogV1(invalid),
      "empty-log",
      "serialize",
      { path: "events" }
    );
    expect(error.cause).toBeInstanceOf(SessionEventLogError);
  });

  it("does not mutate log or event inputs during serialization or replay", () => {
    const log = makeLog();
    const eventsReference = log.events;
    const snapshot = JSON.stringify(log);
    serializeSessionEventLogV1(log);
    replaySessionEventLogV1(log);
    expect(JSON.stringify(log)).toBe(snapshot);
    expect(log.events).toBe(eventsReference);
  });
});
