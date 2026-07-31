import type { RelationIntention } from "../events";
import { buildTopology } from "../graph/buildTopology";
import type { SessionTopology } from "../graph/types";
import type { ConceptId } from "../ids";
import type { CommittedThreadV1, SessionStateV1 } from "../model/sessionState";
import type { RelationLookup } from "../outcomes/lookup";
import {
  INTENTION_LABELS,
  RELATION_TYPE_GLOSS,
  compareStrings,
  facultyLabel,
  formatList,
  pluralise,
} from "../outcomes/prose";
import type { FacetId, FacultyId, RelationType } from "@/content/castalia/schema";
import type { MotifDetection, MotifKind } from "./types";

/**
 * Relation types that let a third concept genuinely *hold* an opposition. A
 * structural correspondence between the third concept and one pole does not:
 * noticing that two things rhyme is not the same as explaining why a conflict
 * takes the shape it does.
 */
const GROUNDING_RELATION_TYPES: ReadonlySet<RelationType> = new Set([
  "formal-ground",
  "material-ground",
  "instantiation",
]);
const REFRAMING_RELATION_TYPES: ReadonlySet<RelationType> = new Set(["reframing"]);

interface Adjacency {
  readonly order: readonly ConceptId[];
  readonly neighbours: ReadonlyMap<ConceptId, readonly ConceptId[]>;
  readonly rank: ReadonlyMap<ConceptId, number>;
}

function buildAdjacency(topology: SessionTopology): Adjacency {
  const neighbours = new Map<ConceptId, readonly ConceptId[]>();
  const rank = new Map<ConceptId, number>();
  topology.conceptIds.forEach((conceptId, index) => rank.set(conceptId, index));
  for (const node of topology.nodes) neighbours.set(node.conceptId, node.neighbourIds);
  return { order: topology.wovenConceptIds, neighbours, rank };
}

/** Components of the woven graph with one vertex or one edge removed. */
function componentsExcluding(
  adjacency: Adjacency,
  members: readonly ConceptId[],
  excludedConcept: ConceptId | null,
  excludedEdge: readonly [ConceptId, ConceptId] | null
): readonly (readonly ConceptId[])[] {
  const allowed = new Set(members.filter((id) => id !== excludedConcept));
  const seen = new Set<ConceptId>();
  const components: ConceptId[][] = [];

  const blocked = (a: ConceptId, b: ConceptId): boolean =>
    excludedEdge !== null &&
    ((excludedEdge[0] === a && excludedEdge[1] === b) ||
      (excludedEdge[0] === b && excludedEdge[1] === a));

  for (const start of members) {
    if (!allowed.has(start) || seen.has(start)) continue;
    const component: ConceptId[] = [];
    const queue: ConceptId[] = [start];
    seen.add(start);
    while (queue.length > 0) {
      const current = queue.shift() as ConceptId;
      component.push(current);
      for (const neighbour of adjacency.neighbours.get(current) ?? []) {
        if (!allowed.has(neighbour) || seen.has(neighbour)) continue;
        if (blocked(current, neighbour)) continue;
        seen.add(neighbour);
        queue.push(neighbour);
      }
    }
    components.push(component);
  }

  return components;
}

function facultiesOf(
  conceptIds: readonly ConceptId[],
  lookup: Pick<RelationLookup, "conceptFaculty">
): readonly FacultyId[] {
  const set = new Set<FacultyId>();
  for (const conceptId of conceptIds) set.add(lookup.conceptFaculty(conceptId));
  return [...set].sort(compareStrings);
}

function facultyPhrase(faculties: readonly FacultyId[]): string {
  return formatList(faculties.map(facultyLabel));
}

/**
 * Two regions are *separate faculty regions* only when they have no faculty in
 * common. Overlap is the difference between a bridge and a twig: cutting the
 * one thread that holds a Measure leaf to a Measure/Sound web disconnects the
 * graph, but it does not separate one faculty region from another, so it is not
 * a Bridge no matter how central the cut makes it look.
 */
function areDisjoint(
  left: readonly FacultyId[],
  right: readonly FacultyId[]
): boolean {
  const set = new Set(left);
  return right.every((faculty) => !set.has(faculty));
}

function sortByRank(
  conceptIds: readonly ConceptId[],
  adjacency: Adjacency
): readonly ConceptId[] {
  return [...conceptIds].sort(
    (a, b) => (adjacency.rank.get(a) ?? 0) - (adjacency.rank.get(b) ?? 0)
  );
}

function threadsOnPair(
  state: SessionStateV1,
  a: ConceptId,
  b: ConceptId
): readonly CommittedThreadV1[] {
  return state.threads.filter(
    (thread) =>
      (thread.pair[0] === a && thread.pair[1] === b) ||
      (thread.pair[0] === b && thread.pair[1] === a)
  );
}

