/**
 * WHEN ATTUNEMENT BECOMES AVAILABLE
 *
 * Attunement is a held heightened state, not a consumable hint and not a reward
 * (VERTICAL-SLICE-SPEC §13). It is *invited* by the composition and never
 * forced, so this answers exactly one question: has the web become enough of a
 * composition that listening to it one thread at a time would be worth doing?
 *
 * The specification prefers a motif or topology threshold over a score, and the
 * reason is worth stating: any numeric threshold the player can see becomes a
 * target, and a target turns a contemplative instrument into a progress bar.
 * So there is no counter, no meter, and nothing in the interface that counts
 * down toward this. The invitation simply appears when the web can carry it.
 *
 * Two ways in, because two different kinds of session deserve it:
 *
 *  - a completed semantic motif — the web has said something structural;
 *  - or enough connected material that the web has a shape at all, which
 *    covers the player who weaves broadly without ever closing a motif.
 *
 * Both are properties of the composition, and neither can be farmed: repeating
 * the same pairing does not add threads, and threads scattered across
 * unconnected fragments do not make a shape.
 */
import type { SessionStateV1 } from "../../domain/model";

/**
 * Enough threads that the web is a composition rather than a few remarks, and
 * enough of them joined that it has a centre. Deliberately reachable inside the
 * 12–18 minute arc without being the point of it.
 */
export const ATTUNEMENT_THRESHOLDS = Object.freeze({
  minThreadsWithMotif: 3,
  minThreadsWithoutMotif: 6,
  /** Concepts in the largest connected region — the web needs a body. */
  minLargestRegion: 4,
});

export function isAttunementEligible(session: SessionStateV1): boolean {
  if (session.concluded) return false;
  const threadCount = session.threads.length;
  if (session.completedMotifs.length > 0) {
    return threadCount >= ATTUNEMENT_THRESHOLDS.minThreadsWithMotif;
  }
  if (threadCount < ATTUNEMENT_THRESHOLDS.minThreadsWithoutMotif) return false;

  // Largest connected region, by flood fill over committed threads. Scattered
  // pairs never qualify however many there are, because a handful of unrelated
  // remarks is not something you can listen through.
  const neighbours = new Map<string, string[]>();
  for (const thread of session.threads) {
    const [a, b] = [String(thread.pair[0]), String(thread.pair[1])];
    (neighbours.get(a) ?? neighbours.set(a, []).get(a)!).push(b);
    (neighbours.get(b) ?? neighbours.set(b, []).get(b)!).push(a);
  }
  const seen = new Set<string>();
  let largest = 0;
  for (const start of neighbours.keys()) {
    if (seen.has(start)) continue;
    let size = 0;
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (seen.has(current)) continue;
      seen.add(current);
      size += 1;
      for (const next of neighbours.get(current) ?? []) {
        if (!seen.has(next)) stack.push(next);
      }
    }
    if (size > largest) largest = size;
  }
  return largest >= ATTUNEMENT_THRESHOLDS.minLargestRegion;
}
