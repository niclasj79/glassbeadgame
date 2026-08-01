import type { ConceptId, ThreadId } from "../ids";
import type { FacetId } from "@/content/castalia/schema";

/**
 * THE THREE MOTIF FAMILIES (VERTICAL-SLICE-SPEC §12).
 *
 * Their rules are semantic, not topological. A triangle is not a Dialectic; a
 * facet appearing three times is not a Canon; a cut vertex is not a Bridge.
 * Each detector has to look at what the player *declared* and what the content
 * pack actually *documents* before it will say a motif exists.
 *
 * A detection carries no score, no tier, and no reward. Completion changes the
 * composition — the score gains an ensemble structure and the world reorganises
 * — and that is the entirety of what completing a motif does.
 */
export const MOTIF_KINDS = Object.freeze(["dialectic", "canon", "bridge"] as const);
export type MotifKind = (typeof MOTIF_KINDS)[number];

export interface MotifDetection {
  readonly kind: MotifKind;
  /**
   * Stable identity for this motif in this web. Two replays of the same session
   * produce the same key, and a motif that has already been recorded as
   * completed is recognised by it.
   */
  readonly key: string;
  /** Participating concepts, ascending session order. */
  readonly conceptIds: readonly ConceptId[];
  /** Participating threads, creation order. */
  readonly threadIds: readonly ThreadId[];
  /** The concept the motif turns on, where it has one (Bridge). */
  readonly focusConceptId: ConceptId | null;
  /** The thread the motif turns on, where it has one (Bridge, Dialectic). */
  readonly focusThreadId: ThreadId | null;
  /** The recurring facet (Canon). */
  readonly facetId: FacetId | null;
  /** Sequence of the latest event that made this motif true. */
  readonly completedAtSequence: number;
  /** One sentence about *this* web. Never a template filled from a score band. */
  readonly reason: string;
}
