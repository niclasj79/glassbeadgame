/**
 * DURABLE STORAGE SCHEMA
 *
 * IndexedDB is the target store (ARCHITECTURE §11, VERTICAL-SLICE-SPEC §20).
 * `localStorage` keeps only small preferences, and only until the legacy store
 * is removed.
 *
 * The event log is canonical. Everything else in here is a derived convenience
 * that exists so the Codex can be listed without replaying every session — and
 * every derived record can be thrown away and rebuilt from its log. That is the
 * property that makes migrations survivable: if a derived shape changes, the
 * migration deletes and rebuilds rather than transforming, and no player data
 * is ever at risk from a transformation bug.
 *
 * Schema version is separate from the event schema version (ADR-013). The two
 * evolve independently and deliberately: this one describes how records are
 * laid out on disk, that one describes what a session *is*.
 */

export const DATABASE_NAME = "glass-bead-game";

/**
 * Bump only in a reviewed change that also adds a migration step. Version 1 is
 * the first durable store; there is nothing before it to migrate from except
 * the legacy `gbg.v1` localStorage blob, which is imported opportunistically
 * and never required.
 */
export const DATABASE_VERSION = 1;

export const STORE_SESSIONS = "sessions";
export const STORE_DISCOVERIES = "discoveries";
export const STORE_OPEN_THREADS = "openThreads";
export const STORE_PREFERENCES = "preferences";

export const STORES = Object.freeze([
  STORE_SESSIONS,
  STORE_DISCOVERIES,
  STORE_OPEN_THREADS,
  STORE_PREFERENCES,
] as const);

export type StoreName = (typeof STORES)[number];

/**
 * A played session. `eventLog` is the serialized canonical log and is the only
 * field that cannot be recomputed; `portrait` and `annotation` are cached so a
 * list of past Games can be rendered without replaying each one.
 */
export interface PersistedSessionRecord {
  readonly id: string;
  readonly seed: string;
  readonly contentPackVersion: string;
  readonly worldId: string;
  /** Serialized `SessionEventLogV1`. Canonical. */
  readonly eventLog: string;
  /** Wall-clock, for ordering the archive only. Never used by replay. */
  readonly endedAt: number;
  readonly concluded: boolean;
  /** Cached derived summary. Safe to discard and rebuild. */
  readonly portrait?: unknown;
  readonly annotation?: string;
  readonly threadCount: number;
  readonly motifKinds: readonly string[];
}

/** A documented relation the player has met, with where they first met it. */
export interface PersistedDiscoveryRecord {
  readonly relationId: string;
  readonly firstSessionId: string;
  readonly firstSeenAt: number;
  readonly timesMet: number;
  /** The evidence class at the time, so a later pack revision is detectable. */
  readonly evidence: string;
  readonly contentPackVersion: string;
}

/**
 * Open Threads persist beyond their session (VERTICAL-SLICE-SPEC §10) — they
 * are questions the player left standing, and the full version may let them be
 * resolved later.
 */
export interface PersistedOpenThreadRecord {
  readonly openThreadId: string;
  readonly sessionId: string;
  readonly pair: readonly [string, string];
  readonly intention: string;
  readonly facet: string;
  readonly question: string;
  readonly createdAt: number;
  readonly contentPackVersion: string;
}

export interface PersistedPreference {
  readonly key: string;
  readonly value: unknown;
}

export const STORE_KEYS: Readonly<Record<StoreName, string>> = Object.freeze({
  [STORE_SESSIONS]: "id",
  [STORE_DISCOVERIES]: "relationId",
  [STORE_OPEN_THREADS]: "openThreadId",
  [STORE_PREFERENCES]: "key",
});

/** Indexes needed to list without a full scan. */
export const STORE_INDEXES: Readonly<
  Record<StoreName, readonly { readonly name: string; readonly keyPath: string }[]>
> = Object.freeze({
  [STORE_SESSIONS]: Object.freeze([
    { name: "endedAt", keyPath: "endedAt" },
    { name: "seed", keyPath: "seed" },
  ]),
  [STORE_DISCOVERIES]: Object.freeze([
    { name: "firstSeenAt", keyPath: "firstSeenAt" },
  ]),
  [STORE_OPEN_THREADS]: Object.freeze([
    { name: "createdAt", keyPath: "createdAt" },
    { name: "sessionId", keyPath: "sessionId" },
  ]),
  [STORE_PREFERENCES]: Object.freeze([]),
});
