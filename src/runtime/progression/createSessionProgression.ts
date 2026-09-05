/**
 * SESSION PROGRESSION — where a committed thread becomes a consequence.
 *
 * Before this existed, the arena could weave threads and nothing else ever
 * happened: `documented-relation.revealed`, `open-thread.created`,
 * `motif.completed`, `attunement.*`, and `session.concluded` had no producer
 * anywhere in the application, so `outcomes` and `completedMotifs` were
 * permanently empty in production and the session had no exit at all.
 *
 * Everything here is orchestration. It owns no rules: outcome resolution,
 * motif detection, and conclusion compilation are pure domain functions passed
 * in. Its whole job is to run them in the right order, append what they imply
 * to the durable log, and hand one coordinated cue plan to the directors.
 *
 * ── Why an unresolved thread appends nothing ────────────────────────────────
 * The event schema models exactly two outcome events, and ADR-013 freezes it.
 * That is not a gap. `resolveThreadOutcome` is a pure function of the pair, the
 * declared intention, and the pinned content pack, so replaying the log
 * re-derives "unresolved" every time. Absence *is* the record, and it is a
 * faithful one. Adding a third event would buy nothing and cost the freeze.
 */
import { createSessionEvent } from "../../domain/events";
import type { SessionEventV1 } from "../../domain/events";
import {
  toConceptId,
  toDocumentedRelationId,
  toMotifCompletionId,
  toMotifKindId,
  toOpenThreadId,
  toThreadId,
  type ThreadId,
} from "../../domain/ids";
import type { CommittedThreadV1, SessionStateV1 } from "../../domain/model";
import type {
  RelationLookup,
  ThreadOutcomeResolution,
} from "../../domain/outcomes";
import type { DomainSessionStore } from "../../state/domainSession";
import type { CueBus } from "../cues";
import {
  planAttunement,
  planCommitMoment,
  planConclusion,
  planMotifCompleted,
} from "../cues";
import type { DocumentedRelation } from "../../content/castalia/schema";

/**
 * A motif the domain has detected in the current web. Injected rather than
 * imported so detection can be authored and revised independently.
 */
export interface DetectedMotif {
  /** Stable within a session for the same structure — used to dedupe. */
  readonly completionId: string;
  readonly motifKindId: string;
  readonly conceptIds: readonly string[];
  readonly threadIds: readonly string[];
  /** Why this formed, in the player's terms. Never a score. */
  readonly reason: string;
}

export interface SessionProgressionDependencies {
  readonly domainStore: DomainSessionStore;
  readonly cueBus: CueBus;
  readonly lookup: RelationLookup;
  readonly now: () => number;
  readonly resolveOutcome: (
    thread: CommittedThreadV1,
    lookup: RelationLookup
  ) => ThreadOutcomeResolution;
  readonly detectMotifs: (
    session: SessionStateV1,
    lookup: RelationLookup
  ) => readonly DetectedMotif[];
  readonly compileConclusion: (
    session: SessionStateV1,
    lookup: RelationLookup
  ) => unknown;
  /**
   * Whether the composition has developed enough to invite Attunement. Spec §13
   * requires an invitation, never a forced entry, and explicitly prefers a
   * motif or topology threshold over a score.
   */
  readonly attunementEligible: (session: SessionStateV1) => boolean;
}

export interface SessionProgression {
  /** Run after an interpretation commit has appended its atomic batch. */
  readonly afterCommit: (threadId: ThreadId) => ThreadOutcomeResolution | null;
  readonly attunementAvailable: () => boolean;
  readonly enterAttunement: () => void;
  readonly exitAttunement: () => void;
  /**
   * THE INVITATION, AS SOMETHING THE WORLD CAN HEAR.
   *
   * `attunementAvailable()` has always answered the question correctly and
   * nothing ever asked it: a live DOM audit of a running session found no
   * Attunement affordance among eighteen buttons, the project's own capture
   * harness probes for one and gives up, and `enterAttunement` had no caller
   * outside a unit test. A reducer state, two event types, a cue, a written
   * caption and 346 tested lines of `audio/attunement.ts` were unreachable by
   * any player, by any input.
   *
   * Availability changes only when the composition changes, so it is pushed
   * rather than polled. Spec §13 asks that Attunement be "explicitly invited
   * but not forced": the invitation is this edge, and what to do with it is the
   * subscriber's business. Fires only on a change, and fires immediately with
   * the current value so a surface that mounts late is never wrong.
   */
  readonly onInvitationChanged: (
    listener: (available: boolean) => void
  ) => () => void;
  readonly conclude: () => void;
}

