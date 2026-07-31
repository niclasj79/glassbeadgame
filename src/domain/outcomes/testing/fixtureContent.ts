import { toConceptId, type ConceptId } from "../../ids";
import type { RelationIntention } from "../../events";
import {
  relationKey,
  toFacetId,
  type ConceptMotif,
  type DocumentedRelation,
  type FacetId,
  type FacultyId,
  type OpenThreadPrompt,
} from "@/content/castalia/schema";
import type { RelationLookup } from "../lookup";

/**
 * A HAND-BUILT CONTENT PACK FOR TESTS.
 *
 * Deliberately independent of `src/content/castalia/*` so that every semantic
 * rule in the domain is proved against material the test itself controls: the
 * shipped pack can be re-authored, re-sourced, or reduced without a single
 * domain test changing meaning. The shapes are the real schema shapes, so this
 * is a faithful stand-in rather than a simplification.
 *
 * Fifteen concepts across the four faculties, with pairs deliberately chosen to
 * exercise all three outcome shapes: documented pairs, pairs that share a facet
 * but nothing authored, and pairs with neither.
 */

const facet = (id: string): FacetId => toFacetId(id);

interface FixtureConcept {
  readonly id: ConceptId;
  readonly name: string;
  readonly faculty: FacultyId;
  readonly facets: readonly FacetId[];
  readonly motif: ConceptMotif;
}

const motif = (
  degrees: readonly number[],
  rhythm: readonly number[],
  register: ConceptMotif["register"],
  articulation: ConceptMotif["articulation"],
  timbre: ConceptMotif["timbre"]
): ConceptMotif => Object.freeze({ degrees, rhythm, register, articulation, timbre });

const concept = (
  id: string,
  name: string,
  faculty: FacultyId,
  facets: readonly string[],
  conceptMotif: ConceptMotif
): FixtureConcept =>
  Object.freeze({
    id: toConceptId(id),
    name,
    faculty,
    facets: Object.freeze(facets.map(facet)),
    motif: conceptMotif,
  });

