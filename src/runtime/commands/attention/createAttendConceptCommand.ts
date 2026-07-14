import { createSessionEvent, type SessionEventV1 } from "../../../domain/events";
import type { ConceptId } from "../../../domain/ids";
import type { SessionStateV1 } from "../../../domain/model";
import {
  decodeSessionEventLogV1,
  type SessionEventLogV1,
} from "../../../domain/replay";
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

export interface PreparedAttendConcept {
  readonly activeEventLog: SessionEventLogV1;
  readonly activeSession: SessionStateV1;
  readonly event: BeadAttendedEventV1;
}

export interface AttendConceptPreparation {
  readonly prepare: (conceptId: ConceptId) => PreparedAttendConcept;
  readonly publish: (prepared: PreparedAttendConcept) => AttendConceptResult;
}

export function createAttendConceptPreparation(
  dependencies: AttendConceptCommandDependencies
): AttendConceptPreparation {
  const prepare = (conceptId: ConceptId): PreparedAttendConcept => {
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

    decodeSessionEventLogV1({
      format: active.eventLog.format,
      schemaVersion: active.eventLog.schemaVersion,
      events: [...active.eventLog.events, event],
    });

    return Object.freeze({
      activeEventLog: active.eventLog,
      activeSession: active.session,
      event,
    });
  };

  const publish = (prepared: PreparedAttendConcept): AttendConceptResult => {
    dependencies.domainStore.getState().appendEvent(prepared.event);

    const published = dependencies.domainStore.getState();
    if (published.eventLog === null || published.session === null) {
      throw new Error("Attend command publication did not produce a matching state");
    }

    return Object.freeze({
      event: prepared.event,
      eventLog: published.eventLog,
      session: published.session,
    });
  };

  return Object.freeze({ prepare, publish });
}

export function createAttendConceptCommand(
  dependencies: AttendConceptCommandDependencies
): AttendConcept {
  const preparation = createAttendConceptPreparation(dependencies);

  return (conceptId) => {
    return preparation.publish(preparation.prepare(conceptId));
  };
}
