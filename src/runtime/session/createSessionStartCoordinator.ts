import type { DisciplineId } from "../../content/types";
import { createSessionEvent } from "../../domain/events";
import {
  toConceptId,
  toContentPackVersion,
  toSessionId,
  toWorldId,
} from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";
import {
  decodeSessionEventLogV1,
  SESSION_EVENT_LOG_FORMAT,
  SESSION_EVENT_LOG_SCHEMA_VERSION,
  type SessionEventLogV1,
} from "../../domain/replay";
import type { SessionDraw } from "../../game/session";
import type { DomainSessionStore } from "../../state/domainSession";
import type { SessionStartProjection } from "../../state/types";
import type { WorldTheme } from "../../themes";

const DISCIPLINES = new Set<DisciplineId>([
  "mathematics",
  "music",
  "philosophy",
  "physics",
  "art",
  "history",
]);

export const LEGACY_CONTENT_PACK_VERSION = toContentPackVersion("legacy-content.v1");

export interface StartSessionOptions {
  readonly seed?: number;
  readonly daily?: boolean;
}

export interface SessionStartResult {
  readonly eventLog: SessionEventLogV1;
  readonly session: SessionStateV1;
}

export interface SessionStartCoordinatorDependencies {
  readonly domainStore: DomainSessionStore;
  readonly draw: (picks: DisciplineId[], seed?: number) => SessionDraw;
  readonly now: () => number;
  readonly selectTheme: (seed: number, daily?: boolean) => WorldTheme;
  readonly applyProjection: (projection: SessionStartProjection) => void;
}

export type StartSession = (
  picks: readonly DisciplineId[],
  options?: StartSessionOptions
) => SessionStartResult;

function validatePicks(picks: readonly DisciplineId[]): void {
  const unique = new Set(picks);
  if ((picks.length !== 2 && picks.length !== 3) || unique.size !== picks.length) {
    throw new RangeError("session start requires two or three distinct disciplines");
  }
  if (!picks.every((pick) => DISCIPLINES.has(pick))) {
    throw new TypeError("session start contains an unknown discipline");
  }
}

export function createSessionStartCoordinator(
  dependencies: SessionStartCoordinatorDependencies
): StartSession {
  return (picks, options) => {
    validatePicks(picks);

    const requestedPicks = [...picks];
    const draw = dependencies.draw(requestedPicks, options?.seed);
    const startedAt = dependencies.now();
    const theme = dependencies.selectTheme(draw.seed, options?.daily);
    const sessionId = toSessionId(`session:${startedAt}:${draw.seed}`);
    const event = createSessionEvent({
      sessionId,
      sequence: 0,
      at: startedAt,
      type: "session.started",
      payload: {
        seed: String(draw.seed),
        contentPackVersion: LEGACY_CONTENT_PACK_VERSION,
        worldId: toWorldId(theme.id),
        conceptIds: draw.beadIds.map(toConceptId),
      },
    });
    const eventLog = decodeSessionEventLogV1({
      format: SESSION_EVENT_LOG_FORMAT,
      schemaVersion: SESSION_EVENT_LOG_SCHEMA_VERSION,
      events: [event],
    });
    const projection: SessionStartProjection = Object.freeze({
      seed: draw.seed,
      disciplines: Object.freeze([...draw.disciplines]),
      beadIds: Object.freeze([...draw.beadIds]),
      threads: Object.freeze([]),
      discoveries: Object.freeze([]),
      motifs: Object.freeze([]),
      score: 0,
      startedAt,
      interaction: Object.freeze({ mode: "idle", fromId: null, sticky: false, reveal: null }),
      curatedAvailable: draw.curatedAvailable,
      insight: 1,
      illuminationsUsed: 0,
      daily: options?.daily,
      themeId: theme.id,
    });

    dependencies.domainStore.getState().loadEventLog(eventLog);
    dependencies.applyProjection(projection);

    const published = dependencies.domainStore.getState();
    if (published.eventLog === null || published.session === null) {
      throw new Error("domain session publication did not produce a matching state");
    }
    return { eventLog: published.eventLog, session: published.session };
  };
}
