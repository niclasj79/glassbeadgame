import { toFacetId, type Facet } from "./schema";

/**
 * THE FACET VOCABULARY
 *
 * Facets are the load-bearing idea of the whole content model. They are the
 * only thing that makes candidate resonance honest: a bead glows because it
 * genuinely shares a structural property with what you are attending to, not
 * because an author hid an answer behind it. They are also what Open Threads
 * are built from, and what the Canon motif watches for as it recurs across the
 * web through transformation.
 *
 * A facet earns its place only if it is (a) structural rather than thematic,
 * (b) genuinely present in concepts from more than one faculty, and (c) statable
 * in one clause a player will understand. "Beauty" is not a facet. "Something
 * preserved while everything else changes" is.
 */
const facet = (id: string, name: string, gloss: string): Facet =>
  Object.freeze({ id: toFacetId(id), name, gloss });

export const FACETS: readonly Facet[] = Object.freeze([
  facet(
    "recursion",
    "Recursion",
    "A rule applied again to its own result, so the whole reappears inside the part."
  ),
  facet(
    "invariance",
    "Invariance",
    "Something that survives untouched while everything around it is transformed."
  ),
  facet(
    "periodicity",
    "Return",
    "A pattern that comes back after a fixed interval, and can be counted on to."
  ),
  facet(
    "incommensurability",
    "No Common Measure",
    "Two quantities that share no exact unit, so they never quite line up."
  ),
  facet(
    "decomposition",
    "Decomposition",
    "A complicated whole resolved without remainder into simple components."
  ),
  facet(
    "superposition",
    "Superposition",
    "Independent parts occupying the same place at once, and simply adding."
  ),
  facet(
    "projection",
    "Projection",
    "Something of higher dimension cast down onto a surface, losing one freedom."
  ),
  facet(
    "viewpoint",
    "Standpoint",
    "Structure that only resolves correctly from one particular place to stand."
  ),
  facet(
    "discreteness",
    "Discreteness",
    "Countable steps, with nothing legitimate in between them."
  ),
  facet(
    "continuity",
    "Continuity",
    "Unbroken variation, where every intermediate value genuinely occurs."
  ),
  facet(
    "self-reference",
    "Self-Reference",
    "A structure that has to include an account of itself, and strains doing it."
  ),
  facet(
    "orientation",
    "Orientation",
    "Handedness or sidedness — a distinction that travel can destroy."
  ),
  facet(
    "compromise",
    "Deliberate Error",
    "An inexactness accepted on purpose, because exactness would cost more."
  ),
  facet(
    "irreversibility",
    "Irreversibility",
    "A direction in the process itself, which running time backwards would violate."
  ),
  facet(
    "entrainment",
    "Entrainment",
    "Separate oscillators that, once weakly coupled, fall into a fixed relation."
  ),
  facet(
    "optical-mixture",
    "Mixture in the Eye",
    "Parts kept separate in the object and combined only by the sense that reads it."
  ),
  facet(
    "proportion",
    "Proportion",
    "Ratio used as the organising principle, rather than absolute size."
  ),
  facet(
    "tiling",
    "Tiling",
    "Space filled completely by repeated figures, without gap or overlap."
  ),
  facet(
    "threshold",
    "Threshold",
    "A boundary at which behaviour changes kind rather than degree."
  ),
  facet(
    "imitation",
    "Imitation",
    "A figure restated elsewhere with something changed — scale, time, or direction."
  ),
  facet(
    "interference",
    "Interference",
    "Two patterns crossing, so their agreement and disagreement become visible."
  ),
  facet(
    "quantisation",
    "Quantisation",
    "A continuum cut into fixed portions so it can be handled and reproduced."
  ),
]);

export const facetById = new Map(FACETS.map((f) => [f.id, f]));
