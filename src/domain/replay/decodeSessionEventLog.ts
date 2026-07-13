import {
  createSessionEvent,
  INPUT_MODALITIES,
  RELATION_INTENTIONS,
  type ConceptPair,
  type GestureProfile,
  type InputModality,
  type RelationIntention,
  type SessionEventTypeV1,
  type SessionEventV1,
} from "../events";
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
  type ConceptId,
  type ThreadId,
} from "../ids";
import { replaySessionEventLogV1 } from "./replaySessionEventLog";
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

type UnknownRecord = Record<string, unknown>;

const EVENT_KEYS = [
  "schemaVersion",
  "id",
  "sessionId",
  "sequence",
  "at",
  "type",
  "payload",
] as const;
const GESTURE_KEYS = [
  "inputModality",
  "durationMs",
  "pathLengthViewport",
  "curvature",
  "averageSpeedViewportPerSecond",
  "speedVariance",
  "pressure",
] as const;
const EVENT_TYPES = [
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
] as const satisfies readonly SessionEventTypeV1[];

function fail(
  code: SessionEventLogErrorCode,
  stage: SessionEventLogErrorStage,
  path: string,
  message: string,
  eventIndex?: number,
  cause?: unknown
): never {
  throw new SessionEventLogError(code, stage, message, { path, eventIndex, cause });
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  code: SessionEventLogErrorCode,
  stage: SessionEventLogErrorStage,
  path: string,
  eventIndex?: number
): UnknownRecord {
  if (!isRecord(value)) fail(code, stage, path, `${path} must be an object`, eventIndex);
  return value;
}

function requireExactKeys(
  value: UnknownRecord,
  expected: readonly string[],
  code: SessionEventLogErrorCode,
  stage: SessionEventLogErrorStage,
  path: string,
  eventIndex?: number
): void {
  const actual = Object.keys(value);
  if (
    actual.length !== expected.length ||
    actual.some((key) => !expected.includes(key)) ||
    expected.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    fail(code, stage, path, `${path} has missing or extra fields`, eventIndex);
  }
}

function requireString(
  value: unknown,
  code: SessionEventLogErrorCode,
  stage: SessionEventLogErrorStage,
  path: string,
  eventIndex?: number
): string {
  if (typeof value !== "string") fail(code, stage, path, `${path} must be a string`, eventIndex);
  return value;
}

function requireNonEmptyString(
  value: unknown,
  code: SessionEventLogErrorCode,
  stage: SessionEventLogErrorStage,
  path: string,
  eventIndex?: number
): string {
  const text = requireString(value, code, stage, path, eventIndex);
  if (text.trim().length === 0) fail(code, stage, path, `${path} must not be blank`, eventIndex);
  return text;
}

function requireNonNegativeNumber(
  value: unknown,
  path: string,
  eventIndex: number,
  code: SessionEventLogErrorCode = "invalid-event-shape"
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(code, "decode", path, `${path} must be finite and non-negative`, eventIndex);
  }
  return value;
}

function requireSequence(value: unknown, path: string, eventIndex: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(
      "invalid-event-shape",
      "decode",
      path,
      `${path} must be a non-negative safe integer`,
      eventIndex
    );
  }
  return value;
}

function requireId<Value>(
  value: unknown,
  factory: (text: string) => Value,
  path: string,
  eventIndex: number
): Value {
  const text = requireNonEmptyString(
    value,
    "invalid-event-payload",
    "decode",
    path,
    eventIndex
  );
  try {
    return factory(text);
  } catch (error) {
    fail("invalid-event-payload", "decode", path, `${path} is invalid`, eventIndex, error);
  }
}

function requireArray(value: unknown, path: string, eventIndex: number): readonly unknown[] {
  if (!Array.isArray(value)) {
    fail("invalid-event-payload", "decode", path, `${path} must be an array`, eventIndex);
  }
  return value;
}

function requireConceptIds(value: unknown, path: string, eventIndex: number): readonly ConceptId[] {
  return requireArray(value, path, eventIndex).map((item, index) =>
    requireId(item, toConceptId, `${path}[${index}]`, eventIndex)
  );
}

