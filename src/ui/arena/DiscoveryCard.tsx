import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/state/store";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import type { Discovery } from "@/state/types";

function dismissReveal(): void {
  useStore.getState().setInteraction({ mode: "idle", reveal: null });
}

function TierMarks({ tier }: { tier: number }) {
  return (
    <span className="text-resonance" aria-label={`tier ${tier}`}>
      {"✦".repeat(Math.max(1, tier))}
    </span>
  );
}

function ConceptChip({ id }: { id: string }) {
  const concept = conceptById.get(id);
  const disc = concept ? disciplineById.get(concept.discipline) : undefined;
  if (!concept || !disc) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-display text-lg leading-none" style={{ color: disc.color }}>
        {disc.glyph}
      </span>
      <span className="font-ui text-sm tracking-wide text-bright">{concept.name}</span>
    </span>
  );
}

function Card({ discovery }: { discovery: Discovery }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        dismissReveal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Radial dim — the cosmos recedes, the insight takes the stage. */}
      <motion.div
        className="pointer-events-auto absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 38%, transparent 0%, hsl(220 43% 4% / 0.55) 78%, hsl(220 43% 4% / 0.82) 100%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.8, delay: 0.25 } }}
        exit={{ opacity: 0, transition: { duration: 0.35 } }}
        onClick={dismissReveal}
      />

      <motion.div
        className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-8 sm:pb-12"
        initial={{ opacity: 0, y: 26, scale: 0.98 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { delay: 0.55, duration: 0.65, ease: [0.22, 1, 0.36, 1] },
        }}
        exit={{ opacity: 0, y: 14, scale: 0.985, transition: { duration: 0.3 } }}
      >
        <div className="pointer-events-auto w-full max-w-xl rounded-3xl border border-line/60 bg-surface/80 p-7 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-9">
          <div className="flex items-center justify-between">
            <p className="font-ui text-[10px] uppercase tracking-[0.45em] text-dim">
              A connection discovered
            </p>
            <TierMarks tier={discovery.tier} />
          </div>

          <h3 className="mt-3 font-display text-3xl font-medium leading-tight text-bright sm:text-4xl">
            {discovery.title}
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ConceptChip id={discovery.a} />
            <span className="font-display text-dim">—</span>
            <ConceptChip id={discovery.b} />
          </div>

          <p className="mt-5 font-display text-[17px] italic leading-relaxed text-bright/90 sm:text-lg">
            {discovery.insight}
          </p>

          {discovery.quote && (
            <blockquote className="mt-5 border-l-2 border-glow/50 pl-4">
              <p className="font-display text-sm italic leading-relaxed text-dim">
                “{discovery.quote.text}”
              </p>
              <footer className="mt-1.5 font-ui text-[10px] uppercase tracking-[0.28em] text-dim/70">
                {discovery.quote.source}
              </footer>
            </blockquote>
          )}

          <div className="mt-7 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-ui text-sm font-semibold tabular-nums text-resonance">
                +{discovery.points} resonance
              </span>
              {discovery.newToCodex && (
                <span className="rounded-full border border-glow/40 bg-glow/10 px-3 py-1 font-ui text-[10px] uppercase tracking-[0.22em] text-glow">
                  New to your codex
                </span>
              )}
            </div>
            <button
              onClick={dismissReveal}
              className="rounded-full border border-line/60 px-6 py-2.5 font-ui text-[11px] uppercase tracking-[0.28em] text-bright transition-colors hover:border-glow/60 hover:bg-glow/10"
            >
              Continue
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/** The payoff of the whole game: mounted only during a curated reveal. */
export function DiscoveryCard() {
  const reveal = useStore((s) => s.session?.interaction.reveal ?? null);
  return (
    <AnimatePresence>{reveal && <Card key={reveal.id} discovery={reveal} />}</AnimatePresence>
  );
}
