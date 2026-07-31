import { describe, expect, it } from "vitest";
import { toConceptId, type ConceptId } from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";
import { evaluateCandidateResonance } from "../../domain/relations/resonance";
import type { FacetId } from "../../content/castalia/schema";
import { toFacetId } from "../../content/castalia/schema";
import {
  createCastaliaCandidateEvidenceResolver,
  type CastaliaResonanceLookup,
} from "./resolveCastaliaCandidateEvidence";

const id = (value: string): ConceptId => toConceptId(value);

// A miniature draw with deliberately shaped structure, so each rule can be
// isolated. Faculties and facets mirror the real pack's semantics.
const FACETS: Record<string, readonly FacetId[]> = {
  a: [toFacetId("recursion"), toFacetId("proportion")],
  b: [toFacetId("recursion"), toFacetId("imitation")],
  c: [toFacetId("proportion"), toFacetId("periodicity")],
  d: [toFacetId("periodicity"), toFacetId("interference")],
  e: [toFacetId("periodicity"), toFacetId("tiling")],
  f: [toFacetId("periodicity"), toFacetId("threshold")],
};

const FACULTY: Record<string, string> = {
  a: "measure",
  b: "sound",
  c: "measure",
  d: "sound",
  e: "matter",
  f: "image",
};

const lookup = (
  documented: readonly (readonly [string, string])[] = []
): CastaliaResonanceLookup => {
  const keys = new Set(
    documented.map(([x, y]) => (x < y ? `${x}~${y}` : `${y}~${x}`))
  );
  return {
    conceptFacets: (conceptId) => FACETS[String(conceptId)] ?? [],
    conceptFaculty: (conceptId) => FACULTY[String(conceptId)] ?? null,
    hasDocumentedRelation: (x, y) => {
      const [p, q] = [String(x), String(y)].sort();
      return keys.has(`${p}~${q}`);
    },
  };
};

const session = (
  threads: readonly (readonly [string, string])[] = []
): SessionStateV1 =>
  ({
    conceptIds: Object.keys(FACETS).map(id),
    threads: threads.map((pair, index) => ({
      id: `thread:${index}`,
      pair: [id(pair[0]), id(pair[1])],
    })),
  }) as unknown as SessionStateV1;

const bandsFor = (
  attended: string,
  threads: readonly (readonly [string, string])[] = [],
  documented: readonly (readonly [string, string])[] = []
): Map<string, string> => {
  const state = session(threads);
  const resolve = createCastaliaCandidateEvidenceResolver(lookup(documented));
  const candidates = resolve({
    session: state,
    attendedConceptId: id(attended),
  });
  const bands = evaluateCandidateResonance({
    sessionConceptIds: state.conceptIds,
    attendedConceptId: id(attended),
    candidates,
  });
  return new Map(bands.map((r) => [String(r.candidateId), r.band]));
};

