/**
 * CANDIDATE RESONANCE EVIDENCE — the honest version.
 *
 * This replaces a placeholder that classified six hardcoded concept pairs and
 * hardwired `topologySupport: 0`. That placeholder had two problems worth
 * naming, because they explain every rule below.
 *
 * First, it was a hidden-answer list wearing a resonance costume. A pair glowed
 * because an author had written it down. This one glows because the two ideas
 * genuinely share structure, which is a fact about the concepts and not a fact
 * about the answer key.
 *
 * Second, it made the bands uncalibrated in a way no test could catch: with
 * topology pinned at zero the reachable support range was 0–4, while the bands
 * were written for 0–6. Real values had to arrive together with re-derived
 * thresholds, so this file and the band assertions in its test are a single
 * change.
 *
 * CAV-003 governs the inputs: reviewed facet/structural support, documented
 * presence *without endpoint disclosure*, session topology, and current web
 * context — never raw authored tier, never source count, and never a binary
 * known-pair flag on its own. The band function already enforces the last one
 * by refusing to count the documented bonus unless generative support is
 * non-zero, which is why a documented pair with no shared structure still reads
 * weak. That is correct: it means the preview cannot be farmed as an oracle.
 */
import type { ConceptId } from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";
import type {
  CandidateResonanceEvidence,
  ResonanceSupportLevel,
} from "../../domain/relations/resonance";
import type { FacetId } from "../../content/castalia/schema";
import type { ResolveCandidateEvidence } from "./createInterpretationAttentionCoordinator";

/** Everything this resolver needs from the content pack, and nothing more. */
export interface CastaliaResonanceLookup {
  readonly conceptFacets: (conceptId: ConceptId) => readonly FacetId[];
  readonly conceptFaculty: (conceptId: ConceptId) => string | null;
  readonly hasDocumentedRelation: (a: ConceptId, b: ConceptId) => boolean;
}

/**
 * A facet carried by at most this many concepts in the current draw counts as
 * distinctive. Sharing `recursion` when two beads have it says far more than
 * sharing `periodicity` when six do — so rarity within the draw, not rarity in
 * the pack, is what makes a correspondence feel pointed.
 */
const DISTINCTIVE_MAX_HOLDERS = 3;

const clamp2 = (value: number): ResonanceSupportLevel =>
  (value <= 0 ? 0 : value >= 2 ? 2 : 1) as ResonanceSupportLevel;

interface Neighbourhood {
  readonly neighbours: ReadonlyMap<ConceptId, ReadonlySet<ConceptId>>;
  readonly facultyOf: ReadonlyMap<ConceptId, string>;
  /** Component root per concept, so joining two components is detectable. */
  readonly component: ReadonlyMap<ConceptId, ConceptId>;
  readonly facetHolders: ReadonlyMap<FacetId, number>;
  readonly liveFacets: ReadonlySet<FacetId>;
}

function buildNeighbourhood(
  session: SessionStateV1,
  lookup: CastaliaResonanceLookup
): Neighbourhood {
  const neighbours = new Map<ConceptId, Set<ConceptId>>();
  const facultyOf = new Map<ConceptId, string>();
  const facetHolders = new Map<FacetId, number>();

  for (const conceptId of session.conceptIds) {
    neighbours.set(conceptId, new Set());
    const faculty = lookup.conceptFaculty(conceptId);
    if (faculty !== null) facultyOf.set(conceptId, faculty);
    for (const facet of lookup.conceptFacets(conceptId)) {
      facetHolders.set(facet, (facetHolders.get(facet) ?? 0) + 1);
    }
  }

  for (const thread of session.threads) {
    neighbours.get(thread.pair[0])?.add(thread.pair[1]);
    neighbours.get(thread.pair[1])?.add(thread.pair[0]);
  }

  // Union-find would be overkill for a dozen beads; a flood fill is clearer.
  const component = new Map<ConceptId, ConceptId>();
  for (const conceptId of session.conceptIds) {
    if (component.has(conceptId)) continue;
    const stack = [conceptId];
    while (stack.length > 0) {
      const current = stack.pop() as ConceptId;
      if (component.has(current)) continue;
      component.set(current, conceptId);
      for (const next of neighbours.get(current) ?? []) {
        if (!component.has(next)) stack.push(next);
      }
    }
  }

  /**
   * A facet is "live" once the player has already woven two concepts that carry
   * it. This is what makes the arena answer to what the player is building
   * rather than to a fixed table — the same bead reads differently in two
   * different sessions, which is the whole point of an instrument.
   */
  const facetCounts = new Map<FacetId, number>();
  const threaded = new Set<ConceptId>();
  for (const thread of session.threads) {
    threaded.add(thread.pair[0]);
    threaded.add(thread.pair[1]);
  }
  for (const conceptId of threaded) {
    for (const facet of lookup.conceptFacets(conceptId)) {
      facetCounts.set(facet, (facetCounts.get(facet) ?? 0) + 1);
    }
  }
  const liveFacets = new Set<FacetId>();
  for (const [facet, count] of facetCounts) {
    if (count >= 2) liveFacets.add(facet);
  }

  return { neighbours, facultyOf, component, facetHolders, liveFacets };
}

