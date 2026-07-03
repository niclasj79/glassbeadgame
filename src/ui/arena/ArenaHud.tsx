import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/state/store";
import { isCoarsePointer } from "@/lib/device";
import type { Discovery, MotifAward } from "@/state/types";
import { GlassPanel } from "../components/GlassPanel";
import { Button } from "../components/Button";
import { BeadInspectCard } from "./BeadInspectCard";
import { DiscoveryCard } from "./DiscoveryCard";
import { JournalDrawer } from "./JournalDrawer";
import { MotifRitualToast, MotifTracker } from "./MotifTracker";

function ResonanceGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"
        fill="currentColor"
      />
    </svg>
  );
}

function BookGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5.5A2.5 2.5 0 016.5 3H20v15.5H6.5A2.5 2.5 0 004 21V5.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M20 18.5H6.5a2.5 2.5 0 000 5H20" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function LensGuide() {
  return (
    <GlassPanel className="pointer-events-auto absolute bottom-5 right-5 hidden w-80 bg-void/62 p-4 md:block">
      <p className="font-ui text-[10px] uppercase tracking-[0.35em] text-dim">The Lens</p>
      <p className="mt-2 font-display text-base italic leading-relaxed text-bright/90">
        Labels mark focus, woven beads, and the extreme points of True, Beautiful, and Good.
      </p>
    </GlassPanel>
  );
}

