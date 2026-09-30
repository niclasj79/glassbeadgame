import type { ConceptPair } from "../events";
import type { ConceptId } from "../ids";
import { cloneAndFreeze } from "../model/immutable";
import type { ConceptStructureLookup } from "../outcomes/lookup";
import { compareStrings } from "../outcomes/prose";
import { sharedFacetsOf } from "../outcomes/resolveThreadOutcome";
import { studyCount } from "./goal";
import { combinations, compareNumberLists, unorderedPairKey } from "./order";
import type {
  StudyCanonGoal,
  StudyCarryGoal,
  StudyDefinition,
  StudyPassageGoal,
  StudySolution,
} from "./types";

/**
 * THE SOLVER (STUDIES-SPEC §9).
 *
 * Enumerates every answer of a brief within a Study's beads, reading nothing
 * but facets and faculties — the same public information the player reads from
 * the beads (R1). The pack validator runs it over every authored Study and
 * refuses to build when a Study is not what it claims to be: a solvable Study
 * whose authored line is not an answer, a shorter answer than the brief's
 * count, a silence that could in fact be broken.
 *
 * A carrying thread is a pair of the Study's beads with at least one shared
 * facet, and "shared" means exactly `sharedFacetsOf` — there is one definition
 * of it in the domain and the Studies do not keep a second.
 *
 * Pure, deterministic and exhaustive. The bead sets are eight beads, so plain
 * enumeration is both the simplest proof and fast enough to run at build.
 */

/** A Study's beads as a graph of carrying pairs, in the Study's own order. */
interface CarryingGraph {
  readonly beads: readonly ConceptId[];
  readonly rank: ReadonlyMap<ConceptId, number>;
  /** Carrying neighbours of each bead, in bead order. */
  readonly neighbours: ReadonlyMap<ConceptId, readonly ConceptId[]>;
}

function uniqueBeads(conceptIds: readonly ConceptId[]): readonly ConceptId[] {
  return [...new Set(conceptIds)];
}

function buildCarryingGraph(
  conceptIds: readonly ConceptId[],
  lookup: ConceptStructureLookup
): CarryingGraph {
  const beads = uniqueBeads(conceptIds);
  const rank = new Map<ConceptId, number>();
  beads.forEach((bead, index) => rank.set(bead, index));
  const neighbours = new Map<ConceptId, ConceptId[]>();
  for (const bead of beads) neighbours.set(bead, []);
  for (let i = 0; i < beads.length; i += 1) {
    for (let j = i + 1; j < beads.length; j += 1) {
      const a = beads[i] as ConceptId;
      const b = beads[j] as ConceptId;
      if (sharedFacetsOf(a, b, lookup).length === 0) continue;
      neighbours.get(a)?.push(b);
      neighbours.get(b)?.push(a);
    }
  }
  return { beads, rank, neighbours };
}

function rankSequence(
  pairs: readonly ConceptPair[],
  rank: ReadonlyMap<ConceptId, number>
): readonly number[] {
  return pairs.flatMap(([a, b]) => [rank.get(a) ?? -1, rank.get(b) ?? -1]);
}

/** Fewer threads first, then by the order of the beads they join. */
function sortAnswers(
  answers: ConceptPair[][],
  rank: ReadonlyMap<ConceptId, number>
): ConceptPair[][] {
  return answers.sort(
    (left, right) =>
      left.length - right.length ||
      compareNumberLists(rankSequence(left, rank), rankSequence(right, rank))
  );
}

function pairsAlong(path: readonly ConceptId[]): ConceptPair[] {
  const pairs: ConceptPair[] = [];
  for (let index = 1; index < path.length; index += 1) {
    pairs.push([path[index - 1] as ConceptId, path[index] as ConceptId]);
  }
  return pairs;
}

/** Breadth-first distance in carrying threads, or null when nothing joins them. */
function shortestWay(
  graph: CarryingGraph,
  from: ConceptId,
  to: ConceptId
): number | null {
  const distance = new Map<ConceptId, number>([[from, 0]]);
  const queue: ConceptId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift() as ConceptId;
    const reached = distance.get(current) ?? 0;
    for (const next of graph.neighbours.get(current) ?? []) {
      if (distance.has(next)) continue;
      if (next === to) return reached + 1;
      distance.set(next, reached + 1);
      queue.push(next);
    }
  }
  return null;
}

/**
 * Passage: every simple path of carrying threads from A to B within the
 * count. A path of at least one thread: a bead is not a way to itself.
 */
