import type { ConceptId, ThreadId } from "../ids";
import { cloneAndFreeze } from "../model/immutable";
import type { SessionStateV1 } from "../model/sessionState";
import type { ConceptStructureLookup } from "../outcomes/lookup";
import { sharedFacetsOf } from "../outcomes/resolveThreadOutcome";
import { studyCount } from "./goal";
import { combinations, compareNumberLists, unorderedPairKey } from "./order";
import { solveStudy } from "./solveStudy";
import {
  FACULTY_COUNT,
  type FacetId,
  type FacultyId,
  type StudyCanonGoal,
  type StudyCarryGoal,
  type StudyDefinition,
  type StudyGoal,
  type StudyLineStep,
  type StudyMark,
  type StudyNotYet,
  type StudyPassageGoal,
  type StudySilenceExplanation,
  type StudySolution,
  type StudySolvedBySilence,
  type StudySolvedByThreads,
  type StudyStatus,
} from "./types";

/**
 * THE EVALUATOR (STUDIES-SPEC §4–§6).
 *
 * A Study's status is a pure function of the session state and the Study:
 * replaying the log reproduces it exactly, and nothing here reads a clock or a
 * random source.
 *
 * Two honesty rules hold by construction, not by care:
 *
 *  - R1. The lookup is `ConceptStructureLookup` and nothing wider, so the
 *    evaluator cannot see a documented relation, an evidence class or an Open
 *    Thread prompt. Whether a Study is solved depends on concept identity,
 *    faculty and facets — what a player reads from the beads.
 *  - R2. The session's outcomes are never read. A thread counts by the facets
 *    its beads share, whatever card it drew.
 *
 * Only carrying threads count toward the brief: threads whose beads share a
 * facet, between two of the Study's beads. Any other thread is woven and shown
 * as in the Free Game, and counts only toward the number the session used.
 */

/** A committed thread that carries something between two of the Study's beads. */
interface WovenThread {
  readonly id: ThreadId;
  /** Position in the session's creation order. */
  readonly index: number;
  readonly a: ConceptId;
  readonly b: ConceptId;
  /** What the thread carries: the facets both beads hold, sorted. */
  readonly facets: readonly FacetId[];
}

/** The player's answer, in line order: threads and the steps that read them. */
interface FoundAnswer {
  readonly threads: readonly WovenThread[];
  readonly steps: readonly StudyLineStep[];
}

const NOT_YET: StudyNotYet = Object.freeze({
  kind: "not-yet",
  statement: Object.freeze({ kind: "no-answer-yet" }),
});

const NOT_YET_CAN_BE_DONE: StudyNotYet = Object.freeze({
  kind: "not-yet",
  statement: Object.freeze({ kind: "can-be-done" }),
});

function wovenCarryingThreads(
  session: SessionStateV1,
  rank: ReadonlyMap<ConceptId, number>,
  lookup: ConceptStructureLookup
): readonly WovenThread[] {
  const woven: WovenThread[] = [];
  session.threads.forEach((thread, index) => {
    const [a, b] = thread.pair;
    if (a === b || !rank.has(a) || !rank.has(b)) return;
    const facets = sharedFacetsOf(a, b, lookup);
    if (facets.length === 0) return;
    woven.push({ id: thread.id, index, a, b, facets });
  });
  return woven;
}

/**
 * How two candidate answers are ordered: fewer threads first — the answer is
 * the least of the session's threads that meets the brief — then the one that
 * was complete first, then by creation order. A thread woven later can never
 * displace an answer of the same size, so the answer the plate shows is stable.
 */
function answerRank(threads: readonly WovenThread[]): readonly number[] {
  const indices = threads.map((thread) => thread.index).sort((a, b) => a - b);
  return [threads.length, indices[indices.length - 1] ?? -1, ...indices];
}

function step(thread: WovenThread, from: ConceptId, to: ConceptId): StudyLineStep {
  return { from, to, facets: thread.facets };
}

