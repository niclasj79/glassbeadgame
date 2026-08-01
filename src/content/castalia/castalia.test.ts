import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { RELATION_INTENTIONS, type RelationIntention } from "@/domain/events";
import { toConceptId } from "@/domain/ids";
import type { RelationLookup } from "@/domain/outcomes/lookup";

import {
  CASTALIA_LOOKUP,
  CASTALIA_PACK,
  CONTENT_PACK_VERSION,
  findRelation,
  openThreadPromptFor,
  openThreadsByIntention,
  relationByKey,
  relationsByConcept,
} from "./index";
import {
  relationKey,
  toFacetId,
  type CastaliaPack,
  type DocumentedRelation,
} from "./schema";
import { validateCastaliaPack } from "./validate";

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
