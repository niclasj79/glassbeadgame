/**
 * SESSION GENERATION
 *
 * Deterministic from a seed, and pure — no React, no Three, no Web Audio
 * (VERTICAL-SLICE-SPEC §5). The draw decides which twelve of the twenty-four
 * beads are present, which is the single biggest lever on whether a session has
 * anything worth saying.
 *
 * The hard constraint is that quality must be *guaranteed* without being
 * *disclosed*. The generator is allowed to know where documented relations and
 * shared facets are, because it has to promise the player a draw that can
 * support recognition, an Open Thread, and a motif. It is never allowed to hand
 * that knowledge onward: the returned draw is a list of concept ids and nothing
 * else. No endpoint list, no pair hints, no ordering that ranks pairs. If this
 * function ever returns a pair, the game has become a hidden-answer hunt again.
 */
import type { ConceptId } from "../ids";

export interface DrawCandidateConcept {
  readonly id: ConceptId;
  readonly faculty: string;
  readonly facets: readonly string[];
}

export interface DrawLookup {
  readonly concepts: readonly DrawCandidateConcept[];
  /** Whether an authored relation exists. Used to shape, never to reveal. */
  readonly hasDocumentedRelation: (a: ConceptId, b: ConceptId) => boolean;
}

export interface CastaliaDrawRequest {
  readonly seed: string;
  readonly lookup: DrawLookup;
  /** Beads present in the session. The slice draws twelve of twenty-four. */
  readonly size?: number;
  /**
   * Concepts that must appear. The golden path pins its opening pair here so a
   * fixed seed reproduces the canonical integration scenario.
   */
  readonly require?: readonly ConceptId[];
}

export interface CastaliaDraw {
  /** Present beads, in a stable order that carries no ranking. */
  readonly conceptIds: readonly ConceptId[];
}

const DEFAULT_SIZE = 12;

/** xmur3 + mulberry32: small, fast, and stable across platforms. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h ^= h >>> 16) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sharedFacetCount(
  a: DrawCandidateConcept,
  b: DrawCandidateConcept
): number {
  const set = new Set(a.facets);
  let count = 0;
  for (const facet of b.facets) if (set.has(facet)) count += 1;
  return count;
}

interface DrawQuality {
  /** Documented relations available among the present beads. */
  readonly documented: number;
  /** Pairs that share a facet but have no authored relation — Open Threads. */
  readonly open: number;
  /** Documented relations that cross faculties. */
  readonly crossFacultyDocumented: number;
  /** Triangles of mutually related beads — the substrate a motif needs. */
  readonly triangles: number;
  readonly faculties: number;
}

/**
 * Scores a candidate draw on what it can *support*, never on what it contains.
 * Exported for tests, because a draw's quality is a rule and rules get tested.
 */
export function assessDraw(
  concepts: readonly DrawCandidateConcept[],
  lookup: DrawLookup
): DrawQuality {
  let documented = 0;
  let open = 0;
  let crossFacultyDocumented = 0;
  const related = new Map<ConceptId, Set<ConceptId>>();
  for (const concept of concepts) related.set(concept.id, new Set());

  for (let i = 0; i < concepts.length; i += 1) {
    for (let j = i + 1; j < concepts.length; j += 1) {
      const a = concepts[i];
      const b = concepts[j];
      if (lookup.hasDocumentedRelation(a.id, b.id)) {
        documented += 1;
        if (a.faculty !== b.faculty) crossFacultyDocumented += 1;
        related.get(a.id)?.add(b.id);
        related.get(b.id)?.add(a.id);
      } else if (sharedFacetCount(a, b) > 0) {
        open += 1;
      }
    }
  }

  let triangles = 0;
  for (let i = 0; i < concepts.length; i += 1) {
    for (let j = i + 1; j < concepts.length; j += 1) {
      const ab = related.get(concepts[i].id)?.has(concepts[j].id);
      if (!ab) continue;
      for (let k = j + 1; k < concepts.length; k += 1) {
        if (
          related.get(concepts[i].id)?.has(concepts[k].id) &&
          related.get(concepts[j].id)?.has(concepts[k].id)
        ) {
          triangles += 1;
        }
      }
    }
  }

  return {
    documented,
    open,
    crossFacultyDocumented,
    triangles,
    faculties: new Set(concepts.map((c) => c.faculty)).size,
  };
}

