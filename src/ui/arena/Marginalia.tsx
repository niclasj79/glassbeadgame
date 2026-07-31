import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cueBus } from "@/runtime/cues";
import { useStore } from "@/state/store";
import { dwellMs, noteFor, type Note } from "./marginaliaNote";

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
 *    (CAV-006). Same measure, same type size, same dwell — the dwell is one
 *    function in `marginaliaNote.ts` and it does not consult the kind. Only the
 *    closing mark differs: a documented note ends; an open one keeps a hanging
 *    rule.
 *  - **Every player gets it.** This surface used to be `hidden md:flex`, so a
 *    phone finished an entire Game without once being told whether a claim was
 *    documented, contested, or a reading — the one thing the content model
 *    exists to distinguish. Below `md` the margin becomes the foot of the page:
 *    same words, same measure, same dwell, same weight for an Open Thread.
 *
 * It is `aria-hidden`, and now truthfully so. The same meaning reaches assistive
 * technology through `CueCaptions`, which subscribes to the caption channel and
 * speaks the evidence phrase for every outcome. Before that existed this file
 * claimed the live region in `InterpretationControls` covered it; that region
 * prints only the mechanics of the player's own input and said nothing about
 * evidence at all.
 */

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
      timer.current = window.setTimeout(() => setNote(null), dwellMs(next));
    });
    return () => {
      unsubscribe();
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      data-testid="marginalia"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end md:inset-y-0 md:left-auto md:right-0 md:w-[min(27rem,32vw)] md:items-center"
    >
      {/* THE PAGE BENEATH THE MARGIN.

          Without it the note competes with the arena for the same pixels and
          both become unreadable — a margin is only a margin if something is
          holding it. It rises from the foot of a phone and in from the side of
          a desktop: the same gesture against the two different edges the note
          is written along.

          Two grounds rather than one gradient with a direction swapped. The
          note is roughly 430px tall on a phone and roughly 300px on a desktop
          margin, so a single ramp that reads correctly across a narrow column
          reaches barely a third of the way up a tall sheet — which is how bead
          labels ended up running straight through "your reading runs with the
          record". Each edge gets stops chosen for the run it actually has. */}
      <div
        className={
          "absolute inset-0 -z-10 backdrop-blur-[2px] transition-opacity duration-700 md:hidden " +
          (note ? "opacity-100" : "opacity-0")
        }
        style={{
          background:
            "linear-gradient(to top, hsl(var(--void)) 0%, hsl(var(--void) / 0.97) 68%, hsl(var(--void) / 0.72) 88%, hsl(var(--void) / 0) 100%)",
        }}
      />
      <div
        className={
          "absolute inset-0 -z-10 hidden transition-opacity duration-700 md:block " +
          (note ? "opacity-100" : "opacity-0")
        }
        style={{
          background:
            "linear-gradient(to left, hsl(var(--void)) 0%, hsl(var(--void) / 0.92) 55%, hsl(var(--void) / 0) 100%)",
        }}
      />
      <AnimatePresence mode="wait">
        {note && (
          <motion.figure
            key={note.id}
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, x: 0, y: 10 }
            }
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: reducedMotion ? 0.14 : 0.7, ease: [0.22, 1, 0.36, 1] }}
            /* Same measure on both edges: the note is a column of running prose
               either way, and pb-20 keeps the last line clear of the sound
               control in the corner. */
            className="m-0 w-full px-6 pb-20 pt-7 md:px-0 md:py-0 md:pl-10 md:pr-8"
          >
            {/* The scribe's rule: the margin is ruled before it is written in.
                Gold is spent only on what is genuinely settled, so a reading
                the Game offers rules in brass however confidently it is put. */}
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
            {note.sourceLine && (
              <p className="engraved mt-3 normal-case tracking-[0.12em] text-faint">
                {note.sourceLine}
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