/** Passage: the shortest path of woven carrying threads from A to B, within N. */
function findPassage(
  goal: StudyPassageGoal,
  woven: readonly WovenThread[],
  rank: ReadonlyMap<ConceptId, number>
): FoundAnswer | null {
  const { from, to } = goal;
  if (from === to || !rank.has(from) || !rank.has(to) || goal.threads < 1) return null;

  // The earliest thread stands for its pair; a later one on the same pair adds nothing.
  const byPair = new Map<string, WovenThread>();
  const neighbours = new Map<ConceptId, ConceptId[]>();
  for (const thread of woven) {
    const key = unorderedPairKey(thread.a, thread.b);
    if (byPair.has(key)) continue;
    byPair.set(key, thread);
    neighbours.set(thread.a, [...(neighbours.get(thread.a) ?? []), thread.b]);
    neighbours.set(thread.b, [...(neighbours.get(thread.b) ?? []), thread.a]);
  }

  const threadsAlong = (beads: readonly ConceptId[]): WovenThread[] =>
    beads
      .slice(1)
      .map((bead, index) => byPair.get(unorderedPairKey(beads[index] as ConceptId, bead)))
      .filter((thread): thread is WovenThread => thread !== undefined);

  // Every simple path within the count; the paths are few, so all are kept.
  const paths: (readonly ConceptId[])[] = [];
  const path: ConceptId[] = [from];
  const extend = (bead: ConceptId): void => {
    for (const next of neighbours.get(bead) ?? []) {
      if (path.includes(next)) continue;
      path.push(next);
      if (next === to) paths.push([...path]);
      else if (path.length - 1 < goal.threads) extend(next);
      path.pop();
    }
  };
  extend(from);

  let best: { readonly beads: readonly ConceptId[]; readonly key: readonly number[] } | null =
    null;
  for (const beads of paths) {
    const key = answerRank(threadsAlong(beads));
    if (best === null || compareNumberLists(key, best.key) < 0) best = { beads, key };
  }
  if (best === null) return null;

  const beads = best.beads;
  const threads = threadsAlong(beads);
  return {
    threads,
    steps: threads.map((thread, index) =>
      step(thread, beads[index] as ConceptId, beads[index + 1] as ConceptId)
    ),
  };
}

/**
 * The fewest threads of a group joining it, preferring earlier threads
 * (Kruskal over creation order), or null when the group is not joined.
 */
function joiningThreads(
  group: readonly ConceptId[],
  threads: readonly WovenThread[]
): readonly WovenThread[] | null {
  const parent = new Map<ConceptId, ConceptId>(group.map((bead) => [bead, bead]));
  const root = (bead: ConceptId): ConceptId => {
    let current = bead;
    while (parent.get(current) !== current) current = parent.get(current) as ConceptId;
    return current;
  };
  const tree: WovenThread[] = [];
  for (const thread of threads) {
    if (!parent.has(thread.a) || !parent.has(thread.b)) continue;
    const left = root(thread.a);
    const right = root(thread.b);
    if (left === right) continue;
    parent.set(left, right);
    tree.push(thread);
  }
  return tree.length === group.length - 1 ? tree : null;
}

/**
 * A tree read as a line: from its first leaf in bead order, each thread from
 * the bead already reached to the next. A path reads end to end; a branching
 * tree reads depth first, so every step still starts where the line has been.
 */
