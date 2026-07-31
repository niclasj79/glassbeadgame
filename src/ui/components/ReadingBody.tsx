import type { ElementType } from "react";
import type { Reading } from "../reading";

/**
 * ONE OUTCOME, SET ONCE.
 *
 * The margin writes a reading while the Game is being played and the conclusion
 * writes the same reading back afterwards. Setting them separately is how two
 * surfaces end up disagreeing about whether a relation is a record or a
 * reading, and it is also how one of them quietly acquires more weight than the
 * other — which is the exact thing CAV-006 forbids. So there is one component,
 * and the only thing either caller may change is the size of the title.
 *
 * THE CITATIONS ARE PART OF IT, NOT AN ATTACHMENT.
 *
 * The plate used to end on "N sources in the Codex": a count, pointing at a
 * screen that was cut. `sources.ts` had exactly one consumer in the whole
 * application and it was that count. Spec §10 wants a source reference in a
 * documented result and the content model's honesty rests on a player being
 * able to go and check, so the entries are printed here, verbatim, in the order
 * the pack cites them, under a heading that says what they are evidence *for*.
 */
export interface ReadingBodyProps {
  readonly reading: Reading;
  /** `h2` in the margin, `h3` inside the conclusion's register. */
  readonly titleTag: ElementType;
  readonly titleClassName: string;
}

export function ReadingBody({
  reading,
  titleTag: Title,
  titleClassName,
}: ReadingBodyProps) {
  return (
    <>
      {/* The scribe's rule: the page is ruled before it is written in. Gold is
          spent only on what is genuinely settled, so a reading the Game offers
          rules in brass however confidently it is put. */}
      <div
        className={
          "mb-3 h-px w-16 " +
          (reading.kind === "documented" && !reading.interpretive
            ? "bg-gold/70"
            : "bg-brass/50")
        }
      />
      <p className="engraved mb-2">{reading.standing}</p>
      <Title className={titleClassName}>{reading.title}</Title>
      <p className="prose-castalia mt-2 max-w-none text-body leading-relaxed">
        {reading.body}
      </p>
      {reading.aside && (
        <p className="mt-3 border-l border-brass/40 pl-3 font-ui text-caption leading-relaxed text-dim">
          {reading.aside}
        </p>
      )}
      {reading.sourceLine && (
        <div className="mt-4" data-testid="citations">
          <p className="engraved normal-case tracking-[0.12em] text-faint">
            {reading.sourceLine}
          </p>
          {/* An ordered list, because the pack cites in a fixed order and a
              player comparing this to `sources.ts` should find the same
              sequence. Set small and quiet: a citation is apparatus. */}
          <ol className="mt-2 space-y-1.5">
            {reading.citations.map((source) => (
              <li
                key={source.id}
                /* Hanging indent, as a bibliography is set: a citation that
                   wraps is otherwise indistinguishable from the next one. */
                className="pl-4 font-ui text-caption leading-relaxed text-dim [text-indent:-1rem]"
              >
                {source.citation}
                {source.locator && (
                  <span className="text-faint"> — {source.locator}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {/* An open question keeps its rule hanging: the phrase has not closed,
          and the page shows it. */}
      {reading.kind === "open" && (
        <div className="mt-4 h-px w-24 bg-gradient-to-r from-brass/60 to-transparent" />
      )}
    </>
  );
}
