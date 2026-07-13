import type { EventId } from "../ids";

export const SESSION_TRANSITION_ERROR_CODES = [
  "invalid-lifecycle",
  "session-identity-mismatch",
  "sequence-mismatch",
  "relative-time-regression",
  "invalid-session-concepts",
  "unknown-concept",
  "unknown-thread",
  "duplicate-identity",
  "duplicate-outcome",
  "pair-mismatch",
  "hypothesis-mismatch",
  "attunement-state",
] as const;

export type SessionTransitionErrorCode =
  (typeof SESSION_TRANSITION_ERROR_CODES)[number];

export class SessionTransitionError extends Error {
  readonly code: SessionTransitionErrorCode;
  readonly eventId: EventId;

  constructor(code: SessionTransitionErrorCode, eventId: EventId, message: string) {
    super(message);
    this.name = "SessionTransitionError";
    this.code = code;
    this.eventId = eventId;
  }
}
