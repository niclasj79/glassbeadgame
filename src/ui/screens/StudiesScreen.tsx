import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { studies, type StudyChapterListing } from "@/runtime/studies";
import { useStore } from "@/state/store";
import { QUIET_CONTROL } from "../components/ReadingColumn";

/**
 * THE STUDIES (STUDIES-SPEC §7) — the page behind the second door.
 *
 * Three chapters, in their order, and in each its Studies by their briefs: the
 * brief is the whole of what a Study says before it is begun, and it is worded
 * the same for a Study that can be done and one that cannot, because both are
 * rendered by one function from the goal. Beside each brief is Begin.
 *
 * WHAT THE PAGE DOES NOT SAY. It shows briefs, not results: no Study is marked
 * solved or unsolved, no chapter is marked complete, and nothing counts —
 * no "3 of 12", no percentage, no bar. The Studies keep nothing (§10), so
 * there is nothing true that such a mark could say; and a list that remembered
 * would make the next Study an attempt to fill it in.
 *
 * NO THRESHOLD. A Study opens straight into the arena. The one paragraph here
 * says only what a Study is and the one answer a player would not otherwise
 * know they may give, in the specification's own words: that saying a brief
 * cannot be met is an answer, not a surrender.
 *
 * THE PRESS IS ANSWERED BEFORE THE STUDY IS BUILT. Begin builds a session and
 * mounts the arena, synchronously, exactly as the threshold's Enter does — so
 * it keeps the threshold's law (`threshold.test.ts`): the page answers on the
 * way down, the Study is begun two frames later behind that paint, and a second
 * press is a no-op. The way back builds nothing and is taken on the click.
 *
 * The instrument stands behind the page the whole time, dimmed by the same
 * dye the threshold uses, and the page scrolls on a short phone rather than
 * pinning anything over the reading.
 */

const RISE = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

/** Staggered so the page assembles rather than appearing, as the threshold does. */
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

/** What a Study is, and the answer a player would not otherwise know to give. */
const LEAD =
  "Each Study is a problem posed over a fixed set of beads and solved by weaving, with the Game's own verbs. If a brief cannot be met with the beads given, say so: that is an answer, not a surrender. Nothing is timed, and nothing is lost.";

/** The same ground as the threshold's: a dye, thickest where the measure is. */
const GROUND =
  "radial-gradient(ellipse 62% 96% at 50% 50%, hsl(var(--void) / 0.82) 0%, hsl(var(--void) / 0.7) 52%, hsl(var(--void) / 0.18) 100%)";

export interface StudiesPageProps {
  /** The three chapters in order, each with its Studies in order (`studies.chapters()`). */
  readonly chapters: readonly StudyChapterListing[];
  readonly reducedMotion: boolean;
  /** A Study has been begun and the page is leaving. */
  readonly leaving: boolean;
  readonly onBegin: (studyId: string) => void;
  readonly onBack: () => void;
}

/**
 * The page with no store attached, so what it lists and what each control does
 * can be read and pressed. `StudiesScreen` is the subscription and the press.
 */
export function StudiesPage({
  chapters,
  reducedMotion,
  leaving,
  onBegin,
  onBack,
}: StudiesPageProps) {
  return (
    <motion.div
      data-testid="studies-screen"
      className="absolute inset-0 z-10 overflow-y-auto overscroll-contain"
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: leaving ? 0.45 : 0.8 }}
      style={{ pointerEvents: leaving ? "none" : undefined }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: GROUND }}
      />

      <div className="relative mx-auto w-full max-w-2xl px-6 py-14 sm:py-20">
        <motion.div {...step(0, reducedMotion)}>
          <button
            type="button"
            data-testid="studies-back"
            onClick={onBack}
            className={QUIET_CONTROL}
          >
            Back to the title
          </button>
        </motion.div>

        <motion.p {...step(1, reducedMotion)} className="engraved mt-10">
          Castalia
        </motion.p>
        <motion.h1
          {...step(2, reducedMotion)}
          className="mt-4 font-display text-5xl font-medium tracking-wide text-bright sm:text-6xl"
        >
          Studies
        </motion.h1>
        <motion.p
          {...step(3, reducedMotion)}
          className="prose-castalia mt-6 max-w-[44ch]"
        >
          {LEAD}
        </motion.p>

        {chapters.map((chapter, index) => (
          <motion.section
            key={chapter.chapter}
            {...step(4 + index, reducedMotion)}
            data-testid="studies-chapter"
            data-chapter={chapter.chapter}
            aria-labelledby={`studies-chapter-${chapter.chapter}`}
          >
            <div className="rule-engraved my-9" />
            <h2
              id={`studies-chapter-${chapter.chapter}`}
              className="font-display text-title font-medium text-vellum"
            >
              {chapter.name}
            </h2>
            <ul className="mt-5 space-y-4">
              {chapter.studies.map((study) => (
                <li
                  key={study.id}
                  data-testid="study-listing"
                  data-study-id={study.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
                >
                  <p
                    data-testid="study-listing-brief"
                    className="min-w-0 max-w-[40ch] font-display text-lead leading-snug text-bright/90"
                  >
                    {study.brief}
                  </p>
                  <button
                    type="button"
                    data-testid={`study-begin-${study.id}`}
                    aria-label={`Begin — ${study.brief}`}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      onBegin(study.id);
                    }}
                    onClick={() => onBegin(study.id)}
                    className={QUIET_CONTROL}
                  >
                    Begin
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        ))}
      </div>
    </motion.div>
  );
}

export function StudiesScreen() {
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  // The list is authored data and does not change while it is read.
  const [chapters] = useState(() => studies.chapters());
  const [leaving, setLeaving] = useState<string | null>(null);
  const pressed = useRef(false);

  const begin = useCallback((studyId: string) => {
    if (pressed.current) return;
    pressed.current = true;
    setLeaving(studyId);
  }, []);

  const back = useCallback(() => {
    if (pressed.current) return;
    pressed.current = true;
    useStore.getState().returnToTitle();
  }, []);

  /*
   * Two frames after the leaving state is committed, exactly as the threshold
   * does it: long enough for the browser to have painted the answer to the
   * press, short enough that the arena is not kept waiting.
   */
  useEffect(() => {
    if (leaving === null) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => studies.start(leaving));
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, [leaving]);

  return (
    <StudiesPage
      chapters={chapters}
      reducedMotion={reducedMotion}
      leaving={leaving !== null}
      onBegin={begin}
      onBack={back}
    />
  );
}
