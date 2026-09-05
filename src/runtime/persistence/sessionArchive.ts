import { createStore, type StoreApi } from "zustand/vanilla";
import type { SessionStateV1 } from "../../domain/model";
import { serializeSessionEventLogV1, type SessionEventLogV1 } from "../../domain/replay";
import type { ProgressRepository } from "../../platform/indexeddb/createIndexedDbRepository";
import type { PersistedSessionRecord } from "../../platform/indexeddb/schema";
import type { DomainSessionStore } from "../../state/domainSession";

/**
 * THE SHELF — keeping what a Game made.
 *
 * `src/platform/indexeddb/` has held a complete, tested repository whose
 * comment calls the event log "canonical" since M7, and until this module
 * existed it had zero consumers: fifteen minutes of composition, a portrait,
 * an annotation and a register with real citations were destroyed when the
 * tab closed. The portrait plate said "nothing carries over but what you
 * learned to notice", which was a fine sentiment and a literal description of
 * data loss (DESIGN-REVIEW-SCHELL §2).
 *
 * What is kept is the log and nothing derived from it that could not be
 * rebuilt: the portrait, the annotation and the conclusion are all pure
 * functions of the log (ADR-003), so a kept Game re-opens as exactly the
 * reading it was. The annotation's text is stored alongside only so a shelf
 * can name a Game without replaying it — and it is *described* by a dependency
 * rather than computed here, because the annotation builder belongs to the
 * conclusion's deferred chunk and this module is loaded with the title.
 *
 * TWO RULES.
 *
 *  - **A Game is kept when it concludes, live.** The archive watches the
 *    canonical store for the one transition that means "this session just
 *    ended": the same session, `concluded` false then true. A log loaded whole
 *    from the shelf arrives already concluded and is never written back, so
 *    re-reading a Game cannot move it to the top of the shelf or overwrite
 *    the moment it actually ended.
 *  - **The shelf is not a collection.** It lists what a Game said, in the
 *    order Games ended. Nothing here counts concepts seen, relations met, or
 *    Games played; a count is a completion meter wearing a bookshelf
 *    (ADR-010). `listKept` returns records; what a surface does with them is
 *    bound by that.
 *
 * Storage failure never costs the player anything but durability, and it is
 * reported rather than hidden: `status` says whether this Game was kept, so
 * the plate can say "kept for this visit only" in a private window instead of
 * losing it quietly.
 */

/**
 * Whether this Game was kept, truthfully:
 *
 *   kept           written to durable storage; it will be on the shelf next visit
 *   kept-for-now   the browser is not keeping anything between visits (a private
 *                  window, storage denied), so the Game is held in memory for
 *                  this visit only — the shelf works until the page closes
 *   unavailable    the write itself failed; nothing holds the Game
 */
export type KeepStatus = "unkept" | "keeping" | "kept" | "kept-for-now" | "unavailable";

export interface ArchiveState {
  /** The session the status speaks about, or null before any Game concluded. */
  readonly sessionId: string | null;
  readonly status: KeepStatus;
  /** When the Game was kept, on the game clock. Null unless kept. */
  readonly keptAt: number | null;
}

export interface SessionArchive {
  readonly status: StoreApi<ArchiveState>;
  /** Kept Games, most recently concluded first. */
  readonly listKept: (limit?: number) => Promise<readonly PersistedSessionRecord[]>;
  readonly detach: () => void;
}

export interface SessionArchiveDependencies {
  readonly domainStore: DomainSessionStore;
  readonly repository: ProgressRepository;
  /** The annotation's text for a concluded session — how the shelf names it. */
  readonly describe: (session: SessionStateV1) => Promise<string> | string;
  readonly now: () => number;
}

export interface ArchiveRecordInput {
  readonly session: SessionStateV1;
  readonly eventLog: SessionEventLogV1;
  readonly annotation: string;
  readonly endedAt: number;
}

/**
 * The record a concluded session becomes. Pure: the same session, log and
 * annotation always produce the same record, endedAt aside.
 */
export function archiveRecordFor(input: ArchiveRecordInput): PersistedSessionRecord {
  const { session, eventLog, annotation, endedAt } = input;
  if (!session.concluded) {
    throw new RangeError("only a concluded Game is kept");
  }
  const motifKinds = [
    ...new Set(session.completedMotifs.map((motif) => String(motif.motifKindId))),
  ];
  return Object.freeze({
    id: String(session.sessionId),
    seed: session.seed,
    contentPackVersion: String(session.contentPackVersion),
    worldId: String(session.worldId),
    eventLog: serializeSessionEventLogV1(eventLog),
    endedAt,
    concluded: true,
    annotation,
    threadCount: session.threads.length,
    motifKinds: Object.freeze(motifKinds),
  });
}

const INITIAL: ArchiveState = Object.freeze({
  sessionId: null,
  status: "unkept",
  keptAt: null,
});

export function createSessionArchive(
  dependencies: SessionArchiveDependencies
): SessionArchive {
  const { domainStore, repository, describe, now } = dependencies;
  const status = createStore<ArchiveState>()(() => INITIAL);

  const keep = (session: SessionStateV1, eventLog: SessionEventLogV1): void => {
    const sessionId = String(session.sessionId);
    const endedAt = now();
    status.setState({ sessionId, status: "keeping", keptAt: null });
    void Promise.resolve()
      .then(() => describe(session))
      .then((annotation) =>
        repository.saveSession(
          archiveRecordFor({ session, eventLog, annotation, endedAt })
        )
      )
      .then(() => {
        // The repository degrades to memory rather than failing, and says so:
        // a write that landed in memory only is kept for this visit, not kept.
        status.setState({
          sessionId,
          status: repository.available() ? "kept" : "kept-for-now",
          keptAt: endedAt,
        });
      })
      .catch(() => {
        status.setState({ sessionId, status: "unavailable", keptAt: null });
      });
  };

  const detach = domainStore.subscribe((state, previous) => {
    const session = state.session;
    const before = previous.session;
    if (!session || !state.eventLog) return;
    // Only the live ending of the same session. A log loaded whole from the
    // shelf is already concluded when it arrives and must not be written back.
    if (!before || String(before.sessionId) !== String(session.sessionId)) return;
    if (before.concluded || !session.concluded) return;
    keep(session, state.eventLog);
  });

  return Object.freeze({
    status,
    listKept: (limit?: number) => repository.listSessions(limit),
    detach,
  });
}
