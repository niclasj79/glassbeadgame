import type { SessionStateV1 } from "@/domain/model";

/**
 * WHAT THE WORLD MAY SAY ABOUT A THREAD, READ FROM THE LOG.
 *
 * Two questions, both answered from the session's outcome entries and nothing
 * else, so a replayed log draws exactly what the live session drew:
 *
 *   closed   a documented relation was revealed for it. Its ink dries and its
 *            figure closes; an Open Thread's ink stays wet and its terminal
 *            stays open (CAV-006, scene/resolution.ts).
 *   lit      the Game answered it at all — documented or Open Thread. A thread
 *            with neither is one the Game had nothing to add to. Absence is
 *            the record for that outcome (no durable event is appended), so
 *            "no entry" is the honest reading of "unlit", and it holds under
 *            replay because the resolver is deterministic and runs in the same
 *            commit that appends the thread.
 *
 * The two are independent on purpose: an Open Thread is lit and not closed;
 * a documented relation is both; an unlit strand is neither. Pure.
 */
export interface ThreadStanding {
  readonly closed: boolean;
  readonly lit: boolean;
}

const UNANSWERED: ThreadStanding = Object.freeze({ closed: false, lit: false });

export function threadStandings(
  outcomes: SessionStateV1["outcomes"]
): ReadonlyMap<string, ThreadStanding> {
  const standings = new Map<string, ThreadStanding>();
  for (const outcome of outcomes) {
    const id = String(outcome.threadId);
    const previous = standings.get(id) ?? UNANSWERED;
    standings.set(
      id,
      Object.freeze({
        closed: previous.closed || outcome.type === "documented-relation",
        lit: true,
      })
    );
  }
  return standings;
}

/** A thread the log holds no outcome for is unanswered: open and unlit. */
export function standingOf(
  standings: ReadonlyMap<string, ThreadStanding>,
  threadId: string
): ThreadStanding {
  return standings.get(threadId) ?? UNANSWERED;
}
