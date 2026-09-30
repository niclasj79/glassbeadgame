import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { RELATION_INTENTIONS, type RelationIntention } from "@/domain/events";
import type { ConceptPair } from "@/domain/events";
import { toConceptId, type ConceptId } from "@/domain/ids";
import type { ConceptStructureLookup, RelationLookup } from "@/domain/outcomes/lookup";
import {
  FACULTY_COUNT,
  answerKey,
  describeStudyStatus,
  evaluateStudy,
  magisterLine,
  renderStudyBrief,
  solveStudy,
  studyCount,
  toStudyId,
  type StudyNames,
  type StudyStatus,
} from "@/domain/studies";
import { buildStudySession } from "@/domain/studies/testing/buildStudySession";

import {
  CASTALIA_LOOKUP,
  CASTALIA_PACK,
  CASTALIA_STUDIES,
  CONTENT_PACK_VERSION,
  FACULTIES,
  castaliaStudyById,
  facetById,
  facultyById,
  findRelation,
  openThreadPromptFor,
  openThreadsByIntention,
  relationByKey,
  relationsByConcept,
} from "./index";
import {
  FACULTY_IDS,
  relationKey,
  toFacetId,
  type CastaliaPack,
  type DocumentedRelation,
  type StudyDefinition,
} from "./schema";
import {
  STUDY_ERROR_CODES,
  assertCastaliaPackValid,
  validateCastaliaPack,
  validateStudies,
  type StudyErrorCode,
} from "./validate";

const relationFor = (a: string, b: string): DocumentedRelation => {
  const relation = findRelation(a, b);
  expect(relation, `expected a documented relation for ${a} ~ ${b}`).toBeDefined();
  return relation as DocumentedRelation;
};

/** The relations the golden path and the reference set are built on. */
const MANDATED: ReadonlyArray<{
  readonly a: string;
  readonly b: string;
  readonly primary: RelationIntention;
}> = [
  { a: "measure.fibonacci-sequence", b: "sound.counterpoint", primary: "echo" },
  { a: "measure.prime-numbers", b: "sound.polyrhythm", primary: "echo" },
  {
    a: "measure.continuous-symmetry",
    b: "matter.conservation-of-energy",
    primary: "ground",
  },
  { a: "sound.just-intonation", b: "sound.equal-temperament", primary: "tension" },
  { a: "image.linear-perspective", b: "image.anamorphosis", primary: "tension" },
  { a: "measure.fourier-series", b: "sound.overtone-series", primary: "ground" },
  { a: "image.camera-obscura", b: "image.linear-perspective", primary: "passage" },
  { a: "image.girih-tiling", b: "matter.crystal-lattice", primary: "echo" },
];

describe("Castalia content pack", () => {
  it("validates with zero errors", () => {
    const { errors } = validateCastaliaPack(CASTALIA_PACK);
    expect(errors).toEqual([]);
  });

  it("reports only the warnings the pack knowingly accepts", () => {
    const { warnings } = validateCastaliaPack(CASTALIA_PACK);
    // The only accepted drift is four six-step concept motifs authored in
    // concepts.ts, which exceed the schema's "2–5 entries" target. Nothing in
    // this pack may quietly accumulate warnings beyond that.
    for (const warning of warnings) {
      expect(warning).toMatch(/authored target is 2–5/);
    }
  });

  it("gives every relation at least one genuinely shared facet", () => {
    for (const relation of CASTALIA_PACK.relations) {
      expect(relation.sharedFacets.length, relation.id).toBeGreaterThan(0);
    }
  });

  it("declares the content pack version used by session events", () => {
    expect(CONTENT_PACK_VERSION).toBe("castalia.v1");
    expect(CASTALIA_PACK.version).toBe(CONTENT_PACK_VERSION);
  });

  it("holds 24 concepts, six per faculty", () => {
    expect(CASTALIA_PACK.concepts).toHaveLength(24);
    for (const faculty of CASTALIA_PACK.faculties) {
      const count = CASTALIA_PACK.concepts.filter(
        (concept) => concept.faculty === faculty.id
      ).length;
      expect(count, faculty.id).toBe(6);
    }
  });

  it("holds a relation count inside the slice target", () => {
    expect(CASTALIA_PACK.relations.length).toBeGreaterThanOrEqual(35);
    expect(CASTALIA_PACK.relations.length).toBeLessThanOrEqual(45);
  });
});

describe("mandated relations", () => {
  it.each(MANDATED)("$a ~ $b exists with primary $primary", ({ a, b, primary }) => {
    const relation = relationFor(a, b);
    expect(relation.fit[primary]).toBe("primary");
    const primaries = RELATION_INTENTIONS.filter(
      (intention) => relation.fit[intention] === "primary"
    );
    expect(primaries).toEqual([primary]);
  });

  it("states the Bartók proportional claim as contested, with the disagreement", () => {
    const relation = relationFor("measure.fibonacci-sequence", "sound.counterpoint");
    expect(relation.evidence).toBe("contested");
    expect(relation.relationType).not.toBe("historical-transmission");
    expect(relation.counterpoint).toBeDefined();
    expect(relation.sources).toContain("src.howat-1983");
    expect(relation.sources).toContain("src.lendvai-1971");
  });

  it("states the Hockney–Falco reading as contested rather than as transmission", () => {
    const relation = relationFor("image.camera-obscura", "image.linear-perspective");
    expect(relation.evidence).toBe("contested");
    expect(relation.relationType).not.toBe("historical-transmission");
    expect(relation.counterpoint).toBeDefined();
    expect(relation.sources).toContain("src.stork-2004");
  });

  it("states the girih quasicrystal reading as contested and cites both sides", () => {
    const relation = relationFor("image.girih-tiling", "matter.crystal-lattice");
    expect(relation.evidence).toBe("contested");
    expect(relation.sources).toContain("src.lu-steinhardt-2007");
    expect(relation.sources).toContain("src.makovicky-2007");
    expect(relation.counterpoint).toBeDefined();
  });

  it("grounds conservation of energy in Noether 1918", () => {
    const relation = relationFor(
      "measure.continuous-symmetry",
      "matter.conservation-of-energy"
    );
    expect(relation.relationType).toBe("formal-ground");
    expect(relation.evidence).toBe("established");
    expect(relation.sources).toContain("src.noether-1918");
  });
});

