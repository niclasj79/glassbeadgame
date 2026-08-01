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

/**
 * Structure alone decides `high`. The documented bit may lift a pairing out of
 * silence and no further.
 *
 * The earlier rule summed the documented bit into the same total as facet,
 * topology and context, and it turned the strongest signal in the arena into a
 * rendering of the answer key. Measured on the golden draw: five pairs reached
 * `high`, four of them documented — precision 0.80 against a base rate of 0.121
 * — and with the bonus removed only one pair reached `high` at all. Four of the
 * five existed *solely* because a relation was authored for that pair.
 *
 * The cause was calibration rather than intent. The thresholds were written for
 * a 0–6 range, but `topologySupport` is 0 on an empty web, so at session start
 * the generative range only reaches 4 once in sixty-six pairs and the documented
 * bit cast the deciding vote. That is exactly the hidden endpoint list §7
 * forbids and product law 1 exists to prevent.
 *
 * Two changes, and both are needed. The documented bit is now applied *after*
 * the `high` decision, so it can only ever promote weak→medium. And the `high`
 * threshold is re-derived against the range structure actually reaches on an
 * empty web — facet plus context, topology being silent — so a genuinely rich
 * correspondence can read strongly on its own merits from the first moment.
 *
 * Correlation between `high` and the documented set does not vanish, and should
 * not: relations were authored where structure is rich, so the two agree
 * honestly. What must never happen is the documented bit deciding the band.
 */
const HIGH_SUPPORT = 3;
const MEDIUM_SUPPORT = 2;

function calculateBand(evidence: CandidateResonanceEvidence): ResonanceBand {
  const generativeSupport =
    evidence.facetSupport + evidence.topologySupport + evidence.contextSupport;

  /**
   * `high` also requires that the player's own web is part of the reason.
   *
   * Measured over all 276 pairs of the pack on an empty web, no threshold is
   * innocent: "shares any structure at all" already predicts an authored
   * relation at 2.68x the base rate, and the strictest reachable threshold runs
   * at 4.60x. That correlation is not a leak to be tuned away — it is what
   * honest content looks like, because relations were authored precisely where
   * structure is rich. No arrangement of facet and context can separate them.
   *
   * So the arena does not single anything out before there is a web to be
   * structural *about*. `topologySupport` is zero until the player has woven
   * something, and it is computed from what they wove — a shared neighbour, two
   * regions a commitment would join. Requiring it means the strongest signal in
   * the world can only ever be an opinion about *your* composition, which is
   * something the answer key cannot supply.
   *
   * It also reads better than the alternative. The opening is genuinely open,
   * nothing is privileged before you have said anything, and the world earns
   * its emphasis as you give it something to have an opinion about.
   */
  if (generativeSupport >= HIGH_SUPPORT && evidence.topologySupport > 0) {
    return "high";
  }

  // CAV-003 permits documented presence as an input; it forbids it as the whole
  // signal. Confined here, it can say "there is something to think about" and
  // can never say "this is the one".
  const documentedLift =
    evidence.documentedRelationPresent && generativeSupport > 0 ? 1 : 0;
  return generativeSupport + documentedLift >= MEDIUM_SUPPORT ? "medium" : "weak";
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
