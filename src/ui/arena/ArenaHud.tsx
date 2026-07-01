import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/state/store";
import { GlassPanel } from "../components/GlassPanel";

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

/** In-arena chrome: restrained, glassy, never louder than the cosmos. */
export function ArenaHud() {
  const score = useStore((s) => s.session?.score ?? 0);
  const threadCount = useStore((s) => s.session?.threads.length ?? 0);
  const discoveries = useStore((s) => s.session?.discoveries ?? []);
  const returnToTitle = useStore((s) => s.returnToTitle);

  const curatedCount = discoveries.filter((d) => d.kind === "curated").length;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.9, duration: 0.8 } }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
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

      {/* Leave — top right (becomes the Conclusion in M5) */}
      <button
        onClick={returnToTitle}
        className="pointer-events-auto absolute right-5 top-5 rounded-full border border-line/40 bg-surface/50 px-5 py-2.5 font-ui text-[11px] uppercase tracking-[0.25em] text-dim backdrop-blur-md transition-colors hover:border-line/80 hover:text-bright"
      >
        Leave
      </button>

      {/* First-thread hint — bottom center */}
      <AnimatePresence>
        {threadCount === 0 && (
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
    </motion.div>
  );
}
