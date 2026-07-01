import { concepts } from "@/content/concepts";
import { connectionByPair } from "@/content/connections";
import { pairKey, type DisciplineId } from "@/content/types";
import { mulberry32, shuffle } from "@/lib/utils";

export interface SessionDraw {
  seed: number;
  disciplines: DisciplineId[];
  beadIds: string[];
  /** Curated connections present among the drawn beads. */
  curatedAvailable: number;
}

const MIN_CURATED = 6;
const MAX_ATTEMPTS = 48;

/**
 * Draw the beads for one Game: an even split across the chosen disciplines
 * plus one or two bridge concepts from outside them. Rejection-samples until
 * enough curated pairs are present, so a session can never be content-starved.
 */
export function drawSession(picks: DisciplineId[], seed?: number): SessionDraw {
  const s = seed ?? ((Math.random() * 0x7fffffff) | 0);
  const rng = mulberry32(s);
  const perPick = picks.length === 2 ? 5 : 4;
  const bridgeCount = picks.length === 2 ? 2 : 1;

  const pools = picks.map((d) => concepts.filter((c) => c.discipline === d));
  const bridgePool = concepts.filter((c) => c.bridge && !picks.includes(c.discipline));

  let best: string[] = [];
  let bestScore = -1;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ids: string[] = [];
    for (const pool of pools) {
      ids.push(...shuffle(pool, rng).slice(0, perPick).map((c) => c.id));
    }
    ids.push(...shuffle(bridgePool, rng).slice(0, bridgeCount).map((c) => c.id));
    const curated = countCuratedPairs(ids);
    if (curated > bestScore) {
      bestScore = curated;
      best = ids;
    }
    if (connectionByPair.size === 0 || curated >= MIN_CURATED) break;
  }

  return {
    seed: s,
    disciplines: picks,
    beadIds: shuffle(best, rng),
    curatedAvailable: Math.max(bestScore, 0),
  };
}

function countCuratedPairs(ids: string[]): number {
  let n = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (connectionByPair.has(pairKey(ids[i], ids[j]))) n++;
    }
  }
  return n;
}