function requireThreadIds(value: unknown, path: string, eventIndex: number): readonly ThreadId[] {
  return requireArray(value, path, eventIndex).map((item, index) =>
    requireId(item, toThreadId, `${path}[${index}]`, eventIndex)
  );
}

function requirePair(value: unknown, path: string, eventIndex: number): ConceptPair {
  const pair = requireArray(value, path, eventIndex);
  if (pair.length !== 2) {
    fail("invalid-event-payload", "decode", path, `${path} must contain two IDs`, eventIndex);
  }
  const result = [
    requireId(pair[0], toConceptId, `${path}[0]`, eventIndex),
    requireId(pair[1], toConceptId, `${path}[1]`, eventIndex),
  ] as const;
  if (result[0] === result[1]) {
    fail("invalid-event-payload", "decode", path, `${path} endpoints must be distinct`, eventIndex);
  }
  return result;
}

function requireIntention(value: unknown, path: string, eventIndex: number): RelationIntention {
  if (typeof value !== "string" || !isRelationIntention(value)) {
    fail("invalid-event-payload", "decode", path, `${path} is unsupported`, eventIndex);
  }
  return value;
}

function isRelationIntention(value: string): value is RelationIntention {
  return (RELATION_INTENTIONS as readonly string[]).includes(value);
}

function isInputModality(value: string): value is InputModality {
  return (INPUT_MODALITIES as readonly string[]).includes(value);
}

