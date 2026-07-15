import {
  toConceptId,
  type ConceptId,
} from "../../domain/ids";
import type { CandidateResonanceEvidence } from "../../domain/relations/resonance";
import type { ResolveCandidateEvidence } from "./createInterpretationAttentionCoordinator";

type ProvisionalFixtureClassification = "reference" | "open-thread";

interface ProvisionalFixture {
  readonly first: ConceptId;
  readonly second: ConceptId;
  readonly classification: ProvisionalFixtureClassification;
}

function fixture(
  first: string,
  second: string,
  classification: ProvisionalFixtureClassification
): ProvisionalFixture {
  return Object.freeze({
    first: toConceptId(first),
    second: toConceptId(second),
    classification,
  });
}

const PROVISIONAL_FIXTURES = Object.freeze([
  fixture("math.fibonacci-sequence", "music.counterpoint", "reference"),
  fixture("math.prime-numbers", "music.polyrhythm", "reference"),
  fixture("art.perspective", "hist.renaissance", "reference"),
  fixture("music.consonance", "music.dissonance", "reference"),
  fixture("math.abstract-algebra", "phys.energy-conservation", "reference"),
  fixture("math.fibonacci-sequence", "art.perspective", "open-thread"),
]);

function classifyPair(
  attendedConceptId: ConceptId,
  candidateId: ConceptId
): ProvisionalFixtureClassification | undefined {
  for (const candidate of PROVISIONAL_FIXTURES) {
    if (
      (candidate.first === attendedConceptId &&
        candidate.second === candidateId) ||
      (candidate.second === attendedConceptId &&
        candidate.first === candidateId)
    ) {
      return candidate.classification;
    }
  }
  return undefined;
}

function createEvidence(
  candidateId: ConceptId,
  classification: ProvisionalFixtureClassification | undefined
): CandidateResonanceEvidence {
  if (classification === "reference") {
    return Object.freeze({
      candidateId,
      facetSupport: 2,
      topologySupport: 0,
      contextSupport: 2,
      documentedRelationPresent: false,
    });
  }
  if (classification === "open-thread") {
    return Object.freeze({
      candidateId,
      facetSupport: 1,
      topologySupport: 0,
      contextSupport: 1,
      documentedRelationPresent: false,
    });
  }
  return Object.freeze({
    candidateId,
    facetSupport: 0,
    topologySupport: 0,
    contextSupport: 0,
    documentedRelationPresent: false,
  });
}

export type ResolveProvisionalCandidateEvidence = ResolveCandidateEvidence;

export const resolveProvisionalCandidateEvidence: ResolveProvisionalCandidateEvidence =
  (request) => {
    const sessionConceptIds = request.session.conceptIds;
    const evidence: CandidateResonanceEvidence[] = [];

    for (const candidateId of sessionConceptIds) {
      if (candidateId === request.attendedConceptId) continue;
      evidence.push(
        createEvidence(
          candidateId,
          classifyPair(request.attendedConceptId, candidateId)
        )
      );
    }

    return Object.freeze(evidence);
  };
