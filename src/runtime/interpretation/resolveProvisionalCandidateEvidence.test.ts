import { describe, expect, it } from "vitest";
import {
  CandidateResonanceError,
  evaluateCandidateResonance,
} from "../../domain/relations/resonance";
import {
  toConceptId,
  toContentPackVersion,
  toSessionId,
  toWorldId,
  type ConceptId,
} from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";
import * as interpretation from ".";
import { resolveProvisionalCandidateEvidence } from ".";

const IDS = Object.freeze({
  fibonacci: toConceptId("math.fibonacci-sequence"),
  counterpoint: toConceptId("music.counterpoint"),
  primeNumbers: toConceptId("math.prime-numbers"),
  polyrhythm: toConceptId("music.polyrhythm"),
  perspective: toConceptId("art.perspective"),
  renaissance: toConceptId("hist.renaissance"),
  consonance: toConceptId("music.consonance"),
  dissonance: toConceptId("music.dissonance"),
  abstractAlgebra: toConceptId("math.abstract-algebra"),
  energyConservation: toConceptId("phys.energy-conservation"),
  unknown: toConceptId("unknown.concept"),
});

const HIGH_REFERENCE_PAIRS = Object.freeze([
  Object.freeze([IDS.fibonacci, IDS.counterpoint] as const),
  Object.freeze([IDS.primeNumbers, IDS.polyrhythm] as const),
  Object.freeze([IDS.perspective, IDS.renaissance] as const),
  Object.freeze([IDS.consonance, IDS.dissonance] as const),
  Object.freeze([IDS.abstractAlgebra, IDS.energyConservation] as const),
]);

function createSession(conceptIds: readonly ConceptId[]): SessionStateV1 {
  return Object.freeze({
    sessionId: toSessionId("session.provisional-evidence"),
    seed: "provisional-evidence-seed",
    contentPackVersion: toContentPackVersion("castalia.test.v1"),
    worldId: toWorldId("castalia"),
    conceptIds: Object.freeze([...conceptIds]),
    lastSequence: 0,
    at: 0,
    attendedConceptId: null,
    selectedPair: null,
    hypothesis: null,
    threads: Object.freeze([]),
    outcomes: Object.freeze([]),
    completedMotifs: Object.freeze([]),
    attunementActive: false,
    concluded: false,
  });
}

function resolve(
  attendedConceptId: ConceptId,
  conceptIds: readonly ConceptId[]
) {
  return resolveProvisionalCandidateEvidence({
    attendedConceptId,
    session: createSession(conceptIds),
  });
}

function highEvidence(candidateId: ConceptId) {
  return {
    candidateId,
    facetSupport: 2,
    topologySupport: 0,
    contextSupport: 2,
    documentedRelationPresent: false,
  } as const;
}

function mediumEvidence(candidateId: ConceptId) {
  return {
    candidateId,
    facetSupport: 1,
    topologySupport: 0,
    contextSupport: 1,
    documentedRelationPresent: false,
  } as const;
}

