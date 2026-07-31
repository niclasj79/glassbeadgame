/**
 * WHERE THE WEB IS ANCHORED ON THE PRIME CIRCLE
 *
 * Committed threads leave gold stations on the armillary's prime circle at the
 * longitudes their endpoints occupy. Two facts have to be kept apart, because
 * they change on completely different clocks:
 *
 *   *which* beads are anchored, and how heavily — changes only when a thread
 *   is committed, so it is derived once, in React, from domain state;
 *
 *   *where* those beads are — changes every frame, because the arena morphs
 *   between the armillary and the Lens planes and the beads breathe. It is
 *   therefore read in the frame loop and never during render.
 *
 * This module owns the first half, as a pure function, so the second half has
 * nothing left to decide. The armillary previously computed both together in a
 * `useMemo`: it sampled `frameState.positions` during render (a per-frame
 * value read at render time, which AGENTS.md forbids in both directions) and
 * so froze every station's longitude at the moment its thread was committed,
 * leaving the gold behind when the layout moved.
 */

/** The most stations the ring material carries. A shader ABI: see Armillary. */
export const MAX_STATIONS = 12;

export interface StationAnchor {
  /** Bead the station stands under; its longitude is resolved per frame. */
  readonly id: string;
  /** Weight of the anchor, 0–1: how much of the web meets at this bead. */
  readonly weight: number;
}

/** Only the part of a committed thread a station is derived from. */
export interface StationThread {
  readonly pair: readonly [string, string];
}

/**
 * The anchored beads of a draw, heaviest first, ties broken on id so the same
 * web produces the same stations on every machine and in every replay.
 *
 * Weight saturates: a bead with six threads is not six times as bright as a
 * bead with one, and the ring is not a bar chart.
 */
export function stationAnchors(
  threads: readonly StationThread[] | null | undefined
): readonly StationAnchor[] {
  if (!threads || threads.length === 0) return [];
  const degree = new Map<string, number>();
  for (const thread of threads) {
    for (const conceptId of thread.pair) {
      const key = String(conceptId);
      degree.set(key, (degree.get(key) ?? 0) + 1);
    }
  }
  return [...degree.entries()]
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1))
    .slice(0, MAX_STATIONS)
    .map(([id, count]) => ({ id, weight: Math.min(1, 0.4 + count * 0.28) }));
}
