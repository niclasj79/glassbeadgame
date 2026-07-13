import { eventIdFor } from "../ids";
import {
  INPUT_MODALITIES,
  type AnyCreateSessionEventInputV1,
  type ConceptPair,
  type GestureProfile,
  type SessionEventOfTypeV1,
  type SessionEventTypeV1,
} from "./types";

type EventForInput<Input extends AnyCreateSessionEventInputV1> =
  Input extends { readonly type: infer Type extends SessionEventTypeV1 }
    ? SessionEventOfTypeV1<Type>
    : never;

const NUMERIC_GESTURE_FIELDS = [
  "durationMs",
  "pathLengthViewport",
  "curvature",
  "averageSpeedViewportPerSecond",
  "speedVariance",
  "pressure",
] as const satisfies readonly (keyof GestureProfile)[];

function cloneAndFreeze<Value>(value: Value): Value {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneAndFreeze(item))) as Value;
  }

  if (value !== null && typeof value === "object") {
    const clone: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      clone[key] = cloneAndFreeze(item);
    }
    return Object.freeze(clone) as Value;
  }

  return value;
}

function assertDistinctPair(pair: ConceptPair): void {
  if (pair[0] === pair[1]) {
    throw new RangeError("a concept pair must contain two distinct concept IDs");
  }
}

function assertGesture(gesture: GestureProfile): void {
  if (!(INPUT_MODALITIES as readonly string[]).includes(gesture.inputModality)) {
    throw new TypeError("gesture input modality is not supported");
  }

  for (const field of NUMERIC_GESTURE_FIELDS) {
    const value = gesture[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new RangeError(`gesture ${field} must be finite and non-negative`);
    }
  }

  if (gesture.pressure !== undefined && gesture.pressure > 1) {
    throw new RangeError("gesture pressure must be between 0 and 1");
  }
}

function validatePayload(input: AnyCreateSessionEventInputV1): void {
  switch (input.type) {
    case "session.started":
      if (input.payload.seed.trim().length === 0) {
        throw new TypeError("session seed must be a non-empty string");
      }
      return;
    case "pair.selected":
    case "relation.hypothesized":
      assertDistinctPair(input.payload.pair);
      return;
    case "thread.committed":
      assertDistinctPair(input.payload.pair);
      assertGesture(input.payload.gesture);
      return;
    case "bead.attended":
    case "documented-relation.revealed":
    case "open-thread.created":
    case "motif.completed":
    case "attunement.entered":
    case "attunement.exited":
    case "session.concluded":
      return;
    default: {
      const exhaustive: never = input;
      return exhaustive;
    }
  }
}

export function createSessionEvent<Input extends AnyCreateSessionEventInputV1>(
  input: Input
): EventForInput<Input> {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) {
    throw new RangeError("event sequence must be a non-negative safe integer");
  }
  if (!Number.isFinite(input.at) || input.at < 0) {
    throw new RangeError("event time must be finite and non-negative");
  }

  validatePayload(input as AnyCreateSessionEventInputV1);

  return Object.freeze({
    schemaVersion: 1,
    id: eventIdFor(input.sessionId, input.sequence),
    sessionId: input.sessionId,
    sequence: input.sequence,
    at: input.at,
    type: input.type,
    payload: cloneAndFreeze(input.payload),
  }) as EventForInput<Input>;
}
