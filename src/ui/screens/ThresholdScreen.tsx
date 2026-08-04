import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { startSession } from "@/runtime/session";
import { useStore } from "@/state/store";
import { Button } from "../components/Button";
import {
  THRESHOLD_ANSWERS,
  THRESHOLD_COPY,
  THRESHOLD_FACULTIES,
  THRESHOLD_VERBS,
} from "./thresholdCopy";

/**
 * THE THRESHOLD SCREEN.
 *
 * It stands between the title and the arena, and the instrument stands behind
 * it the whole time: `phase === "threshold"` is read by `CameraRig`,
 * `Armillary` and `useAudio` as the pre-arena pose, so the world is already
 * composed and breathing while this is read. Nothing is loading, and nothing
 * says it is.
 *
 * WHY THE DRAW IS BUILT HERE AND NOT AT THE TITLE. `startSession` builds the
 * draw and flips the phase in one move, so it cannot run until the player has
 * finished reading — otherwise they would be pulled into the arena mid-sentence.
 * The expensive half is already paid for: the title screen holds its door shut
 * until the shaders have linked (`openingWorld`), which is the two-second freeze
 * that used to eat the entire opening. What is left on this press is the draw
 * itself, which is a seeded shuffle over twenty-four concepts.
 *
 * The press is still answered on the way down, for the same reason the title's
 * is: a decision the player has already made must not sit unacknowledged while
 * the main thread is busy. `scene/opening.ts` carries the measurements.
 *
 * ON SCROLLING. This is more words than the game shows anywhere else, and on a
 * short phone it will not fit. It scrolls, and the door travels with the text
 * rather than being pinned to the viewport, because a control that floats over
 * the reading implies the reading is an obstacle to it.
 */

const RISE = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

/** Staggered so the page assembles rather than appearing. Matches the title. */
function step(index: number, reducedMotion: boolean) {
  return {
    ...RISE,
    initial: reducedMotion ? { opacity: 0 } : RISE.initial,
    transition: {
      duration: reducedMotion ? 0.2 : 0.7,
      delay: reducedMotion ? 0 : 0.08 * index,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  };
}

export function ThresholdScreen() {
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  const [entering, setEntering] = useState(false);
  const pressed = useRef(false);

  const enter = useCallback(() => {
    if (pressed.current) return;
    pressed.current = true;
    setEntering(true);
  }, []);

  /*
   * Two frames after the leaving state is committed, exactly as the title does
   * it: long enough for the browser to have painted the acknowledgement, short
   * enough that the arena is not kept waiting.
   */
  useEffect(() => {
    if (!entering) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => startSession());
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, [entering]);

  return (
    <motion.div
      data-testid="threshold"
      className="absolute inset-0 z-10 overflow-y-auto overscroll-contain"
      initial={{ opacity: 0 }}
      animate={{ opacity: entering ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: entering ? 0.45 : 0.8 }}
      style={{ pointerEvents: entering ? "none" : undefined }}
    >
      {/*
       * THE PAGE HAS A GROUND.
       *
       * Captured at 1440x900 and 414x896 before this existed: the armillary's
       * gold ring and the firmament's graticule ran straight through the body
       * text — "Near-silence" and "nobody knows" each had a line through them.
       * This is more running prose than the game shows anywhere else, and it
       * sits centre-stage rather than in a margin.
       *
       * It is a dye and not a panel, in the same language `ReadingColumn` uses
       * for the margin and `scene/MarginRule.tsx` for the frame: void, laid
       * thickest where the measure is and falling off to almost nothing at the
       * edges, so the instrument stays visible and stops competing. It is fixed
       * rather than scrolled, so the world behind is dimmed evenly however far
       * down the page the reader is — and it goes when the page goes.
       */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 62% 96% at 50% 50%, hsl(var(--void) / 0.82) 0%, hsl(var(--void) / 0.7) 52%, hsl(var(--void) / 0.18) 100%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-2xl px-6 py-14 sm:py-20">
        <motion.p {...step(0, reducedMotion)} className="engraved">
          {THRESHOLD_COPY.eyebrow}
        </motion.p>

        <motion.h1
          {...step(1, reducedMotion)}
          className="mt-4 font-display text-5xl font-medium tracking-wide text-bright sm:text-6xl"
        >
          {THRESHOLD_COPY.title}
        </motion.h1>

        <motion.p
          {...step(2, reducedMotion)}
          className="prose-castalia mt-6 max-w-[44ch]"
        >
          {THRESHOLD_COPY.welcome}
        </motion.p>

        {/* The four faculties, named and glossed by the pack itself. */}
        <motion.dl
          {...step(3, reducedMotion)}
          className="mt-7 grid gap-x-8 gap-y-4 sm:grid-cols-2"
        >
          {THRESHOLD_FACULTIES.map((faculty) => (
            <div key={faculty.name} className="min-w-0">
              <dt className="font-display text-lead font-medium text-vellum">
                {faculty.name}
              </dt>
              <dd className="mt-1 font-ui text-caption leading-relaxed text-dim">
                {faculty.gloss}
              </dd>
            </div>
          ))}
        </motion.dl>

        <div className="rule-engraved my-9" />

        <motion.p
          {...step(4, reducedMotion)}
          className="prose-castalia max-w-[44ch]"
        >
          {THRESHOLD_COPY.verbsLead}
        </motion.p>

        {/* The same glyphs, names and meanings the plate will offer. */}
        <motion.ul {...step(5, reducedMotion)} className="mt-6 space-y-3">
          {THRESHOLD_VERBS.map((verb) => (
            <li key={verb.label} className="flex items-baseline gap-4">
              <span
                aria-hidden
                className="w-6 shrink-0 text-center font-ui text-lead text-brass"
              >
                {verb.icon}
              </span>
              <span className="min-w-0">
                <span className="font-display text-lead font-medium text-vellum">
                  {verb.label}
                </span>
                <span className="font-ui text-body text-dim"> — {verb.description}</span>
              </span>
            </li>
          ))}
        </motion.ul>

        <div className="rule-engraved my-9" />

        <motion.p
          {...step(6, reducedMotion)}
          className="prose-castalia max-w-[44ch]"
        >
          {THRESHOLD_COPY.answersLead}
        </motion.p>

        <motion.ul {...step(7, reducedMotion)} className="mt-5 space-y-4">
          {THRESHOLD_ANSWERS.map((answer) => (
            <li key={answer.kind} className="max-w-[46ch]">
              <span className="font-display text-lead font-medium text-vellum">
                {answer.kind}
              </span>
              <span className="font-ui text-body leading-relaxed text-dim">
                {" "}
                — {answer.sentence}
              </span>
            </li>
          ))}
        </motion.ul>

        <div className="rule-engraved my-9" />

        <motion.p {...step(8, reducedMotion)} className="engraved">
          {THRESHOLD_COPY.pointHeading}
        </motion.p>
        {THRESHOLD_COPY.point.map((paragraph, index) => (
          <motion.p
            key={index}
            {...step(9 + index, reducedMotion)}
            className="prose-castalia mt-4 max-w-[46ch]"
          >
            {paragraph}
          </motion.p>
        ))}

        <motion.p
          {...step(11, reducedMotion)}
          className="mt-8 font-ui text-body leading-relaxed text-faint"
        >
          {THRESHOLD_COPY.reassurance}
        </motion.p>

        {/* Travels with the reading rather than floating over it. */}
        <motion.div {...step(12, reducedMotion)} className="mt-10">
          <Button
            data-testid="threshold-enter"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              enter();
            }}
            onClick={enter}
          >
            {THRESHOLD_COPY.enter}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