function readAsLine(
  tree: readonly WovenThread[],
  rank: ReadonlyMap<ConceptId, number>
): FoundAnswer {
  const incident = new Map<ConceptId, WovenThread[]>();
  for (const thread of tree) {
    incident.set(thread.a, [...(incident.get(thread.a) ?? []), thread]);
    incident.set(thread.b, [...(incident.get(thread.b) ?? []), thread]);
  }
  const byRank = (a: ConceptId, b: ConceptId): number =>
    (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
  const leaves = [...incident.entries()]
    .filter(([, threads]) => threads.length === 1)
    .map(([bead]) => bead)
    .sort(byRank);
  const start = leaves[0];
  if (start === undefined) return { threads: [], steps: [] };

  const threads: WovenThread[] = [];
  const steps: StudyLineStep[] = [];
  const reached = new Set<ConceptId>([start]);
  const walk = (bead: ConceptId): void => {
    const onward = (incident.get(bead) ?? [])
      .map((thread) => ({ thread, other: thread.a === bead ? thread.b : thread.a }))
      .filter(({ other }) => !reached.has(other))
      .sort((left, right) => byRank(left.other, right.other));
    for (const { thread, other } of onward) {
      if (reached.has(other)) continue;
      reached.add(other);
      threads.push(thread);
      steps.push(step(thread, bead, other));
      walk(other);
    }
  };
  walk(start);
  return { threads, steps };
}

/**
 * Canon: the fewest woven threads that all carry F, join, and reach K
 * faculties. The group of beads is searched rather than assumed, because a
 * player's threads may need more than K − 1 of them: a line that visits one
 * faculty twice is still a canon through three, and it is the one they wove.
 */
function findCanon(
  goal: StudyCanonGoal,
  woven: readonly WovenThread[],
  rank: ReadonlyMap<ConceptId, number>,
  lookup: ConceptStructureLookup
): FoundAnswer | null {
  const carriesFacet = (bead: ConceptId): boolean =>
    lookup.conceptFacets(bead).includes(goal.facet);
  const threads = woven.filter((thread) => carriesFacet(thread.a) && carriesFacet(thread.b));
  const beads = [...new Set(threads.flatMap((thread) => [thread.a, thread.b]))].sort(
    (a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0)
  );

  for (let size = 2; size <= beads.length; size += 1) {
    let best: { readonly tree: readonly WovenThread[]; readonly key: readonly number[] } | null =
      null;
    for (const group of combinations(beads, size)) {
      const faculties = new Set(group.map((bead) => lookup.conceptFaculty(bead)));
      if (faculties.size < goal.faculties) continue;
      const tree = joiningThreads(group, threads);
      if (tree === null) continue;
      const key = answerRank(tree);
      if (best === null || compareNumberLists(key, best.key) < 0) best = { tree, key };
    }
    if (best !== null) return readAsLine(best.tree, rank);
  }
  return null;
}

/** Carry: the earliest woven thread carrying F with a bead in X, read into X. */
function findCarry(
  goal: StudyCarryGoal,
  woven: readonly WovenThread[],
  rank: ReadonlyMap<ConceptId, number>,
  lookup: ConceptStructureLookup
): FoundAnswer | null {
  const carriesFacet = (bead: ConceptId): boolean =>
    lookup.conceptFacets(bead).includes(goal.facet);
  for (const thread of woven) {
    if (!carriesFacet(thread.a) || !carriesFacet(thread.b)) continue;
    const aInto = lookup.conceptFaculty(thread.a) === goal.into;
    const bInto = lookup.conceptFaculty(thread.b) === goal.into;
    if (!aInto && !bInto) continue;
    // Read into the faculty: from the bead outside it, or in bead order when both are in it.
    const bFirst = aInto && bInto ? (rank.get(thread.b) ?? 0) < (rank.get(thread.a) ?? 0) : aInto;
    const [from, to] = bFirst ? [thread.b, thread.a] : [thread.a, thread.b];
    return { threads: [thread], steps: [step(thread, from, to)] };
  }
  return null;
}

function findAnswer(
  goal: StudyGoal,
  woven: readonly WovenThread[],
  rank: ReadonlyMap<ConceptId, number>,
  lookup: ConceptStructureLookup
): FoundAnswer | null {
  switch (goal.kind) {
    case "passage":
      return findPassage(goal, woven, rank);
    case "canon":
      return findCanon(goal, woven, rank, lookup);
    case "carry":
      return findCarry(goal, woven, rank, lookup);
    default: {
      const exhaustive: never = goal;
      return exhaustive;
    }
  }
}

/**
 * Consecutive threads are threads of the answer that meet at a bead. On a
 * passage those are neighbours along the line. On a canon every thread carries
 * the canon's facet, so a canon is never Varied — repetition is what a canon
 * is. A single thread has no neighbour, so it is not Varied either: a mark is
 * never awarded for having nothing to compare.
 */
function isVaried(threads: readonly WovenThread[]): boolean {
  if (threads.length < 2) return false;
  for (const [left, right] of combinations(threads, 2)) {
    const meet =
      left.a === right.a || left.a === right.b || left.b === right.a || left.b === right.b;
    if (!meet) continue;
    if (left.facets.some((facet) => right.facets.includes(facet))) return false;
  }
  return true;
}

function marksFor(
  found: FoundAnswer,
  count: number,
  used: number,
  lookup: ConceptStructureLookup
): readonly StudyMark[] {
  const marks: StudyMark[] = [];
  if (used === count) marks.push("economical");
  const faculties = new Set(
    found.steps.flatMap((entry) => [
      lookup.conceptFaculty(entry.from),
      lookup.conceptFaculty(entry.to),
    ])
  );
  if (faculties.size >= FACULTY_COUNT) marks.push("wide");
  if (isVaried(found.threads)) marks.push("varied");
  return marks;
}

/** Why the brief cannot be met here, in ids and counts. */
function silenceFor(
  goal: StudyGoal,
  beads: readonly ConceptId[],
  solution: StudySolution,
  lookup: ConceptStructureLookup
): StudySilenceExplanation {
  switch (goal.kind) {
    case "passage":
      return {
        kind: "passage-silence",
        from: goal.from,
        to: goal.to,
        threads: goal.threads,
        shortest: solution.shortest,
      };
    case "canon": {
      const reached: FacultyId[] = [];
      for (const bead of beads) {
        if (!lookup.conceptFacets(bead).includes(goal.facet)) continue;
        const faculty = lookup.conceptFaculty(bead);
        if (!reached.includes(faculty)) reached.push(faculty);
      }
      return { kind: "canon-silence", facet: goal.facet, faculties: goal.faculties, reached };
    }
    case "carry": {
      // With no answer, a bead of the faculty carrying the facet can only be the
      // one bead here that carries it at all.
      const lone =
        beads.find(
          (bead) =>
            lookup.conceptFaculty(bead) === goal.into &&
            lookup.conceptFacets(bead).includes(goal.facet)
        ) ?? null;
      return { kind: "carry-silence", facet: goal.facet, into: goal.into, lone };
    }
    default: {
      const exhaustive: never = goal;
      return exhaustive;
    }
  }
}

/**
 * The Study's status for this session.
 *
 * Threads first: when the woven carrying threads meet the brief, the Study is
 * solved by them, however many other threads the session holds. Otherwise a
 * declared silence is tested against the solver: with no answer anywhere in the
 * beads it solves the Study and says why; with an answer it is *not yet*, and
 * the statement says only that it can be done with these beads.
 *
 * `declaredSilence` is the ephemeral declaration (STUDIES-SPEC §8); it is never
 * logged, so it is an argument rather than session state.
 */
export function evaluateStudy(
  session: SessionStateV1,
  study: StudyDefinition,
  lookup: ConceptStructureLookup,
  declaredSilence: boolean
): StudyStatus {
  const beads = [...new Set(study.conceptIds)];
  const rank = new Map<ConceptId, number>();
  beads.forEach((bead, index) => rank.set(bead, index));
  const count = studyCount(study.goal);

  const found = findAnswer(
    study.goal,
    wovenCarryingThreads(session, rank, lookup),
    rank,
    lookup
  );
  if (found !== null) {
    const solved: StudySolvedByThreads = {
      kind: "solved",
      by: "threads",
      threadIds: found.threads.map((thread) => thread.id),
      marks: marksFor(found, count, session.threads.length, lookup),
      explanation: {
        kind: "line",
        steps: found.steps,
        count,
        used: session.threads.length,
      },
    };
    return cloneAndFreeze(solved);
  }

  if (!declaredSilence) return NOT_YET;

  const solution = solveStudy(study, lookup);
  if (solution.answers.length > 0) return NOT_YET_CAN_BE_DONE;

  const silence: StudySolvedBySilence = {
    kind: "solved",
    by: "silence",
    threadIds: [],
    marks: [],
    explanation: silenceFor(study.goal, beads, solution, lookup),
  };
  return cloneAndFreeze(silence);
}
