/**
 * CASTALIA SESSION START
 *
 * Replaces the legacy six-discipline draw. Two things change beyond the
 * content pack, and both matter for replay.
 *
 * The session id was `session:${startedAt}:${seed}` — derived from the wall
 * clock, so the same seed produced a different session identity on every run
 * and no session was reproducible from its seed alone. It is now derived from
 * the seed and the pack version, which is what makes `?seed=castalia-golden-001`
 * a genuine fixture rather than an approximation of one.
 *
 * And the draw is pinned. The golden path's four beads are required present, so
 * the canonical integration scenario is reachable from its seed by construction
 * rather than by luck. The rest of the draw is still seeded and free, so two
 * players on the same seed see the same arena and a different seed is a
 * genuinely different Game.
 */
import { createSessionEvent } from "../../domain/events";
import {
  toConceptId,
  toSessionId,
  toWorldId,
  type ConceptId,
} from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";
import {
  decodeSessionEventLogV1,
  SESSION_EVENT_LOG_FORMAT,
  SESSION_EVENT_LOG_SCHEMA_VERSION,
  type SessionEventLogV1,
} from "../../domain/replay";
import { drawCastaliaSession } from "../../domain/session";
import { CONTENT_PACK_VERSION } from "../../content/castalia";
import type { DomainSessionStore } from "../../state/domainSession";
import { castaliaDrawLookup } from "../content/castaliaLookup";

/** The world of the vertical slice. One world, stated once. */
export const CASTALIA_WORLD_ID = toWorldId("castalia");

/**
 * The golden path's opening and second pairs (spec §23). Pinned so the
 * canonical scenario is reachable from its seed by construction.
 */
export const GOLDEN_PATH_CONCEPTS: readonly ConceptId[] = Object.freeze([
  toConceptId("measure.fibonacci-sequence"),
  toConceptId("sound.counterpoint"),
  toConceptId("measure.prime-numbers"),
  toConceptId("sound.polyrhythm"),
]);

export interface CastaliaSessionStartOptions {
  /** Stable seed text. The same seed always produces the same arena. */
  readonly seed: string;
  /** Beads present. Defaults to twelve, per the slice specification. */
  readonly size?: number;
  /** Pin the golden path's beads. On by default for the slice's one world. */
  readonly pinGoldenPath?: boolean;
}

export interface CastaliaSessionStartResult {
  readonly eventLog: SessionEventLogV1;
  readonly session: SessionStateV1;
}

export interface CastaliaSessionStartDependencies {
  readonly domainStore: DomainSessionStore;
  readonly now: () => number;
}

export function createCastaliaSessionStart(
  dependencies: CastaliaSessionStartDependencies
): (options: CastaliaSessionStartOptions) => CastaliaSessionStartResult {
  return (options) => {
    const seed = options.seed.trim();
    if (seed.length === 0) {
      throw new RangeError("a session seed must not be empty");
    }

    const draw = drawCastaliaSession({
      seed,
      lookup: castaliaDrawLookup,
      ...(options.size === undefined ? {} : { size: options.size }),
      ...(options.pinGoldenPath === false
        ? {}
        : { require: GOLDEN_PATH_CONCEPTS }),
    });

    // Derived from seed and pack, never from the clock: the same seed on the
    // same pack is the same session, which is what replay depends on.
    const sessionId = toSessionId(
      `session:${String(CONTENT_PACK_VERSION)}:${seed}`
    );

    const event = createSessionEvent({
      sessionId,
      sequence: 0,
      at: dependencies.now(),
      type: "session.started",
      payload: {
        seed,
        contentPackVersion: CONTENT_PACK_VERSION,
        worldId: CASTALIA_WORLD_ID,
        conceptIds: draw.conceptIds,
      },
    });

    const eventLog = decodeSessionEventLogV1({
      format: SESSION_EVENT_LOG_FORMAT,
      schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
      events: [event],
    });

    dependencies.domainStore.getState().loadEventLog(eventLog);
    const published = dependencies.domainStore.getState();
    if (published.eventLog === null || published.session === null) {
      throw new Error("session publication did not produce a matching state");
    }
    return { eventLog: published.eventLog, session: published.session };
  };
}
