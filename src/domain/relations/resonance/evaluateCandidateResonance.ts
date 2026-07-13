import type { ConceptId } from "../../ids";
import {
  CandidateResonanceError,
  type CandidateResonanceErrorCode,
} from "./CandidateResonanceError";
import type {
  CandidateResonance,
  CandidateResonanceEvidence,
  CandidateResonanceRequest,
  ResonanceBand,
  ResonanceSupportLevel,
} from "./types";

function fail(code: CandidateResonanceErrorCode, message: string): never {
  throw new CandidateResonanceError(code, message);
}

function isConceptId(value: unknown): value is ConceptId {
  return typeof value === "string" && value.trim().length > 0;
}

function isSupportLevel(value: unknown): value is ResonanceSupportLevel {
  return value === 0 || value === 1 || value === 2;
}

function validateSession(request: CandidateResonanceRequest): ReadonlySet<ConceptId> {
  if (!Array.isArray(request.sessionConceptIds) || request.sessionConceptIds.length < 2) {
    return fail(
      "invalid-session-concepts",
      "candidate resonance requires at least two session concepts"
    );
  }

  const sessionConcepts = new Set<ConceptId>();
  for (const conceptId of request.sessionConceptIds) {
    if (!isConceptId(conceptId) || sessionConcepts.has(conceptId)) {
      return fail(
        "invalid-session-concepts",
        "session concepts must be unique valid concept identifiers"
      );
    }
    sessionConcepts.add(conceptId);
  }

  if (!isConceptId(request.attendedConceptId) || !sessionConcepts.has(request.attendedConceptId)) {
    return fail(
      "attended-concept-not-in-session",
      "the attended concept must belong to the session"
    );
  }

  return sessionConcepts;
}

function validateEvidence(evidence: CandidateResonanceEvidence): void {
  if (
    !isSupportLevel(evidence.facetSupport) ||
    !isSupportLevel(evidence.topologySupport) ||
    !isSupportLevel(evidence.contextSupport)
  ) {
    fail(
      "invalid-support-level",
      "candidate support levels must be exactly 0, 1, or 2"
    );
  }

  if (typeof evidence.documentedRelationPresent !== "boolean") {
    fail(
      "invalid-documented-relation-presence",
      "documented relation presence must be a boolean"
    );
  }
}

function indexCandidates(
  request: CandidateResonanceRequest,
  sessionConcepts: ReadonlySet<ConceptId>
): ReadonlyMap<ConceptId, CandidateResonanceEvidence> {
  if (!Array.isArray(request.candidates)) {
    return fail(
      "incomplete-candidate-coverage",
      "candidate evidence must cover every non-attended session concept"
    );
  }

  const candidates = new Map<ConceptId, CandidateResonanceEvidence>();
  for (const evidence of request.candidates) {
    if (
      evidence === null ||
      typeof evidence !== "object" ||
      !isConceptId(evidence.candidateId) ||
      evidence.candidateId === request.attendedConceptId ||
      !sessionConcepts.has(evidence.candidateId) ||
      candidates.has(evidence.candidateId)
    ) {
      return fail(
        "invalid-candidate-identity",
        "candidate identities must be unique non-attended session concepts"
      );
    }

    validateEvidence(evidence);
    candidates.set(evidence.candidateId, evidence);
  }

  if (candidates.size !== request.sessionConceptIds.length - 1) {
    return fail(
      "incomplete-candidate-coverage",
      "candidate evidence must cover every non-attended session concept"
    );
  }

  return candidates;
}

function calculateBand(evidence: CandidateResonanceEvidence): ResonanceBand {
  const generativeSupport =
    evidence.facetSupport + evidence.topologySupport + evidence.contextSupport;
  const documentedBonus =
    evidence.documentedRelationPresent && generativeSupport > 0 ? 1 : 0;
  const totalSupport = generativeSupport + documentedBonus;

  if (totalSupport >= 4) return "high";
  if (totalSupport >= 2) return "medium";
  return "weak";
}

export function evaluateCandidateResonance(
  request: CandidateResonanceRequest
): readonly CandidateResonance[] {
  const sessionConcepts = validateSession(request);
  const candidates = indexCandidates(request, sessionConcepts);
  const results: CandidateResonance[] = [];

  for (const candidateId of request.sessionConceptIds) {
    if (candidateId === request.attendedConceptId) continue;

    const evidence = candidates.get(candidateId);
    if (evidence === undefined) {
      fail(
        "incomplete-candidate-coverage",
        "candidate evidence must cover every non-attended session concept"
      );
    }

    results.push(Object.freeze({ candidateId, band: calculateBand(evidence) }));
  }

  return Object.freeze(results);
}
