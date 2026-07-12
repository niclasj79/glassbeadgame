import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/state/store";
import { isCoarsePointer } from "@/lib/device";
import { frameState, beadPosition, emitBurst } from "@/scene/frameState";
import { LENS_VIEWS } from "@/game/layout";
import { useCurrentTheme } from "@/themes/useTheme";
import { illuminationChime } from "@/audio/sfx";
import type { Discovery, MotifAward } from "@/state/types";
import { presentationNow } from "@/runtime/testMode";
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
  const lensView = useStore((s) => s.lensView);
  const cycleLens = useStore((s) => s.cycleLens);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);

  const curatedAvailable = useStore((s) => s.session?.curatedAvailable ?? 0);
  const insight = useStore((s) => s.session?.insight ?? 0);
  const spendInsight = useStore((s) => s.spendInsight);

  const illuminate = () => {
    const pair = spendInsight();
    if (!pair) return;
    frameState.illumination = {
      a: pair[0],
      b: pair[1],
      until: presentationNow() + 4000,
    };
    illuminationChime(pair[0], pair[1]);
    for (const id of pair) {
      const p = beadPosition(id);
      if (p) emitBurst(p, "#ffe9b0", 10, 0.5);
    }
  };

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

  const theme = useCurrentTheme();

  useEffect(() => {
    if (mode !== "concluding") return;
    // The web's final bloom under the rising camera.
    emitBurst([0, 0, 0], theme.burst.color, 48, 1.6);
    emitBurst([0, 0.4, 0], theme.burst.secondary, 24, 0.9);
    const t = setTimeout(finishConcluding, reducedMotion ? 700 : 4200);
    return () => clearTimeout(t);
  }, [mode, finishConcluding, reducedMotion, theme]);

  // The world announces itself — once per session, after any welcome.
  const [introVisible, setIntroVisible] = useState(false);
  const introShownFor = useRef<number | null>(null);
  const sessionSeed = useStore((s) => s.session?.seed ?? null);
  const isDaily = useStore((s) => !!s.session?.daily);
  useEffect(() => {
    if (sessionSeed === null || welcomeOpen) return;
    if (introShownFor.current === sessionSeed) return;
    introShownFor.current = sessionSeed;
    setIntroVisible(true);
    const t = setTimeout(() => setIntroVisible(false), 4200);
    return () => clearTimeout(t);
  }, [sessionSeed, welcomeOpen]);

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
    if (coarse && threadCount >= 2 && !hintsSeen.inspect) {
      return {
        id: "inspect",
        delay: 1.2,
        text: "Hold a finger still on any bead to read what it holds",
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
  const pinnedInspectId = useStore((s) => s.pinnedInspectId);
  useEffect(() => {
    if (pinnedInspectId && !hintsSeen.inspect) markHintSeen("inspect");
  }, [pinnedInspectId, hintsSeen.inspect, markHintSeen]);

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
            onClick={cycleLens}
            aria-pressed={lensActive}
            title="The Lens triptych: Good × True, Good × Beautiful, True × Beautiful — tap again to turn the page, a fourth tap closes"
            className={
              "pointer-events-auto absolute right-5 top-[4.6rem] rounded-full border px-5 py-2.5 font-ui text-[11px] uppercase tracking-[0.25em] backdrop-blur-md transition-colors " +
              (lensActive
                ? "border-glow/70 bg-glow/15 text-bright"
                : "border-line/40 bg-surface/50 text-dim hover:border-line/80 hover:text-bright")
            }
          >
            {lensActive ? `Lens · ${LENS_VIEWS[lensView - 1].label} ▸` : "The Lens"}
          </button>

          {/* Illuminate — spend Insight to be shown where light hides. */}
          {!lensActive && (
            <button
              onClick={illuminate}
              disabled={insight <= 0}
              title={
                insight > 0
                  ? "Spend one Insight: the Game briefly shows where a luminous connection hides"
                  : "Luminous discoveries and motifs grant Insight"
              }
              className={
                "pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border px-6 py-2.5 font-ui text-[11px] uppercase tracking-[0.25em] backdrop-blur-md transition-colors " +
                (insight > 0
                  ? "border-resonance/50 bg-resonance/10 text-bright hover:bg-resonance/20"
                  : "border-line/30 bg-surface/40 text-dim/50")
              }
            >
              ✧ Illuminate · {insight}
            </button>
          )}

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

      {/* The world's title card — Tetris Effect's level-opening breath.
          (Centering lives on a plain wrapper: framer owns `transform`.) */}
      <AnimatePresence>
        {introVisible && mode !== "concluding" && (
          <div className="pointer-events-none absolute inset-x-4 top-[18%] flex justify-center">
          <motion.div
            key={`intro-${sessionSeed}`}
            className="text-center"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] },
            }}
            exit={{ opacity: 0, y: -8, transition: { duration: 1.2 } }}
          >
            <p className="font-ui text-[10px] uppercase tracking-[0.55em] text-dim/70">
              {isDaily ? "Today's Draw opens into" : "The Game opens into"}
            </p>
            <h2 className="mt-2 font-display text-4xl font-medium tracking-wide text-bright sm:text-5xl">
              {theme.name}
            </h2>
            <p className="mt-2 font-display text-base italic text-dim">
              {theme.tagline}
            </p>
          </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mode !== "concluding" && activeHint && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[5.6rem] flex justify-center px-6">
            <motion.p
              key={activeHint.id}
              className="max-w-md text-center font-ui text-xs leading-relaxed tracking-wide text-dim/80"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: activeHint.delay, duration: 1 } }}
              exit={{ opacity: 0, transition: { duration: 0.6 } }}
            >
              {activeHint.text}
            </motion.p>
          </div>
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
