import { castaliaConceptById } from "@/content/castalia";
import type { CastaliaConcept } from "@/content/castalia/schema";

/**
 * ONE READING IN THE COLUMN AT A TIME.
 *
 * The bead inspection card and the margin are set in the same reserved column
 * (`ReadingColumn`, IMP-5), and two plates in one column is one plate over
 * another. An inspection is pinned deliberately — a long press, or the
 * intention plate's own Details verb — so it is the thing the player has just
 * asked for by name, and the margin stands down for it until it is closed.
 * Nothing is lost by standing down: `Marginalia` returns null while it does,
 * which keeps its subscription live and every reading it has kept.
 *
 * Both surfaces ask this one question rather than each testing the store for
 * themselves. The failure mode of two conditions is the one that leaves the
 * column empty: a pinned id the pack cannot resolve is *not* an inspection, and
 * if the margin yielded to it while the card declined to draw, the composition
 * would lose its column entirely for as long as it stood.
 *
 * It lives here rather than in either surface so that neither owns it, and in a
 * module of its own rather than beside the component, so the file that exports
 * `BeadInspectCard` exports components and nothing else.
 */
export function inspectedConcept(
  pinnedInspectId: string | null
): CastaliaConcept | null {
  if (pinnedInspectId === null) return null;
  return castaliaConceptById.get(pinnedInspectId) ?? null;
}
