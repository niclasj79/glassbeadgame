import { describe, expect, it } from "vitest";
import { toConceptId, type ConceptId } from "../ids";
import {
  assessDraw,
  CastaliaDrawError,
  DRAW_REQUIREMENTS,
  drawCastaliaSession,
  type DrawCandidateConcept,
  type DrawLookup,
} from "./drawCastaliaSession";

const FACULTIES = ["measure", "sound", "matter", "image"] as const;
const FACET_POOL = [
  "recursion",
  "invariance",
  "periodicity",
  "proportion",
  "decomposition",
  "projection",
  "tiling",
  "threshold",
];

/**
 * A synthetic pack shaped like the real one — 24 concepts, 6 per faculty, with
 * facets distributed so that shared structure is common and documented
 * relations are sparse and mostly cross-faculty.
 */
function buildPack(): DrawCandidateConcept[] {
  const concepts: DrawCandidateConcept[] = [];
  for (let f = 0; f < FACULTIES.length; f += 1) {
    for (let i = 0; i < 6; i += 1) {
      concepts.push({
        id: toConceptId(`${FACULTIES[f]}.c${i}`),
        faculty: FACULTIES[f],
        facets: [
          FACET_POOL[(f + i) % FACET_POOL.length],
          FACET_POOL[(f * 3 + i * 2) % FACET_POOL.length],
        ],
      });
    }
  }
  return concepts;
}

/** Documented relations: every cross-faculty pair whose indices agree mod 3. */
function buildLookup(concepts: readonly DrawCandidateConcept[]): DrawLookup {
  const index = new Map(concepts.map((c, i) => [String(c.id), i]));
  return {
    concepts,
    hasDocumentedRelation: (a, b) => {
      const ia = index.get(String(a));
      const ib = index.get(String(b));
      if (ia === undefined || ib === undefined) return false;
      const ca = concepts[ia];
      const cb = concepts[ib];
      if (ca.faculty === cb.faculty) return ia % 5 === ib % 5;
      return ia % 3 === ib % 3;
    },
  };
}

const pack = buildPack();
const lookup = buildLookup(pack);

describe("drawCastaliaSession", () => {
  it("is deterministic for a seed", () => {
    const a = drawCastaliaSession({ seed: "castalia-golden-001", lookup });
    const b = drawCastaliaSession({ seed: "castalia-golden-001", lookup });
    expect(a.conceptIds).toEqual(b.conceptIds);
  });

  it("gives different seeds different draws", () => {
    const a = drawCastaliaSession({ seed: "one", lookup });
    const b = drawCastaliaSession({ seed: "two", lookup });
    expect(a.conceptIds).not.toEqual(b.conceptIds);
  });

  it("draws the requested number of distinct beads", () => {
    const draw = drawCastaliaSession({ seed: "size", lookup });
    expect(draw.conceptIds).toHaveLength(12);
    expect(new Set(draw.conceptIds).size).toBe(12);
  });

  it("always includes required concepts, so the golden path is reproducible", () => {
    const require: ConceptId[] = [
      toConceptId("measure.c0"),
      toConceptId("sound.c3"),
    ];
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const draw = drawCastaliaSession({ seed, lookup, require });
      for (const id of require) expect(draw.conceptIds).toContain(id);
    }
  });

  it("meets the quality floor across many seeds", () => {
    // These are floors on what the draw can *support* — recognition, real
    // Open Threads, a cross-faculty relation in reach, and a motif substrate.
    for (let i = 0; i < 40; i += 1) {
      const draw = drawCastaliaSession({ seed: `seed-${i}`, lookup });
      const present = draw.conceptIds.map(
        (id) => pack.find((c) => c.id === id) as DrawCandidateConcept
      );
      const quality = assessDraw(present, lookup);
      expect(quality.faculties).toBe(DRAW_REQUIREMENTS.minFaculties);
      expect(quality.crossFacultyDocumented).toBeGreaterThanOrEqual(
        DRAW_REQUIREMENTS.minCrossFacultyDocumented
      );
      expect(quality.triangles).toBeGreaterThanOrEqual(
        DRAW_REQUIREMENTS.minTriangles
      );
      expect(quality.open).toBeGreaterThanOrEqual(DRAW_REQUIREMENTS.minOpen);
    }
  });

  it("returns concept ids and nothing else", () => {
    // The one disclosure rule: the generator may know where the relations are,
    // but must never hand that knowledge to the player. A pair in this return
    // value would turn the game back into a hidden-answer hunt.
    const draw = drawCastaliaSession({ seed: "disclosure", lookup });
    expect(Object.keys(draw)).toEqual(["conceptIds"]);
    for (const id of draw.conceptIds) expect(typeof id).toBe("string");
  });

  it("orders by faculty so the arena has an authored geography", () => {
    const draw = drawCastaliaSession({ seed: "geography", lookup });
    const order = draw.conceptIds.map((id) => String(id).split(".")[0]);
    const firstIndex = new Map<string, number>();
    order.forEach((faculty, index) => {
      if (!firstIndex.has(faculty)) firstIndex.set(faculty, index);
    });
    // Every faculty's beads are contiguous.
    for (const [faculty, start] of firstIndex) {
      const count = order.filter((f) => f === faculty).length;
      expect(order.slice(start, start + count).every((f) => f === faculty)).toBe(
        true
      );
    }
  });

  it("rejects impossible requests rather than silently degrading", () => {
    expect(() => drawCastaliaSession({ seed: "x", lookup, size: 2 })).toThrow(
      CastaliaDrawError
    );
    expect(() =>
      drawCastaliaSession({ seed: "x", lookup, size: 40 })
    ).toThrow(CastaliaDrawError);
    expect(() =>
      drawCastaliaSession({
        seed: "x",
        lookup,
        require: [toConceptId("nope.missing")],
      })
    ).toThrow(CastaliaDrawError);
  });

  it("still returns a playable draw when the floor cannot be met", () => {
    // A degenerate pack must not hang or throw at session start; it must
    // return the best available draw.
    const thin: DrawCandidateConcept[] = pack
      .slice(0, 12)
      .map((c) => ({ ...c, facets: [] }));
    const draw = drawCastaliaSession({
      seed: "thin",
      lookup: { concepts: thin, hasDocumentedRelation: () => false },
    });
    expect(draw.conceptIds).toHaveLength(12);
  });
});

describe("assessDraw", () => {
  it("counts documented, open, and triangle structure", () => {
    const present = pack.slice(0, 12);
    const quality = assessDraw(present, lookup);
    expect(quality.documented).toBeGreaterThan(0);
    expect(quality.open).toBeGreaterThan(0);
    expect(quality.faculties).toBeGreaterThan(0);
    expect(quality.triangles).toBeGreaterThanOrEqual(0);
  });

  it("treats a pair as open only when it shares a facet and has no relation", () => {
    const a: DrawCandidateConcept = {
      id: toConceptId("x.a"),
      faculty: "measure",
      facets: ["recursion"],
    };
    const b: DrawCandidateConcept = {
      id: toConceptId("x.b"),
      faculty: "sound",
      facets: ["recursion"],
    };
    const c: DrawCandidateConcept = {
      id: toConceptId("x.c"),
      faculty: "image",
      facets: ["tiling"],
    };
    const quality = assessDraw([a, b, c], {
      concepts: [a, b, c],
      hasDocumentedRelation: () => false,
    });
    expect(quality.open).toBe(1);
    expect(quality.documented).toBe(0);
  });
});
