/**
 * THE CONTENT ADAPTER
 *
 * Binds the assembled Castalia pack to the narrow interfaces the domain
 * declares. The domain never imports content directly — that is what keeps
 * outcome resolution, motif detection, the portrait, the annotation, and the
 * conclusion compiler testable against hand-built fixtures, and what lets the
 * pack be re-sourced without a single domain file changing.
 *
 * Every lookup here is total by contract: it is called only with concept ids
 * that belong to the session, and it must not throw. Where a lookup cannot
 * answer, it returns the honest empty answer rather than an invented one —
 * `null` for "no authored relation" is the actual input to Open Thread and
 * unresolved outcomes, so making it throw would turn a designed silence into a
 * crash.
 */
import {
  CASTALIA_PACK,
  castaliaConceptById,
  facetById,
  findRelation,
  openThreadPromptFor,
  relationByKey,
} from "@/content/castalia";
import type {
  ConceptMotif,
  DocumentedRelation,
  FacetId,
  FacultyId,
  OpenThreadPrompt,
} from "@/content/castalia/schema";
import { relationKey } from "@/content/castalia/schema";
import type { RelationIntention } from "@/domain/events";
import type { ConceptId } from "@/domain/ids";
import type { RelationLookup } from "@/domain/outcomes";
import type { CastaliaResonanceLookup } from "@/runtime/interpretation/resolveCastaliaCandidateEvidence";
import type { DrawCandidateConcept, DrawLookup } from "@/domain/session";

const EMPTY_FACETS: readonly FacetId[] = Object.freeze([]);

/**
 * A motif for a concept the pack does not know. Reached only if a persisted
 * session references a concept a later pack removed; the game should degrade to
 * a plain sustained tone rather than fail to replay a player's saved Game.
 */
const SILENT_MOTIF: ConceptMotif = Object.freeze({
  degrees: Object.freeze([0]),
  rhythm: Object.freeze([4]),
  register: "mid",
  articulation: "sustained",
  timbre: "glass",
});

export const castaliaLookup: RelationLookup = Object.freeze({
  conceptName: (id: ConceptId) =>
    castaliaConceptById.get(String(id))?.name ?? String(id),

  conceptFaculty: (id: ConceptId): FacultyId =>
    castaliaConceptById.get(String(id))?.faculty ?? "measure",

  conceptFacets: (id: ConceptId) =>
    castaliaConceptById.get(String(id))?.facets ?? EMPTY_FACETS,

  conceptMotif: (id: ConceptId) =>
    castaliaConceptById.get(String(id))?.motif ?? SILENT_MOTIF,

  facetName: (id: FacetId) => facetById.get(id)?.name ?? String(id),

  findRelation: (a: ConceptId, b: ConceptId): DocumentedRelation | null =>
    findRelation(String(a), String(b)) ?? null,

  openThreadPrompt: (
    intention: RelationIntention,
    facets: readonly FacetId[]
  ): OpenThreadPrompt | null => openThreadPromptFor(intention, facets) ?? null,
});

/** The subset candidate resonance needs. Same pack, narrower contract. */
export const castaliaResonanceLookup: CastaliaResonanceLookup = Object.freeze({
  conceptFacets: (id: ConceptId) =>
    castaliaConceptById.get(String(id))?.facets ?? EMPTY_FACETS,
  conceptFaculty: (id: ConceptId) =>
    castaliaConceptById.get(String(id))?.faculty ?? null,
  hasDocumentedRelation: (a: ConceptId, b: ConceptId) =>
    relationByKey.has(relationKey(String(a), String(b))),
});

/**
 * The pool the draw samples from. Built once: the pack is frozen, so rebuilding
 * this per session would only produce identical arrays.
 */
const DRAW_CONCEPTS: readonly DrawCandidateConcept[] = Object.freeze(
  CASTALIA_PACK.concepts.map((concept) =>
    Object.freeze({
      id: concept.id as unknown as ConceptId,
      faculty: concept.faculty,
      facets: concept.facets as readonly string[],
    })
  )
);

export const castaliaDrawLookup: DrawLookup = Object.freeze({
  concepts: DRAW_CONCEPTS,
  hasDocumentedRelation: (a: ConceptId, b: ConceptId) =>
    relationByKey.has(relationKey(String(a), String(b))),
});
