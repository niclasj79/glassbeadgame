import { motion } from "framer-motion";
import type { Annotation } from "@/domain/annotation";
import type { Portrait, PortraitDimension } from "@/domain/portrait";
import { useStore } from "@/state/store";
import { ReadingBody } from "../components/ReadingBody";
import { QUIET_CONTROL, ReadingRule } from "../components/ReadingColumn";
import type { RevealState } from "./conclusionReveal";
import type { ThreadReading } from "./threadRegister";

/**
 * THE PORTRAIT PLATE — what a Game leaves behind.
 *
 * The prototype ended on a score, a rank sigil, and a progress bar toward the
 * next rank. All three are gone, and ADR-010 is the reason: a number as the
 * primary result makes the next Game an attempt to beat it, and this game's
 * whole claim is that you begin another Game to say something different.
 *
 * What replaces them is six readings with no total. There is deliberately no
 * arithmetic here — no sum, no average, no "overall". A web high in Openness is
 * not worse than a web high in Coherence, and a session that declared no
 * Tension did not fail to.
 *
 * THE DIAL WENT WITH THEM (GAP-14).
 *
 * Six filled arcs on a shared circular track put the score back. A dial is a
 * comparable scale by construction: put six of them on one page, at one radius,
 * struck in one colour, and the eye reads six values against one another and
 * ranks them — which is exactly the cross-dimension comparison the types were
 * built to make impossible. `Portrait` carries no total precisely so that
 * Coherence 0.7 and Openness 0.3 cannot be added; drawing them as two arcs on
 * the same track adds them by eye anyway, and then the fuller arc reads as the
 * better one.
 *
 * Nothing is lost by dropping it, because the value was never the reading. The
 * value and the phrase are computed from the same structure, and the phrase
 * says it in words a player can check — "Sound answered; Image stayed silent",
 * "two of your three threads crossed between faculties". The evidence lines
 * stay for the same reason: they are the only place the portrait names what it
 * counted. What is gone is the picture of a gauge.
 *
 * So a dimension is set exactly as an outcome is: ruled, named, said, and
 * evidenced. One law for anything that is read.
 */

/**
 * One reading of the web. No geometry, no value, no mark that can be compared
 * with the reading beside it — the difference between two dimensions is what
 * they say, and they say it in the phrase.
 */
function Reading({ dimension }: { dimension: PortraitDimension }) {
  return (
    <div data-testid="portrait-reading" className="min-w-0 max-w-[46ch]">
      <ReadingRule />
      <h3 className="font-display text-lead font-medium text-vellum">
        {dimension.label}
      </h3>
      <p className="mt-1 font-ui text-body leading-relaxed text-dim">
        {dimension.phrase}
      </p>
      {dimension.evidence.length > 0 && (
        <p className="engraved mt-2 normal-case tracking-[0.1em]">
          {dimension.evidence.join(" · ")}
        </p>
      )}
    </div>
  );
}

/**
 * How anything on this plate arrives. One object, passed to every entrance, so
 * a thread and a reading cannot acquire different entrances and therefore
 * different weight (CAV-006).
 */
interface Entrance {
  readonly initial: { readonly opacity: number; readonly y?: number };
  readonly animate: { readonly opacity: number; readonly y: number };
  readonly transition: {
    readonly duration: number;
    readonly ease: readonly [number, number, number, number];
  };
}

/**
 * ONE THREAD, READ BACK.
 *
 * The margin says this while the Game is being played and it is gone the moment
 * the player picks the arena back up; this is where it can be found afterwards.
 * Same words, same order, same epistemic label — and the citations, which no
 * surface in the game printed at all before this pass, so a documented claim
 * could be checked by nobody.
 *
 * Every entry is set identically, and every entry *enters* identically. There
 * is no mark that says one thread went better than another, because none did —
 * including the one the compiler found heaviest, which is why
 * `performance.climax` is not consulted anywhere on this plate.
 */
function ThreadEntry({
  entry,
  entrance,
}: {
  entry: ThreadReading;
  entrance: Entrance;
}) {
  return (
    <motion.li
      data-testid="thread-reading"
      className="max-w-[46ch]"
      initial={entrance.initial}
      animate={entrance.animate}
      transition={entrance.transition}
    >
      <p className="engraved mb-2 normal-case tracking-[0.12em] text-dim">
        {entry.reading}
      </p>
      <ReadingBody
        reading={entry}
        titleTag="h3"
        titleClassName="font-display text-lead font-medium leading-tight text-vellum"
      />
    </motion.li>
  );
}

export interface PortraitPlateProps {
  readonly portrait: Portrait;
  readonly annotation: Annotation;
  readonly threadCount: number;
  /** Every thread the player wove, in the order they wove it. */
  readonly threads: readonly ThreadReading[];
  /**
   * How much of the reading the performance has written. Null is the whole
   * reading at once — the honest fallback when there is no performance to read
   * a clock from, and what a player gets the moment they ask for it.
   */
  readonly reveal?: RevealState | null;
  /** Ends the assembly and hands over the whole reading. */
  readonly onTakeWhole?: () => void;
  readonly onAnother: () => void;
  readonly onLeave: () => void;
}

