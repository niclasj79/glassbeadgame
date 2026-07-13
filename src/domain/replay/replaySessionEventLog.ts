import type { SessionStateV1 } from "../model";
import {
  reduceSession,
  SessionTransitionError,
} from "../reducer";
import { SessionEventLogError } from "./SessionEventLogError";
import type { SessionEventLogV1 } from "./types";

export function replaySessionEventLogV1(log: SessionEventLogV1): SessionStateV1 {
  if (log.events.length === 0) {
    throw new SessionEventLogError("empty-log", "replay", "event log is empty", {
      path: "events",
    });
  }

  let state: SessionStateV1 | null = null;
  for (let index = 0; index < log.events.length; index += 1) {
    const event = log.events[index];
    try {
      state = reduceSession(state, event);
    } catch (error) {
      if (error instanceof SessionTransitionError) {
        throw new SessionEventLogError(
          "replay-transition",
          "replay",
          `event ${index} failed session transition validation`,
          {
            path: `events[${index}]`,
            eventIndex: index,
            transitionCode: error.code,
            rejectedEventId: error.eventId,
            cause: error,
          }
        );
      }
      throw error;
    }
  }

  if (!state) {
    throw new SessionEventLogError("empty-log", "replay", "event log is empty", {
      path: "events",
    });
  }
  return state;
}