function maxSequence(threads: readonly CommittedThreadV1[]): number {
  return threads.reduce((max, thread) => Math.max(max, thread.sequence), 0);
}

interface Holding {
  readonly thread: CommittedThreadV1;
  readonly verb: "grounded" | "reframed";
  readonly detail: string;
}

/**
 * Does this thread let its third concept hold one pole of a Tension? The test
 * reads *both* what the player declared and what the pack documents, so a
 * player-declared Ground counts, and so does an undeclared Ground that the
 * content pack actually records.
 */
function holdingOf(
  thread: CommittedThreadV1,
  third: ConceptId,
  lookup: RelationLookup
): Holding | null {
  const other = thread.pair[0] === third ? thread.pair[1] : thread.pair[0];
  const thirdName = lookup.conceptName(third);
  const otherName = lookup.conceptName(other);

  if (thread.intention === "ground" || thread.intention === "passage") {
    return {
      thread,
      verb: thread.intention === "ground" ? "grounded" : "reframed",
      detail: `your ${INTENTION_LABELS[thread.intention]} thread from ${thirdName} to ${otherName}`,
    };
  }

  const relation = lookup.findRelation(thread.pair[0], thread.pair[1]);
  if (relation === null) return null;
  if (GROUNDING_RELATION_TYPES.has(relation.relationType)) {
    return {
      thread,
      verb: "grounded",
      detail: `the documented ${RELATION_TYPE_GLOSS[relation.relationType].replace(/^an? /, "")} between ${thirdName} and ${otherName}`,
    };
  }
  if (REFRAMING_RELATION_TYPES.has(relation.relationType)) {
    return {
      thread,
      verb: "reframed",
      detail: `the documented reframing between ${thirdName} and ${otherName}`,
    };
  }
  return null;
}

function detectDialectics(
  state: SessionStateV1,
  topology: SessionTopology,
  adjacency: Adjacency,
  lookup: RelationLookup
): readonly MotifDetection[] {
  const detections: MotifDetection[] = [];

  for (const triad of topology.triads) {
    const [first, second, third] = triad.conceptIds;
    const arrangements: readonly (readonly [ConceptId, ConceptId, ConceptId])[] = [
      [first, second, third],
      [first, third, second],
      [second, third, first],
    ];

    for (const [x, y, z] of arrangements) {
      const tensions = threadsOnPair(state, x, y).filter(
        (thread) => thread.intention === "tension"
      );
      if (tensions.length === 0) continue;

      const supports = [...threadsOnPair(state, z, x), ...threadsOnPair(state, z, y)].sort(
        (a, b) => a.sequence - b.sequence
      );
      const holdings = supports
        .map((thread) => holdingOf(thread, z, lookup))
        .filter((holding): holding is Holding => holding !== null);
      if (holdings.length === 0) continue;

      const holding = holdings[0] as Holding;
      const threads = [...tensions, ...supports].sort((a, b) => a.sequence - b.sequence);
      const conceptIds = sortByRank([x, y, z], adjacency);

      detections.push(
        Object.freeze({
          kind: "dialectic" as const,
          key: `dialectic:${sortByRank([x, y], adjacency).join("|")}|${z}`,
          conceptIds: Object.freeze(conceptIds),
          threadIds: Object.freeze(threads.map((thread) => thread.id)),
          focusConceptId: z,
          focusThreadId: (tensions[0] as CommittedThreadV1).id,
          facetId: null,
          completedAtSequence: maxSequence(threads),
          reason: `The Tension between ${lookup.conceptName(x)} and ${lookup.conceptName(y)} is ${holding.verb} by ${lookup.conceptName(z)}, through ${holding.detail}.`,
        })
      );
    }
  }

  return detections;
}

