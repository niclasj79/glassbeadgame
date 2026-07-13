import { decodeSessionEventLogV1 } from "./decodeSessionEventLog";
import { SessionEventLogError } from "./SessionEventLogError";
import type { SessionEventLogV1 } from "./types";

export function serializeSessionEventLogV1(log: SessionEventLogV1): string {
  try {
    return JSON.stringify(decodeSessionEventLogV1(log));
  } catch (error) {
    if (error instanceof SessionEventLogError) {
      throw new SessionEventLogError(error.code, "serialize", error.message, {
        path: error.path ?? undefined,
        eventIndex: error.eventIndex ?? undefined,
        transitionCode: error.transitionCode ?? undefined,
        rejectedEventId: error.rejectedEventId ?? undefined,
        cause: error,
      });
    }
    throw error;
  }
}
