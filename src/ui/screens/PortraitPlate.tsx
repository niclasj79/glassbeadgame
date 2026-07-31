import { motion } from "framer-motion";
import type { Annotation } from "@/domain/annotation";
import type { Portrait, PortraitDimension } from "@/domain/portrait";
import { useStore } from "@/state/store";
import { ReadingBody } from "../components/ReadingBody";
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
 * Tension did not fail to. The plate is laid out as six equal entries for
 * exactly that reason; ranking them visually would reintroduce the number the
 * types were careful not to contain.
 *
 * Each dimension shows its evidence. That is the part that makes it a portrait
 * rather than a horoscope: the phrase names concepts, facets and counts the
 * player can go and check against the web they just made.
 */

/**
 * A reading is drawn as a filled arc rather than a bar. A bar has a far end,
 * and a far end is a target; an arc is a position on a dial. The numeric value
 * is never printed.
 */
function Reading({ dimension }: { dimension: PortraitDimension }) {
  const turns = Math.max(0.04, Math.min(1, dimension.value));
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex gap-4">
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="hsl(var(--line))"
          strokeWidth="1"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="hsl(var(--brass))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${circumference * turns} ${circumference}`}
          transform="rotate(-90 28 28)"
        />
      </svg>
      <div className="min-w-0">
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
    </div>
  );
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
 * Every entry is set identically. There is no mark that says one thread went
 * better than another, because none did.
 */
function ThreadEntry({ entry }: { entry: ThreadReading }) {
  return (
    <li data-testid="thread-reading" className="max-w-[46ch]">
      <p className="engraved mb-2 normal-case tracking-[0.12em] text-dim">
        {entry.reading}
      </p>
      <ReadingBody
        reading={entry}
        titleTag="h3"
        titleClassName="font-display text-lead font-medium leading-tight text-vellum"
      />
    </li>
  );
}

export interface PortraitPlateProps {
  readonly portrait: Portrait;
  readonly annotation: Annotation;
  readonly threadCount: number;
  /** Every thread the player wove, in the order they wove it. */
  readonly threads: readonly ThreadReading[];
  readonly onAnother: () => void;
  readonly onLeave: () => void;
}

export function PortraitPlate({
  portrait,
  annotation,
  threadCount,
  threads,
  onAnother,
  onLeave,
}: PortraitPlateProps) {
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const step = reducedMotion ? 0 : 0.09;

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
          summarises. */}
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.2 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5"
      >
        {annotation.sentences.map((sentence, index) => (
          <motion.p
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + index * step * 2, duration: 0.8 }}
            className="prose-castalia mt-3 max-w-[46ch] text-lead"
          >
            {sentence}
          </motion.p>
        ))}
      </motion.div>

      <div className="rule-engraved my-8" />

      <p className="engraved mb-5">
        {threadCount === 1 ? "One thread" : `${threadCount} threads`} · six readings, no total
      </p>

      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {portrait.dimensions.map((dimension, index) => (
          <motion.div
            key={dimension.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 + index * step, duration: 0.7 }}
          >
            <Reading dimension={dimension} />
          </motion.div>
        ))}
      </div>

      {threads.length > 0 && (
        <>
          <div className="rule-engraved my-8" />
          {/* Named for what it is. Not "your best connections", not "what you
              discovered" — the threads, in order, with what the Game answered
              and where that answer can be checked. */}
          <p className="engraved mb-5">The threads, in the order you wove them</p>
          <ol data-testid="thread-register" className="space-y-8">
            {threads.map((entry) => (
              <ThreadEntry key={entry.threadId} entry={entry} />
            ))}
          </ol>
        </>
      )}

      <div className="rule-engraved my-8" />

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
      </div>
      {/* Says what the next Game is for. The invitation is expressive, not
          acquisitive — there is nothing here to accumulate. */}
      <p className="engraved mt-5 normal-case tracking-[0.1em]">
        Another Game draws different beads. Nothing carries over but what you learned to notice.
      </p>
    </div>
  );
}
