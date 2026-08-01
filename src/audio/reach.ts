/**
 * HOW FAR THE WEB HAS BEEN CARRIED.
 *
 * The ambient bed used to swell with `session.score`, and the reviewer's
 * rejection of that was explicit: ADR-010 replaced the number with the portrait,
 * so the room must not get louder as points accumulate. This is the replacement
 * the review named — topology.
 *
 * Reach is the size of the largest connected region of the composition,
 * normalised against the arena. It is a property of what the player *built*: it
 * rises when two regions join, it cannot be raised by finding anything, there is
 * no ceiling to complete and nothing to fill. Two players with the same number
 * of threads can have very different reach, and that difference is exactly what
 * the bed should be following.
 *
 * Pure. No Web Audio, no store, no clock.
 */

export interface ReachInput {
  /** Concepts present in the arena. The denominator, floored at four. */
  readonly conceptCount: number;
  /** Committed threads as unordered pairs of concept ids. */
  readonly pairs: readonly (readonly [string, string])[];
}

/**
 * 0 with nothing woven; 1 when one connected region spans the whole arena.
 *
 * The floor of four on the denominator matters: in a two-bead arena a single
 * thread would otherwise read as a fully carried world, and the bed would arrive
 * at its ceiling on the player's first gesture.
 */
export function compositionReach(input: ReachInput): number {
  const neighbours = new Map<string, string[]>();
  for (const [a, b] of input.pairs) {
    if (a === b) continue;
    const listA = neighbours.get(a);
    if (listA === undefined) neighbours.set(a, [b]);
    else listA.push(b);
    const listB = neighbours.get(b);
    if (listB === undefined) neighbours.set(b, [a]);
    else listB.push(a);
  }
  if (neighbours.size === 0) return 0;

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
  return Math.min(1, largest / Math.max(4, input.conceptCount));
}
