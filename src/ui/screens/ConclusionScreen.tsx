import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { buildAnnotation, type Annotation } from "@/domain/annotation";
import { resolveSessionOutcomes } from "@/domain/outcomes";
import { compileConclusion } from "@/domain/performance";
import { buildPortrait, type Portrait } from "@/domain/portrait";
import { castaliaLookup } from "@/runtime/content/castaliaLookup";
import { startSession } from "@/runtime/session";
import { presentationNow } from "@/runtime/testMode";
import { domainSessionStore } from "@/state/domainSession";
import { useStore } from "@/state/store";
import { useStore as useVanillaStore } from "zustand";
import {
  delayMsFor,
  revealAfter,
  revealSchedule,
  type PerformanceTiming,
  type RevealState,
  type RevealStep,
} from "./conclusionReveal";
import { PortraitPlate } from "./PortraitPlate";
import { ReadingScroller } from "./ReadingScroller";
import { threadRegister, type ThreadReading } from "./threadRegister";

/**
 * THE CONCLUSION
 *
 * A thin shell around `PortraitPlate`. Everything on the plate is derived from
 * the canonical event log — the same log the arena appended to, replayed — so
 * the reading a player is given at the end is a reading of the Game they
 * actually played and nothing else.
 *
 * The legacy plate is gone entirely: score, rank sigil, codex-new markers, the
 * share-progress link, and the list of curated connections all counted against
 * a corpus that no longer ships. ADR-010 replaces the number with the portrait.
 *
 * THE PERFORMANCE NOW REACHES THE PAGE (GAP-4).
 *
 * `compileConclusion` has always compiled the concluded log into a score: entry
 * times in creation order, a tempo taken from the web's density and tension
 * load, a total length. Until this pass the only consumer outside the domain
 * was the audio director. The page ignored it and stamped itself complete at
 * t = 0, so a player heard a reconstruction of their session play out over a
 * document that had finished arriving before the first voice entered.
 *
 * The reading assembles on that clock now — `conclusionReveal.ts` holds the
 * mapping and the reasoning. Two things it is careful not to be:
 *
 *  - **Not a cutscene.** Another Game and Leave stand from the first frame,
 *    "Read it all now" ends the assembly, and Escape does the same from the
 *    keyboard. Nothing here waits for the performance to finish before the
 *    player may act, and there is no state in which the way out is missing.
 *  - **Not a second compilation of anything.** The performance is compiled from
 *    the same replayed session the portrait and the annotation are built from,
 *    by the same pure function the progression published to the audio director,
 *    so the page and the score cannot describe different sessions.
 *
 * WHAT IS STILL UNCONSUMED, AND BY WHOM. `performance.camera` — the ordered
 * camera hints, each with a reason — and `performance.climax` belong to the
 * scene. This module deliberately reads neither: a camera hint is not a DOM
 * concern, and marking the climax on the plate would print a best thread, which
 * is the number ADR-010 removed wearing a different hat.
 */

export interface ConclusionReadingProps {
  readonly portrait: Portrait;
  readonly annotation: Annotation;
  readonly threadCount: number;
  readonly threads: readonly ThreadReading[];
  /** Null renders the whole reading at once. See `PortraitPlateProps`. */
  readonly reveal?: RevealState | null;
  readonly onTakeWhole?: () => void;
  readonly onAnother: () => void;
  readonly onLeave: () => void;
}

/**
 * The composed page, with no store attached — the ground it is read against,
 * the scrolling column, and the plate. Separate from the shell so the layout
 * that made the last image unreadable can be asserted directly.
 */
export function ConclusionReading({
  portrait,
  annotation,
  threadCount,
  threads,
  reveal = null,
  onTakeWhole,
  onAnother,
  onLeave,
}: ConclusionReadingProps) {
  return (
    <>
      {/*
        THE SCRIM, IN TWO PARTS.

        The web stays visible behind the reading — it is the thing being read,
        and dismissing it to a blank page would break the one continuity the
        conclusion has. One flat veil could not serve both halves of that: at
        88% the arena was properly present in the margins and *also* still
        punching through the text, because the beads carry bloom and 12% of a
        bloomed bead is a bright object. Depth's evidence line ran across a lit
        bead; the gold armillary crossed the column; troika bead labels read at
        full weight through the middle of a sentence.

        So the veil is cut to the column instead of being turned up everywhere.
        Outside the measure the arena is *more* present than before; inside it
        the ground is effectively solid and no bead, ring or label can reach the
        type. The reading is a page laid on the world, which is what it is.
      */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-void/72 backdrop-blur-[3px]" />
        {/* 62rem, with the flat part of the gradient reaching 12% in from each
            edge: that plateau is wider than the plate's 48rem measure plus its
            gutters, so every line of type — including the evidence lines, which
            are the longest things on the page — stands on solid ground and only
            the empty margin sits in the fade. */}
        <div
          data-testid="conclusion-column-scrim"
          className="absolute inset-y-0 left-1/2 w-[min(62rem,100%)] -translate-x-1/2"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--void) / 0) 0%, hsl(var(--void) / 0.97) 12%, hsl(var(--void) / 0.97) 88%, hsl(var(--void) / 0) 100%)",
          }}
        />
      </div>
      <ReadingScroller
        label="The reading this Game left"
        moreBelowLabel="The reading continues"
      >
        <PortraitPlate
          portrait={portrait}
          annotation={annotation}
          threadCount={threadCount}
          threads={threads}
          reveal={reveal}
          onTakeWhole={onTakeWhole}
          onAnother={onAnother}
          onLeave={onLeave}
        />
      </ReadingScroller>
    </>
  );
}

