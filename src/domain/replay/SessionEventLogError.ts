import type { EventId } from "../ids";
import type { SessionTransitionErrorCode } from "../reducer";

export const SESSION_EVENT_LOG_ERROR_CODES = [
  "malformed-json",
  "invalid-envelope-shape",
  "unsupported-log-version",
  "invalid-event-shape",
  "unsupported-event-version",
  "unsupported-event-type",
  "invalid-event-id",
  "invalid-event-payload",
  "empty-log",
  "replay-transition",
] as const;

export type SessionEventLogErrorCode =
  (typeof SESSION_EVENT_LOG_ERROR_CODES)[number];
export type SessionEventLogErrorStage = "parse" | "decode" | "serialize" | "replay";

interface SessionEventLogErrorDetails {
  readonly path?: string;
  readonly eventIndex?: number;
  readonly transitionCode?: SessionTransitionErrorCode;
  readonly rejectedEventId?: EventId;
  readonly cause?: unknown;
}

export class SessionEventLogError extends Error {
  readonly code: SessionEventLogErrorCode;
  readonly stage: SessionEventLogErrorStage;
  readonly path: string | null;
  readonly eventIndex: number | null;
  readonly transitionCode: SessionTransitionErrorCode | null;
  readonly rejectedEventId: EventId | null;
  readonly cause: unknown;

  constructor(
    code: SessionEventLogErrorCode,
    stage: SessionEventLogErrorStage,
    message: string,
    details: SessionEventLogErrorDetails = {}
  ) {
    super(message);
    this.name = "SessionEventLogError";
    this.code = code;
    this.stage = stage;
    this.path = details.path ?? null;
    this.eventIndex = details.eventIndex ?? null;
    this.transitionCode = details.transitionCode ?? null;
    this.rejectedEventId = details.rejectedEventId ?? null;
    this.cause = details.cause;
  }
}