export function ArenaHud() {
  const score = useStore((s) => s.session?.score ?? 0);
  const threadCount = useStore((s) => s.session?.threads.length ?? 0);
  const discoveries = useStore((s) => s.session?.discoveries ?? []);
  const motifs = useStore((s) => s.session?.motifs ?? []);
  const mode = useStore((s) => s.session?.interaction.mode ?? "idle");
  const returnToTitle = useStore((s) => s.returnToTitle);
  const concludeSession = useStore((s) => s.concludeSession);
  const finishConcluding = useStore((s) => s.finishConcluding);
  const lensActive = useStore((s) => s.lensActive);
  const setLens = useStore((s) => s.setLens);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);

  const curatedAvailable = useStore((s) => s.session?.curatedAvailable ?? 0);

  const [journalOpen, setJournalOpen] = useState(false);
  // The welcome is a first-encounter ritual, not a per-session toll gate.
  const [welcomeOpen, setWelcomeOpen] = useState(
    () => !useStore.getState().settings.hintsSeen.welcome
  );
  const dismissWelcome = () => {
    setWelcomeOpen(false);
    markHintSeen("welcome");
  };
  const [faintToast, setFaintToast] = useState<Discovery | null>(null);
  const [motifToast, setMotifToast] = useState<MotifAward | null>(null);
  const seenDiscoveries = useRef(0);
  const seenMotifs = useRef(0);

  useEffect(() => {
    if (mode !== "concluding") return;
    const t = setTimeout(finishConcluding, reducedMotion ? 700 : 4200);
    return () => clearTimeout(t);
  }, [mode, finishConcluding, reducedMotion]);

  const hintsSeen = useStore((s) => s.settings.hintsSeen);
  const markHintSeen = useStore((s) => s.markHintSeen);
  const coarse = useMemo(isCoarsePointer, []);
  const activeHint = useMemo(() => {
    if (welcomeOpen) return null;
    if (threadCount === 0 && !hintsSeen.weave) {
      return {
        id: "weave",
        delay: 2.2,
        text: coarse
          ? "Tap a bead, then tap another to weave a thread - drag the void to orbit"
          : "Press a bead and draw its thread to another - drag the void to orbit",
      };
    }
    if (discoveries.length >= 1 && !hintsSeen.journal) {
      return {
        id: "journal",
        delay: 1.2,
        text: "Every discovery is kept in your Journal - the book at the left edge",
      };
    }
    if (threadCount >= 3 && !hintsSeen.lens) {
      return {
        id: "lens",
        delay: 1.2,
        text: "Open the Lens to see your web arranged along True, Good, and Beautiful",
      };
    }
    const curatedFound = discoveries.filter((d) => d.kind === "curated").length;
    if (
      !hintsSeen.conclude &&
      curatedFound > 0 &&
      (curatedFound >= 3 || curatedFound >= curatedAvailable)
    ) {
      return {
        id: "conclude",
        delay: 1.4,
        text: "When the weave feels complete, conclude the Game to receive its Annotation",
      };
    }
    return null;
  }, [welcomeOpen, threadCount, discoveries, hintsSeen, coarse, curatedAvailable]);

  useEffect(() => {
    if (threadCount > 0 && !hintsSeen.weave) markHintSeen("weave");
  }, [threadCount, hintsSeen.weave, markHintSeen]);
  useEffect(() => {
    if (journalOpen && !hintsSeen.journal) markHintSeen("journal");
  }, [journalOpen, hintsSeen.journal, markHintSeen]);
  useEffect(() => {
    if (lensActive && !hintsSeen.lens) markHintSeen("lens");
  }, [lensActive, hintsSeen.lens, markHintSeen]);

  useEffect(() => {
    if (discoveries.length > seenDiscoveries.current) {
      const latest = discoveries[discoveries.length - 1];
      seenDiscoveries.current = discoveries.length;
      if (latest.kind === "faint") {
        setFaintToast(latest);
        const t = setTimeout(() => setFaintToast(null), 4600);
        return () => clearTimeout(t);
      }
    }
  }, [discoveries]);

  useEffect(() => {
    if (motifs.length > seenMotifs.current) {
      setMotifToast(motifs[motifs.length - 1]);
      seenMotifs.current = motifs.length;
      const t = setTimeout(() => setMotifToast(null), 4600);
      return () => clearTimeout(t);
    }
  }, [motifs]);

  const curatedCount = discoveries.filter((d) => d.kind === "curated").length;
  // The invitation: once the weave has real substance, the way out glows.
  const concludeInvites =
    !hintsSeen.conclude &&
    curatedCount > 0 &&
    (curatedCount >= 3 || curatedCount >= curatedAvailable);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.9, duration: 0.8 } }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
      {mode !== "concluding" && (
        <>
          <GlassPanel className="pointer-events-auto absolute left-4 top-4 flex items-center gap-3 rounded-full px-4 py-2.5 sm:left-5 sm:top-5 sm:px-5">
            <span className="flex items-center gap-1.5 text-resonance">
              <ResonanceGlyph />
              <span className="font-ui text-sm font-semibold tabular-nums">{score}</span>
            </span>
            <span className="hidden h-3 w-px bg-line/70 sm:block" />
            <span className="hidden font-ui text-[11px] uppercase tracking-[0.22em] text-dim sm:inline">
              Resonance
            </span>
            {/* The session's arc — always visible: how much light remains. */}
            {curatedAvailable > 0 && (
              <>
                <span className="h-3 w-px bg-line/70" />
                <span
                  className={
                    "font-ui text-[11px] tabular-nums " +
                    (curatedCount >= curatedAvailable ? "text-resonance" : "text-dim")
                  }
                >
                  {curatedCount >= curatedAvailable
                    ? "all luminous found"
                    : `${curatedCount} of ${curatedAvailable} luminous`}
                </span>
              </>
            )}
            {threadCount > 0 && (
              <span className="hidden font-ui text-[11px] tabular-nums text-dim md:inline">
                · {threadCount} {threadCount === 1 ? "thread" : "threads"}
              </span>
            )}
          </GlassPanel>

          <button
            onClick={() => {
              if (!hintsSeen.conclude) markHintSeen("conclude");
              if (threadCount === 0 && discoveries.length === 0) returnToTitle();
              else concludeSession();
            }}
            className={
              "pointer-events-auto absolute right-4 top-4 rounded-full border px-5 py-2.5 font-ui text-[11px] uppercase tracking-[0.25em] backdrop-blur-md transition-colors sm:right-5 sm:top-5 " +
              (concludeInvites
                ? "animate-invite-pulse border-resonance/60 bg-resonance/10 text-bright"
                : "border-line/40 bg-surface/50 text-dim hover:border-resonance/60 hover:text-bright")
            }
          >
            {threadCount === 0 && discoveries.length === 0 ? (
              "Leave the arena"
            ) : (
              <>
                <span className="sm:hidden">Conclude ✦</span>
                <span className="hidden sm:inline">Conclude the Game ✦</span>
              </>
            )}
          </button>

          <button
            onClick={() => setLens(!lensActive)}
            aria-pressed={lensActive}
            title="The Lens: view the beads along True / Good / Beautiful"
            className={
              "pointer-events-auto absolute right-5 top-[4.6rem] rounded-full border px-5 py-2.5 font-ui text-[11px] uppercase tracking-[0.25em] backdrop-blur-md transition-colors " +
              (lensActive
                ? "border-glow/70 bg-glow/15 text-bright"
                : "border-line/40 bg-surface/50 text-dim hover:border-line/80 hover:text-bright")
            }
          >
            {lensActive ? "Close the Lens" : "The Lens"}
          </button>

          <button
            onClick={() => setJournalOpen(true)}
            aria-label="Open discovery journal"
            className="pointer-events-auto absolute left-5 top-1/2 -translate-y-1/2 rounded-full border border-line/40 bg-surface/50 p-3.5 text-dim backdrop-blur-md transition-colors hover:border-line/80 hover:text-bright"
          >
            <BookGlyph />
            {discoveries.length > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-glow px-1 font-ui text-[10px] font-semibold text-void">
                {discoveries.length}
              </span>
            )}
          </button>
        </>
      )}

      <AnimatePresence>
        {mode !== "concluding" && welcomeOpen && threadCount === 0 && (
          <motion.div
            key="arena-welcome"
            className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-void/35 px-6 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
          >
            <GlassPanel
              role="dialog"
              aria-modal="true"
              aria-labelledby="arena-welcome-title"
              className="w-full max-w-lg bg-void/80 p-7 text-center sm:p-8"
            >
              <p className="font-ui text-[10px] uppercase tracking-[0.45em] text-dim/75">
                The Arena opens
              </p>
              <h2
                id="arena-welcome-title"
                className="mt-3 font-display text-3xl font-medium text-bright sm:text-4xl"
              >
                Weave the luminous connections
              </h2>
              <p className="mt-4 font-display text-lg italic leading-relaxed text-bright/90">
                Among these beads hide {curatedAvailable > 0 ? curatedAvailable : "several"}{" "}
                luminous connections — real correspondences between the disciplines.
              </p>
              <p className="mt-3 font-ui text-sm leading-relaxed text-dim">
                Draw threads to seek them; even faint resonances teach the hand. When your
                weave feels complete, conclude the Game.
              </p>
              <Button className="mt-7" onClick={dismissWelcome}>
                Enter the weave
              </Button>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mode !== "concluding" && activeHint && (
          <motion.p
            key={activeHint.id}
            className="absolute bottom-8 left-1/2 w-full max-w-md -translate-x-1/2 px-6 text-center font-ui text-xs leading-relaxed tracking-wide text-dim/80"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: activeHint.delay, duration: 1 } }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
          >
            {activeHint.text}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {faintToast && (
          <motion.div
            key={faintToast.id}
            className="absolute bottom-8 right-5 w-[300px]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.5 }}
          >
            <GlassPanel className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-display text-sm italic text-dim">Faint resonance</p>
                <span className="font-ui text-xs tabular-nums text-dim">+{faintToast.points}</span>
              </div>
              <p className="mt-1.5 line-clamp-3 font-ui text-[12px] leading-relaxed text-dim/80">
                {faintToast.insight}
              </p>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {mode !== "concluding" && <MotifTracker />}
      {mode !== "concluding" && lensActive && <LensGuide />}

      <AnimatePresence>
        {motifToast && (
          <MotifRitualToast key={motifToast.motifId + motifToast.at} motif={motifToast} />
        )}
      </AnimatePresence>

      <JournalDrawer open={journalOpen} onClose={() => setJournalOpen(false)} />
      {mode !== "concluding" && <BeadInspectCard />}
      <DiscoveryCard />
    </motion.div>
  );
}
