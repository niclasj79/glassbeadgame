import type { PresentationCue } from "@/runtime/cues";
import { capitalise, type ThreadOutcomeResolution } from "@/domain/outcomes";
import { castaliaConceptById } from "@/content/castalia/concepts";
import { facetById } from "@/content/castalia/facets";
import { toFacetId } from "@/content/castalia/schema";
import {
  documentedReading,
  motifReading,
  openThreadReading,
  unresolvedReading,
  type Citation,
  type Reading,
} from "../reading";
import { threadRegister } from "../screens/threadRegister";

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
 * is only what is specific to a cue: which payload becomes a reading, which
 * thread it answers, how it is set in two layers, and how long that reading
 * takes to arrive.
 */

export interface Note extends Reading {
  readonly id: string;
  readonly seconds: number;
  /**
   * The committed thread this reading answers, or null for a motif, which
   * belongs to several threads and to none of them alone. It is what lets a
   * reopened thread find its own reading again (I-019).
   */
  readonly threadId: string | null;
}

/** Only these classes may be spoken of as a record. */
export { SPEAKS_FOR_RECORD } from "../reading";

export function noteFor(cue: PresentationCue): Note | null {
  const at = { id: cue.id, seconds: cue.duration };
  switch (cue.type) {
    case "outcome.documented": {
      const { relation, evidence, reception } = cue.payload;
      return {
        ...documentedReading(relation, evidence, reception),
        ...at,
        threadId: String(cue.payload.threadId),
      };
    }
    case "outcome.open-thread": {
      const id = String(cue.payload.sharedFacet);
      const facet = facetById.get(toFacetId(id))?.name ?? id;
      return {
        ...openThreadReading(cue.payload.question, facet),
        ...at,
        threadId: String(cue.payload.threadId),
      };
    }
    case "outcome.unresolved":
      return {
        ...unresolvedReading(cue.payload.statement),
        ...at,
        threadId: String(cue.payload.threadId),
      };
    case "motif.completed":
      return {
        ...motifReading(
          // "bridge has formed" was the id, not the name. A motif is the one
          // structural event of the middle game and its note is titled like one.
          `A ${capitalise(String(cue.payload.motifKindId))} has formed`,
          cue.payload.reason,
          cue.payload.conceptIds
            .map((id) => castaliaConceptById.get(String(id))?.name ?? String(id))
            .join(" · ")
        ),
        ...at,
        threadId: null,
      };
    default:
      return null;
  }
}

/**
 * A THREAD'S READING, REBUILT FROM THE LOG.
 *
 * The margin keeps a bounded history (`MARGIN_KEPT`), so a long Game can push
 * an early thread's reading off the front — and a thread reopened from the
 * world or the mirror must still show its card (I-019). The reading is not
 * invented here: the domain resolves the outcome from the canonical thread,
 * and `threadRegister` sets it exactly as the conclusion sets it, so the card
 * cannot say anything the margin would not have said when the thread was woven.
 */
export function noteForOutcome(outcome: ThreadOutcomeResolution): Note {
  const [entry] = threadRegister([outcome]);
  return {
    kind: entry.kind,
    title: entry.title,
    body: entry.body,
    aside: entry.aside,
    standing: entry.standing,
    interpretive: entry.interpretive,
    sourceLine: entry.sourceLine,
    citations: entry.citations,
    id: `thread-reading:${entry.threadId}`,
    seconds: 0,
    threadId: entry.threadId,
  };
}

/**
 * ONE SENTENCE, FOUND THE WAY A READER FINDS IT.
 *
 * The thread card leads with a single sentence of the insight (I-018). The
 * authored insights are dense with what fools a naive splitter — dates, "c.",
 * "e.g.", initials such as "J. S. Bach", closing quotes and brackets — so a
 * stop ends the sentence only when the next word begins a new one (a capital,
 * a figure, or an opening quote) and the word before it is neither a known
 * abbreviation nor a lone initial. When no such stop exists the whole text is
 * one sentence, and it is returned whole rather than cut.
 */
const SENTENCE_STOP = /[.!?…]["'”’)\]]*(?=\s+["'“‘([]?[A-Z0-9À-Þ])/g;
const NOT_A_STOP =
  /(?:\b(?:c|ca|cf|e\.g|i\.e|vs|etc|al|St|Mr|Mrs|Dr|No|Vol|pp|ed|eds|fig)|(?:^|[\s(])[A-Z])\.$/;

export function firstSentence(text: string): string {
  const trimmed = text.trim();
  // `matchAll` walks a copy of the pattern, so no state is carried between calls.
  for (const match of trimmed.matchAll(SENTENCE_STOP)) {
    const throughStop = trimmed.slice(0, match.index + 1);
    if (NOT_A_STOP.test(throughStop)) continue;
    return trimmed.slice(0, match.index + match[0].length);
  }
  return trimmed;
}

/** The two layers of a thread card: what it says first, and whether there is more. */
export interface NoteLayers {
  /** The title, the evidence line and one sentence — the card as it arrives. */
  readonly first: Note;
  /** True when "Read more" has something to add: insight, counterpoint, sources. */
  readonly more: boolean;
}

const NO_CITATIONS: readonly Citation[] = Object.freeze([]);

/**
 * THE THREAD CARD IN TWO LAYERS (I-018).
 *
 * After a weave the column holds one thread card: its title, the evidence line
 * and one sentence, with the rest — the remainder of the insight, the
 * counterpoint, the citations — a request away. The layer is only a *length*:
 * the standing line, which says whether the Game is reporting a record or
 * offering a reading, is on the first layer of every card, because that is the
 * distinction the content model exists to keep and it is never "more".
 *
 * An Open Thread's first layer is its whole question, and an unlit thread's is
 * its whole statement: those are the one thing the card says, and cutting a
 * question in half would be the timer's defect in a new coat. A motif is not a
 * thread card at all and is always read whole.
 */
export function noteLayers(note: Note): NoteLayers {
  if (note.kind !== "documented") return { first: note, more: false };
  const sentence = firstSentence(note.body);
  const more =
    sentence.length < note.body.trim().length ||
    note.aside !== null ||
    note.citations.length > 0;
  return {
    first: {
      ...note,
      body: sentence,
      aside: null,
      sourceLine: null,
      citations: NO_CITATIONS,
    },
    more,
  };
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
