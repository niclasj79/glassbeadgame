import { createSessionEvent, type SessionEventV1 } from "../../../domain/events";
import type { ConceptId } from "../../../domain/ids";
import type { SessionStateV1 } from "../../../domain/model";
import type { SessionEventLogV1 } from "../../../domain/replay";
import type { DomainSessionStore } from "../../../state/domainSession";
import { AttendConceptCommandError } from "./AttendConceptCommandError";

export type BeadAttendedEventV1 = Extract<
  SessionEventV1,
  { readonly type: "bead.attended" }
>;

export interface AttendConceptCommandDependencies {
  readonly domainStore: DomainSessionStore;
  readonly now: () => number;
}

export interface AttendConceptResult {
  readonly event: BeadAttendedEventV1;
  readonly eventLog: SessionEventLogV1;
  readonly session: SessionStateV1;
}

export type AttendConcept = (conceptId: ConceptId) => AttendConceptResult;

export function createAttendConceptCommand(
  dependencies: AttendConceptCommandDependencies
): AttendConcept {
  return (conceptId) => {
    const active = dependencies.domainStore.getState();
    if (active.eventLog === null || active.session === null) {
      throw new AttendConceptCommandError(
        "no-active-session",
        "cannot attend a concept without an active canonical session"
      );
    }

    const at = dependencies.now();
    const event = createSessionEvent({
      sessionId: active.session.sessionId,
      sequence: active.session.lastSequence + 1,
      at,
      type: "bead.attended",
      payload: { conceptId },
    });

    active.appendEvent(event);

    const published = dependencies.domainStore.getState();
    if (published.eventLog === null || published.session === null) {
      throw new Error("Attend command publication did not produce a matching state");
    }

    return Object.freeze({
      event,
      eventLog: published.eventLog,
      session: published.session,
    });
  };
}
