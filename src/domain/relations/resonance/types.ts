import type { ConceptId } from "../../ids";

export const RESONANCE_BANDS = Object.freeze(["weak", "medium", "high"] as const);
export const RESONANCE_SUPPORT_LEVELS = Object.freeze([0, 1, 2] as const);

export type ResonanceBand = (typeof RESONANCE_BANDS)[number];
export type ResonanceSupportLevel = (typeof RESONANCE_SUPPORT_LEVELS)[number];

export interface CandidateResonanceEvidence {
  readonly candidateId: ConceptId;
  readonly facetSupport: ResonanceSupportLevel;
  readonly topologySupport: ResonanceSupportLevel;
  readonly contextSupport: ResonanceSupportLevel;
  readonly documentedRelationPresent: boolean;
}

export interface CandidateResonanceRequest {
  readonly attendedConceptId: ConceptId;
  readonly sessionConceptIds: readonly ConceptId[];
  readonly candidates: readonly CandidateResonanceEvidence[];
}

export interface CandidateResonance {
  readonly candidateId: ConceptId;
  readonly band: ResonanceBand;
}
