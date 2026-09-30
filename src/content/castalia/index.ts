import { toContentPackVersion, type ContentPackVersion } from "@/domain/ids";
import { RELATION_INTENTIONS, type RelationIntention } from "@/domain/events";

import { CASTALIA_CONCEPTS, castaliaConceptById } from "./concepts";
import { FACETS, facetById } from "./facets";
import { FACULTIES, facultyById } from "./faculties";
import { CASTALIA_OPEN_THREADS } from "./openThreads";
import { CASTALIA_RELATIONS, relationById } from "./relations";
import { CASTALIA_SOURCES, sourceById } from "./sources";
import { CASTALIA_STUDIES } from "./studies";
import {
  FACULTY_IDS,
  relationKey,
  type CastaliaPack,
  type ConceptMotif,
  type DocumentedRelation,
  type FacetId,
  type FacultyId,
  type OpenThreadPrompt,
  type StudyDefinition,
} from "./schema";

/**
 * THE ASSEMBLED CASTALIA PACK
 *
 * One frozen object plus the lookups the runtime needs. Every derived structure
 * here is built once at module load, in a fixed order, from data that is
 * already sorted — so two processes reading this module see byte-identical
 * iteration order, and a replay from an event log resolves the same relation
 * for the same pair every time.
 *
 * Nothing in this file computes game rules. Resonance, outcome resolution, and
 * motif detection belong to the domain layer and read these structures.
 */
export const CONTENT_PACK_VERSION: ContentPackVersion =
  toContentPackVersion("castalia.v1");

export const CASTALIA_PACK: CastaliaPack = Object.freeze({
  version: CONTENT_PACK_VERSION,
  faculties: FACULTIES,
  facets: FACETS,
  concepts: CASTALIA_CONCEPTS,
  sources: CASTALIA_SOURCES,
  relations: CASTALIA_RELATIONS,
  openThreads: CASTALIA_OPEN_THREADS,
  studies: CASTALIA_STUDIES,
});

const byId = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Study id → Study. The Studies themselves are exported in the order they are
 * shown — chapter order, then ordinal — which the validator enforces, so no
 * surface has to sort them.
 */
export const castaliaStudyById: ReadonlyMap<string, StudyDefinition> = new Map(
  CASTALIA_STUDIES.map((study) => [study.id, study])
);

/** Canonical unordered-pair key → the documented relation for that pair. */
export const relationByKey: ReadonlyMap<string, DocumentedRelation> = new Map(
  [...CASTALIA_RELATIONS]
    .sort(byId)
    .map((relation) => [relationKey(relation.pair[0], relation.pair[1]), relation])
);

/** Concept id → every documented relation it takes part in, sorted by id. */
export const relationsByConcept: ReadonlyMap<string, readonly DocumentedRelation[]> =
  (() => {
    const map = new Map<string, DocumentedRelation[]>();
    for (const concept of CASTALIA_CONCEPTS) map.set(concept.id, []);
    for (const relation of [...CASTALIA_RELATIONS].sort(byId)) {
      for (const conceptId of relation.pair) {
        const bucket = map.get(conceptId);
        if (bucket === undefined) map.set(conceptId, [relation]);
        else bucket.push(relation);
      }
    }
    return new Map(
      [...map.entries()].map(([id, relations]) => [id, Object.freeze(relations)])
    );
  })();

/** Intention → its prompts, facet-specific first, each group sorted by id. */
export const openThreadsByIntention: ReadonlyMap<
  RelationIntention,
  readonly OpenThreadPrompt[]
> = (() => {
  const map = new Map<RelationIntention, OpenThreadPrompt[]>();
  for (const intention of RELATION_INTENTIONS) map.set(intention, []);
  const ordered = [...CASTALIA_OPEN_THREADS].sort((a, b) => {
    const aFallback = a.facet === undefined ? 1 : 0;
    const bFallback = b.facet === undefined ? 1 : 0;
    return aFallback !== bFallback ? aFallback - bFallback : byId(a, b);
  });
  for (const thread of ordered) {
    const bucket = map.get(thread.intention);
    if (bucket === undefined) map.set(thread.intention, [thread]);
    else bucket.push(thread);
  }
  return new Map(
    [...map.entries()].map(([intention, threads]) => [intention, Object.freeze(threads)])
  );
})();

