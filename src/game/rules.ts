import { conceptById } from "@/content/concepts";
import { connectionByPair } from "@/content/connections";
import { pairKey } from "@/content/types";
import { hashString, mulberry32, pick } from "@/lib/utils";
import type { Discovery, MotifAward, SessionState, Thread } from "@/state/types";

export const FAINT_POINTS = 2;
/** From the third faint onward the Game rewards it less — exploration is
 *  welcome, farming is not. */
export const FAINT_POINTS_DIMINISHED = 1;
export const TIER_POINTS: Record<1 | 2 | 3, number> = { 1: 8, 2: 13, 3: 21 };

export function faintPoints(priorFaints: number): number {
  return priorFaints >= 2 ? FAINT_POINTS_DIMINISHED : FAINT_POINTS;
}

type FaintTemplate = (a: string, b: string, ka: string, kb: string) => string;

const FAINT_TEMPLATES: FaintTemplate[] = [
  (a, b, ka, kb) =>
    `Between ${a} and ${b} a quiet correspondence stirs — ${ka} answering ${kb}, too faint yet to name.`,
  (a, b, ka, kb) =>
    `${a} leans toward ${b} across the dark: something of ${ka} recognizes something of ${kb}. The resonance is real, but thin.`,
  (a, b, ka, kb) =>
    `A tentative strand. ${a} and ${b} share a distant kinship — ${ka} on one side, ${kb} on the other — awaiting a stronger synthesis.`,
  (a, b, ka, kb) =>
    `The Game registers a murmur between ${a} and ${b}: ${ka} brushing against ${kb}. Not every pairing is destined to sing.`,
];

/** Deterministic per pair — the same faint pairing always composes the same line. */
export function composeFaintInsight(aId: string, bId: string): string {
  const key = pairKey(aId, bId);
  const rng = mulberry32(hashString(key));
  const a = conceptById.get(aId);
  const b = conceptById.get(bId);
  if (!a || !b) return "A thread into the unknown.";
  const template = pick(FAINT_TEMPLATES, rng);
  return template(a.name, b.name, pick(a.keywords, rng), pick(b.keywords, rng));
}

export interface AttemptResult {
  thread: Thread;
  discovery: Discovery;
}

/** Resolve a weaving attempt into its thread and its discovery payload. */
export function resolveAttempt(aId: string, bId: string, priorFaints = 0): AttemptResult {
  const key = pairKey(aId, bId);
  const curated = connectionByPair.get(key);
  const now = Date.now();

  if (curated) {
    return {
      thread: { id: key, a: aId, b: bId, kind: "curated", tier: curated.tier, createdAt: now },
      discovery: {
        id: key,
        a: aId,
        b: bId,
        kind: "curated",
        tier: curated.tier,
        title: curated.title,
        insight: curated.insight,
        quote: curated.quote,
        newToCodex: false, // store overwrites against the real codex
        points: TIER_POINTS[curated.tier],
      },
    };
  }

  return {
    thread: { id: key, a: aId, b: bId, kind: "faint", tier: 0, createdAt: now },
    discovery: {
      id: key,
      a: aId,
      b: bId,
      kind: "faint",
      tier: 0,
      title: "Faint Resonance",
      insight: composeFaintInsight(aId, bId),
      newToCodex: false,
      points: faintPoints(priorFaints),
    },
  };
}

/**
 * Choose which undiscovered luminous pair an Illumination reveals:
 * profoundest first, deterministic per session and per spend.
 */
export function pickIlluminationTarget(
  session: SessionState
): [string, string] | null {
  const woven = new Set(session.threads.map((t) => t.id));
  const candidates: { pair: [string, string]; tier: number }[] = [];
  const ids = session.beadIds;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const key = pairKey(ids[i], ids[j]);
      if (woven.has(key)) continue;
      const conn = connectionByPair.get(key);
      if (conn) candidates.push({ pair: [ids[i], ids[j]], tier: conn.tier });
    }
  }
  if (candidates.length === 0) return null;
  const topTier = Math.max(...candidates.map((c) => c.tier));
  const top = candidates.filter((c) => c.tier === topTier);
  const rng = mulberry32(session.seed ^ (session.illuminationsUsed + 1) * 0x85ebca6b);
  return pick(top, rng).pair;
}

// ── Motifs ────────────────────────────────────────────────────────────────

const MOTIF_POINTS = { triad: 15, symposium: 20, fugue: 25 } as const;

/**
 * Detect motifs newly completed by the thread (a, b). Runs on a graph of at
 * most 14 nodes — brute force is the correct algorithm.
 */
export function detectNewMotifs(session: SessionState, newThread: Thread): MotifAward[] {
  const awards: MotifAward[] = [];
  const threads = [...session.threads, newThread];
  const adj = new Map<string, Set<string>>();
  for (const t of threads) {
    if (!adj.has(t.a)) adj.set(t.a, new Set());
    if (!adj.has(t.b)) adj.set(t.b, new Set());
    adj.get(t.a)!.add(t.b);
    adj.get(t.b)!.add(t.a);
  }
  const already = new Set(session.motifs.map((m) => m.motifId));
  const now = Date.now();

  // Triad: the new thread closes a triangle.
  if (!already.has("triad")) {
    const na = adj.get(newThread.a) ?? new Set();
    const nb = adj.get(newThread.b) ?? new Set();
    for (const x of na) {
      if (x !== newThread.b && nb.has(x)) {
        awards.push({ motifId: "triad", name: "Triad", points: MOTIF_POINTS.triad, at: now });
        break;
      }
    }
  }

  // Symposium: a connected component spanning three disciplines.
  if (!already.has("symposium")) {
    const component = new Set<string>([newThread.a]);
    const stack = [newThread.a];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nxt of adj.get(cur) ?? []) {
        if (!component.has(nxt)) {
          component.add(nxt);
          stack.push(nxt);
        }
      }
    }
    const disciplines = new Set(
      [...component].map((id) => conceptById.get(id)?.discipline).filter(Boolean)
    );
    if (disciplines.size >= 3) {
      awards.push({
        motifId: "symposium",
        name: "Symposium",
        points: MOTIF_POINTS.symposium,
        at: now,
      });
    }
  }

  // Fugue: a simple path of five beads exists through the new thread.
  if (!already.has("fugue") && longestPathThrough(adj, newThread.a, newThread.b) >= 5) {
    awards.push({ motifId: "fugue", name: "Fugue", points: MOTIF_POINTS.fugue, at: now });
  }

  return awards;
}

/** Longest simple path (in beads) that uses the edge a-b, capped for sanity. */
function longestPathThrough(adj: Map<string, Set<string>>, a: string, b: string): number {
  const longestFrom = (start: string, blocked: Set<string>): number => {
    let best = 1;
    const dfs = (node: string, visited: Set<string>, len: number) => {
      if (len > best) best = len;
      if (len >= 8) return; // more than enough for the fugue check
      for (const nxt of adj.get(node) ?? []) {
        if (!visited.has(nxt) && !blocked.has(nxt)) {
          visited.add(nxt);
          dfs(nxt, visited, len + 1);
          visited.delete(nxt);
        }
      }
    };
    dfs(start, new Set([start, ...blocked]), 1);
    return best;
  };
  // Path through edge = longest arm from a (avoiding b) + longest arm from b (avoiding a).
  return longestFrom(a, new Set([b])) + longestFrom(b, new Set([a]));
}
