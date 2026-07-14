import { createStore, type StoreApi } from "zustand/vanilla";
import type { SessionEventV1 } from "../../domain/events";
import type { SessionStateV1 } from "../../domain/model";
import {
  decodeSessionEventLogV1,
  replaySessionEventLogV1,
  SESSION_EVENT_LOG_FORMAT,
  SESSION_EVENT_LOG_SCHEMA_VERSION,
  type SessionEventLogV1,
} from "../../domain/replay";

export interface DomainSessionAdapterState {
  readonly eventLog: SessionEventLogV1 | null;
  readonly session: SessionStateV1 | null;
  readonly loadEventLog: (input: unknown) => void;
  readonly appendEvent: (event: SessionEventV1) => void;
  readonly appendEvents: (events: readonly SessionEventV1[]) => void;
  readonly clearSession: () => void;
}

export type DomainSessionStore = StoreApi<DomainSessionAdapterState>;

export function createDomainSessionStore(): DomainSessionStore {
  return createStore<DomainSessionAdapterState>()((set, get) => {
    const appendEvents = (events: readonly SessionEventV1[]): void => {
      if (!Array.isArray(events)) {
        throw new TypeError("event batch must be an array");
      }
      if (events.length === 0) {
        throw new RangeError("event batch must not be empty");
      }

      const currentEvents = get().eventLog?.events ?? [];
      const candidate = {
        format: SESSION_EVENT_LOG_FORMAT,
        schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
        events: [...currentEvents, ...events],
      };
      const eventLog = decodeSessionEventLogV1(candidate);
      const session = replaySessionEventLogV1(eventLog);

      set({ eventLog, session });
    };

    return {
      eventLog: null,
      session: null,

      loadEventLog: (input) => {
        const eventLog = decodeSessionEventLogV1(input);
        const session = replaySessionEventLogV1(eventLog);

        set({ eventLog, session });
      },

      appendEvent: (event) => {
        appendEvents([event]);
      },

      appendEvents,

      clearSession: () => {
        const { eventLog, session } = get();
        if (eventLog === null && session === null) return;

        set({ eventLog: null, session: null });
      },
    };
  });
}
