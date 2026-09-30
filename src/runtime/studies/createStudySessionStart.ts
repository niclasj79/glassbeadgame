import { CONTENT_PACK_VERSION } from "../../content/castalia";
import { createSessionEvent } from "../../domain/events";
import { toSessionId } from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";
import {
  decodeSessionEventLogV1,
  SESSION_EVENT_LOG_FORMAT,
  SESSION_EVENT_LOG_SCHEMA_VERSION,
  type SessionEventLogV1,
} from "../../domain/replay";
import type { StudyDefinition } from "../../domain/studies";
import type { DomainSessionStore } from "../../state/domainSession";
import { CASTALIA_WORLD_ID } from "../session/createCastaliaSessionStart";

/**
 * A STUDY SESSION START (STUDIES-SPEC §8).
 *
 * A Study session is an ordinary session: one `session.started` event, decoded
 * and replayed like any other, with no event type or payload of its own
 * (ADR-013). What differs from the Free Game is only what it is started with:
 *
 *  - no draw — the beads are the Study's eight, in the order it lists them;
 *  - the seed is `study:<studyId>`, so the Study is named by its own log and a
 *    restart, which is a new session, is started from the same seed;
 *  - the session id is `session:<packVersion>:<seed>`, the Free Game's own
 *    formula, derived from seed and pack and never from the clock.
 *
 * Nothing about a Study's status is written: it is a pure function of this log
 * and the Study (§8), recomputed after every commit and never stored.
 */
export interface StudySessionStartResult {
  readonly eventLog: SessionEventLogV1;
  readonly session: SessionStateV1;
}

export interface StudySessionStartDependencies {
  readonly domainStore: DomainSessionStore;
  readonly now: () => number;
}

/** The one spelling of a Study session's seed. */
export function studySeedOf(studyId: string): string {
  return `study:${studyId}`;
}

export function createStudySessionStart(
  dependencies: StudySessionStartDependencies
): (study: StudyDefinition) => StudySessionStartResult {
  return (study) => {
    const seed = studySeedOf(String(study.id));
    const event = createSessionEvent({
      sessionId: toSessionId(`session:${String(CONTENT_PACK_VERSION)}:${seed}`),
      sequence: 0,
      at: dependencies.now(),
      type: "session.started",
      payload: {
        seed,
        contentPackVersion: CONTENT_PACK_VERSION,
        worldId: CASTALIA_WORLD_ID,
        conceptIds: [...study.conceptIds],
      },
    });

    // Decoded exactly as a stored log would be, so a Study session can never
    // be something the replay path would refuse.
    const eventLog = decodeSessionEventLogV1({
      format: SESSION_EVENT_LOG_FORMAT,
      schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
      events: [event],
    });

    dependencies.domainStore.getState().loadEventLog(eventLog);
    const published = dependencies.domainStore.getState();
    if (published.eventLog === null || published.session === null) {
      throw new Error("Study session publication did not produce a matching state");
    }
    return { eventLog: published.eventLog, session: published.session };
  };
}