export const FIXTURE_CONCEPTS: readonly FixtureConcept[] = Object.freeze([
  // ── Measure ───────────────────────────────────────────────────────────────
  concept(
    "measure.fibonacci",
    "Fibonacci Sequence",
    "measure",
    ["recursion", "proportion", "discreteness"],
    motif([0, 0, 1, 2, 4], [1, 1, 2, 3, 5], "mid", "plucked", "gut")
  ),
  concept(
    "measure.primes",
    "Prime Numbers",
    "measure",
    ["discreteness", "incommensurability", "decomposition"],
    motif([0, 2, 3, 5], [2, 3, 5, 7], "mid", "struck", "metal")
  ),
  concept(
    "measure.symmetry",
    "Continuous Symmetry",
    "measure",
    ["invariance", "continuity"],
    motif([0, 0, 0], [6, 6, 6], "low", "sustained", "glass")
  ),
  concept(
    "measure.fourier",
    "The Fourier Series",
    "measure",
    ["decomposition", "superposition", "periodicity"],
    motif([0, 4, 7, 11], [8, 4, 2, 2], "high", "bowed", "glass")
  ),
  concept(
    "measure.cantor",
    "Cantor's Diagonal Argument",
    "measure",
    ["self-reference", "discreteness", "threshold"],
    motif([0, 1, 3, 6, 10], [4, 3, 2, 2, 1], "high", "plucked", "metal")
  ),
  // ── Sound ─────────────────────────────────────────────────────────────────
  concept(
    "sound.counterpoint",
    "Counterpoint",
    "sound",
    ["imitation", "superposition", "invariance"],
    motif([0, 4, 2, 7], [4, 4, 4, 4], "mid", "bowed", "gut")
  ),
  concept(
    "sound.polyrhythm",
    "Polyrhythm",
    "sound",
    ["periodicity", "incommensurability", "interference"],
    motif([0, 0, 3, 0], [3, 3, 2, 2], "low", "struck", "wood")
  ),
  concept(
    "sound.just-intonation",
    "Just Intonation",
    "sound",
    ["proportion", "invariance", "continuity"],
    motif([0, 7, 4, 0], [6, 6, 6, 6], "mid", "sustained", "voice")
  ),
  concept(
    "sound.equal-temperament",
    "Equal Temperament",
    "sound",
    ["quantisation", "compromise", "discreteness"],
    motif([0, 1, 2, 3], [3, 3, 3, 3], "mid", "struck", "metal")
  ),
  concept(
    "sound.overtone-series",
    "The Overtone Series",
    "sound",
    ["decomposition", "superposition", "proportion"],
    motif([0, 12, 19, 24], [8, 4, 2, 2], "low", "rung", "metal")
  ),
  // ── Matter ────────────────────────────────────────────────────────────────
  concept(
    "matter.standing-wave",
    "The Standing Wave",
    "matter",
    ["superposition", "quantisation", "interference"],
    motif([0, 12, 7], [8, 4, 4], "low", "bowed", "wood")
  ),
  concept(
    "matter.energy",
    "Conservation of Energy",
    "matter",
    ["invariance", "irreversibility"],
    motif([0, 0], [12, 12], "sub", "sustained", "glass")
  ),
  concept(
    "matter.pendulums",
    "Coupled Pendulums",
    "matter",
    ["entrainment", "periodicity", "interference"],
    motif([0, -5, 0, -5], [4, 4, 4, 4], "low", "plucked", "wood")
  ),
  // ── Image ─────────────────────────────────────────────────────────────────
  concept(
    "image.perspective",
    "Linear Perspective",
    "image",
    ["projection", "viewpoint", "proportion"],
    motif([0, 5, 9], [6, 4, 2], "high", "breathed", "reed")
  ),
  concept(
    "image.divisionism",
    "Divisionism",
    "image",
    ["optical-mixture", "discreteness", "decomposition"],
    motif([0, 2, 4, 6, 8], [1, 1, 1, 1, 1], "air", "plucked", "glass")
  ),
  concept(
    "image.girih",
    "Girih Tiling",
    "image",
    ["tiling", "recursion", "proportion"],
    motif([0, 5, 10, 5], [4, 4, 4, 4], "mid", "rung", "glass")
  ),
]);

/** Facet display names, matching the vocabulary's player-facing names. */
export const FIXTURE_FACET_NAMES: Readonly<Record<string, string>> = Object.freeze({
  recursion: "Recursion",
  invariance: "Invariance",
  periodicity: "Return",
  incommensurability: "No Common Measure",
  decomposition: "Decomposition",
  superposition: "Superposition",
  projection: "Projection",
  viewpoint: "Standpoint",
  discreteness: "Discreteness",
  continuity: "Continuity",
  compromise: "Deliberate Error",
  irreversibility: "Irreversibility",
  entrainment: "Entrainment",
  "optical-mixture": "Mixture in the Eye",
  proportion: "Proportion",
  tiling: "Tiling",
  imitation: "Imitation",
  interference: "Interference",
  quantisation: "Quantisation",
  "self-reference": "Self-Reference",
  threshold: "Threshold",
});

const relation = (
  id: string,
  a: string,
  b: string,
  title: string,
  relationType: DocumentedRelation["relationType"],
  evidence: DocumentedRelation["evidence"],
  fit: DocumentedRelation["fit"],
  sharedFacets: readonly string[],
  insight: string
): DocumentedRelation => {
  const pair: readonly [string, string] = a < b ? [a, b] : [b, a];
  return Object.freeze({
    id,
    pair,
    title,
    relationType,
    evidence,
    fit,
    insight,
    sharedFacets: Object.freeze(sharedFacets.map(facet)),
    sources: Object.freeze([`${id}.source`]),
  });
};

