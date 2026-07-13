import { describe, expect, it } from "vitest";
import { toConceptId } from "../../ids";
import {
  CANDIDATE_RESONANCE_ERROR_CODES,
  CandidateResonanceError,
  evaluateCandidateResonance,
  RESONANCE_BANDS,
  RESONANCE_SUPPORT_LEVELS,
  type CandidateResonanceErrorCode,
  type CandidateResonanceEvidence,
  type CandidateResonanceRequest,
  type ResonanceSupportLevel,
} from ".";

const IDS = Object.freeze({
  attended: toConceptId("math.fibonacci-sequence"),
  weak: toConceptId("image.perspective"),
  documentedOnly: toConceptId("history.renaissance"),
  medium: toConceptId("music.polyrhythm"),
  contextual: toConceptId("physics.energy-conservation"),
  highOpen: toConceptId("matter.crystal-growth"),
  highDocumented: toConceptId("music.counterpoint"),
  extra: toConceptId("extra.concept"),
});

const DEFAULT_SUPPORT = Object.freeze({
  facetSupport: 0 as ResonanceSupportLevel,
  topologySupport: 0 as ResonanceSupportLevel,
  contextSupport: 0 as ResonanceSupportLevel,
  documentedRelationPresent: false,
});

function evidence(
  candidateId: CandidateResonanceEvidence["candidateId"],
  overrides: Partial<Omit<CandidateResonanceEvidence, "candidateId">> = {}
): CandidateResonanceEvidence {
  return { candidateId, ...DEFAULT_SUPPORT, ...overrides };
}

function twoConceptRequest(
  candidate: CandidateResonanceEvidence
): CandidateResonanceRequest {
  return {
    attendedConceptId: IDS.attended,
    sessionConceptIds: [IDS.attended, candidate.candidateId],
    candidates: [candidate],
  };
}

