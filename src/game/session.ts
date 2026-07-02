import { concepts, conceptById } from "@/content/concepts";
import { connections, connectionByPair } from "@/content/connections";
import { pairKey, type DisciplineId } from "@/content/types";
import { mulberry32, shuffle } from "@/lib/utils";

export interface SessionDraw {
  seed: number;
  disciplines: DisciplineId[];
  beadIds: string[];
  /** Curated connections present among the drawn beads. */
  curatedAvailable: number;
}

/** Curated connections deliberately planted in every draw. */
const SEEDED_CONNECTIONS = 4;

/**
 * Draw the beads for one Game. The draw is seeded with the beads of several
 * curated connections from the chosen disciplines — a session can never be
 * content-starved by construction — then filled with random concepts for
 * open exploration, plus one or two bridge beads from outside disciplines.
 */
export function drawSession(picks: DisciplineId[], seed?: number): SessionDraw {
  const s = seed ?? ((Math.random() * 0x7fffffff) | 0);
  const rng = mulberry32(s);
  const perPick = picks.length === 2 ? 5 : 4;
  const bridgeCount = picks.length === 2 ? 2 : 1;

  const quota = new Map<DisciplineId, number>(picks.map((d) => [d, perPick]));
  const chosen = new Set<string>();

  // 1) Plant curated connections whose beads fit the remaining quotas.
  const pool = shuffle(
    connections.filter((c) => {
      const da = conceptById.get(c.pair[0])?.discipline;
      const db = conceptById.get(c.pair[1])?.discipline;
      return !!da && !!db && picks.includes(da) && picks.includes(db);
    }),
    rng
  );
  let planted = 0;
  for (const conn of pool) {
    if (planted >= SEEDED_CONNECTIONS) break;
    const [a, b] = conn.pair;
    const da = conceptById.get(a)!.discipline;
    const db = conceptById.get(b)!.discipline;
    const needA = chosen.has(a) ? 0 : 1;
    const needB = chosen.has(b) ? 0 : 1;
    const fits =
      da === db
        ? (quota.get(da) ?? 0) >= needA + needB
        : (quota.get(da) ?? 0) >= needA && (quota.get(db) ?? 0) >= needB;
    if (!fits) continue;
    if (needA) {
      chosen.add(a);
      quota.set(da, (quota.get(da) ?? 0) - 1);
    }
    if (needB) {
      chosen.add(b);
      quota.set(db, (quota.get(db) ?? 0) - 1);
    }
    planted++;
  }

  // 2) Fill the remaining quotas with unused concepts, at random.
  for (const d of picks) {
    const remaining = quota.get(d) ?? 0;
    if (remaining <= 0) continue;
    const unused = concepts.filter((c) => c.discipline === d && !chosen.has(c.id));
    for (const c of shuffle(unused, rng).slice(0, remaining)) chosen.add(c.id);
  }

  // 3) Bridge beads from outside the chosen disciplines.
  const bridgePool = concepts.filter((c) => c.bridge && !picks.includes(c.discipline));
  for (const c of shuffle(bridgePool, rng).slice(0, bridgeCount)) chosen.add(c.id);

  const beadIds = shuffle([...chosen], rng);
  return {
    seed: s,
    disciplines: picks,
    beadIds,
    curatedAvailable: countCuratedPairs(beadIds),
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