function detectCanons(
  state: SessionStateV1,
  topology: SessionTopology,
  adjacency: Adjacency,
  lookup: RelationLookup
): readonly MotifDetection[] {
  const carriersByFacet = new Map<FacetId, ConceptId[]>();
  for (const conceptId of topology.wovenConceptIds) {
    for (const facet of lookup.conceptFacets(conceptId)) {
      const carriers = carriersByFacet.get(facet);
      if (carriers === undefined) carriersByFacet.set(facet, [conceptId]);
      else carriers.push(conceptId);
    }
  }

  const detections: MotifDetection[] = [];
  const facets = [...carriersByFacet.keys()].sort(compareStrings);

  for (const facet of facets) {
    const carriers = carriersByFacet.get(facet) ?? [];
    if (carriers.length < 3) continue;

    const carrierSet = new Set(carriers);
    const connectingThreads = state.threads.filter(
      (thread) =>
        thread.pair[0] !== thread.pair[1] &&
        carrierSet.has(thread.pair[0]) &&
        carrierSet.has(thread.pair[1])
    );
    if (connectingThreads.length < 2) continue;

    /*
     * Carriers only count as a Canon when the threads actually run between
     * them: three beads that happen to share a facet but were never woven to
     * one another are a coincidence of the draw, not a recurrence in the web.
     */
    const restricted: Adjacency = {
      order: carriers,
      rank: adjacency.rank,
      neighbours: new Map(
        carriers.map((conceptId) => [
          conceptId,
          (adjacency.neighbours.get(conceptId) ?? []).filter((neighbour) =>
            carrierSet.has(neighbour)
          ),
        ])
      ),
    };

    for (const component of componentsExcluding(restricted, carriers, null, null)) {
      if (component.length < 3) continue;
      const memberSet = new Set(component);
      const threads = connectingThreads.filter(
        (thread) => memberSet.has(thread.pair[0]) && memberSet.has(thread.pair[1])
      );
      if (threads.length < 2) continue;

      const intentions = new Set<RelationIntention>(
        threads.map((thread) => thread.intention)
      );
      const faculties = facultiesOf(component, lookup);
      const transformsByFaculty = faculties.length >= 2;
      const transformsByIntention = intentions.size >= 2;
      if (!transformsByFaculty && !transformsByIntention) continue;

      const clauses: string[] = [];
      if (transformsByFaculty) clauses.push(`it crosses ${facultyPhrase(faculties)}`);
      if (transformsByIntention) {
        clauses.push(
          `you read it as ${formatList(
            [...intentions]
              .sort(compareStrings)
              .map((intention) => INTENTION_LABELS[intention])
          )}`
        );
      }

      const ordered = sortByRank(component, adjacency);
      detections.push(
        Object.freeze({
          kind: "canon" as const,
          key: `canon:${facet}:${ordered.join("+")}`,
          conceptIds: Object.freeze(ordered),
          threadIds: Object.freeze(threads.map((thread) => thread.id)),
          focusConceptId: null,
          focusThreadId: null,
          facetId: facet,
          completedAtSequence: maxSequence(threads),
          reason: `${lookup.facetName(facet)} recurs through ${formatList(
            ordered.map((conceptId) => lookup.conceptName(conceptId))
          )}, transformed rather than repeated — ${formatList(clauses)}.`,
        })
      );
    }
  }

  return detections;
}

