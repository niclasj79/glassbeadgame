import type { RelationIntention } from "../events";
import type { ConceptId } from "../ids";
import type {
  ConceptMotif,
  DocumentedRelation,
  FacetId,
  FacultyId,
  OpenThreadPrompt,
} from "@/content/castalia/schema";

/**
 * THE CONTENT SEAM.
 *
 * Every semantic rule in `outcomes/`, `motifs/`, `portrait/`, `annotation/`, and
 * `performance/` reads authored content through this interface and never through
 * a direct module import. Two reasons, both load-bearing:
 *
 *  1. The domain stays pure and testable. A hand-built fixture lookup exercises
 *     every rule without the twenty-four-bead pack in memory.
 *  2. The content pack can be authored, revised, and re-sourced without any
 *     domain file changing. `relations.ts` is authored separately; nothing here
 *     depends on the shape of that file, only on this contract.
 *
 * The lookups are total by contract: they are called only with concept ids that
 * belong to the session, and they must not throw. `findRelation` and
 * `openThreadPrompt` return `null` for "nothing authored", which is the honest
 * answer and the input to Open Thread and unresolved outcomes.
 *
 * Parameters are typed with the branded `ConceptId`/`FacetId`, so an
 * implementation written over plain `string` ids remains assignable.
 */
export interface ConceptLookup {
  /** Player-facing name, used verbatim in prose. */
  readonly conceptName: (id: ConceptId) => string;
  readonly conceptFaculty: (id: ConceptId) => FacultyId;
  /** Authored facets, in authored order. */
  readonly conceptFacets: (id: ConceptId) => readonly FacetId[];
  /** Authored musical identity (CAV-008). The conclusion compiler transforms it. */
  readonly conceptMotif: (id: ConceptId) => ConceptMotif;
}

export interface FacetLookup {
  /** Player-facing facet name, used verbatim in prose. */
  readonly facetName: (id: FacetId) => string;
}

export interface DocumentedRelationLookup {
  /**
   * The authored relation for an unordered pair, or `null` when none exists.
   * Order of the arguments must not change the result.
   */
  readonly findRelation: (a: ConceptId, b: ConceptId) => DocumentedRelation | null;
}

export interface OpenThreadPromptLookup {
  /**
   * The best authored prompt for a declared intention given the facets a pair
   * genuinely shares, or `null` when the pack has nothing for this combination.
   * A facet-specific prompt should be preferred to the intention's fallback.
   */
  readonly openThreadPrompt: (
    intention: RelationIntention,
    facets: readonly FacetId[]
  ) => OpenThreadPrompt | null;
}

export interface RelationLookup
  extends ConceptLookup,
    FacetLookup,
    DocumentedRelationLookup,
    OpenThreadPromptLookup {}

/** The single member the topology selectors need. */
export type FacultyLookup = Pick<ConceptLookup, "conceptFaculty">;

/** Concept identity plus facets — everything motif detection needs about a bead. */
export type ConceptStructureLookup = Pick<
  ConceptLookup,
  "conceptName" | "conceptFaculty" | "conceptFacets"
>;
