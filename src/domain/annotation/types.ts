import type { ConceptId, ThreadId } from "../ids";
import type { FacetId } from "@/content/castalia/schema";

/**
 * THE ANNOTATION (VERTICAL-SLICE-SPEC §16).
 *
 * A short topology-aware coda. The specification's hard requirement is negative
 * and worth restating: it "must not merely combine generic fragments based on
 * score bands or dominant faculties". So there are no bands here. Every
 * sentence names something the player can point at — a concept, a thread, a
 * facet, a faculty, a count, an actual open question — and a sentence is
 * omitted entirely when the web gives it nothing to name.
 *
 * `references` exists so presentation can highlight exactly what the coda is
 * talking about, and so tests can prove the prose is anchored in real structure
 * rather than in adjectives.
 */
export interface AnnotationReferences {
  readonly conceptIds: readonly ConceptId[];
  readonly threadIds: readonly ThreadId[];
  readonly facetIds: readonly FacetId[];
}

export interface Annotation {
  /**
   * The coda, in reading order. Never fewer than one sentence and never more
   * than the web has structural facts to state: length scales with the size of
   * the web rather than sitting at a fixed cap, so a twelve-thread session is
   * not compressed into the same breath as a two-thread one.
   */
  readonly sentences: readonly string[];
  /** The sentences joined by a single space. */
  readonly text: string;
  readonly references: AnnotationReferences;
}
