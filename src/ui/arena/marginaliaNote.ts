import type { PresentationCue } from "@/runtime/cues";
import { castaliaConceptById } from "@/content/castalia/concepts";
import { facetById } from "@/content/castalia/facets";
import { toFacetId } from "@/content/castalia/schema";
import {
  documentedReading,
  motifReading,
  openThreadReading,
  unresolvedReading,
  type Reading,
} from "../reading";

/**
 * WHAT THE MARGIN SAYS — the copy rules, with no DOM attached.
 *
 * Pulled out of the component so the one thing that must never drift can be
 * asserted directly: an interpretive relation must never be presented as a
 * record. Twelve of the forty-four authored relations are readings the Game
 * offers, and the difference between "this is documented" and "this is our
 * reading" is the whole content model. The sentences that carry that difference
 * live in `src/ui/reading.ts` now, because the conclusion's register presents
 * the same outcomes and the two surfaces may not drift apart. What is left here
 * is only what is specific to a cue: which payload becomes a reading, and how
 * long that reading takes to arrive.
 */

export interface Note extends Reading {
  readonly id: string;
  readonly seconds: number;
}

/** Only these classes may be spoken of as a record. */
export { SPEAKS_FOR_RECORD } from "../reading";

export function noteFor(cue: PresentationCue): Note | null {
  const at = { id: cue.id, seconds: cue.duration };
  switch (cue.type) {
    case "outcome.documented": {
      const { relation, evidence, reception } = cue.payload;
      return { ...documentedReading(relation, evidence, reception), ...at };
    }
    case "outcome.open-thread": {
      const id = String(cue.payload.sharedFacet);
      const facet = facetById.get(toFacetId(id))?.name ?? id;
      return { ...openThreadReading(cue.payload.question, facet), ...at };
    }
    case "outcome.unresolved":
      return { ...unresolvedReading(cue.payload.statement), ...at };
    case "motif.completed":
      return {
        ...motifReading(
          `${String(cue.payload.motifKindId)} has formed`,
          cue.payload.reason,
          cue.payload.conceptIds
            .map((id) => castaliaConceptById.get(String(id))?.name ?? String(id))
            .join(" · ")
        ),
        ...at,
      };
    default:
      return null;
  }
}

/**
 * ENTRANCE, NEVER EXIT.
 *
 * This function used to be `dwellMs`, and it *removed* the note:
 * `max(4200, seconds * 1000 + 3400)`, so a plate was on screen for 5.1–7.4 s.
 * Measured against the authored content it was carrying — insight 49–85 words,
 * plus counterpoint, standing, title and source line, 88–139 words in all —
 * that demanded between 710 and 1630 words per minute. The surface was
 * `pointer-events-none` with no pin, no hover-hold, no history and no re-open
 * path anywhere in the game, so text a player had begun reading was taken away
 * and could never be recovered.
 *
 * Nothing removes a note now but the player, or the player beginning another
 * interpretation (`marginState.ts`). What is left here is the *entrance*: the
 * cue's own span, scaled down and capped, so a slow deliberate weave writes its
 * note in a little more slowly than a quick one. It is identical for every kind
 * of outcome, because an Open Thread differs from a documented relation in
 * resolution and never in reward (CAV-006).
 */
export function entranceMs(note: Note): number {
  return Math.min(900, Math.max(320, Math.round(note.seconds * 240)));
}