function requireSession(store: DomainSessionStore): SessionStateV1 {
  const session = store.getState().session;
  if (!session) throw new Error("an active canonical session is required");
  return session;
}

/**
 * The next sequence number, read fresh each time. Progression appends several
 * events in a row and every one must follow the previous, so this is
 * deliberately re-read rather than cached.
 */
function nextSequence(store: DomainSessionStore): number {
  return requireSession(store).lastSequence + 1;
}

export function createSessionProgression(
  dependencies: SessionProgressionDependencies
): SessionProgression {
  const { domainStore, cueBus, lookup, now } = dependencies;

  const append = (event: SessionEventV1): void => {
    domainStore.getState().appendEvent(event);
  };

  const invitationListeners = new Set<(available: boolean) => void>();

  const isAvailable = (): boolean => {
    const session = domainStore.getState().session;
    if (!session || session.concluded || session.attunementActive) return false;
    return dependencies.attunementEligible(session);
  };

  let invited = isAvailable();

  /**
   * Called at the end of every operation that can change the answer. Notifies
   * only on an edge, so a subscriber may treat `true` as "this just became
   * possible" and stage the moment without debouncing it itself.
   */
  const settleInvitation = (): void => {
    const next = isAvailable();
    if (next === invited) return;
    invited = next;
    for (const listener of [...invitationListeners]) listener(next);
  };

  /**
   * A new Game must not inherit the last one's invitation. Deliberately keyed
   * on session identity rather than on every store write: settling inside the
   * append that a commit is still in the middle of would announce Attunement
   * before the motif that earned it had been staged.
   */
  let settledSessionId: string | null = (() => {
    const session = domainStore.getState().session;
    return session ? String(session.sessionId) : null;
  })();
  domainStore.subscribe((state) => {
    const sessionId = state.session ? String(state.session.sessionId) : null;
    if (sessionId === settledSessionId) return;
    settledSessionId = sessionId;
    settleInvitation();
  });

  /**
   * Emits `motif.completed` for every detection not already in the log. Runs
   * after every commit because a motif can only ever be created by one, and
   * dedupes on completion id so re-detection of a standing motif is silent.
   */
  const publishNewMotifs = (afterSeconds = 0): void => {
    const session = requireSession(domainStore);
    const known = new Set(
      session.completedMotifs.map((motif) => String(motif.completionId))
    );
    const detected = dependencies.detectMotifs(session, lookup);
    for (const motif of detected) {
      if (known.has(motif.completionId)) continue;
      const event = createSessionEvent({
        sessionId: session.sessionId,
        sequence: nextSequence(domainStore),
        at: now(),
        type: "motif.completed",
        payload: {
          completionId: toMotifCompletionId(motif.completionId),
          motifKindId: toMotifKindId(motif.motifKindId),
          conceptIds: motif.conceptIds.map(toConceptId),
          threadIds: motif.threadIds.map(toThreadId),
        },
      });
      append(event);
      cueBus.publish(
        planMotifCompleted(
          {
            motifKindId: toMotifKindId(motif.motifKindId),
            conceptIds: motif.conceptIds.map(toConceptId),
            threadIds: motif.threadIds.map(toThreadId),
            reason: motif.reason,
          },
          event.id,
          afterSeconds
        )
      );
    }
  };

  const resolveCommit = (threadId: ThreadId): ThreadOutcomeResolution | null => {
      const session = requireSession(domainStore);
      const thread = session.threads.find((entry) => entry.id === threadId);
      if (!thread) return null;
      if (session.outcomes.some((outcome) => outcome.threadId === threadId)) {
        // Already resolved. Re-running would duplicate the outcome and the
        // reducer would reject it — better to be idempotent than to throw.
        return null;
      }

      const outcome = dependencies.resolveOutcome(thread, lookup);
      const wovenEventId = thread.eventId;

      // How long the commit takes to resolve on stage. A motif this commit
      // completed is staged only after that, so the outcome and the motif are
      // two moments rather than one note covering another.
      let settledAfter = 0;
      const publishMoment = (plan: ReturnType<typeof planCommitMoment>): void => {
        cueBus.publish(plan);
        settledAfter = plan.duration;
      };

      if (outcome.kind === "documented") {
        const relation: DocumentedRelation = outcome.relation;
        const event = createSessionEvent({
          sessionId: session.sessionId,
          sequence: nextSequence(domainStore),
          at: now(),
          type: "documented-relation.revealed",
          payload: {
            threadId,
            // ADR-013 condition 1: the id must resolve in the pinned pack.
            documentedRelationId: toDocumentedRelationId(relation.id),
          },
        });
        append(event);
        publishMoment(
          planCommitMoment({
            woven: {
              threadId,
              pair: thread.pair,
              intention: thread.intention,
              gesture: thread.gesture,
            },
            wovenEventId,
            outcome: {
              kind: "documented",
              eventId: event.id,
              payload: {
                threadId,
                pair: thread.pair,
                intention: thread.intention,
                relation,
                evidence: relation.evidence,
                reception: outcome.stance,
              },
            },
          })
        );
      } else if (outcome.kind === "open-thread") {
        // ADR-013 condition 2: the handle is derived only from pair, intention,
        // facet, and pack — never from live topology — so replay re-derives it.
        const openThreadId = toOpenThreadId(
          `open:${outcome.facet}:${outcome.promptId ?? "fallback"}:${String(threadId)}`
        );
        const event = createSessionEvent({
          sessionId: session.sessionId,
          sequence: nextSequence(domainStore),
          at: now(),
          type: "open-thread.created",
          payload: { threadId, openThreadId },
        });
        append(event);
        publishMoment(
          planCommitMoment({
            woven: {
              threadId,
              pair: thread.pair,
              intention: thread.intention,
              gesture: thread.gesture,
            },
            wovenEventId,
            outcome: {
              kind: "open-thread",
              eventId: event.id,
              payload: {
                threadId,
                pair: thread.pair,
                intention: thread.intention,
                question: outcome.question,
                sharedFacet: outcome.facet,
              },
            },
          })
        );
      } else {
        // No durable event: absence is the record. The cue still fires, because
        // "nothing is grounded here yet" is a real answer the player deserves
        // to receive immediately, not silence that reads as a dropped input.
        publishMoment(
          planCommitMoment({
            woven: {
              threadId,
              pair: thread.pair,
              intention: thread.intention,
              gesture: thread.gesture,
            },
            wovenEventId,
            outcome: {
              kind: "unresolved",
              payload: {
                threadId,
                pair: thread.pair,
                intention: thread.intention,
                statement: outcome.statement,
              },
            },
          })
        );
      }

      publishNewMotifs(settledAfter);
      return outcome;
  };

  const progression: SessionProgression = {
    afterCommit: (threadId) => {
      try {
        return resolveCommit(threadId);
      } finally {
        // Settled last and on every path, including the idempotent early
        // returns: the invitation must arrive *after* the motif that earned it
        // has been staged, and must never be skipped because a commit was
        // replayed.
        settleInvitation();
      }
    },

    attunementAvailable: isAvailable,

    onInvitationChanged: (listener) => {
      invitationListeners.add(listener);
      listener(isAvailable());
      return () => {
        invitationListeners.delete(listener);
      };
    },

    enterAttunement: () => {
      const session = requireSession(domainStore);
      if (session.attunementActive || session.concluded) return;
      const event = createSessionEvent({
        sessionId: session.sessionId,
        sequence: nextSequence(domainStore),
        at: now(),
        type: "attunement.entered",
        payload: {},
      });
      append(event);
      cueBus.publish(planAttunement({ active: true }, event.id));
      settleInvitation();
    },

    exitAttunement: () => {
      const session = requireSession(domainStore);
      if (!session.attunementActive) return;
      const event = createSessionEvent({
        sessionId: session.sessionId,
        sequence: nextSequence(domainStore),
        at: now(),
        type: "attunement.exited",
        payload: {},
      });
      append(event);
      cueBus.publish(planAttunement({ active: false }, event.id));
      settleInvitation();
    },

    conclude: () => {
      const session = requireSession(domainStore);
      if (session.concluded) return;
      if (session.attunementActive) {
        // Concluding from inside Attunement must close it in the log, or replay
        // would reconstruct a session that ended mid-state.
        const exit = createSessionEvent({
          sessionId: session.sessionId,
          sequence: nextSequence(domainStore),
          at: now(),
          type: "attunement.exited",
          payload: {},
        });
        append(exit);
      }
      const current = requireSession(domainStore);
      const event = createSessionEvent({
        sessionId: current.sessionId,
        sequence: nextSequence(domainStore),
        at: now(),
        type: "session.concluded",
        payload: {},
      });
      append(event);
      // Compiled from the concluded log, so the performance can only ever be
      // the performance of this exact session.
      const performance = dependencies.compileConclusion(
        requireSession(domainStore),
        lookup
      );
      cueBus.publish(planConclusion({ performance }, event.id));
      settleInvitation();
    },
  };
  return Object.freeze(progression);
}