function detectBridges(
  state: SessionStateV1,
  topology: SessionTopology,
  adjacency: Adjacency,
  lookup: RelationLookup
): readonly MotifDetection[] {
  const detections: MotifDetection[] = [];

  for (const node of topology.nodes) {
    if (!node.isArticulation) continue;
    // Structural centrality is not enough: the concept must itself reach into
    // more than one faculty, or it is merely a link in a single-faculty chain.
    if (node.neighbourFaculties.length < 2) continue;

    /**
     * Only this concept's own component may supply the regions it bridges.
     *
     * This previously passed every woven concept in the session, so two regions
     * belonging to entirely *different* connected components could be picked as
     * the two sides of a crossing — and the web is fragmented for most of a
     * session, so that was the common case rather than a corner one. The Game
     * would then state, as a structural finding, that removing a concept made
     * two faculties "fall away" from a third that had never been attached to
     * anything. Product law 8: silence is preferable to fabricated significance.
     */
    const component = topology.components[node.componentIndex];
    if (component === undefined) continue;
    const members = component.conceptIds;

    const regions = componentsExcluding(adjacency, members, node.conceptId, null).map(
      (piece) => facultiesOf(piece, lookup)
    );
    let left: readonly FacultyId[] | null = null;
    let right: readonly FacultyId[] | null = null;
    for (let i = 0; i < regions.length && left === null; i += 1) {
      for (let j = i + 1; j < regions.length; j += 1) {
        const a = regions[i] as readonly FacultyId[];
        const b = regions[j] as readonly FacultyId[];
        if (areDisjoint(a, b)) {
          left = a;
          right = b;
          break;
        }
      }
    }
    if (left === null || right === null) continue;

    const threads = state.threads.filter(
      (thread) =>
        thread.pair[0] === node.conceptId || thread.pair[1] === node.conceptId
    );
    const conceptIds = sortByRank(
      [node.conceptId, ...node.neighbourIds],
      adjacency
    );

    detections.push(
      Object.freeze({
        kind: "bridge" as const,
        key: `bridge:concept:${node.conceptId}`,
        conceptIds: Object.freeze(conceptIds),
        threadIds: Object.freeze(threads.map((thread) => thread.id)),
        focusConceptId: node.conceptId,
        focusThreadId: null,
        facetId: null,
        completedAtSequence: maxSequence(threads),
        reason: `${lookup.conceptName(node.conceptId)} is the only crossing here: remove it and ${facultyPhrase(
          left
        )} ${pluralise(left.length, "falls", "fall")} away from ${facultyPhrase(right)}.`,
      })
    );
  }

  for (const edge of topology.edges) {
    if (!edge.isGraphBridge) continue;
    // Same confinement as above: a thread can only bridge regions inside the
    // component it belongs to.
    const endpoint = topology.nodes.find(
      (node) => node.conceptId === edge.pair[0]
    );
    const edgeComponent =
      endpoint === undefined ? undefined : topology.components[endpoint.componentIndex];
    if (edgeComponent === undefined) continue;
    const pieces = componentsExcluding(adjacency, edgeComponent.conceptIds, null, [
      edge.pair[0],
      edge.pair[1],
    ]);
    const sideA = pieces.find((piece) => piece.includes(edge.pair[0]));
    const sideB = pieces.find((piece) => piece.includes(edge.pair[1]));
    if (sideA === undefined || sideB === undefined) continue;
    /*
     * A thread joining exactly two beads is the whole web, not a bridge across
     * it. "Structurally central" requires something on at least one side for
     * the thread to be central between.
     */
    if (sideA.length + sideB.length < 3) continue;

    const facultiesA = facultiesOf(sideA, lookup);
    const facultiesB = facultiesOf(sideB, lookup);
    if (!areDisjoint(facultiesA, facultiesB)) continue;

    const thread = state.threads.find((entry) => entry.id === edge.threadId);
    if (thread === undefined) continue;

    detections.push(
      Object.freeze({
        kind: "bridge" as const,
        key: `bridge:thread:${edge.threadId}`,
        conceptIds: Object.freeze(sortByRank([edge.pair[0], edge.pair[1]], adjacency)),
        threadIds: Object.freeze([edge.threadId]),
        focusConceptId: null,
        focusThreadId: edge.threadId,
        facetId: null,
        completedAtSequence: thread.sequence,
        reason: `The ${INTENTION_LABELS[edge.intention]} between ${lookup.conceptName(
          edge.pair[0]
        )} and ${lookup.conceptName(
          edge.pair[1]
        )} is the only thread holding ${facultyPhrase(facultiesA)} to ${facultyPhrase(
          facultiesB
        )}.`,
      })
    );
  }

  return detections;
}

const KIND_ORDER: Readonly<Record<MotifKind, number>> = Object.freeze({
  dialectic: 0,
  canon: 1,
  bridge: 2,
});

/**
 * Every motif currently true of this web, in the order they became true.
 *
 * Pure and deterministic: identical state and identical content always yield an
 * identical array, key for key and word for word. Nothing here reads the clock,
 * and nothing here awards anything.
 */
export function detectMotifs(
  state: SessionStateV1,
  lookup: RelationLookup
): readonly MotifDetection[] {
  const topology = buildTopology(state, lookup);
  const adjacency = buildAdjacency(topology);

  const detections = [
    ...detectDialectics(state, topology, adjacency, lookup),
    ...detectCanons(state, topology, adjacency, lookup),
    ...detectBridges(state, topology, adjacency, lookup),
  ];

  const unique = new Map<string, MotifDetection>();
  for (const detection of detections) {
    if (!unique.has(detection.key)) unique.set(detection.key, detection);
  }

  return Object.freeze(
    [...unique.values()].sort((a, b) => {
      if (a.completedAtSequence !== b.completedAtSequence) {
        return a.completedAtSequence - b.completedAtSequence;
      }
      if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) {
        return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
      }
      return compareStrings(a.key, b.key);
    })
  );
}

/** Identity used to match a detection against an already recorded completion. */
export function motifCompletionKey(
  kind: string,
  conceptIds: readonly ConceptId[]
): string {
  return `${kind}:${[...conceptIds].sort(compareStrings).join("+")}`;
}

/**
 * Detections the session has not already recorded a `motif.completed` event
 * for. The runtime publishes these; the domain never publishes anything.
 */
export function detectNewMotifs(
  state: SessionStateV1,
  lookup: RelationLookup
): readonly MotifDetection[] {
  const recorded = new Set(
    state.completedMotifs.map((motif) =>
      motifCompletionKey(motif.motifKindId, motif.conceptIds)
    )
  );
  return Object.freeze(
    detectMotifs(state, lookup).filter(
      (detection) =>
        !recorded.has(motifCompletionKey(detection.kind, detection.conceptIds))
    )
  );
}
