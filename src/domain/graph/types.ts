import type { ConceptPair, RelationIntention } from "../events";
import type { ConceptId, ThreadId } from "../ids";
import type { FacultyId } from "@/content/castalia/schema";

/**
 * TOPOLOGY OF A WOVEN WEB.
 *
 * These selectors are read by the world, the camera, the orchestration, the
 * portrait, the annotation, and the conclusion compiler, so three properties
 * matter more than elegance:
 *
 *  - **Total.** Every field is defined for an empty session, a single bead, a
 *    forest, a multigraph with parallel threads, and a fully connected web.
 *    Nothing throws.
 *  - **Deterministic.** Iteration follows session concept order and thread
 *    creation order everywhere, so two replays produce identical structures
 *    down to array order.
 *  - **Cheap.** At slice scale (≤ 24 concepts, ≤ 45 threads) the exact
 *    algorithms below cost microseconds, so clarity was chosen over asymptotics
 *    wherever the two disagreed. `accreteWeb` covers the incremental case.
 *
 * Multiplicity convention: `degree` counts *distinct neighbours* and
 * `threadCount` counts *incident threads*. Two threads over the same pair are
 * two threads and one edge — connectivity, cycles, and bridges use the simple
 * graph, while musical and dramatic weight uses the thread count.
 */
export interface ConceptNodeTopology {
  readonly conceptId: ConceptId;
  readonly faculty: FacultyId;
  /** Distinct neighbouring concepts. */
  readonly degree: number;
  /** Incident threads, including parallel threads on one pair. */
  readonly threadCount: number;
  /** Neighbours in session order. */
  readonly neighbourIds: readonly ConceptId[];
  /** Incident threads in creation order. */
  readonly threadIds: readonly ThreadId[];
  /** Faculties reachable in one step, in canonical faculty order. */
  readonly neighbourFaculties: readonly FacultyId[];
  /** Index into `SessionTopology.components`; `-1` when the concept is unwoven. */
  readonly componentIndex: number;
  /** `degree / (wovenCount - 1)`, or 0 when fewer than two concepts are woven. */
  readonly degreeCentrality: number;
  /** Normalised Brandes betweenness over the woven simple graph. */
  readonly betweenness: number;
  /** `0.4 · degreeCentrality + 0.6 · betweenness`. Structural, not evaluative. */
  readonly centrality: number;
  /** Removing this concept increases the number of connected components. */
  readonly isArticulation: boolean;
}

export interface ThreadEdgeTopology {
  readonly threadId: ThreadId;
  readonly pair: ConceptPair;
  readonly intention: RelationIntention;
  /** Creation index, 0-based. */
  readonly order: number;
  /** Sequence of the committing event. */
  readonly sequence: number;
  /** Endpoints sit in different faculties. */
  readonly isFacultyCrossing: boolean;
  /**
   * Removing this thread disconnects its endpoints. False when a parallel
   * thread over the same pair would still hold them together.
   */
  readonly isGraphBridge: boolean;
  /** Another thread already joined the same pair. */
  readonly isParallel: boolean;
  /** Both endpoints are the same concept. Excluded from adjacency. */
  readonly isSelfPair: boolean;
}

export interface ConceptComponent {
  readonly index: number;
  /** Concepts in session order. */
  readonly conceptIds: readonly ConceptId[];
  /** Threads whose endpoints both sit in this component, in creation order. */
  readonly threadIds: readonly ThreadId[];
  /** Faculties present, in canonical faculty order. */
  readonly faculties: readonly FacultyId[];
  /** `edges - vertices + 1`: independent cycles inside this component. */
  readonly circuitRank: number;
}

/** A cycle as an ordered walk of concepts; the closing edge returns to `[0]`. */
export interface ConceptCycle {
  readonly conceptIds: readonly ConceptId[];
  readonly length: number;
}

/** A triangle, always in ascending session order. */
export interface ConceptTriad {
  readonly conceptIds: readonly [ConceptId, ConceptId, ConceptId];
}

export interface FacultySpread {
  /** Faculties carrying at least one woven concept, canonical order. */
  readonly presentFaculties: readonly FacultyId[];
  readonly wovenByFaculty: Readonly<Record<FacultyId, number>>;
  readonly threadsByFaculty: Readonly<Record<FacultyId, number>>;
  /** Threads whose endpoints sit in different faculties. */
  readonly crossingThreadCount: number;
  /** `crossingThreadCount / threadCount`, 0 when nothing is woven. */
  readonly crossingShare: number;
  /** Normalised Shannon entropy of woven concepts over faculties, 0–1. */
  readonly spread: number;
}

export interface IntentionMix {
  readonly counts: Readonly<Record<RelationIntention, number>>;
  readonly shares: Readonly<Record<RelationIntention, number>>;
  readonly distinctCount: number;
  /** Highest count; ties broken by canonical intention order. Null when empty. */
  readonly dominant: RelationIntention | null;
  readonly dominantIsTied: boolean;
  /** Normalised Shannon entropy over the four intentions, 0–1. */
  readonly balance: number;
}

export interface SessionTopology {
  /** Every session concept, in session order. */
  readonly conceptIds: readonly ConceptId[];
  /** Concepts carrying at least one thread, in session order. */
  readonly wovenConceptIds: readonly ConceptId[];
  /** Session concepts no thread has touched, in session order. */
  readonly untouchedConceptIds: readonly ConceptId[];
  readonly nodes: readonly ConceptNodeTopology[];
  readonly edges: readonly ThreadEdgeTopology[];
  readonly components: readonly ConceptComponent[];
  readonly componentCount: number;
  /** Fundamental cycles of the woven simple graph. */
  readonly cycles: readonly ConceptCycle[];
  /** Every triangle, ascending session order, deduplicated. */
  readonly triads: readonly ConceptTriad[];
  readonly facultySpread: FacultySpread;
  readonly intentionMix: IntentionMix;
  readonly threadCount: number;
  /** Distinct pairs joined, ignoring parallel threads and self-pairs. */
  readonly edgeCount: number;
  readonly maxDegree: number;
  /** `edges - vertices + components`: independent cycles across the whole web. */
  readonly circuitRank: number;
  /** Edges over the complete-graph maximum for the woven concepts, 0–1. */
  readonly density: number;
  /** How much of the web hangs together: connectedness with closure, 0–1. */
  readonly coherence: number;
  /** How much is still hanging loose: leaves and untouched beads, 0–1. */
  readonly openness: number;
  /** Declared Tension weighted by how little of it a third concept holds, 0–1. */
  readonly tensionLoad: number;
}

/** One step of the web's growth, produced in thread creation order. */
export interface WebAccretionStep {
  readonly threadId: ThreadId;
  readonly order: number;
  readonly sequence: number;
  readonly wovenCount: number;
  readonly edgeCount: number;
  readonly componentCount: number;
  /** Threads per woven concept, normalised against a fully joined web, 0–1. */
  readonly density: number;
  /** This thread joined two previously separate components. */
  readonly joinedComponents: boolean;
  /** Both endpoints already sat in the same component: the thread closed a loop. */
  readonly closedCycle: boolean;
  /** Both endpoints already carried a thread before this one. */
  readonly bothEndpointsAlreadyWoven: boolean;
  /** Endpoints sit in different faculties. */
  readonly isFacultyCrossing: boolean;
}
