import type { ConceptId, ThreadId } from "../ids";
import type { CommittedThreadV1, SessionStateV1 } from "../model/sessionState";
import type { FacultyLookup } from "../outcomes/lookup";
import { buildTopology } from "./buildTopology";
import type { SessionTopology } from "./types";

/**
 * Cheap selectors for the hot paths that do not need the full topology — a
 * hover highlight should not run Brandes betweenness.
 */

/** Distinct neighbours per concept, including concepts with no threads. */
export function conceptDegrees(
  state: SessionStateV1
): ReadonlyMap<ConceptId, number> {
  const neighbours = new Map<ConceptId, Set<ConceptId>>();
  for (const conceptId of state.conceptIds) {
    neighbours.set(conceptId, new Set<ConceptId>());
  }
  for (const thread of state.threads) {
    if (thread.pair[0] === thread.pair[1]) continue;
    neighbours.get(thread.pair[0])?.add(thread.pair[1]);
    neighbours.get(thread.pair[1])?.add(thread.pair[0]);
  }
  const degrees = new Map<ConceptId, number>();
  for (const [conceptId, set] of neighbours) degrees.set(conceptId, set.size);
  return degrees;
}

/** Neighbours of one concept, in first-thread order. */
export function neighbourIdsOf(
  state: SessionStateV1,
  conceptId: ConceptId
): readonly ConceptId[] {
  const seen = new Set<ConceptId>();
  const neighbours: ConceptId[] = [];
  for (const thread of state.threads) {
    if (thread.pair[0] === thread.pair[1]) continue;
    const other =
      thread.pair[0] === conceptId
        ? thread.pair[1]
        : thread.pair[1] === conceptId
          ? thread.pair[0]
          : null;
    if (other === null || seen.has(other)) continue;
    seen.add(other);
    neighbours.push(other);
  }
  return Object.freeze(neighbours);
}

/** Threads touching one concept, in creation order. */
export function threadsTouching(
  state: SessionStateV1,
  conceptId: ConceptId
): readonly CommittedThreadV1[] {
  return Object.freeze(
    state.threads.filter(
      (thread) => thread.pair[0] === conceptId || thread.pair[1] === conceptId
    )
  );
}

export function findThread(
  state: SessionStateV1,
  threadId: ThreadId
): CommittedThreadV1 | null {
  return state.threads.find((thread) => thread.id === threadId) ?? null;
}

/** Concepts carrying at least one thread, in session order. */
export function wovenConceptIds(state: SessionStateV1): readonly ConceptId[] {
  const woven = new Set<ConceptId>();
  for (const thread of state.threads) {
    woven.add(thread.pair[0]);
    woven.add(thread.pair[1]);
  }
  return Object.freeze(state.conceptIds.filter((id) => woven.has(id)));
}

/**
 * A single-entry memo keyed on state identity.
 *
 * Session state is frozen and replaced wholesale on every event, so identity is
 * a sound cache key: the same object can never describe two different webs.
 * Presentation layers call topology selectors many times per frame; this keeps
 * that free between events without introducing a second source of truth.
 */
export function createTopologyCache(
  lookup: FacultyLookup
): (state: SessionStateV1) => SessionTopology {
  let cachedState: SessionStateV1 | null = null;
  let cachedTopology: SessionTopology | null = null;

  return (state) => {
    if (cachedState === state && cachedTopology !== null) return cachedTopology;
    const topology = buildTopology(state, lookup);
    cachedState = state;
    cachedTopology = topology;
    return topology;
  };
}
