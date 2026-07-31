import type { PresentationCue } from "@/runtime/cues";
import { castaliaConceptById } from "@/content/castalia/concepts";
import { facetById } from "@/content/castalia/facets";
import { toFacetId } from "@/content/castalia/schema";

/**
 * WHAT THE MARGIN SAYS — the copy rules, with no DOM attached.
 *
 * Pulled out of the component so the one thing that must never drift can be
 * asserted directly: an interpretive relation must never be presented as a
 * record. Twelve of the forty-four authored relations are readings the Game
 * offers, and the difference between "this is documented" and "this is our
 * reading" is the whole content model.
 */

export interface Note {
  readonly id: string;
  readonly kind: "documented" | "open" | "unresolved" | "motif";
  readonly title: string;
  readonly body: string;
  /** The honest complication, set apart so it reads as a caveat, not a clause. */
  readonly aside: string | null;
  /** The honest label for how firmly the Game stands behind this. */
  readonly standing: string;
  /** True when the Game is offering a reading, not reporting a record. */
  readonly interpretive: boolean;
  /** Already says what the sources are evidence *for*. */
  readonly sourceLine: string | null;
  readonly seconds: number;
}

const EVIDENCE_STANDING: Record<string, string> = {
  established: "Documented · standard in the field",
  attested: "Documented · a specific recorded instance",
  contested: "Documented · specialists disagree",
  interpretive: "A reading the Game offers · not a claim of influence",
};

const RECEPTION_NOTE: Record<string, string> = {
  confirmed: "Your reading runs with the record.",
  refined: "The record narrows your reading.",
  complicated: "The record runs across your reading. It still stands.",
};

/**
 * An interpretive relation has no record to run with, so it gets the Game's own
 * voice and never a sentence that lends it an authority the pack does not carry.
 */
const READING_NOTE: Record<string, string> = {
  confirmed: "The Game reads it the same way.",
  refined: "The Game reads it slightly differently.",
  complicated: "The Game reads it across yours. Both are readings.",
};

/** Only these classes may be spoken of as a record. */
export const SPEAKS_FOR_RECORD: ReadonlySet<string> = new Set([
  "established",
  "attested",
  "contested",
]);

/**
 * A citation count under an interpretive relation reads as a citation *of* it.
 * The pack's validator only ever requires sources for claims that assert
 * influence; on an interpretive relation the entries are evidence for the two
 * structures being compared — Douady and Couder for the phyllotaxis, Barbour
 * for the tuning — and never for the comparison, which is the Game's own. So
 * the line says which.
 */
function sourceLine(
  count: number,
  interpretive: boolean
): string | null {
  if (count === 0) return null;
  const noun = count === 1 ? "source" : "sources";
  return interpretive
    ? `${count} ${noun} for the material compared`
    : `${count} ${noun} in the Codex`;
}

export function noteFor(cue: PresentationCue): Note | null {
  switch (cue.type) {
    case "outcome.documented": {
      const { relation, evidence, reception } = cue.payload;
      const interpretive = !SPEAKS_FOR_RECORD.has(evidence);
      return {
        id: cue.id,
        kind: "documented",
        title: relation.title,
        body: relation.insight,
        aside: relation.counterpoint ?? null,
        interpretive,
        standing: `${EVIDENCE_STANDING[evidence] ?? evidence} · ${
          (interpretive ? READING_NOTE[reception] : RECEPTION_NOTE[reception]) ??
          ""
        }`,
        sourceLine: sourceLine(relation.sources.length, interpretive),
        seconds: cue.duration,
      };
    }
    case "outcome.open-thread": {
      const facet =
        facetById.get(toFacetId(String(cue.payload.sharedFacet)))?.name ??
        String(cue.payload.sharedFacet);
      return {
        id: cue.id,
        kind: "open",
        title: "An open thread",
        body: cue.payload.question,
        aside: null,
        interpretive: false,
        standing: `No documented relation here · both carry ${facet}`,
        sourceLine: null,
        seconds: cue.duration,
      };
    }
    case "outcome.unresolved":
      return {
        id: cue.id,
        kind: "unresolved",
        title: "Nothing grounded yet",
        body: cue.payload.statement,
        aside: null,
        interpretive: false,
        standing: "The Game is not asserting anything here",
        sourceLine: null,
        seconds: cue.duration,
      };
    case "motif.completed":
      return {
        id: cue.id,
        kind: "motif",
        title: `${String(cue.payload.motifKindId)} has formed`,
        body: cue.payload.reason,
        aside: null,
        interpretive: false,
        standing: cue.payload.conceptIds
          .map((id) => castaliaConceptById.get(String(id))?.name ?? String(id))
          .join(" · "),
        sourceLine: null,
        seconds: cue.duration,
      };
    default:
      return null;
  }
}

/**
 * How long the note stays on the page. Identical for every kind: an Open Thread
 * dwells exactly as long as a documented relation (CAV-006). Held a little past
 * the cue so the last words are readable after the world has finished
 * responding, then released without asking.
 */
export function dwellMs(note: Note): number {
  return Math.max(4200, note.seconds * 1000 + 3400);
}
