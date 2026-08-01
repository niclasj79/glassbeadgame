import type { DocumentedRelation, EvidenceClass } from "@/content/castalia/schema";
import { sourceById } from "@/content/castalia/sources";

/**
 * WHAT A READING IS ALLOWED TO SAY, AND WHERE ITS EVIDENCE IS.
 *
 * Two surfaces present an authored outcome — the arena's margin while the Game
 * is being played, and the conclusion's register once it is over — and the one
 * thing that must never drift between them is the difference between "this is
 * documented" and "this is our reading". That distinction is the entire content
 * model, so both surfaces build the same object here rather than each composing
 * their own sentences from the same payload.
 *
 * THE CITATIONS ARE THE POINT.
 *
 * `sources.ts` says of itself that "the citation is shown verbatim in the Codex
 * so the player can go and check it". There is no Codex — it was cut, along
 * with the title screen's entry point — and until this module existed the whole
 * register had exactly one consumer in the application: the margin, reading
 * `relation.sources.length` to print "3 sources in the Codex". Not one file
 * rendered `source.citation` anywhere. A player could not check anything, and
 * was told to go somewhere that does not exist.
 *
 * So the count is no longer a pointer. It is a heading over the citations
 * themselves, which are short, which are checkable, and which belong with the
 * claim they support.
 */

/** One entry of the source register, resolved and ready to be read. */
export interface Citation {
  readonly id: string;
  /** Verbatim from the pack. Never paraphrased and never truncated. */
  readonly citation: string;
  /** Where in the work to actually look, when the pack says. */
  readonly locator: string | null;
}

export type ReadingKind = "documented" | "open" | "unresolved" | "motif";

/**
 * One outcome, said once. Every field is copy or content; there is deliberately
 * no number on it, because a number on an outcome is a score whatever it is
 * called (ADR-010), and no flag that ranks one kind above another (CAV-006).
 */
export interface Reading {
  readonly kind: ReadingKind;
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
  readonly citations: readonly Citation[];
}

/** Only these evidence classes may be spoken of as a record. */
export const SPEAKS_FOR_RECORD: ReadonlySet<string> = new Set([
  "established",
  "attested",
  "contested",
]);

const EVIDENCE_STANDING: Readonly<Record<string, string>> = Object.freeze({
  established: "Documented · standard in the field",
  attested: "Documented · a specific recorded instance",
  contested: "Documented · specialists disagree",
  interpretive: "A reading the Game offers · not a claim of influence",
});

const RECEPTION_NOTE: Readonly<Record<string, string>> = Object.freeze({
  confirmed: "Your reading runs with the record.",
  refined: "The record narrows your reading.",
  complicated: "The record runs across your reading. It still stands.",
});

/**
 * An interpretive relation has no record to run with, so it gets the Game's own
 * voice and never a sentence that lends it an authority the pack does not carry.
 */
const READING_NOTE: Readonly<Record<string, string>> = Object.freeze({
  confirmed: "The Game reads it the same way.",
  refined: "The Game reads it slightly differently.",
  complicated: "The Game reads it across yours. Both are readings.",
});

const NO_CITATIONS: readonly Citation[] = Object.freeze([]);

/** True when the Game is offering a reading rather than reporting a record. */
export function isInterpretive(evidence: string): boolean {
  return !SPEAKS_FOR_RECORD.has(evidence);
}

/**
 * The heading over the citations.
 *
 * A citation count under an interpretive relation reads as a citation *of* it.
 * The pack's validator only ever requires sources for claims that assert
 * influence; on an interpretive relation the entries are evidence for the two
 * structures being compared — Douady and Couder for the phyllotaxis, Barbour
 * for the tuning — and never for the comparison, which is the Game's own. So
 * the line says which, and it no longer sends anyone to a Codex.
 */
export function sourceLine(count: number, interpretive: boolean): string | null {
  if (count === 0) return null;
  const noun = count === 1 ? "source" : "sources";
  return interpretive
    ? `${count} ${noun} for the material compared`
    : `${count} ${noun} for this claim`;
}

/**
 * The register entries a relation cites, in the order it cites them.
 *
 * An id the register does not carry is dropped rather than printed as a bare
 * id: a citation a player cannot follow is worse than a shorter list, and the
 * count that heads the list is taken from what actually resolved, so the
 * heading can never promise more evidence than the page shows.
 */
export function citationsFor(ids: readonly string[]): readonly Citation[] {
  const resolved: Citation[] = [];
  for (const id of ids) {
    const source = sourceById.get(id);
    if (source === undefined) continue;
    resolved.push(
      Object.freeze({
        id,
        citation: source.citation,
        locator: source.locator ?? null,
      })
    );
  }
  return Object.freeze(resolved);
}

/** An authored relation, with the standing its evidence class permits. */
export function documentedReading(
  relation: DocumentedRelation,
  evidence: EvidenceClass,
  reception: string
): Reading {
  const interpretive = isInterpretive(evidence);
  const note = interpretive ? READING_NOTE[reception] : RECEPTION_NOTE[reception];
  const citations = citationsFor(relation.sources);
  return {
    kind: "documented",
    title: relation.title,
    body: relation.insight,
    aside: relation.counterpoint ?? null,
    standing: `${EVIDENCE_STANDING[evidence] ?? evidence} · ${note ?? ""}`,
    interpretive,
    sourceLine: sourceLine(citations.length, interpretive),
    citations,
  };
}

/** An interpretable but undocumented pairing. Same weight, different close. */
export function openThreadReading(question: string, facetName: string): Reading {
  return {
    kind: "open",
    title: "An open thread",
    body: question,
    aside: null,
    standing: `No documented relation here · both carry ${facetName}`,
    interpretive: false,
    sourceLine: null,
    citations: NO_CITATIONS,
  };
}

/**
 * Honest near-silence: short because there is genuinely nothing to say, never
 * because the player did anything wrong.
 */
export function unresolvedReading(statement: string): Reading {
  return {
    kind: "unresolved",
    title: "Nothing grounded yet",
    body: statement,
    aside: null,
    standing: "The Game is not asserting anything here",
    interpretive: false,
    sourceLine: null,
    citations: NO_CITATIONS,
  };
}

/** A motif is not an outcome, but it is read on the same surface. */
export function motifReading(
  title: string,
  reason: string,
  concepts: string
): Reading {
  return {
    kind: "motif",
    title,
    body: reason,
    aside: null,
    standing: concepts,
    interpretive: false,
    sourceLine: null,
    citations: NO_CITATIONS,
  };
}