export function createCastaliaCandidateEvidenceResolver(
  lookup: CastaliaResonanceLookup
): ResolveCandidateEvidence {
  return (request) => {
    const session = request.session;
    const context = buildNeighbourhood(session, lookup);
    const attended = request.attendedConceptId;
    const attendedFacets = new Set(lookup.conceptFacets(attended));
    const attendedNeighbours = context.neighbours.get(attended) ?? new Set();
    const attendedFaculty = context.facultyOf.get(attended);
    const attendedComponent = context.component.get(attended);

    const evidence: CandidateResonanceEvidence[] = [];

    for (const candidateId of session.conceptIds) {
      if (candidateId === attended) continue;

      const candidateFacets = lookup.conceptFacets(candidateId);
      const shared = candidateFacets.filter((facet) => attendedFacets.has(facet));

      // ── Facet support: do these two ideas actually share structure? ──────
      const facetSupport = clamp2(shared.length);

      // ── Context support: is this correspondence pointed, and is it live? ──
      const candidateFaculty = context.facultyOf.get(candidateId);
      const crossFaculty =
        attendedFaculty !== undefined &&
        candidateFaculty !== undefined &&
        attendedFaculty !== candidateFaculty;
      const distinctive = shared.some(
        (facet) => (context.facetHolders.get(facet) ?? 0) <= DISTINCTIVE_MAX_HOLDERS
      );
      const live = shared.some((facet) => context.liveFacets.has(facet));
      // A correspondence with no shared structure gets no context credit, so a
      // merely cross-faculty pairing can never climb on novelty alone.
      const contextSupport =
        shared.length === 0
          ? 0
          : clamp2(
              (crossFaculty ? 1 : 0) + (distinctive ? 1 : 0) + (live ? 1 : 0)
            );

      // ── Topology support: what would committing this actually do? ────────
      // Silent at session start, which is honest — topology has nothing to say
      // about an empty web.
      const candidateNeighbours = context.neighbours.get(candidateId) ?? new Set();
      let sharedNeighbour = false;
      for (const neighbour of candidateNeighbours) {
        if (attendedNeighbours.has(neighbour)) {
          sharedNeighbour = true;
          break;
        }
      }
      const candidateComponent = context.component.get(candidateId);
      const joinsComponents =
        attendedComponent !== undefined &&
        candidateComponent !== undefined &&
        attendedComponent !== candidateComponent &&
        (attendedNeighbours.size > 0 || candidateNeighbours.size > 0);
      const topologySupport = clamp2(
        (sharedNeighbour ? 1 : 0) + (joinsComponents ? 1 : 0)
      );

      evidence.push(
        Object.freeze({
          candidateId,
          facetSupport,
          topologySupport,
          contextSupport,
          // Never surfaced on its own — the band function refuses to count it
          // unless generative support is already non-zero, so this cannot leak
          // an endpoint list.
          documentedRelationPresent: lookup.hasDocumentedRelation(
            attended,
            candidateId
          ),
        })
      );
    }

    return Object.freeze(evidence);
  };
}
