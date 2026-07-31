import { useMemo } from "react";
import { motion } from "framer-motion";
import { buildAnnotation, type Annotation } from "@/domain/annotation";
import { buildPortrait, type Portrait } from "@/domain/portrait";
import { castaliaLookup } from "@/runtime/content/castaliaLookup";
import { startSession } from "@/runtime/session";
import { domainSessionStore } from "@/state/domainSession";
import { useStore } from "@/state/store";
import { useStore as useVanillaStore } from "zustand";
import { PortraitPlate } from "./PortraitPlate";
import { ReadingScroller } from "./ReadingScroller";

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
 */

export interface ConclusionReadingProps {
  readonly portrait: Portrait;
  readonly annotation: Annotation;
  readonly threadCount: number;
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
          onAnother={onAnother}
          onLeave={onLeave}
        />
      </ReadingScroller>
    </>
  );
}

export function ConclusionScreen() {
  const domainSession = useVanillaStore(domainSessionStore, (s) => s.session);
  const returnToTitle = useStore((s) => s.returnToTitle);

  const reading = useMemo(() => {
    if (!domainSession) return null;
    return {
      portrait: buildPortrait(domainSession, castaliaLookup),
      annotation: buildAnnotation(domainSession, castaliaLookup),
      threadCount: domainSession.threads.length,
    };
  }, [domainSession]);

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
        onAnother={() => startSession()}
        onLeave={returnToTitle}
      />
    </motion.div>
  );
}
