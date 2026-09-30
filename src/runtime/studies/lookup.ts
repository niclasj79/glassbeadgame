import { castaliaConceptById } from "../../content/castalia";
import type { FacetId, FacultyId } from "../../content/castalia/schema";
import type { ConceptId } from "../../domain/ids";
import type { ConceptStructureLookup } from "../../domain/outcomes/lookup";

const NO_FACETS: readonly FacetId[] = Object.freeze([]);

/**
 * THE PACK, AS A STUDY MAY READ IT (R1).
 *
 * Concept names, faculties and facets — what a player reads from the beads —
 * and nothing wider. It is built from the pack's concepts here rather than
 * handed the runtime's `castaliaLookup`, which also answers documented
 * relations and Open Thread prompts: that object would satisfy the evaluator's
 * parameter type, and a Study must not be one careless argument away from a
 * relation. Every Study caller in the runtime passes this one.
 *
 * Total by contract, like every content lookup: a Study's beads are proved to
 * be in the pack at build, so the fallbacks are never reached in play.
 */
export const castaliaStudyLookup: ConceptStructureLookup = Object.freeze({
  conceptName: (id: ConceptId): string =>
    castaliaConceptById.get(String(id))?.name ?? String(id),
  conceptFaculty: (id: ConceptId): FacultyId =>
    castaliaConceptById.get(String(id))?.faculty ?? "measure",
  conceptFacets: (id: ConceptId): readonly FacetId[] =>
    castaliaConceptById.get(String(id))?.facets ?? NO_FACETS,
});
