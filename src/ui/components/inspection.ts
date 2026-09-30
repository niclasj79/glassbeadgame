import { castaliaConceptById } from "@/content/castalia";
import type { CastaliaConcept } from "@/content/castalia/schema";

/**
 * WHAT THE PLAYER HAS ASKED TO READ BY NAME.
 *
 * An inspection is pinned deliberately — a long press, the world's Details
 * mark, `I`, or the mirror's "Details for focused bead" — so it is the thing
 * the player has just asked for, and it outranks everything else the column
 * could be saying at that moment:
 *
 *  - over a dwell card, it wins: a glance is not a request (I-015);
 *  - over a bead the column is already showing — the attended bead, the one
 *    under the lens, either bead of a locked or reopened pair — that bead's
 *    card opens in full where it stands, so the pair stays on the page;
 *  - over anything else, it takes the column until it is set aside, and the
 *    margin stands down for it. Nothing is lost by standing down: the margin's
 *    state lives above the column and keeps every reading while it waits.
 *
 * Every surface asks this one question rather than each testing the store for
 * itself. The failure mode of two conditions is the one that leaves the column
 * empty: a pinned id the pack cannot resolve is *not* an inspection, and if the
 * margin yielded to it while the card declined to draw, the composition would
 * lose its column entirely for as long as it stood.
 *
 * It lives here rather than in either surface so that neither owns it, and in a
 * module of its own rather than beside a component, so the files that export
 * components export components and nothing else.
 */
export function inspectedConcept(
  pinnedInspectId: string | null
): CastaliaConcept | null {
  if (pinnedInspectId === null) return null;
  return castaliaConceptById.get(pinnedInspectId) ?? null;
}