export const FIXTURE_RELATIONS: readonly DocumentedRelation[] = Object.freeze([
  relation(
    "rel.spiral-canon",
    "measure.fibonacci",
    "sound.counterpoint",
    "The Spiral Canon",
    "structural-correspondence",
    "interpretive",
    { echo: "primary", passage: "partial", tension: "unsupported", ground: "supported" },
    [],
    "Proportional growth and displaced imitative entries are compared as structures; no influence is asserted."
  ),
  relation(
    "rel.indivisible-rhythms",
    "measure.primes",
    "sound.polyrhythm",
    "Indivisible Rhythms",
    "structural-correspondence",
    "established",
    { echo: "primary", passage: "partial", tension: "partial", ground: "supported" },
    ["incommensurability"],
    "Cycles of co-prime length realign only after their product, which is the arithmetic fact stated in time."
  ),
  relation(
    "rel.noethers-mirror",
    "measure.symmetry",
    "matter.energy",
    "Noether's Mirror",
    "formal-ground",
    "established",
    { ground: "primary", echo: "supported", passage: "partial", tension: "unsupported" },
    ["invariance"],
    "A continuous symmetry of the action yields a conserved quantity; time-translation invariance yields energy."
  ),
  relation(
    "rel.one-comma",
    "sound.just-intonation",
    "sound.equal-temperament",
    "One Comma, Deliberately Spent",
    "opposition",
    "established",
    { tension: "primary", passage: "supported", ground: "partial", echo: "unsupported" },
    [],
    "Twelve just fifths exceed seven octaves by the Pythagorean comma; equal temperament spends that comma on purpose."
  ),
  relation(
    "rel.same-series-twice",
    "sound.overtone-series",
    "matter.standing-wave",
    "The Same Series, Twice",
    "material-ground",
    "established",
    { ground: "primary", echo: "supported", passage: "partial", tension: "unsupported" },
    ["superposition"],
    "A bounded medium admits only whole-number modes; the overtone series is that mode set, heard."
  ),
  relation(
    "rel.partials-as-coefficients",
    "measure.fourier",
    "sound.overtone-series",
    "Partials as Coefficients",
    "structural-correspondence",
    "established",
    { echo: "primary", ground: "supported", passage: "supported", tension: "unsupported" },
    ["decomposition", "superposition"],
    "The harmonic partials of a periodic tone are exactly the non-zero coefficients of its Fourier expansion."
  ),
  relation(
    "rel.ratios-from-the-series",
    "sound.overtone-series",
    "sound.just-intonation",
    "Ratios from the Series",
    "formal-ground",
    "established",
    { ground: "primary", echo: "supported", passage: "partial", tension: "unsupported" },
    ["proportion"],
    "The intervals of just intonation are the small whole-number ratios that the low partials already state."
  ),
  relation(
    "rel.modes-of-a-string",
    "measure.fourier",
    "matter.standing-wave",
    "Modes of a String",
    "instantiation",
    "established",
    { ground: "primary", echo: "supported", passage: "supported", tension: "unsupported" },
    ["superposition"],
    "A vibrating string realises the Fourier basis physically: each mode is one term of the series."
  ),
  relation(
    "rel.two-geometries",
    "image.perspective",
    "image.girih",
    "Two Geometries of the Surface",
    "structural-correspondence",
    "interpretive",
    { echo: "primary", tension: "supported", passage: "partial", ground: "unsupported" },
    ["proportion"],
    "Both organise a plane by ratio, one toward a single standpoint and one without any privileged place to stand."
  ),
  relation(
    "rel.analysis-on-the-canvas",
    "image.divisionism",
    "measure.fourier",
    "Analysis on the Canvas",
    "structural-correspondence",
    "interpretive",
    { echo: "primary", passage: "partial", ground: "partial", tension: "unsupported" },
    ["decomposition"],
    "Both separate a whole into independent components that recombine only in the reading."
  ),
  relation(
    "rel.beating-and-entrainment",
    "matter.pendulums",
    "sound.polyrhythm",
    "Falling Into Step",
    "structural-correspondence",
    "contested",
    { echo: "primary", ground: "partial", passage: "partial", tension: "supported" },
    ["periodicity", "interference"],
    "Weakly coupled oscillators lock; whether rhythmic performance entrains the same way is actively disputed."
  ),
]);