/**
 * How often the schedule is re-read while it waits.
 *
 * ONE CLOCK, NOT TWO. The page is measured against `presentationNow` — the same
 * clock the cue bus schedules the audio director on — because two directors of
 * one performance reading two different clocks is exactly how a reconstruction
 * stops reconstructing anything. In test mode that clock only moves when a test
 * moves it, so the wait cannot be slept off in one go: it is re-read on a
 * bounded interval instead, which costs four comparisons a second, allocates
 * nothing, and makes the page behave identically under a real clock and under
 * the controlled one the capture harness and the browser suite drive.
 */
const RECHECK_MS = 250;

/**
 * Play the schedule.
 *
 * One timer at a time and one state write per step — around two dozen for a
 * whole session — so nothing here runs on a frame path and nothing accumulates.
 * The cursor is carried in a ref as well as in state because the timer callback
 * needs the current value without re-subscribing, and because "the player took
 * the whole reading" has to be visible to a timeout that is already in flight.
 *
 * The elapsed time is measured against a start stamp rather than accumulated
 * from the timeouts, so a throttled background tab returns to the schedule it
 * has actually reached instead of replaying it from where it fell asleep.
 */
function usePerformedReading(steps: readonly RevealStep[]): {
  readonly reveal: RevealState;
  readonly takeWhole: () => void;
} {
  const [taken, setTaken] = useState(0);
  const takenRef = useRef(0);

  useEffect(() => {
    takenRef.current = 0;
    setTaken(0);
    if (steps.length === 0) return;

    const startedAt = presentationNow();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const play = (): void => {
      const elapsed = presentationNow() - startedAt;
      let next = takenRef.current;
      while (next < steps.length && steps[next].atSeconds * 1000 <= elapsed) {
        next += 1;
      }
      if (next !== takenRef.current) {
        takenRef.current = next;
        setTaken(next);
      }
      if (next < steps.length) {
        timer = setTimeout(
          play,
          Math.min(RECHECK_MS, delayMsFor(steps, next, elapsed))
        );
      }
    };

    play();
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [steps]);

  const takeWhole = useCallback(() => {
    takenRef.current = steps.length;
    setTaken(steps.length);
  }, [steps]);

  const reveal = useMemo(() => revealAfter(steps, taken), [steps, taken]);
  return { reveal, takeWhole };
}

const NO_STEPS: readonly RevealStep[] = Object.freeze([]);

export function ConclusionScreen() {
  const domainSession = useVanillaStore(domainSessionStore, (s) => s.session);
  const returnToTitle = useStore((s) => s.returnToTitle);

  const reading = useMemo(() => {
    if (!domainSession) return null;
    const portrait = buildPortrait(domainSession, castaliaLookup);
    const annotation = buildAnnotation(domainSession, castaliaLookup);
    const threads = threadRegister(
      resolveSessionOutcomes(domainSession, castaliaLookup)
    );
    /*
     * The same compiler, over the same replayed session, that the progression
     * published to the audio director when the Game concluded. It is pure and
     * deterministic — `goldenPath.test.ts` pins that a reloaded log compiles
     * byte-identically — so this is the score that is playing, not a second
     * arrangement of it.
     */
    const performance: PerformanceTiming = compileConclusion(
      domainSession,
      castaliaLookup
    );
    return {
      portrait,
      annotation,
      threads,
      threadCount: domainSession.threads.length,
      steps: revealSchedule(performance, {
        sentences: annotation.sentences.length,
        threads: threads.length,
        readings: portrait.dimensions.length,
      }),
    };
  }, [domainSession]);

  const { reveal, takeWhole } = usePerformedReading(reading?.steps ?? NO_STEPS);

  /* The keyboard's way past the performance. Escape is unclaimed on this
     screen, and a player who wants the page rather than the reconstruction
     should not have to find a control to say so. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") takeWhole();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [takeWhole]);

  if (!reading) return null;

  return (
    <motion.div
      className="absolute inset-0 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 1 } }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <ConclusionReading
        portrait={reading.portrait}
        annotation={reading.annotation}
        threadCount={reading.threadCount}
        threads={reading.threads}
        reveal={reveal}
        onTakeWhole={takeWhole}
        onAnother={() => startSession()}
        onLeave={returnToTitle}
      />
    </motion.div>
  );
}
