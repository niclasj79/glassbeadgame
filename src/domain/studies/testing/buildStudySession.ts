import { createSessionEvent } from "../../events/createSessionEvent";
import type { RelationIntention, SessionEventV1 } from "../../events";
import {
  toContentPackVersion,
  toDocumentedRelationId,
  toOpenThreadId,
  toSessionId,
  toThreadId,
  toWorldId,
  type ConceptId,
  type ThreadId,
} from "../../ids";
import type { SessionStateV1 } from "../../model/sessionState";
import { reduceSession } from "../../reducer/reduceSession";
import {
  SESSION_EVENT_LOG_FORMAT,
  SESSION_EVENT_LOG_SCHEMA_VERSION,
  type SessionEventLogV1,
} from "../../replay/types";

/**
 * A STUDY SESSION, BUILT FROM REAL EVENTS.
 *
 * A Study session is an ordinary session (STUDIES-SPEC §8): `session.started`
 * with seed `study:<studyId>`, the Study's beads in authored order, and session
 * id `session:<packVersion>:study:<studyId>`, followed by the Free Game's own
 * events. No event type or payload is added. Each thread may be followed by the
 * outcome event the Free Game would have logged for it, so a test can weave the
 * same threads with every outcome documented, every one an Open Thread, or none
 * — and show the Study's status does not move (R2).
 */

export interface StudyThreadSpec {
  readonly a: ConceptId;
  readonly b: ConceptId;
  readonly intention?: RelationIntention;
  /** The outcome event logged after the commit, if any. */
  readonly outcome?: "documented" | "open-thread";
  /** Overrides the generated `thread:<n>` identity. */
  readonly threadId?: string;
}

export interface StudySessionSpec {
  readonly studyId: string;
  readonly conceptIds: readonly ConceptId[];
  readonly contentPackVersion?: string;
  readonly threads?: readonly StudyThreadSpec[];
}

export interface StudySession {
  /** The log as a player's browser would hold it, not yet decoded. */
  readonly log: SessionEventLogV1;
  /** The live state, reduced event by event. */
  readonly state: SessionStateV1;
  readonly threadIds: readonly ThreadId[];
}

const STEP_MS = 1000;

export function buildStudySession(spec: StudySessionSpec): StudySession {
  const packVersion = spec.contentPackVersion ?? "fixture-1";
  const sessionId = toSessionId(`session:${packVersion}:study:${spec.studyId}`);
  const events: SessionEventV1[] = [];
  const threadIds: ThreadId[] = [];
  const push = (build: (sequence: number, at: number) => SessionEventV1): void => {
    const sequence = events.length;
    events.push(build(sequence, sequence * STEP_MS));
  };

  push((sequence, at) =>
    createSessionEvent({
      sessionId,
      sequence,
      at,
      type: "session.started",
      payload: {
        seed: `study:${spec.studyId}`,
        contentPackVersion: toContentPackVersion(packVersion),
        worldId: toWorldId("castalia"),
        conceptIds: spec.conceptIds,
      },
    })
  );

  (spec.threads ?? []).forEach((thread, index) => {
    const threadId = toThreadId(thread.threadId ?? `thread:${index}`);
    const pair = [thread.a, thread.b] as const;
    const intention = thread.intention ?? "echo";
    threadIds.push(threadId);

    push((sequence, at) =>
      createSessionEvent({
        sessionId,
        sequence,
        at,
        type: "bead.attended",
        payload: { conceptId: thread.a },
      })
    );
    push((sequence, at) =>
      createSessionEvent({ sessionId, sequence, at, type: "pair.selected", payload: { pair } })
    );
    push((sequence, at) =>
      createSessionEvent({
        sessionId,
        sequence,
        at,
        type: "relation.hypothesized",
        payload: { pair, intention },
      })
    );
    push((sequence, at) =>
      createSessionEvent({
        sessionId,
        sequence,
        at,
        type: "thread.committed",
        payload: { threadId, pair, intention, gesture: { inputModality: "keyboard" } },
      })
    );
    if (thread.outcome === "documented") {
      push((sequence, at) =>
        createSessionEvent({
          sessionId,
          sequence,
          at,
          type: "documented-relation.revealed",
          payload: {
            threadId,
            documentedRelationId: toDocumentedRelationId(`rel.fixture.${index}`),
          },
        })
      );
    } else if (thread.outcome === "open-thread") {
      push((sequence, at) =>
        createSessionEvent({
          sessionId,
          sequence,
          at,
          type: "open-thread.created",
          payload: { threadId, openThreadId: toOpenThreadId(`open-thread.fixture.${index}`) },
        })
      );
    }
  });

  let state: SessionStateV1 | null = null;
  for (const event of events) state = reduceSession(state, event);
  if (state === null) throw new Error("a Study session must produce state");

  return Object.freeze({
    log: Object.freeze({
      format: SESSION_EVENT_LOG_FORMAT,
      schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
      events: Object.freeze(events),
    }),
    state,
    threadIds: Object.freeze(threadIds),
  });
}