export const FIXTURE_OPEN_THREAD_PROMPTS: readonly OpenThreadPrompt[] = Object.freeze([
  Object.freeze({
    id: "ot.echo.recursion",
    intention: "echo" as RelationIntention,
    facet: facet("recursion"),
    question:
      "Does {facet} take the same form in {a} that it takes in {b}, or only the same name?",
  }),
  Object.freeze({
    id: "ot.echo",
    intention: "echo" as RelationIntention,
    question:
      "{a} and {b} both show {facet}. What would have to be demonstrated for that to be one form rather than two?",
  }),
  Object.freeze({
    id: "ot.passage",
    intention: "passage" as RelationIntention,
    question:
      "You are asking whether {facet} passed from {a} into {b}. What record would show the transmission?",
  }),
  Object.freeze({
    id: "ot.tension",
    intention: "tension" as RelationIntention,
    question:
      "{a} and {b} both carry {facet}. At what point does {facet} stop holding for both of them?",
  }),
  Object.freeze({
    id: "ot.ground",
    intention: "ground" as RelationIntention,
    question:
      "You are asking whether {a} gives {b} its {facet}. What would that support actually consist of?",
  }),
]);

export interface FixtureLookupOptions {
  /** Drop every authored prompt, to exercise the domain fallback questions. */
  readonly withoutOpenThreadPrompts?: boolean;
  /** Drop every documented relation, to exercise Open Thread and unresolved. */
  readonly withoutRelations?: boolean;
}

/** A `RelationLookup` over the fixture pack. Pure, total, and deterministic. */
export function createFixtureLookup(
  options: FixtureLookupOptions = {}
): RelationLookup {
  const concepts = new Map(FIXTURE_CONCEPTS.map((entry) => [entry.id as string, entry]));
  const relations = new Map(
    (options.withoutRelations === true ? [] : FIXTURE_RELATIONS).map((entry) => [
      relationKey(entry.pair[0], entry.pair[1]),
      entry,
    ])
  );
  const prompts =
    options.withoutOpenThreadPrompts === true ? [] : FIXTURE_OPEN_THREAD_PROMPTS;

  const require = (id: ConceptId): FixtureConcept => {
    const found = concepts.get(id);
    if (found === undefined) {
      throw new RangeError(`fixture lookup has no concept ${id}`);
    }
    return found;
  };

  const lookup: RelationLookup = {
    conceptName: (id) => require(id).name,
    conceptFaculty: (id) => require(id).faculty,
    conceptFacets: (id) => require(id).facets,
    conceptMotif: (id) => require(id).motif,
    facetName: (id) => FIXTURE_FACET_NAMES[id] ?? String(id),
    findRelation: (a, b) => relations.get(relationKey(a, b)) ?? null,
    openThreadPrompt: (intention, facets) => {
      const forIntention = prompts.filter((entry) => entry.intention === intention);
      const specific = forIntention.find(
        (entry) => entry.facet !== undefined && facets.includes(entry.facet)
      );
      if (specific !== undefined) return specific;
      return forIntention.find((entry) => entry.facet === undefined) ?? null;
    },
  };
  return Object.freeze(lookup);
}

/** Shorthand so tests read as prose rather than as string literals. */
export const C = Object.freeze({
  fibonacci: toConceptId("measure.fibonacci"),
  primes: toConceptId("measure.primes"),
  symmetry: toConceptId("measure.symmetry"),
  fourier: toConceptId("measure.fourier"),
  cantor: toConceptId("measure.cantor"),
  counterpoint: toConceptId("sound.counterpoint"),
  polyrhythm: toConceptId("sound.polyrhythm"),
  just: toConceptId("sound.just-intonation"),
  equal: toConceptId("sound.equal-temperament"),
  overtones: toConceptId("sound.overtone-series"),
  standingWave: toConceptId("matter.standing-wave"),
  energy: toConceptId("matter.energy"),
  pendulums: toConceptId("matter.pendulums"),
  perspective: toConceptId("image.perspective"),
  divisionism: toConceptId("image.divisionism"),
  girih: toConceptId("image.girih"),
});