describe("evidential discipline", () => {
  it("gives every historical-transmission a source, a direction, and non-interpretive evidence", () => {
    const transmissions = CASTALIA_PACK.relations.filter(
      (relation) => relation.relationType === "historical-transmission"
    );
    expect(transmissions.length).toBeGreaterThan(0);
    for (const relation of transmissions) {
      expect(relation.sources.length, relation.id).toBeGreaterThan(0);
      expect(relation.direction, relation.id).toBeDefined();
      expect(relation.evidence, relation.id).not.toBe("interpretive");
    }
  });

  it("uses historical-transmission sparingly", () => {
    const transmissions = CASTALIA_PACK.relations.filter(
      (relation) => relation.relationType === "historical-transmission"
    );
    expect(transmissions.length).toBeLessThanOrEqual(3);
  });

  it("gives every non-interpretive relation at least one resolvable source", () => {
    const sourceIds = new Set(CASTALIA_PACK.sources.map((source) => source.id));
    for (const relation of CASTALIA_PACK.relations) {
      for (const sourceId of relation.sources) {
        expect(sourceIds.has(sourceId), `${relation.id} → ${sourceId}`).toBe(true);
      }
      if (relation.evidence !== "interpretive") {
        expect(relation.sources.length, relation.id).toBeGreaterThan(0);
      }
    }
  });

  it("requires a counterpoint wherever evidence is contested", () => {
    for (const relation of CASTALIA_PACK.relations) {
      if (relation.evidence === "contested") {
        expect(relation.counterpoint, relation.id).toBeTruthy();
      }
    }
  });

  it("only ever claims facets both concepts actually carry", () => {
    const facets = new Map(
      CASTALIA_PACK.concepts.map((concept) => [concept.id, concept.facets])
    );
    for (const relation of CASTALIA_PACK.relations) {
      const [a, b] = relation.pair;
      for (const facetId of relation.sharedFacets) {
        expect(facets.get(a), `${relation.id}/${a}`).toContain(facetId);
        expect(facets.get(b), `${relation.id}/${b}`).toContain(facetId);
      }
    }
  });

  it("leans cross-faculty", () => {
    const facultyOf = new Map(
      CASTALIA_PACK.concepts.map((concept) => [concept.id, concept.faculty])
    );
    let cross = 0;
    let within = 0;
    for (const relation of CASTALIA_PACK.relations) {
      const [a, b] = relation.pair;
      if (facultyOf.get(a) === facultyOf.get(b)) within += 1;
      else cross += 1;
    }
    expect(cross).toBeGreaterThan(within);
  });

  it("gives every concept at least two ways into the web", () => {
    for (const concept of CASTALIA_PACK.concepts) {
      expect(
        relationsByConcept.get(concept.id)?.length ?? 0,
        concept.id
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("offers a primary example of each intention", () => {
    for (const intention of RELATION_INTENTIONS) {
      const count = CASTALIA_PACK.relations.filter(
        (relation) => relation.fit[intention] === "primary"
      ).length;
      expect(count, intention).toBeGreaterThan(0);
    }
  });
});

describe("deterministic lookups", () => {
  it("keys relations by a sorted pair, resolvable in either order", () => {
    for (const relation of CASTALIA_PACK.relations) {
      const [a, b] = relation.pair;
      expect(a < b, relation.id).toBe(true);
      expect(relationByKey.get(relationKey(a, b))).toBe(relation);
      expect(findRelation(b, a)).toBe(relation);
    }
    expect(relationByKey.size).toBe(CASTALIA_PACK.relations.length);
  });

  it("orders relationsByConcept identically on repeated construction", () => {
    const first = [...relationsByConcept.entries()].map(
      ([id, relations]) => `${id}:${relations.map((r) => r.id).join(",")}`
    );
    const rebuilt = CASTALIA_PACK.concepts.map((concept) => {
      const ids = CASTALIA_PACK.relations
        .filter((relation) => relation.pair.includes(concept.id))
        .map((relation) => relation.id)
        .sort();
      return `${concept.id}:${ids.join(",")}`;
    });
    expect(first.slice().sort()).toEqual(rebuilt.slice().sort());
    for (const [, relations] of relationsByConcept) {
      const ids = relations.map((relation) => relation.id);
      expect(ids).toEqual([...ids].sort());
    }
  });

  it("orders open thread prompts facet-specific first, then by id", () => {
    for (const intention of RELATION_INTENTIONS) {
      const prompts = openThreadsByIntention.get(intention) ?? [];
      expect(prompts.length, intention).toBeGreaterThan(0);
      const fallbackIndex = prompts.findIndex((prompt) => prompt.facet === undefined);
      expect(fallbackIndex, intention).toBeGreaterThanOrEqual(0);
      expect(
        prompts.slice(fallbackIndex).every((prompt) => prompt.facet === undefined),
        intention
      ).toBe(true);
      const specificIds = prompts
        .slice(0, fallbackIndex)
        .map((prompt) => prompt.id);
      expect(specificIds).toEqual([...specificIds].sort());
    }
  });

  it("resolves an open thread prompt for every intention, with or without a facet", () => {
    for (const intention of RELATION_INTENTIONS) {
      const fallback = openThreadPromptFor(intention);
      expect(fallback, intention).toBeDefined();
      expect(fallback?.facet).toBeUndefined();
      expect(fallback?.question).not.toContain("{facet}");
    }
    const relation = relationFor("measure.prime-numbers", "sound.polyrhythm");
    const specific = openThreadPromptFor("tension", relation.sharedFacets);
    expect(specific?.facet).toBe("incommensurability");
  });
});

describe("the domain content seam", () => {
  it("is satisfied by CASTALIA_LOOKUP without an adapter", () => {
    // Compile-time assertion: if `RelationLookup` in the domain changes shape,
    // this line fails typecheck rather than failing silently at integration.
    const lookup: RelationLookup = CASTALIA_LOOKUP;
    expect(lookup.conceptName(toConceptId("measure.fibonacci-sequence"))).toBe(
      "Fibonacci Sequence"
    );
    expect(lookup.conceptFaculty(toConceptId("sound.counterpoint"))).toBe("sound");
    expect(lookup.facetName(toFacetId("recursion"))).toBe("Recursion");
  });

  it("returns null rather than throwing when nothing is authored", () => {
    const lookup: RelationLookup = CASTALIA_LOOKUP;
    expect(
      lookup.findRelation(
        toConceptId("measure.mobius-band"),
        toConceptId("matter.entropy")
      )
    ).toBeNull();
    expect(lookup.openThreadPrompt("echo", [])).not.toBeNull();
  });

  it("resolves the golden-path relation through the seam in either order", () => {
    const lookup: RelationLookup = CASTALIA_LOOKUP;
    const forward = lookup.findRelation(
      toConceptId("measure.fibonacci-sequence"),
      toConceptId("sound.counterpoint")
    );
    const reverse = lookup.findRelation(
      toConceptId("sound.counterpoint"),
      toConceptId("measure.fibonacci-sequence")
    );
    expect(forward).not.toBeNull();
    expect(reverse).toBe(forward);
    expect(forward?.fit.echo).toBe("primary");
  });
});

describe("validator rules", () => {
  const mutate = (
    change: (draft: {
      relations: DocumentedRelation[];
      openThreads: CastaliaPack["openThreads"];
    }) => void
  ): CastaliaValidation => {
    const draft = {
      relations: [...CASTALIA_PACK.relations],
      openThreads: [...CASTALIA_PACK.openThreads],
    };
    change(draft);
    return validateCastaliaPack({
      ...CASTALIA_PACK,
      relations: draft.relations,
      openThreads: draft.openThreads,
    });
  };

  type CastaliaValidation = ReturnType<typeof validateCastaliaPack>;

  it("rejects a historical-transmission with no source", () => {
    const { errors } = mutate((draft) => {
      draft.relations[0] = {
        ...draft.relations[0],
        relationType: "historical-transmission",
        direction: [draft.relations[0].pair[0], draft.relations[0].pair[1]],
        evidence: "attested",
        sources: [],
      };
    });
    expect(errors.some((e) => e.includes("requires at least one source"))).toBe(true);
  });

  it("rejects a historical-transmission resting on interpretive evidence", () => {
    const { errors } = mutate((draft) => {
      draft.relations[0] = {
        ...draft.relations[0],
        relationType: "historical-transmission",
        direction: [draft.relations[0].pair[0], draft.relations[0].pair[1]],
        evidence: "interpretive",
        sources: ["src.howat-1983"],
      };
    });
    expect(errors.some((e) => e.includes("asserts influence"))).toBe(true);
  });

  it("rejects a direction on a relation that is not a transmission", () => {
    const { errors } = mutate((draft) => {
      draft.relations[1] = {
        ...draft.relations[1],
        direction: [draft.relations[1].pair[0], draft.relations[1].pair[1]],
      };
    });
    expect(errors.some((e) => e.includes("direction is only permitted"))).toBe(true);
  });

  it("rejects contested evidence with no counterpoint", () => {
    const { errors } = mutate((draft) => {
      const index = draft.relations.findIndex((r) => r.evidence === "contested");
      const { counterpoint: _dropped, ...rest } = draft.relations[index];
      draft.relations[index] = rest;
    });
    expect(errors.some((e) => e.includes("requires a counterpoint"))).toBe(true);
  });

  it("rejects a sharedFacet neither concept carries", () => {
    const { errors } = mutate((draft) => {
      draft.relations[2] = {
        ...draft.relations[2],
        sharedFacets: [...draft.relations[2].sharedFacets, "orientation" as never],
      };
    });
    expect(errors.some((e) => e.includes("is not carried by"))).toBe(true);
  });

  it("rejects a fit without exactly one primary", () => {
    const { errors } = mutate((draft) => {
      draft.relations[3] = {
        ...draft.relations[3],
        fit: { echo: "primary", passage: "primary", tension: "partial", ground: "partial" },
      };
    });
    expect(errors.some((e) => e.includes("exactly one primary"))).toBe(true);
  });

  it("rejects an unsorted pair", () => {
    const { errors } = mutate((draft) => {
      const [a, b] = draft.relations[4].pair;
      draft.relations[4] = { ...draft.relations[4], pair: [b, a] };
    });
    expect(errors.some((e) => e.includes("pair must be sorted"))).toBe(true);
  });

  it("rejects a duplicate relation for one pair", () => {
    const { errors } = mutate((draft) => {
      draft.relations.push({ ...draft.relations[5], id: "rel.duplicate" });
    });
    expect(errors.some((e) => e.includes("duplicate relation for pair"))).toBe(true);
  });

  it("rejects an unresolvable source id", () => {
    const { errors } = mutate((draft) => {
      draft.relations[6] = { ...draft.relations[6], sources: ["src.does-not-exist"] };
    });
    expect(errors.some((e) => e.includes("unknown source"))).toBe(true);
  });

  it("rejects a fallback prompt that needs a facet it may not have", () => {
    const { errors } = mutate((draft) => {
      draft.openThreads = draft.openThreads.map((thread) =>
        thread.id === "thread.fallback.echo"
          ? { ...thread, question: "Do {a} and {b} share {facet}?" }
          : thread
      );
    });
    expect(errors.some((e) => e.includes("cannot use {facet}"))).toBe(true);
  });

  it("rejects a question that is not a question", () => {
    const { errors } = mutate((draft) => {
      draft.openThreads = draft.openThreads.map((thread) =>
        thread.id === "thread.fallback.ground"
          ? {
              ...thread,
              question:
                "Consider carefully which claim in {b} would fail if {a} turned out to be false.",
            }
          : thread
      );
    });
    expect(errors.some((e) => e.includes("must end with '?'"))).toBe(true);
  });

  it("rejects a missing intention fallback", () => {
    const { errors } = mutate((draft) => {
      draft.openThreads = draft.openThreads.filter(
        (thread) => thread.id !== "thread.fallback.passage"
      );
    });
    expect(errors.some((e) => e.includes('"passage" has no facet-independent'))).toBe(
      true
    );
  });

  it("rejects a concept dropping below two relations", () => {
    const { errors } = mutate((draft) => {
      draft.relations = draft.relations.filter(
        (relation) => !relation.pair.includes("matter.coupled-pendulums")
      );
    });
    expect(
      errors.some((e) => e.includes("matter.coupled-pendulums") && e.includes("minimum"))
    ).toBe(true);
  });

  it("rejects praise and pseudo-profundity in authored copy", () => {
    const { errors } = mutate((draft) => {
      draft.relations[7] = {
        ...draft.relations[7],
        insight: `You have discovered that everything is connected. ${draft.relations[7].insight}`.slice(
          0,
          600
        ),
      };
    });
    expect(errors.some((e) => e.includes("forbidden copy"))).toBe(true);
  });

  it("warns when the relation count drifts from the slice target", () => {
    const { warnings } = mutate((draft) => {
      draft.relations = draft.relations.slice(0, 10);
    });
    expect(warnings.some((w) => w.includes("slice target"))).toBe(true);
  });
});

describe("facets are claims about the concept, not about the relation that needed them", () => {
  const facetsOf = (id: string): readonly string[] => {
    const concept = CASTALIA_PACK.concepts.find((entry) => entry.id === id);
    expect(concept, id).toBeDefined();
    return (concept as CastaliaPack["concepts"][number]).facets;
  };

  it("does not give Conservation of Energy a direction in time", () => {
    /*
     * The First Law is time-reversal symmetric — energy is conserved running the
     * film backwards, which is exactly why the Second Law is needed to give time
     * an arrow. The concept's own description says the principle follows from
     * the laws being "the same today as tomorrow", and rel.conservation-entropy
     * is titled "The Total Holds, the Direction Does Not" and says in its first
     * clause that the first law "says nothing changes in total". The facet was
     * asserted in the same breath as the relation denied it.
     */
    expect(facetsOf("matter.conservation-of-energy")).not.toContain("irreversibility");
  });

  it("does not give Just Intonation unbroken variation", () => {
    /*
     * Just intonation is a set of exact whole-number ratios; "every intermediate
     * value genuinely occurs" is false of it, and rel.symmetry-just-intonation
     * — the only relation that consumed the facet — says outright that "just
     * intonation does not possess it".
     */
    expect(facetsOf("sound.just-intonation")).not.toContain("continuity");
  });

  it("writes no facet-specific prompt for a facet only one bead carries", () => {
    // A facet one bead carries can never be shared, so a prompt keyed to it can
    // never fire. Removing a facet without removing its prompt leaves exactly
    // that dead template behind.
    const carriers = new Map<string, number>();
    for (const concept of CASTALIA_PACK.concepts) {
      for (const facetId of concept.facets) {
        carriers.set(facetId, (carriers.get(facetId) ?? 0) + 1);
      }
    }
    for (const prompt of CASTALIA_PACK.openThreads) {
      if (prompt.facet === undefined) continue;
      expect(carriers.get(prompt.facet) ?? 0, prompt.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("Open Thread prompts, instantiated against the pairs that can reach them", () => {
  interface Instantiation {
    readonly promptId: string;
    readonly text: string;
  }

  const facetNameById = new Map(
    CASTALIA_PACK.facets.map((facet) => [facet.id as string, facet.name])
  );

  /**
   * Every question the pack can actually produce.
   *
   * A pair reaches a prompt when it has no documented relation and shares at
   * least one facet; both orderings are generated because the pair order is the
   * player's, not the pack's. A template that reads well in the abstract can be
   * nonsense once real names are in it, and instantiating it is the only way to
   * find out.
   */
  const INSTANTIATIONS: readonly Instantiation[] = (() => {
    const out: Instantiation[] = [];
    const concepts = CASTALIA_PACK.concepts;
    for (let i = 0; i < concepts.length; i += 1) {
      for (let j = i + 1; j < concepts.length; j += 1) {
        const left = concepts[i] as (typeof concepts)[number];
        const right = concepts[j] as (typeof concepts)[number];
        if (findRelation(left.id, right.id) !== undefined) continue;
        const shared = [...left.facets]
          .filter((facetId) => right.facets.includes(facetId))
          .sort();
        if (shared.length === 0) continue;
        for (const intention of RELATION_INTENTIONS) {
          const prompt = openThreadPromptFor(intention, shared);
          if (prompt === undefined) continue;
          const facetId =
            prompt.facet !== undefined && shared.includes(prompt.facet)
              ? prompt.facet
              : (shared[0] as (typeof shared)[number]);
          const facetName = facetNameById.get(facetId as string) ?? String(facetId);
          for (const [a, b] of [
            [left, right],
            [right, left],
          ] as const) {
            out.push({
              promptId: prompt.id,
              text: prompt.question
                .split("{a}")
                .join(a.name)
                .split("{b}")
                .join(b.name)
                .split("{facet}")
                .join(facetName),
            });
          }
        }
      }
    }
    return Object.freeze(out);
  })();

  it("actually produces a wide sweep of questions", () => {
    // Guards the sweep itself: if it collapses, the rules below prove nothing.
    expect(INSTANTIATIONS.length).toBeGreaterThan(200);
    expect(
      new Set(INSTANTIATIONS.map((entry) => entry.promptId)).size
    ).toBeGreaterThan(20);
  });

  /**
   * Each rule is a defect that has shipped in this file, restated as something a
   * machine can check on any question the pack can produce.
   */
  const RULES: ReadonlyArray<{
    readonly name: string;
    readonly pattern: RegExp;
    readonly why: string;
  }> = [
    {
      name: "no unsubstituted placeholder",
      pattern: /\{(?:a|b|facet)\}/,
      why: "a placeholder reached the player",
    },
    {
      name: "no bead treated as a proposition that could be false",
      pattern: /\bwere false\b/i,
      why: "beads include phenomena, instruments and techniques, and a phenomenon cannot be false",
    },
    {
      name: "no facet made an agent carrying something between the beads",
      pattern: /\b(?:carry|carries|bring|brings)\b[^?]*\b(?:from|into|back together)\b/i,
      why: "a facet is a property both beads have, never a channel that moves things between them",
    },
    {
      name: "no facet named twice over",
      pattern: /\bperiod of Return\b/i,
      why: "Return is this pack's name for periodicity, so this asks for the period of the period",
    },
    {
      name: "no doubled article",
      pattern: /\b(?:the|a|an) (?:the|a|an)\b/i,
      why: "a name was inserted into a slot that already carried its article",
    },
    {
      name: "no doubled or dangling space",
      pattern: /\s\s|\s[,.;:?]/,
      why: "a substitution left the spacing broken",
    },
  ];

  for (const rule of RULES) {
    it(rule.name, () => {
      const failures = INSTANTIATIONS.filter((entry) => rule.pattern.test(entry.text))
        .slice(0, 6)
        .map((entry) => `${entry.promptId}: ${rule.why}\n  "${entry.text}"`);
      expect(failures.join("\n")).toBe("");
    });
  }

  it("asks a question, and only a question", () => {
    for (const entry of INSTANTIATIONS) {
      expect(entry.text.trimEnd().endsWith("?"), entry.promptId).toBe(true);
      expect(entry.text.charAt(0), entry.promptId).toBe(
        entry.text.charAt(0).toUpperCase()
      );
      // Two sentences at most: a setup, and the question it leads to.
      expect(entry.text.split(/[.?]\s/).length, entry.promptId).toBeLessThanOrEqual(2);
    }
  });

  it("names both beads in every question it produces", () => {
    const names = CASTALIA_PACK.concepts.map((concept) => concept.name);
    for (const entry of INSTANTIATIONS) {
      const mentioned = names.filter((name) => entry.text.includes(name));
      expect(
        mentioned.length,
        `${entry.promptId}: "${entry.text}"`
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("the relations file introduces the pack it actually holds", () => {
  /**
   * The front matter of `relations.ts` states four counts in words. They were
   * wrong — "forty-three claims", "fifteen … interpretive" against a pack of
   * forty-four and twelve — because a number written in prose drifts the moment
   * a relation is added and nothing fails. This is what fails.
   */
  const UNDER_TWENTY: readonly string[] = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const TENS: readonly string[] = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  const numberWord = (value: number): string => {
    if (value < 0 || value > 99 || !Number.isInteger(value)) {
      throw new RangeError(`no word for ${value}`);
    }
    if (value < 20) return UNDER_TWENTY[value] as string;
    const tens = TENS[Math.floor(value / 10)] as string;
    const unit = value % 10;
    return unit === 0 ? tens : `${tens}-${UNDER_TWENTY[unit] as string}`;
  };

  /** The doc comment, with its leading asterisks and line breaks flattened. */
  const frontMatter = (): string => {
    const source = readFileSync(
      fileURLToPath(new URL("./relations.ts", import.meta.url)),
      "utf8"
    );
    const start = source.indexOf("/**");
    const end = source.indexOf("*/", start);
    expect(start, "relations.ts has no front matter").toBeGreaterThanOrEqual(0);
    return source
      .slice(start, end)
      .replace(/^\s*\*/gm, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const capitalise = (value: string): string =>
    `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

  it("keeps the front matter's arithmetic true", () => {
    const text = frontMatter();
    const total = CASTALIA_PACK.relations.length;
    const interpretive = CASTALIA_PACK.relations.filter(
      (relation) => relation.evidence === "interpretive"
    ).length;
    const transmissions = CASTALIA_PACK.relations.filter(
      (relation) => relation.relationType === "historical-transmission"
    ).length;
    const conceding = CASTALIA_PACK.relations.filter(
      (relation) => relation.counterpoint !== undefined
    ).length;

    expect(text).toContain(
      `${capitalise(numberWord(total))} claims about ${numberWord(
        CASTALIA_PACK.concepts.length
      )} beads`
    );
    expect(text).toContain(
      `${capitalise(numberWord(interpretive))} relations are interpretive on purpose`
    );
    expect(text).toContain(
      `Exactly ${numberWord(transmissions)} relation is typed \`historical-transmission\``
    );
    // Stated as "All forty-four carry a `counterpoint`" only while that is true
    // of every one of them.
    expect(conceding).toBe(total);
    expect(text).toContain(`All ${numberWord(total)} carry a \`counterpoint\``);
  });
});

// ─── Studies ────────────────────────────────────────────────────────────────

const conceptIdByName = new Map(
  CASTALIA_PACK.concepts.map((concept) => [concept.name, toConceptId(concept.id)])
);

const bead = (name: string): ConceptId => {
  const id = conceptIdByName.get(name);
  if (id === undefined) throw new RangeError(`the pack holds no bead named ${name}`);
  return id;
};

/** A line of threads through the named beads, bead to bead. */
const lineOf = (...names: string[]): readonly ConceptPair[] =>
  names.slice(1).map((name, index) => [bead(names[index] as string), bead(name)] as const);

/** Names as a presentation surface supplies them, from the pack. */
const STUDY_NAMES: StudyNames = {
  conceptName: (id) => CASTALIA_LOOKUP.conceptName(id),
  facetName: (id) => facetById.get(id)?.name ?? String(id),
  facultyName: (id) => facultyById.get(id)?.name ?? String(id),
};

/**
 * The pack's structure and nothing else: faculties and facets, with concept
 * names stubbed out. What a player can read from the beads, minus even the
 * names, so a test comparing it with the full lookup proves a Study never
 * leans on anything more.
 */
const STRUCTURE: ConceptStructureLookup = (() => {
  const byId = new Map(CASTALIA_PACK.concepts.map((concept) => [concept.id, concept]));
  return Object.freeze({
    conceptName: () => "",
    conceptFaculty: (id: ConceptId) => byId.get(id)?.faculty ?? FACULTY_IDS[0],
    conceptFacets: (id: ConceptId) => byId.get(id)?.facets ?? [],
  });
})();

const studyNamed = (id: string): StudyDefinition => {
  const study = castaliaStudyById.get(id);
  if (study === undefined) throw new RangeError(`no Study ${id}`);
  return study;
};

/**
 * The twelve Studies as the Studies spike (M9-001) fixes them: each brief, and
 * each Magister's line with the facet the packet names for every thread.
 */
const SPIKE_TABLE: ReadonlyArray<{
  readonly id: string;
  readonly brief: string;
  readonly line: readonly string[] | "silence";
  readonly carried?: readonly string[];
}> = [
  {
    id: "study.eschholz-1",
    brief: "From The Möbius Band to Counterpoint in two threads",
    line: ["The Möbius Band", "Continuous Symmetry", "Counterpoint"],
    carried: ["Continuity", "Invariance"],
  },
  {
    id: "study.eschholz-2",
    brief: "Carry Superposition through three faculties",
    line: ["The Fourier Series", "Counterpoint", "The Standing Wave"],
    carried: ["Superposition", "Superposition"],
  },
  {
    id: "study.eschholz-3",
    brief: "Carry Threshold into Matter",
    line: ["Cantor's Diagonal Argument", "Diffraction"],
    carried: ["Threshold"],
  },
  { id: "study.eschholz-4", brief: "Carry Proportion into Matter", line: "silence" },
  {
    id: "study.waldzell-1",
    brief: "From The Möbius Band to Polyrhythm in three threads",
    line: ["The Möbius Band", "Cantor's Diagonal Argument", "Prime Numbers", "Polyrhythm"],
    carried: ["Self-Reference", "Discreteness", "No Common Measure"],
  },
  {
    id: "study.waldzell-2",
    brief: "Carry Decomposition through all four faculties",
    line: ["Prime Numbers", "The Overtone Series", "Conservation of Energy", "Divisionism"],
    carried: ["Decomposition", "Decomposition", "Decomposition"],
  },
  {
    id: "study.waldzell-3",
    brief: "From Just Intonation to Polyrhythm in two threads",
    line: "silence",
  },
  {
    id: "study.waldzell-4",
    brief: "From Girih Tiling to Polyrhythm in two threads",
    line: ["Girih Tiling", "Isorhythm", "Polyrhythm"],
    carried: ["Recursion", "No Common Measure"],
  },
  {
    id: "study.vicus-lusorum-1",
    brief: "From Coupled Pendulums to The Möbius Band in three threads",
    line: ["Coupled Pendulums", "Diffraction", "Cantor's Diagonal Argument", "The Möbius Band"],
    carried: ["Interference", "Threshold", "Self-Reference"],
  },
  {
    id: "study.vicus-lusorum-2",
    brief: "Carry Return through three faculties",
    line: ["The Fourier Series", "Polyrhythm", "Coupled Pendulums"],
    carried: ["Return", "Return"],
  },
  { id: "study.vicus-lusorum-3", brief: "Carry No Common Measure into Image", line: "silence" },
  {
    id: "study.vicus-lusorum-4",
    brief: "Carry Discreteness through all four faculties",
    line: ["Fibonacci Sequence", "Equal Temperament", "The Crystal Lattice", "Divisionism"],
    carried: ["Discreteness", "Discreteness", "Discreteness"],
  },
];

/**
 * What the solver finds within each authored bead set. Pinned, so a change to
 * a set — or to a bead's facets — that alters a Study is seen and reviewed.
 */
const PROOFS: Readonly<
  Record<string, { readonly answers: number; readonly shortest: number | null }>
> = {
  "study.eschholz-1": { answers: 1, shortest: 2 },
  "study.eschholz-2": { answers: 3, shortest: 2 },
  "study.eschholz-3": { answers: 2, shortest: 1 },
  "study.eschholz-4": { answers: 0, shortest: null },
  "study.waldzell-1": { answers: 1, shortest: 3 },
  "study.waldzell-2": { answers: 16, shortest: 3 },
  "study.waldzell-3": { answers: 0, shortest: 3 },
  "study.waldzell-4": { answers: 1, shortest: 2 },
  "study.vicus-lusorum-1": { answers: 1, shortest: 3 },
  "study.vicus-lusorum-2": { answers: 3, shortest: 2 },
  "study.vicus-lusorum-3": { answers: 0, shortest: null },
  "study.vicus-lusorum-4": { answers: 16, shortest: 3 },
};

/** The marks the Magister's own line earns when it is all a session weaves. */
const MAGISTER_MARKS: Readonly<Record<string, readonly string[]>> = {
  "study.eschholz-1": ["economical", "varied"],
  "study.eschholz-2": ["economical"],
  "study.eschholz-3": ["economical"],
  "study.waldzell-1": ["economical", "varied"],
  "study.waldzell-2": ["economical", "wide"],
  "study.waldzell-4": ["economical", "varied"],
  "study.vicus-lusorum-1": ["economical", "varied"],
  "study.vicus-lusorum-2": ["economical"],
  "study.vicus-lusorum-4": ["economical", "wide"],
};

/** Why each silence holds, in the words the plate uses. */
const SILENCE_REASONS: Readonly<Record<string, string>> = {
  "study.eschholz-4": "No Matter bead here carries Proportion.",
  "study.waldzell-3":
    "No bead here carries a facet of both Just Intonation and Polyrhythm; the shortest way needs three.",
  "study.vicus-lusorum-3": "No Image bead here carries No Common Measure.",
};

const SOLVABLE = CASTALIA_STUDIES.filter((study) => study.answer.kind === "threads");
const SILENT = CASTALIA_STUDIES.filter((study) => study.answer.kind === "silence");

const magisterPairs = (study: StudyDefinition): readonly ConceptPair[] =>
  study.answer.kind === "threads" ? study.answer.pairs : [];

/** Every pair of the Study's beads: the most a session over them can weave once each. */
const everyPair = (study: StudyDefinition): readonly ConceptPair[] =>
  study.conceptIds.flatMap((a, index) =>
    study.conceptIds.slice(index + 1).map((b) => [a, b] as const)
  );

function studySession(
  study: StudyDefinition,
  pairs: readonly ConceptPair[],
  outcome?: "documented" | "open-thread"
) {
  return buildStudySession({
    studyId: study.id,
    conceptIds: study.conceptIds,
    contentPackVersion: String(CONTENT_PACK_VERSION),
    threads: pairs.map(([a, b]) => ({ a, b, outcome })),
  });
}

describe("Studies — the twelve", () => {
  it("holds twelve Studies in chapter order, then by ordinal", () => {
    expect(CASTALIA_STUDIES.map((study) => study.id)).toEqual(SPIKE_TABLE.map((row) => row.id));
    expect(CASTALIA_PACK.studies).toBe(CASTALIA_STUDIES);
    for (const study of CASTALIA_STUDIES) expect(castaliaStudyById.get(study.id)).toBe(study);
  });

  it.each(SPIKE_TABLE)("$id poses its brief and holds the Magister's answer", (row) => {
    const study = studyNamed(row.id);
    expect(renderStudyBrief(study.goal, STUDY_NAMES)).toBe(row.brief);

    if (row.line === "silence") {
      expect(study.answer).toEqual({ kind: "silence" });
      expect(magisterLine(study, STRUCTURE)).toBeNull();
      return;
    }
    expect(study.answer).toEqual({ kind: "threads", pairs: lineOf(...row.line) });
    const steps = magisterLine(study, STRUCTURE) ?? [];
    expect(steps).toHaveLength(row.carried?.length ?? -1);
    steps.forEach((step, index) => {
      expect(step.facets.map((facet) => STUDY_NAMES.facetName(facet))).toContain(
        row.carried?.[index]
      );
    });
  });

  it("gives each Study eight beads of its own, in pack order, across at least three faculties", () => {
    const packOrder = new Map(CASTALIA_PACK.concepts.map((concept, index) => [concept.id, index]));
    const sets = new Set<string>();
    for (const study of CASTALIA_STUDIES) {
      expect(study.conceptIds, study.id).toHaveLength(8);
      const order = study.conceptIds.map((id) => packOrder.get(id) ?? -1);
      expect(order, study.id).toEqual([...order].sort((a, b) => a - b));
      expect(order, study.id).not.toContain(-1);
      const faculties = new Set(study.conceptIds.map((id) => STRUCTURE.conceptFaculty(id)));
      expect(faculties.size, study.id).toBeGreaterThanOrEqual(3);
      sets.add([...study.conceptIds].sort().join("+"));
    }
    expect(sets.size).toBe(CASTALIA_STUDIES.length);
  });

  it("raises no Study issue in the shipped pack", () => {
    expect(validateStudies(CASTALIA_PACK)).toEqual([]);
  });

  it.each(CASTALIA_STUDIES.map((study) => ({ id: study.id, study })))(
    "$id is proved by the solver as authored",
    ({ study }) => {
      const solution = solveStudy(study, STRUCTURE);
      expect({ answers: solution.answers.length, shortest: solution.shortest }).toEqual(
        PROOFS[study.id]
      );
      expect(solution.count).toBe(studyCount(study.goal));
      if (study.answer.kind === "threads") {
        expect(study.answer.pairs).toHaveLength(solution.count);
        expect(solution.answers.map(answerKey)).toContain(answerKey(study.answer.pairs));
      }
    }
  );

  it("counts the pack's faculties as the domain does", () => {
    expect(FACULTY_IDS).toHaveLength(FACULTY_COUNT);
    expect(FACULTIES).toHaveLength(FACULTY_COUNT);
    expect(CASTALIA_PACK.faculties).toHaveLength(FACULTY_COUNT);
  });
});

describe("Studies — the spike's claims about the whole pack", () => {
  const everyBead = CASTALIA_PACK.concepts.map((concept) => toConceptId(concept.id));
  const overThePack = (id: string) =>
    solveStudy({ ...studyNamed(id), conceptIds: everyBead }, STRUCTURE);
  const keys = (answers: readonly (readonly ConceptPair[])[]) => answers.map(answerKey).sort();

  it("eschholz-1's line is the only two-thread way in the pack", () => {
    expect(keys(overThePack("study.eschholz-1").answers)).toEqual(
      keys([lineOf("The Möbius Band", "Continuous Symmetry", "Counterpoint")])
    );
  });

  it.each([
    { id: "study.waldzell-1", ways: 4, shortest: 3 },
    { id: "study.waldzell-4", ways: 2, shortest: 2 },
    { id: "study.vicus-lusorum-1", ways: 3, shortest: 3 },
  ])("$id has $ways ways in the pack, the Magister's among them", ({ id, ways, shortest }) => {
    const solution = overThePack(id);
    expect(solution.answers).toHaveLength(ways);
    expect(solution.shortest).toBe(shortest);
    expect(keys(solution.answers)).toContain(answerKey(magisterPairs(studyNamed(id))));
  });

  it("waldzell-3: no bead in the pack carries a facet of both, and the shortest way needs three", () => {
    const solution = overThePack("study.waldzell-3");
    expect(solution.answers).toEqual([]);
    expect(solution.shortest).toBe(3);
    const facetsOf = (name: string) =>
      new Set(CASTALIA_PACK.concepts.find((concept) => concept.name === name)?.facets ?? []);
    const just = facetsOf("Just Intonation");
    const polyrhythm = facetsOf("Polyrhythm");
    const bridges = CASTALIA_PACK.concepts.filter(
      (concept) =>
        concept.facets.some((facet) => just.has(facet)) &&
        concept.facets.some((facet) => polyrhythm.has(facet))
    );
    expect(bridges).toEqual([]);
  });

  it.each([
    { id: "study.eschholz-4", facet: "proportion", faculty: "matter" },
    { id: "study.vicus-lusorum-3", facet: "incommensurability", faculty: "image" },
  ])("$id: no bead of the faculty carries the facet, anywhere in the pack", ({ id, facet, faculty }) => {
    expect(overThePack(id).answers).toEqual([]);
    const carriers = CASTALIA_PACK.concepts.filter(
      (concept) => concept.faculty === faculty && concept.facets.includes(toFacetId(facet))
    );
    expect(carriers).toEqual([]);
  });
});

describe("Studies — solved by the Magister's line, or by silence", () => {
  it.each(SOLVABLE.map((study) => ({ id: study.id, study })))(
    "$id is solved by the Magister's own line, read as it is written",
    ({ study }) => {
      const session = studySession(study, magisterPairs(study));
      const status = evaluateStudy(session.state, study, CASTALIA_LOOKUP, false);
      if (status.kind !== "solved" || status.by !== "threads") {
        throw new Error(`${study.id} was not solved by threads`);
      }
      expect(status.threadIds).toEqual(session.threadIds);
      expect(status.explanation.steps).toEqual(magisterLine(study, STRUCTURE));
      expect(status.explanation.count).toBe(studyCount(study.goal));
      expect(status.marks).toEqual(MAGISTER_MARKS[study.id]);
    }
  );

  it.each(SILENT.map((study) => ({ id: study.id, study })))(
    "$id is solved by declaring silence, and says why",
    ({ study }) => {
      const status = evaluateStudy(studySession(study, []).state, study, CASTALIA_LOOKUP, true);
      expect(status.kind === "solved" && status.by === "silence").toBe(true);
      expect(describeStudyStatus(status, STUDY_NAMES)).toBe(SILENCE_REASONS[study.id]);
    }
  );

  it.each(SILENT.map((study) => ({ id: study.id, study })))(
    "$id is never solved by threads, whatever is woven",
    ({ study }) => {
      const status = evaluateStudy(
        studySession(study, everyPair(study)).state,
        study,
        CASTALIA_LOOKUP,
        false
      );
      expect(status).toEqual({ kind: "not-yet", statement: { kind: "no-answer-yet" } });
    }
  );

  it.each(SOLVABLE.map((study) => ({ id: study.id, study })))(
    "$id meets a declared silence with not yet, and nothing more",
    ({ study }) => {
      const status = evaluateStudy(studySession(study, []).state, study, CASTALIA_LOOKUP, true);
      expect(status).toEqual({ kind: "not-yet", statement: { kind: "can-be-done" } });
      expect(describeStudyStatus(status, STUDY_NAMES)).toBe(
        "Not yet — it can be done with these beads."
      );
    }
  );
});

describe("Studies — the honesty rules against the shipped pack", () => {
  const sessionsFor = (study: StudyDefinition): readonly (readonly ConceptPair[])[] => [
    [],
    magisterPairs(study),
    everyPair(study),
  ];

  it("R1: the full lookup and structure alone give byte-identical status", () => {
    // The pack's full lookup — names, relations, prompts — narrowed only by the parameter type.
    const full: ConceptStructureLookup = CASTALIA_LOOKUP;
    for (const study of CASTALIA_STUDIES) {
      for (const pairs of sessionsFor(study)) {
        const state = studySession(study, pairs).state;
        for (const declared of [false, true]) {
          const status: StudyStatus = evaluateStudy(state, study, full, declared);
          expect(JSON.stringify(status), study.id).toBe(
            JSON.stringify(evaluateStudy(state, study, STRUCTURE, declared))
          );
        }
      }
    }
  });

  it("R2: every outcome documented, every one an Open Thread, or none — the same status", () => {
    for (const study of CASTALIA_STUDIES) {
      for (const pairs of sessionsFor(study)) {
        for (const declared of [false, true]) {
          const statuses = (["documented", "open-thread", undefined] as const).map((outcome) =>
            JSON.stringify(
              evaluateStudy(
                studySession(study, pairs, outcome).state,
                study,
                CASTALIA_LOOKUP,
                declared
              )
            )
          );
          expect(new Set(statuses).size, study.id).toBe(1);
        }
      }
    }
  });
});

describe("Studies — the validator refuses a Study that is not what it claims", () => {
  const replace = (
    id: string,
    change: (study: StudyDefinition) => StudyDefinition
  ): CastaliaPack => ({
    ...CASTALIA_PACK,
    studies: CASTALIA_STUDIES.map((study) => (study.id === id ? change(study) : study)),
  });
  const beadsOf = (...names: string[]): readonly ConceptId[] => names.map(bead);
  const codes = (pack: CastaliaPack): readonly StudyErrorCode[] =>
    validateStudies(pack).map((issue) => issue.code);
  const ESCHHOLZ_1 = "study.eschholz-1";
  const chiaroscuro = (): ConceptId => bead("Chiaroscuro");

  const CASES: ReadonlyArray<{
    readonly code: StudyErrorCode;
    readonly pack: () => CastaliaPack;
  }> = [
    {
      code: "study-id",
      pack: () =>
        replace(ESCHHOLZ_1, (study) => ({ ...study, id: toStudyId("study.eschholz-one") })),
    },
    {
      code: "study-bead-count",
      pack: () =>
        replace(ESCHHOLZ_1, (study) => ({
          ...study,
          conceptIds: study.conceptIds.filter((id) => id !== chiaroscuro()),
        })),
    },
    {
      code: "study-bead-order",
      pack: () =>
        replace(ESCHHOLZ_1, (study) => ({ ...study, conceptIds: [...study.conceptIds].reverse() })),
    },
    {
      code: "study-unknown-concept",
      pack: () =>
        replace(ESCHHOLZ_1, (study) => ({
          ...study,
          conceptIds: study.conceptIds.map((id) =>
            id === chiaroscuro() ? toConceptId("image.nowhere") : id
          ),
        })),
    },
    {
      code: "study-faculties",
      pack: () =>
        replace(ESCHHOLZ_1, (study) => ({
          ...study,
          conceptIds: beadsOf(
            "Fibonacci Sequence",
            "Continuous Symmetry",
            "The Möbius Band",
            "Cantor's Diagonal Argument",
            "Counterpoint",
            "Just Intonation",
            "Equal Temperament",
            "The Overtone Series"
          ),
        })),
    },
    {
      // Coupled Pendulums shares no facet with any bead of eschholz-1.
      code: "study-distractor",
      pack: () =>
        replace(ESCHHOLZ_1, (study) => ({
          ...study,
          conceptIds: study.conceptIds.map((id) =>
            id === chiaroscuro() ? bead("Coupled Pendulums") : id
          ),
        })),
    },
    {
      code: "study-duplicate-beads",
      pack: () =>
        replace("study.eschholz-2", (study) => ({
          ...study,
          conceptIds: studyNamed(ESCHHOLZ_1).conceptIds,
        })),
    },
    {
      code: "study-goal",
      pack: () =>
        replace(ESCHHOLZ_1, (study) => ({
          ...study,
          goal: {
            kind: "passage",
            from: bead("Girih Tiling"),
            to: bead("Counterpoint"),
            threads: 2,
          },
        })),
    },
    {
      // A line from the right bead to the right bead, through a bead that carries nothing.
      code: "study-answer",
      pack: () =>
        replace(ESCHHOLZ_1, (study) => ({
          ...study,
          answer: {
            kind: "threads",
            pairs: lineOf("The Möbius Band", "Fibonacci Sequence", "Counterpoint"),
          },
        })),
    },
    {
      // The right threads, written from the wrong end.
      code: "study-answer-line",
      pack: () =>
        replace(ESCHHOLZ_1, (study) => ({
          ...study,
          answer: {
            kind: "threads",
            pairs: lineOf("Counterpoint", "Continuous Symmetry", "The Möbius Band"),
          },
        })),
    },
    {
      code: "study-shorter-answer",
      pack: () =>
        replace(ESCHHOLZ_1, (study) => ({
          ...study,
          goal: {
            kind: "passage",
            from: bead("The Möbius Band"),
            to: bead("Counterpoint"),
            threads: 3,
          },
          answer: {
            kind: "threads",
            pairs: lineOf("The Möbius Band", "Chiaroscuro", "Continuous Symmetry", "Counterpoint"),
          },
        })),
    },
    {
      // Six ways of three from Just Intonation to Polyrhythm, and none shorter.
      code: "study-passage-answers",
      pack: () =>
        replace("study.waldzell-3", (study) => ({
          ...study,
          conceptIds: beadsOf(
            "Fibonacci Sequence",
            "Prime Numbers",
            "The Fourier Series",
            "Counterpoint",
            "Polyrhythm",
            "Just Intonation",
            "The Overtone Series",
            "Conservation of Energy"
          ),
          goal: {
            kind: "passage",
            from: bead("Just Intonation"),
            to: bead("Polyrhythm"),
            threads: 3,
          },
          answer: {
            kind: "threads",
            pairs: lineOf("Just Intonation", "Fibonacci Sequence", "Prime Numbers", "Polyrhythm"),
          },
        })),
    },
    {
      code: "study-silence-answer",
      pack: () =>
        replace("study.eschholz-3", (study) => ({ ...study, answer: { kind: "silence" } })),
    },
    {
      // Nothing here joins Just Intonation to Polyrhythm at all.
      code: "study-silence-longer-way",
      pack: () =>
        replace("study.waldzell-3", (study) => ({
          ...study,
          conceptIds: beadsOf(
            "Continuous Symmetry",
            "The Möbius Band",
            "Polyrhythm",
            "Isorhythm",
            "Just Intonation",
            "Conservation of Energy",
            "Coupled Pendulums",
            "Linear Perspective"
          ),
        })),
    },
    {
      code: "study-sequence",
      pack: () => ({
        ...CASTALIA_PACK,
        studies: [
          studyNamed("study.eschholz-2"),
          studyNamed(ESCHHOLZ_1),
          ...CASTALIA_STUDIES.slice(2),
        ],
      }),
    },
  ];

  it("exercises every rule once", () => {
    expect(CASES.map((entry) => entry.code).sort()).toEqual([...STUDY_ERROR_CODES].sort());
  });

  it.each(CASES)("rejects a Study that breaks $code", ({ code, pack }) => {
    expect(codes(pack())).toContain(code);
  });

  it("reports exactly the broken rule where only one is broken", () => {
    const exact: readonly StudyErrorCode[] = [
      "study-id",
      "study-bead-count",
      "study-bead-order",
      "study-unknown-concept",
      "study-faculties",
      "study-distractor",
      "study-goal",
      "study-answer",
      "study-answer-line",
      "study-passage-answers",
      "study-silence-answer",
      "study-silence-longer-way",
      "study-sequence",
    ];
    for (const entry of CASES.filter((candidate) => exact.includes(candidate.code))) {
      expect(codes(entry.pack()), entry.code).toEqual([entry.code]);
    }
  });

  it("fails the pack, and so the build, on a broken Study", () => {
    const broken = replace("study.eschholz-3", (study) => ({
      ...study,
      answer: { kind: "silence" },
    }));
    expect(
      validateCastaliaPack(broken).errors.some(
        (error) =>
          error.startsWith("study.eschholz-3: ") && error.endsWith("[study-silence-answer]")
      )
    ).toBe(true);
    expect(() => assertCastaliaPackValid(broken)).toThrow(/study-silence-answer/);
  });

  it("gives every broken rule a message a content author can act on", () => {
    for (const entry of CASES) {
      for (const issue of validateStudies(entry.pack())) {
        expect(issue.message.trim().length, entry.code).toBeGreaterThan(10);
        expect(issue.subject, entry.code).toMatch(/^(study\.|chapter )/);
      }
    }
  });
});