export function PortraitPlate({
  portrait,
  annotation,
  threadCount,
  threads,
  reveal = null,
  onTakeWhole,
  onAnother,
  onLeave,
}: PortraitPlateProps) {
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  /*
   * Reduced motion shortens the entrance and removes the travel; it does not
   * remove the pacing, because the pacing is the performance and not an
   * animation of it. `index.css` states the same rule for the whole game: the
   * point is to remove travel and parallax, not continuity.
   */
  const entrance: Entrance = {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reducedMotion ? 0.2 : 0.9,
      ease: [0.22, 1, 0.36, 1],
    },
  };

  /*
   * Everything below is sliced rather than hidden, so the page is only ever as
   * tall as what has actually been written and nothing is laid out into a hole
   * it will fill in thirty seconds. That is also why the register stands above
   * the six readings now: in time the threads enter first and the web can only
   * be characterised once they have, so putting them in that order means the
   * page grows downward and never reflows a line the player is reading.
   */
  const sentences = reveal
    ? annotation.sentences.slice(0, reveal.sentences)
    : annotation.sentences;
  const woven = reveal ? threads.slice(0, reveal.threads) : threads;
  const readings = reveal
    ? portrait.dimensions.slice(0, reveal.readings)
    : portrait.dimensions;
  const closed = reveal === null || reveal.closed;

  return (
    /*
     * The measure is deliberately narrower than the column scrim behind it, so
     * the type never runs to the edge of its own ground. Vertical rhythm was
     * pulled in from py-16/my-10 because the plate did not fit a 1440x810
     * viewport by roughly the height of one reading: the last row was cut
     * mid-heading. It still scrolls on a short screen — six readings and a
     * five-sentence annotation will not fit every laptop — but it now fits
     * more of them, and `ReadingScroller` says so when it does not.
     */
    <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-14">
      <p className="engraved">The Game concludes</p>

      {/* The annotation leads, because it is the sentence about *this* web.
          The readings are supporting evidence for it, not a scorecard it
          summarises. Its sentences step on the performance's beat. */}
      <div className="mt-5">
        {sentences.map((sentence, index) => (
          <motion.p
            key={index}
            initial={entrance.initial}
            animate={entrance.animate}
            transition={entrance.transition}
            className="prose-castalia mt-3 max-w-[46ch] text-lead"
          >
            {sentence}
          </motion.p>
        ))}
      </div>

      {woven.length > 0 && (
        <>
          <div className="rule-engraved my-8" />
          {/* Named for what it is. Not "your best connections", not "what you
              discovered" — the threads, in order, with what the Game answered
              and where that answer can be checked. */}
          <p className="engraved mb-5">The threads, in the order you wove them</p>
          <ol data-testid="thread-register" className="space-y-8">
            {woven.map((entry) => (
              <ThreadEntry
                key={entry.threadId}
                entry={entry}
                entrance={entrance}
              />
            ))}
          </ol>
        </>
      )}

      {readings.length > 0 && (
        <>
          <div className="rule-engraved my-8" />
          <p className="engraved mb-5">
            {threadCount === 1 ? "One thread" : `${threadCount} threads`} · six readings, no total
          </p>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {readings.map((dimension) => (
              <motion.div
                key={dimension.id}
                initial={entrance.initial}
                animate={entrance.animate}
                transition={entrance.transition}
              >
                <Reading dimension={dimension} />
              </motion.div>
            ))}
          </div>
        </>
      )}

      <div className="rule-engraved my-8" />

      {/* THE WAY OUT IS NEVER WITHHELD.
          Both controls stand from the first frame of the conclusion, before the
          performance has finished writing the page. A reading that assembles
          over its own performance must not become a thing the player has to sit
          through, so the third control — present only while there is still
          something to come — ends the assembly and hands over the rest at once.
          Escape does the same thing from the keyboard. */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onAnother}
          className="rounded-full border border-gold/50 bg-gold/10 px-7 py-3 font-ui text-caption uppercase tracking-engraved text-vellum transition-colors hover:bg-gold/20"
        >
          Another Game
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-full border border-line/50 px-7 py-3 font-ui text-caption uppercase tracking-engraved text-dim transition-colors hover:border-brass/60 hover:text-bright"
        >
          Leave
        </button>
        {!closed && onTakeWhole && (
          <button
            type="button"
            data-testid="conclusion-take-whole"
            onClick={onTakeWhole}
            className={QUIET_CONTROL}
          >
            Read it all now
          </button>
        )}
      </div>
      {/* Says what the next Game is for. The invitation is expressive, not
          acquisitive — there is nothing here to accumulate. */}
      <p className="engraved mt-5 normal-case tracking-[0.1em]">
        Another Game draws different beads. Nothing carries over but what you learned to notice.
      </p>
    </div>
  );
}