function solvePassage(
  graph: CarryingGraph,
  goal: StudyPassageGoal,
  count: number
): StudySolution {
  const { from, to } = goal;
  if (!graph.rank.has(from) || !graph.rank.has(to) || from === to) {
    return { count, shortest: null, answers: [] };
  }

  const answers: ConceptPair[][] = [];
  const path: ConceptId[] = [from];
  const extend = (bead: ConceptId): void => {
    for (const next of graph.neighbours.get(bead) ?? []) {
      if (path.includes(next)) continue;
      path.push(next);
      if (next === to) answers.push(pairsAlong(path));
      else if (path.length - 1 < goal.threads) extend(next);
      path.pop();
    }
  };
  if (goal.threads >= 1) extend(from);

  return {
    count,
    shortest: shortestWay(graph, from, to),
    answers: sortAnswers(answers, graph.rank),
  };
}

function isSpanningTree(
  beads: readonly ConceptId[],
  pairs: readonly ConceptPair[]
): boolean {
  if (pairs.length !== beads.length - 1) return false;
  const reached = new Set<ConceptId>([beads[0] as ConceptId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [a, b] of pairs) {
      if (reached.has(a) !== reached.has(b)) {
        reached.add(a);
        reached.add(b);
        grew = true;
      }
    }
  }
  return reached.size === beads.length;
}

/**
 * Canon: sets of threads that all carry F, connected, whose beads span at
 * least K faculties, of the brief's count.
 *
 * Every pair of F's carriers shares F, so any carriers can be joined. That makes
 * the count the fewest threads possible: K beads in K faculties need K − 1
 * threads, and any K carriers in K distinct faculties can be joined by them —
 * which is why the answers are the spanning trees of those groups.
 */
function solveCanon(
  graph: CarryingGraph,
  goal: StudyCanonGoal,
  count: number,
  lookup: ConceptStructureLookup
): StudySolution {
  const carriers = graph.beads.filter((bead) =>
    lookup.conceptFacets(bead).includes(goal.facet)
  );
  const answers: ConceptPair[][] = [];
  for (const group of combinations(carriers, count + 1)) {
    const faculties = new Set(group.map((bead) => lookup.conceptFaculty(bead)));
    if (faculties.size < goal.faculties) continue;
    const pairs: readonly ConceptPair[] = combinations(group, 2).map(
      ([a, b]) => [a, b] as const
    );
    for (const tree of combinations(pairs, count)) {
      if (isSpanningTree(group, tree)) answers.push([...tree]);
    }
  }
  return {
    count,
    shortest: answers.length > 0 ? count : null,
    answers: sortAnswers(answers, graph.rank),
  };
}

/** Carry: single threads carrying F with at least one bead in faculty X. */
function solveCarry(
  graph: CarryingGraph,
  goal: StudyCarryGoal,
  count: number,
  lookup: ConceptStructureLookup
): StudySolution {
  const carries = (bead: ConceptId): boolean =>
    lookup.conceptFacets(bead).includes(goal.facet);
  const answers: ConceptPair[][] = [];
  for (const [a, b] of combinations(graph.beads, 2)) {
    if (!carries(a) || !carries(b)) continue;
    if (lookup.conceptFaculty(a) !== goal.into && lookup.conceptFaculty(b) !== goal.into) {
      continue;
    }
    answers.push([[a, b] as const]);
  }
  return {
    count,
    shortest: answers.length > 0 ? count : null,
    answers: sortAnswers(answers, graph.rank),
  };
}

/**
 * Every answer of the Study's brief within its beads, deeply frozen and in a
 * fixed order: the same Study and the same content give the same solution.
 */
export function solveStudy(
  study: StudyDefinition,
  lookup: ConceptStructureLookup
): StudySolution {
  const graph = buildCarryingGraph(study.conceptIds, lookup);
  const count = studyCount(study.goal);
  const goal = study.goal;

  let solution: StudySolution;
  switch (goal.kind) {
    case "passage":
      solution = solvePassage(graph, goal, count);
      break;
    case "canon":
      solution = solveCanon(graph, goal, count, lookup);
      break;
    case "carry":
      solution = solveCarry(graph, goal, count, lookup);
      break;
    default: {
      const exhaustive: never = goal;
      return exhaustive;
    }
  }
  return cloneAndFreeze(solution);
}

/**
 * One spelling of "the same answer": the same unordered pairs, whatever order
 * or direction they were written in.
 */
export function answerKey(pairs: readonly ConceptPair[]): string {
  return pairs
    .map(([a, b]) => unorderedPairKey(a, b))
    .sort(compareStrings)
    .join("|");
}

/** Whether a line of pairs is one of the solution's answers. */
export function containsAnswer(
  solution: StudySolution,
  pairs: readonly ConceptPair[]
): boolean {
  const key = answerKey(pairs);
  return solution.answers.some((answer) => answerKey(answer) === key);
}