/**
 * What a draw must be able to support before it is allowed to be played. These
 * are floors on *possibility*, not promises about what the player will do.
 */
export const DRAW_REQUIREMENTS = Object.freeze({
  /** Enough recognition available across a 12–18 minute arc. */
  minDocumented: 6,
  /** Real unanswered questions, not consolation text. */
  minOpen: 8,
  /** §5: a strong cross-faculty relation must be reachable in the overture. */
  minCrossFacultyDocumented: 3,
  /** §5: the draw must support at least one semantic motif. */
  minTriangles: 1,
  /** All four faculties present, so the arena has its full geography. */
  minFaculties: 4,
});

function satisfies(quality: DrawQuality): boolean {
  return (
    quality.documented >= DRAW_REQUIREMENTS.minDocumented &&
    quality.open >= DRAW_REQUIREMENTS.minOpen &&
    quality.crossFacultyDocumented >=
      DRAW_REQUIREMENTS.minCrossFacultyDocumented &&
    quality.triangles >= DRAW_REQUIREMENTS.minTriangles &&
    quality.faculties >= DRAW_REQUIREMENTS.minFaculties
  );
}

export class CastaliaDrawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CastaliaDrawError";
  }
}

/**
 * Draws by rejection sampling against the quality floor, then falls back to the
 * best candidate seen. Rejection sampling is used rather than a clever
 * constructive algorithm because the constraints interact — maximising
 * documented pairs tends to collapse faculty spread — and because a bounded
 * search keeps the whole thing trivially deterministic and easy to reason about.
 */
export function drawCastaliaSession(
  request: CastaliaDrawRequest
): CastaliaDraw {
  const size = request.size ?? DEFAULT_SIZE;
  const pool = request.lookup.concepts;
  if (size < 4) throw new CastaliaDrawError("a session needs at least four beads");
  if (pool.length < size) {
    throw new CastaliaDrawError("the pack has fewer concepts than the draw size");
  }

  const byId = new Map(pool.map((c) => [c.id, c]));
  const required: DrawCandidateConcept[] = [];
  for (const id of request.require ?? []) {
    const concept = byId.get(id);
    if (!concept) {
      throw new CastaliaDrawError(`required concept ${id} is not in the pack`);
    }
    if (!required.some((c) => c.id === id)) required.push(concept);
  }
  if (required.length > size) {
    throw new CastaliaDrawError("more required concepts than the draw size");
  }

  const random = seededRandom(request.seed);
  const requiredIds = new Set(required.map((c) => c.id));
  const rest = pool.filter((c) => !requiredIds.has(c.id));

  let best: DrawCandidateConcept[] | null = null;
  let bestScore = -1;

  // Bounded so the draw cannot become a search that stalls a session start.
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const candidate = [
      ...required,
      ...shuffled(rest, random).slice(0, size - required.length),
    ];
    const quality = assessDraw(candidate, request.lookup);
    if (satisfies(quality)) {
      return Object.freeze({
        conceptIds: Object.freeze(orderForArena(candidate)),
      });
    }
    // Weighted toward the constraints that fail most often, so the fallback is
    // the least-bad draw rather than an arbitrary one.
    const score =
      quality.faculties * 6 +
      quality.crossFacultyDocumented * 3 +
      quality.triangles * 3 +
      quality.documented +
      quality.open * 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (!best) throw new CastaliaDrawError("no draw could be assembled");
  return Object.freeze({ conceptIds: Object.freeze(orderForArena(best)) });
}

/**
 * Grouped by faculty so the arena has an authored geography rather than a
 * scatter, and sorted within a faculty for stability. Deliberately carries no
 * information about relations — position must never hint at an answer.
 */
function orderForArena(
  concepts: readonly DrawCandidateConcept[]
): ConceptId[] {
  const order = ["measure", "sound", "matter", "image"];
  return [...concepts]
    .sort((a, b) => {
      const byFaculty =
        order.indexOf(a.faculty) - order.indexOf(b.faculty);
      if (byFaculty !== 0) return byFaculty;
      return String(a.id) < String(b.id) ? -1 : 1;
    })
    .map((c) => c.id);
}