function isEventType(value: string): value is SessionEventTypeV1 {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

function optionalGestureNumber(
  record: UnknownRecord,
  key: (typeof GESTURE_KEYS)[number],
  path: string,
  eventIndex: number
): number | undefined {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return undefined;
  const fieldPath = `${path}.${key}`;
  const number = requireNonNegativeNumber(
    record[key],
    fieldPath,
    eventIndex,
    "invalid-event-payload"
  );
  if (key === "pressure" && number > 1) {
    fail("invalid-event-payload", "decode", fieldPath, `${fieldPath} must not exceed 1`, eventIndex);
  }
  return number;
}

function requireGesture(value: unknown, path: string, eventIndex: number): GestureProfile {
  const record = requireRecord(value, "invalid-event-payload", "decode", path, eventIndex);
  const actualKeys = Object.keys(record);
  if (
    !Object.prototype.hasOwnProperty.call(record, "inputModality") ||
    actualKeys.some((key) => !GESTURE_KEYS.includes(key as (typeof GESTURE_KEYS)[number]))
  ) {
    fail("invalid-event-payload", "decode", path, `${path} has missing or extra fields`, eventIndex);
  }
  const modality = requireString(
    record.inputModality,
    "invalid-event-payload",
    "decode",
    `${path}.inputModality`,
    eventIndex
  );
  if (!isInputModality(modality)) {
    fail(
      "invalid-event-payload",
      "decode",
      `${path}.inputModality`,
      `${path}.inputModality is unsupported`,
      eventIndex
    );
  }

  const durationMs = optionalGestureNumber(record, "durationMs", path, eventIndex);
  const pathLengthViewport = optionalGestureNumber(
    record,
    "pathLengthViewport",
    path,
    eventIndex
  );
  const curvature = optionalGestureNumber(record, "curvature", path, eventIndex);
  const averageSpeedViewportPerSecond = optionalGestureNumber(
    record,
    "averageSpeedViewportPerSecond",
    path,
    eventIndex
  );
  const speedVariance = optionalGestureNumber(record, "speedVariance", path, eventIndex);
  const pressure = optionalGestureNumber(record, "pressure", path, eventIndex);

  return {
    inputModality: modality,
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(pathLengthViewport === undefined ? {} : { pathLengthViewport }),
    ...(curvature === undefined ? {} : { curvature }),
    ...(averageSpeedViewportPerSecond === undefined
      ? {}
      : { averageSpeedViewportPerSecond }),
    ...(speedVariance === undefined ? {} : { speedVariance }),
    ...(pressure === undefined ? {} : { pressure }),
  };
}

function payloadRecord(
  value: unknown,
  keys: readonly string[],
  path: string,
  eventIndex: number
): UnknownRecord {
  const record = requireRecord(value, "invalid-event-payload", "decode", path, eventIndex);
  requireExactKeys(record, keys, "invalid-event-payload", "decode", path, eventIndex);
  return record;
}

function decodeEvent(value: unknown, eventIndex: number): SessionEventV1 {
  const path = `events[${eventIndex}]`;
  const record = requireRecord(value, "invalid-event-shape", "decode", path, eventIndex);
  requireExactKeys(record, EVENT_KEYS, "invalid-event-shape", "decode", path, eventIndex);

  if (record.schemaVersion !== 1) {
    fail(
      "unsupported-event-version",
      "decode",
      `${path}.schemaVersion`,
      "event schema version is unsupported",
      eventIndex
    );
  }
  const rawType = requireString(
    record.type,
    "invalid-event-shape",
    "decode",
    `${path}.type`,
    eventIndex
  );
  if (!isEventType(rawType)) {
    fail(
      "unsupported-event-type",
      "decode",
      `${path}.type`,
      "event type is unsupported",
      eventIndex
    );
  }

  const sessionId = requireId(record.sessionId, toSessionId, `${path}.sessionId`, eventIndex);
  const sequence = requireSequence(record.sequence, `${path}.sequence`, eventIndex);
  const at = requireNonNegativeNumber(record.at, `${path}.at`, eventIndex);
  const rawId = requireNonEmptyString(
    record.id,
    "invalid-event-id",
    "decode",
    `${path}.id`,
    eventIndex
  );
  const payloadPath = `${path}.payload`;
  let event: SessionEventV1;

  const eventType = rawType;
  switch (eventType) {
    case "session.started": {
      const payload = payloadRecord(
        record.payload,
        ["seed", "contentPackVersion", "worldId", "conceptIds"],
        payloadPath,
        eventIndex
      );
      event = createSessionEvent({
        sessionId,
        sequence,
        at,
        type: "session.started",
        payload: {
          seed: requireNonEmptyString(
            payload.seed,
            "invalid-event-payload",
            "decode",
            `${payloadPath}.seed`,
            eventIndex
          ),
          contentPackVersion: requireId(
            payload.contentPackVersion,
            toContentPackVersion,
            `${payloadPath}.contentPackVersion`,
            eventIndex
          ),
          worldId: requireId(payload.worldId, toWorldId, `${payloadPath}.worldId`, eventIndex),
          conceptIds: requireConceptIds(payload.conceptIds, `${payloadPath}.conceptIds`, eventIndex),
        },
      });
      break;
    }
    case "bead.attended": {
      const payload = payloadRecord(record.payload, ["conceptId"], payloadPath, eventIndex);
      event = createSessionEvent({
        sessionId, sequence, at, type: "bead.attended",
        payload: { conceptId: requireId(payload.conceptId, toConceptId, `${payloadPath}.conceptId`, eventIndex) },
      });
      break;
    }
    case "pair.selected": {
      const payload = payloadRecord(record.payload, ["pair"], payloadPath, eventIndex);
      event = createSessionEvent({
        sessionId, sequence, at, type: "pair.selected",
        payload: { pair: requirePair(payload.pair, `${payloadPath}.pair`, eventIndex) },
      });
      break;
    }
    case "relation.hypothesized": {
      const payload = payloadRecord(record.payload, ["pair", "intention"], payloadPath, eventIndex);
      event = createSessionEvent({
        sessionId, sequence, at, type: "relation.hypothesized",
        payload: {
          pair: requirePair(payload.pair, `${payloadPath}.pair`, eventIndex),
          intention: requireIntention(payload.intention, `${payloadPath}.intention`, eventIndex),
        },
      });
      break;
    }
    case "thread.committed": {
      const payload = payloadRecord(
        record.payload,
        ["threadId", "pair", "intention", "gesture"],
        payloadPath,
        eventIndex
      );
      event = createSessionEvent({
        sessionId, sequence, at, type: "thread.committed",
        payload: {
          threadId: requireId(payload.threadId, toThreadId, `${payloadPath}.threadId`, eventIndex),
          pair: requirePair(payload.pair, `${payloadPath}.pair`, eventIndex),
          intention: requireIntention(payload.intention, `${payloadPath}.intention`, eventIndex),
          gesture: requireGesture(payload.gesture, `${payloadPath}.gesture`, eventIndex),
        },
      });
      break;
    }
    case "documented-relation.revealed": {
      const payload = payloadRecord(
        record.payload,
        ["threadId", "documentedRelationId"],
        payloadPath,
        eventIndex
      );
      event = createSessionEvent({
        sessionId, sequence, at, type: "documented-relation.revealed",
        payload: {
          threadId: requireId(payload.threadId, toThreadId, `${payloadPath}.threadId`, eventIndex),
          documentedRelationId: requireId(
            payload.documentedRelationId,
            toDocumentedRelationId,
            `${payloadPath}.documentedRelationId`,
            eventIndex
          ),
        },
      });
      break;
    }
    case "open-thread.created": {
      const payload = payloadRecord(
        record.payload,
        ["threadId", "openThreadId"],
        payloadPath,
        eventIndex
      );
      event = createSessionEvent({
        sessionId, sequence, at, type: "open-thread.created",
        payload: {
          threadId: requireId(payload.threadId, toThreadId, `${payloadPath}.threadId`, eventIndex),
          openThreadId: requireId(payload.openThreadId, toOpenThreadId, `${payloadPath}.openThreadId`, eventIndex),
        },
      });
      break;
    }
    case "motif.completed": {
      const payload = payloadRecord(
        record.payload,
        ["completionId", "motifKindId", "conceptIds", "threadIds"],
        payloadPath,
        eventIndex
      );
      event = createSessionEvent({
        sessionId, sequence, at, type: "motif.completed",
        payload: {
          completionId: requireId(payload.completionId, toMotifCompletionId, `${payloadPath}.completionId`, eventIndex),
          motifKindId: requireId(payload.motifKindId, toMotifKindId, `${payloadPath}.motifKindId`, eventIndex),
          conceptIds: requireConceptIds(payload.conceptIds, `${payloadPath}.conceptIds`, eventIndex),
          threadIds: requireThreadIds(payload.threadIds, `${payloadPath}.threadIds`, eventIndex),
        },
      });
      break;
    }
    case "attunement.entered":
    case "attunement.exited":
    case "session.concluded": {
      payloadRecord(record.payload, [], payloadPath, eventIndex);
      event = createSessionEvent({ sessionId, sequence, at, type: eventType, payload: {} });
      break;
    }
    default: {
      const exhaustive: never = eventType;
      return exhaustive;
    }
  }

  if (event.id !== rawId) {
    fail(
      "invalid-event-id",
      "decode",
      `${path}.id`,
      "event ID does not match session ID and sequence",
      eventIndex
    );
  }
  return event;
}

export function decodeSessionEventLogV1(input: unknown): SessionEventLogV1 {
  const record = requireRecord(
    input,
    "invalid-envelope-shape",
    "decode",
    "$"
  );
  requireExactKeys(
    record,
    ["format", "schemaVersion", "events"],
    "invalid-envelope-shape",
    "decode",
    "$"
  );
  if (record.format !== SESSION_EVENT_LOG_FORMAT) {
    fail("invalid-envelope-shape", "decode", "format", "log format is invalid");
  }
  if (record.schemaVersion !== SESSION_EVENT_LOG_SCHEMA_VERSION) {
    fail(
      "unsupported-log-version",
      "decode",
      "schemaVersion",
      "log schema version is unsupported"
    );
  }
  if (!Array.isArray(record.events)) {
    fail("invalid-envelope-shape", "decode", "events", "events must be an array");
  }
  if (record.events.length === 0) {
    fail("empty-log", "decode", "events", "event log is empty");
  }

  const log: SessionEventLogV1 = Object.freeze({
    format: SESSION_EVENT_LOG_FORMAT,
    schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
    events: Object.freeze(record.events.map((event, index) => decodeEvent(event, index))),
  });
  replaySessionEventLogV1(log);
  return log;
}

export function parseSessionEventLogV1(json: string): SessionEventLogV1 {
  if (typeof json !== "string") {
    fail("malformed-json", "parse", "$", "event log JSON must be a string");
  }
  let input: unknown;
  try {
    input = JSON.parse(json) as unknown;
  } catch (error) {
    fail("malformed-json", "parse", "$", "event log JSON is malformed", undefined, error);
  }
  return decodeSessionEventLogV1(input);
}