/** The documented relation for a pair, in either order, or `undefined`. */
export const findRelation = (
  a: string,
  b: string
): DocumentedRelation | undefined => relationByKey.get(relationKey(a, b));

/**
 * The prompt to build an Open Thread from: the most specific template that
 * matches the declared intention and one of the pair's shared facets, otherwise
 * the intention's fallback. Deterministic — `sharedFacets` is consulted in the
 * order given, and prompts are already ordered facet-specific-first.
 */
export const openThreadPromptFor = (
  intention: RelationIntention,
  sharedFacets: readonly FacetId[] = []
): OpenThreadPrompt | undefined => {
  const candidates = openThreadsByIntention.get(intention) ?? [];
  for (const facetId of sharedFacets) {
    const match = candidates.find((thread) => thread.facet === facetId);
    if (match !== undefined) return match;
  }
  return candidates.find((thread) => thread.facet === undefined);
};

/**
 * The content seam, filled.
 *
 * `src/domain/outcomes/lookup.ts` declares `RelationLookup` as the only way the
 * domain reads authored content. This object is written to that shape but is
 * typed here structurally rather than by importing the domain's interface, so
 * the two files stay independently editable; assignability is checked in
 * `castalia.test.ts`.
 *
 * Every member is total by the seam's contract — it is called only with ids
 * belonging to the current session and must not throw. The fallbacks below
 * exist so that a malformed id degrades quietly instead of crashing a session;
 * they are unreachable when the contract holds.
 */
export interface CastaliaContentLookup {
  readonly conceptName: (id: string) => string;
  readonly conceptFaculty: (id: string) => FacultyId;
  readonly conceptFacets: (id: string) => readonly FacetId[];
  readonly conceptMotif: (id: string) => ConceptMotif;
  readonly facetName: (id: string) => string;
  readonly findRelation: (a: string, b: string) => DocumentedRelation | null;
  readonly openThreadPrompt: (
    intention: RelationIntention,
    facets: readonly FacetId[]
  ) => OpenThreadPrompt | null;
}

const NO_FACETS: readonly FacetId[] = Object.freeze([]);

const SILENT_MOTIF: ConceptMotif = Object.freeze({
  degrees: Object.freeze([0, 0]),
  rhythm: Object.freeze([1, 1]),
  register: "mid",
  articulation: "struck",
  timbre: "glass",
});

export const CASTALIA_LOOKUP: CastaliaContentLookup = Object.freeze({
  conceptName: (id) => castaliaConceptById.get(id)?.name ?? id,
  conceptFaculty: (id) => castaliaConceptById.get(id)?.faculty ?? FACULTY_IDS[0],
  conceptFacets: (id) => castaliaConceptById.get(id)?.facets ?? NO_FACETS,
  conceptMotif: (id) => castaliaConceptById.get(id)?.motif ?? SILENT_MOTIF,
  facetName: (id) => facetById.get(id as FacetId)?.name ?? id,
  findRelation: (a, b) => relationByKey.get(relationKey(a, b)) ?? null,
  openThreadPrompt: (intention, facets) => openThreadPromptFor(intention, facets) ?? null,
} satisfies CastaliaContentLookup);

export {
  CASTALIA_CONCEPTS,
  CASTALIA_OPEN_THREADS,
  CASTALIA_RELATIONS,
  CASTALIA_SOURCES,
  CASTALIA_STUDIES,
  FACETS,
  FACULTIES,
  castaliaConceptById,
  facetById,
  facultyById,
  relationById,
  sourceById,
};
export * from "./schema";
export {
  CASTALIA_LIMITS,
  STUDY_ERROR_CODES,
  STUDY_LIMITS,
  assertCastaliaPackValid,
  validateCastaliaPack,
  validateStudies,
  type CastaliaValidationResult,
  type StudyErrorCode,
  type StudyIssue,
} from "./validate";
