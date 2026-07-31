import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PresentationCue } from "@/runtime/cues";
import { cueBus } from "@/runtime/cues";
import { castaliaConceptById } from "@/content/castalia/concepts";
import { facetById } from "@/content/castalia/facets";
import { toFacetId } from "@/content/castalia/schema";
import { useStore } from "@/state/store";

/**
 * MARGINALIA — where an outcome is read.
 *
 * The prototype answered every documented connection with a modal card that
 * stopped the world, and the audit lists "modal ceremony for every curated
 * connection" for removal. The replacement is the behaviour of an actual
 * manuscript: a hand writes in the margin while the page stays open. Play is
 * never blocked, nothing needs dismissing, and the note fades on its own.
 *
 * Three commitments show up directly in the markup:
 *
 *  - **Epistemic status is set in the type, not in colour.** The evidence line
 *    is always present and always says which kind of claim this is. A player
 *    with no colour vision, reading a monochrome screenshot, still knows
 *    whether the Game is asserting a fact or offering a reading.
 *  - **An Open Thread is set at the same weight as a documented relation**
 *    (CAV-006). Same measure, same type size, same dwell. Only the closing
 *    mark differs — a documented note ends; an open one keeps a hanging rule.
 *  - **Nothing here is dismissible chrome.** It is `aria-hidden`, because the
 *    same text already reaches assistive technology through the live region in
 *    `InterpretationControls`. Announcing it twice is worse than not at all.
 */

interface Note {
  readonly id: string;
  readonly kind: "documented" | "open" | "unresolved" | "motif";
  readonly title: string;
  readonly body: string;
  /** The honest complication, set apart so it reads as a caveat, not a clause. */
  readonly aside: string | null;
  /** The honest label for how firmly the Game stands behind this. */
  readonly standing: string;
  /** True when the Game is offering a reading, not reporting a record. */
  readonly interpretive?: boolean;
  readonly sources: readonly string[];
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
 * An interpretive relation has no record to run with. Twelve of the
 * forty-four authored relations are readings the Game offers, asserting nothing
 * beyond the two structures compared — so they get the Game's own voice, and
 * never a sentence that lends them an authority the pack does not carry.
 */
const READING_NOTE: Record<string, string> = {
  confirmed: "The Game reads it the same way.",
  refined: "The Game reads it slightly differently.",
  complicated: "The Game reads it across yours. Both are readings.",
};

/** Only these classes may be spoken of as a record. */
const SPEAKS_FOR_RECORD = new Set(["established", "attested", "contested"]);

function noteFor(cue: PresentationCue): Note | null {
  switch (cue.type) {
    case "outcome.documented": {
      const { relation, evidence, reception } = cue.payload;
      return {
        id: cue.id,
        kind: "documented",
        title: relation.title,
        body: relation.insight,
        aside: relation.counterpoint ?? null,
        interpretive: !SPEAKS_FOR_RECORD.has(evidence),
        standing: `${EVIDENCE_STANDING[evidence] ?? evidence} · ${
          (SPEAKS_FOR_RECORD.has(evidence)
            ? RECEPTION_NOTE[reception]
            : READING_NOTE[reception]) ?? ""
        }`,
        sources: relation.sources,
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
        standing: `No documented relation here · both carry ${facet}`,
        sources: [],
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
        standing: "The Game is not asserting anything here",
        sources: [],
        seconds: cue.duration,
      };
    case "motif.completed":
      return {
        id: cue.id,
        kind: "motif",
        title: `${String(cue.payload.motifKindId)} has formed`,
        body: cue.payload.reason,
        aside: null,
        standing: cue.payload.conceptIds
          .map((id) => castaliaConceptById.get(String(id))?.name ?? String(id))
          .join(" · "),
        sources: [],
        seconds: cue.duration,
      };
    default:
      return null;
  }
}

export function Marginalia() {
  const [note, setNote] = useState<Note | null>(null);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = cueBus.subscribe("ui", (cue) => {
      const next = noteFor(cue);
      if (!next) return;
      setNote(next);
      if (timer.current !== null) window.clearTimeout(timer.current);
      // Held a little past the cue so the last words are readable after the
      // world has finished responding, then released without asking.
      timer.current = window.setTimeout(
        () => setNote(null),
        Math.max(4200, next.seconds * 1000 + 3400)
      );
    });
    return () => {
      unsubscribe();
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  // Caption text is announced by the live region in InterpretationControls;
  // this surface is deliberately silent to assistive technology.
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-[min(27rem,32vw)] items-center md:flex"
    >
      {/* The page beneath the margin. Without it the note competes with the
          arena for the same pixels and both become unreadable — a margin is
          only a margin if something is holding it. */}
      <div
        className={
          "absolute inset-0 -z-10 bg-gradient-to-l from-void via-void/92 to-transparent transition-opacity duration-700 " +
          (note ? "opacity-100" : "opacity-0")
        }
      />
      <AnimatePresence mode="wait">
        {note && (
          <motion.figure
            key={note.id}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 6 }}
            transition={{ duration: reducedMotion ? 0.14 : 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="m-0 w-full pl-10 pr-8"
          >
            {/* The scribe's rule: the margin is ruled before it is written in. */}
            <div
              className={
                "mb-3 h-px w-16 " +
                (note.kind === "documented" && !note.interpretive
                  ? "bg-gold/70"
                  : "bg-brass/50")
              }
            />
            <figcaption className="engraved mb-2">{note.standing}</figcaption>
            <h2 className="font-display text-title font-medium leading-tight text-vellum">
              {note.title}
            </h2>
            <p className="prose-castalia mt-2 max-w-none text-body leading-relaxed">
              {note.body}
            </p>
            {note.aside && (
              <p className="mt-3 border-l border-brass/40 pl-3 font-ui text-caption leading-relaxed text-dim">
                {note.aside}
              </p>
            )}
            {note.sources.length > 0 && (
              <p className="engraved mt-3 normal-case tracking-[0.12em] text-faint">
                {note.sources.length === 1
                  ? "1 source in the Codex"
                  : `${note.sources.length} sources in the Codex`}
              </p>
            )}
            {/* An open question keeps its rule hanging: the phrase has not
                closed, and the page shows it. */}
            {note.kind === "open" && (
              <div className="mt-4 h-px w-24 bg-gradient-to-r from-brass/60 to-transparent" />
            )}
          </motion.figure>
        )}
      </AnimatePresence>
    </div>
  );
}