describe("Castalia candidate evidence", () => {
  it("covers every non-attended concept exactly once", () => {
    const resolve = createCastaliaCandidateEvidenceResolver(lookup());
    const state = session();
    const result = resolve({ session: state, attendedConceptId: id("a") });
    expect(result).toHaveLength(state.conceptIds.length - 1);
    expect(new Set(result.map((r) => String(r.candidateId))).size).toBe(
      result.length
    );
    expect(result.some((r) => String(r.candidateId) === "a")).toBe(false);
  });

  it("answers to shared structure, not to an authored pair list", () => {
    // 'b' shares `recursion` with 'a' and is cross-faculty; 'e' shares nothing.
    const bands = bandsFor("a");
    expect(bands.get("b")).not.toBe("weak");
    expect(bands.get("e")).toBe("weak");
  });

  it("refuses to leak a documented pair that shares no structure", () => {
    // CAV-003: a binary known-pair flag may never move a band on its own.
    // Without this, a player could farm the preview as an oracle.
    const without = bandsFor("a");
    const withDocumented = bandsFor("a", [], [["a", "e"]]);
    expect(withDocumented.get("e")).toBe(without.get("e"));
    expect(withDocumented.get("e")).toBe("weak");
  });

  it("does let a documented relation lift a pair that already shares structure", () => {
    const plain = bandsFor("a");
    const documented = bandsFor("a", [], [["a", "b"]]);
    const order = { weak: 0, medium: 1, high: 2 } as const;
    expect(
      order[documented.get("b") as keyof typeof order]
    ).toBeGreaterThanOrEqual(order[plain.get("b") as keyof typeof order]);
  });

  it("says nothing from topology on an empty web", () => {
    // Honest: topology has no opinion about a web that does not exist yet.
    const resolve = createCastaliaCandidateEvidenceResolver(lookup());
    const result = resolve({
      session: session(),
      attendedConceptId: id("a"),
    });
    expect(result.every((r) => r.topologySupport === 0)).toBe(true);
  });

  it("notices when a commitment would close a triangle", () => {
    const resolve = createCastaliaCandidateEvidenceResolver(lookup());
    // a-c and b-c exist, so a-b would close a triangle through c.
    const result = resolve({
      session: session([
        ["a", "c"],
        ["b", "c"],
      ]),
      attendedConceptId: id("a"),
    });
    const toB = result.find((r) => String(r.candidateId) === "b");
    expect(toB?.topologySupport).toBeGreaterThan(0);
  });

  it("notices when a commitment would join two separate regions", () => {
    const resolve = createCastaliaCandidateEvidenceResolver(lookup());
    // a-c is one component, d-e another; a to d would join them.
    const result = resolve({
      session: session([
        ["a", "c"],
        ["d", "e"],
      ]),
      attendedConceptId: id("a"),
    });
    const toD = result.find((r) => String(r.candidateId) === "d");
    expect(toD?.topologySupport).toBeGreaterThan(0);
  });

  it("responds to what the player has already built", () => {
    // `periodicity` becomes live once two concepts carrying it are woven, so
    // the same bead reads differently in two different sessions.
    const resolve = createCastaliaCandidateEvidenceResolver(lookup());
    const before = resolve({
      session: session(),
      attendedConceptId: id("c"),
    }).find((r) => String(r.candidateId) === "f");
    const after = resolve({
      session: session([["d", "e"]]),
      attendedConceptId: id("c"),
    }).find((r) => String(r.candidateId) === "f");
    expect(after!.contextSupport).toBeGreaterThan(before!.contextSupport);
  });

  it("weights a distinctive correspondence above a common one", () => {
    // `recursion` is carried by two concepts here; `periodicity` by four.
    const resolve = createCastaliaCandidateEvidenceResolver(lookup());
    const result = resolve({ session: session(), attendedConceptId: id("c") });
    const common = result.find((r) => String(r.candidateId) === "d");
    const resolveFromA = createCastaliaCandidateEvidenceResolver(lookup());
    const distinctive = resolveFromA({
      session: session(),
      attendedConceptId: id("a"),
    }).find((r) => String(r.candidateId) === "b");
    expect(distinctive!.contextSupport).toBeGreaterThan(common!.contextSupport);
  });

  it("keeps every support level inside the model's domain", () => {
    const resolve = createCastaliaCandidateEvidenceResolver(lookup());
    for (const attended of Object.keys(FACETS)) {
      const result = resolve({
        session: session([
          ["a", "c"],
          ["b", "c"],
          ["d", "e"],
        ]),
        attendedConceptId: id(attended),
      });
      for (const entry of result) {
        for (const level of [
          entry.facetSupport,
          entry.topologySupport,
          entry.contextSupport,
        ]) {
          expect([0, 1, 2]).toContain(level);
        }
      }
    }
  });

  it("is deterministic", () => {
    const resolve = createCastaliaCandidateEvidenceResolver(lookup());
    const run = () =>
      JSON.stringify(
        resolve({
          session: session([["a", "c"]]),
          attendedConceptId: id("a"),
        })
      );
    expect(run()).toBe(run());
  });

  it("reaches every band across a realistic draw", () => {
    // The calibration assertion. Bands were tuned for a 0-6 support range while
    // topology was pinned at zero, so real evidence and band thresholds have to
    // be verified together or the drift is silent.
    const observed = new Set<string>();
    for (const attended of Object.keys(FACETS)) {
      for (const band of bandsFor(
        attended,
        [
          ["a", "c"],
          ["b", "c"],
          ["d", "e"],
        ],
        [["a", "b"]]
      ).values()) {
        observed.add(band);
      }
    }
    expect(observed).toContain("weak");
    expect(observed).toContain("medium");
    expect(observed).toContain("high");
  });
});