function expectErrorCode(
  request: CandidateResonanceRequest,
  code: CandidateResonanceErrorCode
): CandidateResonanceError {
  let thrown: unknown;
  try {
    evaluateCandidateResonance(request);
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(CandidateResonanceError);
  expect((thrown as CandidateResonanceError).code).toBe(code);
  return thrown as CandidateResonanceError;
}

function unsafeRequest(value: unknown): CandidateResonanceRequest {
  return value as CandidateResonanceRequest;
}

describe("evaluateCandidateResonance", () => {
  it("exports closed frozen vocabularies and stable error codes", () => {
    expect(RESONANCE_BANDS).toEqual(["weak", "medium", "high"]);
    expect(RESONANCE_SUPPORT_LEVELS).toEqual([0, 1, 2]);
    expect(CANDIDATE_RESONANCE_ERROR_CODES).toEqual([
      "invalid-session-concepts",
      "attended-concept-not-in-session",
      "invalid-candidate-identity",
      "incomplete-candidate-coverage",
      "invalid-support-level",
      "invalid-documented-relation-presence",
    ]);
    expect(Object.isFrozen(RESONANCE_BANDS)).toBe(true);
    expect(Object.isFrozen(RESONANCE_SUPPORT_LEVELS)).toBe(true);
    expect(Object.isFrozen(CANDIDATE_RESONANCE_ERROR_CODES)).toBe(true);
  });

  it("returns every candidate in canonical session order using the accepted calibration", () => {
    const request: CandidateResonanceRequest = {
      attendedConceptId: IDS.attended,
      sessionConceptIds: [
        IDS.weak,
        IDS.attended,
        IDS.documentedOnly,
        IDS.medium,
        IDS.contextual,
        IDS.highOpen,
        IDS.highDocumented,
      ],
      candidates: [
        evidence(IDS.highDocumented, {
          facetSupport: 1,
          topologySupport: 1,
          contextSupport: 1,
          documentedRelationPresent: true,
        }),
        evidence(IDS.highOpen, {
          facetSupport: 2,
          topologySupport: 1,
          contextSupport: 1,
        }),
        evidence(IDS.contextual, { contextSupport: 2 }),
        evidence(IDS.medium, { facetSupport: 1, topologySupport: 1 }),
        evidence(IDS.documentedOnly, { documentedRelationPresent: true }),
        evidence(IDS.weak, { facetSupport: 1 }),
      ],
    };

    expect(evaluateCandidateResonance(request)).toEqual([
      { candidateId: IDS.weak, band: "weak" },
      { candidateId: IDS.documentedOnly, band: "weak" },
      { candidateId: IDS.medium, band: "medium" },
      { candidateId: IDS.contextual, band: "medium" },
      { candidateId: IDS.highOpen, band: "high" },
      { candidateId: IDS.highDocumented, band: "high" },
    ]);
  });

  it.each([
    [0, 0, 0, false, "weak"],
    [1, 0, 0, false, "weak"],
    [2, 0, 0, false, "medium"],
    [1, 1, 1, false, "medium"],
    [2, 1, 1, false, "high"],
    [0, 0, 0, true, "weak"],
    [1, 0, 0, true, "medium"],
    [1, 1, 1, true, "high"],
    [0, 2, 0, false, "medium"],
    [0, 0, 2, false, "medium"],
  ] as const)(
    "maps facet=%i topology=%i context=%i documented=%s to %s",
    (facetSupport, topologySupport, contextSupport, documentedRelationPresent, band) => {
      const result = evaluateCandidateResonance(
        twoConceptRequest(
          evidence(IDS.medium, {
            facetSupport,
            topologySupport,
            contextSupport,
            documentedRelationPresent,
          })
        )
      );

      expect(result).toEqual([{ candidateId: IDS.medium, band }]);
    }
  );

  it("is input-order independent, byte deterministic, deeply frozen, and non-mutating", () => {
    const sessionConceptIds = [IDS.attended, IDS.weak, IDS.medium, IDS.highOpen];
    const candidates = [
      evidence(IDS.weak, { facetSupport: 1 }),
      evidence(IDS.medium, { topologySupport: 2 }),
      evidence(IDS.highOpen, { facetSupport: 2, topologySupport: 2 }),
    ];
    const request: CandidateResonanceRequest = {
      attendedConceptId: IDS.attended,
      sessionConceptIds,
      candidates,
    };
    const requestSnapshot = structuredClone(request);

    const forward = evaluateCandidateResonance(request);
    const reverse = evaluateCandidateResonance({
      ...request,
      candidates: [...candidates].reverse(),
    });

    expect(request).toEqual(requestSnapshot);
    expect(sessionConceptIds).toEqual(requestSnapshot.sessionConceptIds);
    expect(candidates).toEqual(requestSnapshot.candidates);
    expect(reverse).toEqual(forward);
    expect(JSON.stringify(reverse)).toBe(JSON.stringify(forward));
    expect(Object.isFrozen(forward)).toBe(true);
    expect(forward.every((result) => Object.isFrozen(result))).toBe(true);
  });

  it("exposes only candidate identity and qualitative band", () => {
    const result = evaluateCandidateResonance(
      twoConceptRequest(
        evidence(IDS.highDocumented, {
          facetSupport: 2,
          topologySupport: 1,
          documentedRelationPresent: true,
        })
      )
    );

    expect(Object.keys(result[0])).toEqual(["candidateId", "band"]);
    expect(result[0]).toEqual({ candidateId: IDS.highDocumented, band: "high" });
  });

  it.each([
    unsafeRequest({
      attendedConceptId: IDS.attended,
      sessionConceptIds: [IDS.attended],
      candidates: [],
    }),
    unsafeRequest({
      attendedConceptId: IDS.attended,
      sessionConceptIds: [IDS.attended, IDS.weak, IDS.weak],
      candidates: [evidence(IDS.weak)],
    }),
    unsafeRequest({
      attendedConceptId: IDS.attended,
      sessionConceptIds: [IDS.attended, ""],
      candidates: [],
    }),
    unsafeRequest({
      attendedConceptId: IDS.attended,
      sessionConceptIds: null,
      candidates: [],
    }),
  ])("rejects invalid session concept collections", (request) => {
    expectErrorCode(request, "invalid-session-concepts");
  });

  it("rejects an attended concept that is absent from the session", () => {
    expectErrorCode(
      {
        attendedConceptId: IDS.extra,
        sessionConceptIds: [IDS.attended, IDS.weak],
        candidates: [evidence(IDS.weak)],
      },
      "attended-concept-not-in-session"
    );
  });

  it.each([
    ["attended candidate", [evidence(IDS.attended)]],
    ["extra candidate", [evidence(IDS.extra)]],
    ["duplicate candidate", [evidence(IDS.weak), evidence(IDS.weak)]],
    ["invalid candidate id", [evidence("" as CandidateResonanceEvidence["candidateId"])]],
    ["invalid candidate record", [null]],
  ])("rejects %s identity", (_label, candidates) => {
    expectErrorCode(
      unsafeRequest({
        attendedConceptId: IDS.attended,
        sessionConceptIds: [IDS.attended, IDS.weak],
        candidates,
      }),
      "invalid-candidate-identity"
    );
  });

  it.each([
    unsafeRequest({
      attendedConceptId: IDS.attended,
      sessionConceptIds: [IDS.attended, IDS.weak, IDS.medium],
      candidates: [evidence(IDS.weak)],
    }),
    unsafeRequest({
      attendedConceptId: IDS.attended,
      sessionConceptIds: [IDS.attended, IDS.weak],
      candidates: null,
    }),
  ])("rejects incomplete candidate coverage", (request) => {
    expectErrorCode(request, "incomplete-candidate-coverage");
  });

  it.each(["facetSupport", "topologySupport", "contextSupport"] as const)(
    "rejects every invalid %s shape",
    (field) => {
      for (const invalid of [-1, 0.5, 3, Number.NaN, Number.POSITIVE_INFINITY, "1", null]) {
        const candidate = unsafeRequest({
          attendedConceptId: IDS.attended,
          sessionConceptIds: [IDS.attended, IDS.weak],
          candidates: [{ ...evidence(IDS.weak), [field]: invalid }],
        });
        expectErrorCode(candidate, "invalid-support-level");
      }
    }
  );

  it("rejects non-boolean documented-relation presence", () => {
    expectErrorCode(
      unsafeRequest({
        attendedConceptId: IDS.attended,
        sessionConceptIds: [IDS.attended, IDS.weak],
        candidates: [{ ...evidence(IDS.weak), documentedRelationPresent: 1 }],
      }),
      "invalid-documented-relation-presence"
    );
  });
});
