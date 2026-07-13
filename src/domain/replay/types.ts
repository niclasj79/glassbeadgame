import type { SessionEventV1 } from "../events";

export const SESSION_EVENT_LOG_FORMAT = "glass-bead-game.session-event-log" as const;
export const SESSION_EVENT_LOG_SCHEMA_VERSION = 1 as const;

export interface SessionEventLogV1 {
  readonly format: typeof SESSION_EVENT_LOG_FORMAT;
  readonly schemaVersion: typeof SESSION_EVENT_LOG_SCHEMA_VERSION;
  readonly events: readonly SessionEventV1[];
}
