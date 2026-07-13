export const CANDIDATE_RESONANCE_ERROR_CODES = Object.freeze([
  "invalid-session-concepts",
  "attended-concept-not-in-session",
  "invalid-candidate-identity",
  "incomplete-candidate-coverage",
  "invalid-support-level",
  "invalid-documented-relation-presence",
] as const);

export type CandidateResonanceErrorCode =
  (typeof CANDIDATE_RESONANCE_ERROR_CODES)[number];

export class CandidateResonanceError extends Error {
  readonly code: CandidateResonanceErrorCode;

  constructor(code: CandidateResonanceErrorCode, message: string) {
    super(message);
    this.name = "CandidateResonanceError";
    this.code = code;
  }
}