function weakEvidence(candidateId: ConceptId) {
  return {
    candidateId,
    facetSupport: 0,
    topologySupport: 0,
    contextSupport: 0,
    documentedRelationPresent: false,
  } as const;
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

describe("resolveProvisionalCandidateEvidence", () => {
  it("exports only the callable boundary and keeps fixture data private", () => {
    expect(typeof resolveProvisionalCandidateEvidence).toBe("function");
    expect(interpretation).not.toHaveProperty("PROVISIONAL_FIXTURES");
  });

  it.each(HIGH_REFERENCE_PAIRS)(
    "maps the accepted reference pair %s and %s symmetrically",
    (first, second) => {
      expect(resolve(first, [first, second])).toEqual([highEvidence(second)]);
      expect(resolve(second, [first, second])).toEqual([highEvidence(first)]);
    }
  );

  it("maps the accepted Open Thread fixture symmetrically", () => {
    expect(resolve(IDS.fibonacci, [IDS.fibonacci, IDS.perspective])).toEqual([
      mediumEvidence(IDS.perspective),
    ]);
    expect(resolve(IDS.perspective, [IDS.fibonacci, IDS.perspective])).toEqual([
      mediumEvidence(IDS.fibonacci),
    ]);
  });

  it("maps unclassified and unknown concepts to exact zero support", () => {
    expect(resolve(IDS.unknown, [IDS.unknown, IDS.counterpoint])).toEqual([
      weakEvidence(IDS.counterpoint),
    ]);
    expect(resolve(IDS.counterpoint, [IDS.unknown, IDS.counterpoint])).toEqual([
      weakEvidence(IDS.unknown),
    ]);
  });

  it("preserves canonical session order across overlapping classifications", () => {
    const result = resolve(IDS.fibonacci, [
      IDS.perspective,
      IDS.fibonacci,
      IDS.unknown,
      IDS.counterpoint,
    ]);

    expect(result).toEqual([
      mediumEvidence(IDS.perspective),
      weakEvidence(IDS.unknown),
      highEvidence(IDS.counterpoint),
    ]);
    expect(result.map((evidence) => evidence.candidateId)).toEqual([
      IDS.perspective,
      IDS.unknown,
      IDS.counterpoint,
    ]);
    for (const evidence of result) {
      expect(Object.keys(evidence).sort()).toEqual([
        "candidateId",
        "contextSupport",
        "documentedRelationPresent",
        "facetSupport",
        "topologySupport",
      ]);
      expect(evidence.topologySupport).toBe(0);
      expect(evidence.documentedRelationPresent).toBe(false);
    }
    expectDeeplyFrozen(result);
  });

  it("integrates through the unchanged evaluator as high, medium, and weak", () => {
    const session = createSession([
      IDS.fibonacci,
      IDS.counterpoint,
      IDS.perspective,
      IDS.unknown,
    ]);
    const candidates = resolveProvisionalCandidateEvidence({
      attendedConceptId: IDS.fibonacci,
      session,
    });

    expect(
      evaluateCandidateResonance({
        attendedConceptId: IDS.fibonacci,
        sessionConceptIds: session.conceptIds,
        candidates,
      })
    ).toEqual([
      { candidateId: IDS.counterpoint, band: "high" },
      { candidateId: IDS.perspective, band: "medium" },
      { candidateId: IDS.unknown, band: "weak" },
    ]);
  });

  it("returns fresh deeply frozen byte-identical values without retaining input", () => {
    const conceptIds = [
      IDS.fibonacci,
      IDS.counterpoint,
      IDS.perspective,
      IDS.unknown,
    ];
    const snapshot = [...conceptIds];
    const session: SessionStateV1 = {
      ...createSession(conceptIds),
      conceptIds,
    };
    const request = {
      attendedConceptId: IDS.fibonacci,
      session,
    };

    const first = resolveProvisionalCandidateEvidence(request);
    const second = resolveProvisionalCandidateEvidence(request);

    expect(conceptIds).toEqual(snapshot);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(second).not.toBe(first);
    second.forEach((evidence, index) => {
      expect(evidence).not.toBe(first[index]);
    });
    conceptIds.reverse();
    expect(first.map((evidence) => evidence.candidateId)).toEqual([
      IDS.counterpoint,
      IDS.perspective,
      IDS.unknown,
    ]);
    expectDeeplyFrozen(first);
    expectDeeplyFrozen(second);
  });

  it("leaves invalid attended membership to the accepted evaluator", () => {
    const session = createSession([IDS.counterpoint, IDS.perspective]);
    const candidates = resolveProvisionalCandidateEvidence({
      attendedConceptId: IDS.fibonacci,
      session,
    });

    expect(candidates).toEqual([
      highEvidence(IDS.counterpoint),
      mediumEvidence(IDS.perspective),
    ]);
    expect(() =>
      evaluateCandidateResonance({
        attendedConceptId: IDS.fibonacci,
        sessionConceptIds: session.conceptIds,
        candidates,
      })
    ).toThrowError(
      expect.objectContaining({
        name: "CandidateResonanceError",
        code: "attended-concept-not-in-session",
      })
    );
    expect(() =>
      evaluateCandidateResonance({
        attendedConceptId: IDS.fibonacci,
        sessionConceptIds: session.conceptIds,
        candidates,
      })
    ).toThrow(CandidateResonanceError);
  });
});
