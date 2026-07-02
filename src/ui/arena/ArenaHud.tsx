import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/state/store";
import type { Discovery, MotifAward } from "@/state/types";
import { GlassPanel } from "../components/GlassPanel";
import { DiscoveryCard } from "./DiscoveryCard";
import { JournalDrawer } from "./JournalDrawer";

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

/** In-arena chrome: restrained, glassy, never louder than the cosmos. */
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

  // The concluding cinematic: threads brighten, the cadence resolves,
  // the camera crowns the web — then the Annotation.
  useEffect(() => {
    if (mode !== "concluding") return;
    const t = setTimeout(finishConcluding, reducedMotion ? 700 : 4200);
    return () => clearTimeout(t);
  }, [mode, finishConcluding, reducedMotion]);

  const [journalOpen, setJournalOpen] = useState(false);
  const [faintToast, setFaintToast] = useState<Discovery | null>(null);
  const [motifToast, setMotifToast] = useState<MotifAward | null>(null);
  const seenDiscoveries = useRef(0);
  const seenMotifs = useRef(0);

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

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.9, duration: 0.8 } }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
      {/* Chrome hides during the concluding cinematic. */}
      {mode !== "concluding" && (
      <>
      {/* Score — top left */}
      <GlassPanel className="pointer-events-auto absolute left-5 top-5 flex items-center gap-3 rounded-full px-5 py-2.5">
        <span className="flex items-center gap-1.5 text-resonance">
          <ResonanceGlyph />
          <span className="font-ui text-sm font-semibold tabular-nums">{score}</span>
        </span>
        <span className="h-3 w-px bg-line/70" />
        <span className="font-ui text-[11px] uppercase tracking-[0.22em] text-dim">
          Resonance
        </span>
        {threadCount > 0 && (
          <>
            <span className="h-3 w-px bg-line/70" />
            <span className="font-ui text-[11px] tabular-nums text-dim">
              {threadCount} {threadCount === 1 ? "thread" : "threads"}
              {curatedCount > 0 && ` · ${curatedCount} luminous`}
            </span>
          </>
        )}
      </GlassPanel>

      {/* Conclude — top right */}
      <button
        onClick={() => {
          if (discoveries.length === 0) returnToTitle();
          else concludeSession();
        }}
        className="pointer-events-auto absolute right-5 top-5 rounded-full border border-line/40 bg-surface/50 px-5 py-2.5 font-ui text-[11px] uppercase tracking-[0.25em] text-dim backdrop-blur-md transition-colors hover:border-resonance/60 hover:text-bright"
      >
        {discoveries.length === 0 ? "Leave" : "Conclude the Game"}
      </button>

      {/* Lens toggle — below Conclude */}
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

      {/* Journal toggle — left edge */}
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

      {/* First-thread hint — bottom center */}
      <AnimatePresence>
        {mode !== "concluding" && threadCount === 0 && (
          <motion.p
            key="hint"
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center font-ui text-xs tracking-wide text-dim/80"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 2.2, duration: 1 } }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
          >
            Press a bead and draw its thread to another
            <span className="mx-2 text-line">·</span>
            drag the void to orbit
          </motion.p>
        )}
      </AnimatePresence>

      {/* Faint-resonance toast — bottom right, quiet by design */}
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
                <span className="font-ui text-xs tabular-nums text-dim">
                  +{faintToast.points}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-3 font-ui text-[12px] leading-relaxed text-dim/80">
                {faintToast.insight}
              </p>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Motif award — top center */}
      <AnimatePresence>
        {motifToast && (
          <motion.div
            key={motifToast.motifId + motifToast.at}
            className="absolute left-1/2 top-6 -translate-x-1/2"
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5 }}
          >
            <span className="rounded-full border border-resonance/50 bg-resonance/10 px-5 py-2 font-ui text-[11px] uppercase tracking-[0.28em] text-resonance shadow-[0_0_30px_-8px_hsl(42_92%_60%/0.5)]">
              ✦ Motif · {motifToast.name} +{motifToast.points}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <JournalDrawer open={journalOpen} onClose={() => setJournalOpen(false)} />
      <DiscoveryCard />
    </motion.div>
  );
}
