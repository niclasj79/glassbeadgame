import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import type { Discovery } from "@/state/types";

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

interface Props {
  discovery: Discovery | null;
  onClose: () => void;
}

/**
 * A re-reading of a discovery — the insight card, detached from the arena's
 * reveal machinery so the Annotation (and anywhere else) can open it.
 */
export function ConnectionCard({ discovery, onClose }: Props) {
  useEffect(() => {
    if (!discovery) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [discovery, onClose]);

  return (
    <AnimatePresence>
      {discovery && (
        <motion.div
          key={discovery.id}
          className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-void/70 px-4 py-8 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-xl"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-3xl border border-line/60 bg-surface/85 p-7 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-9">
              <div className="flex items-center justify-between">
                <p className="font-ui text-[10px] uppercase tracking-[0.45em] text-dim">
                  {discovery.kind === "curated" ? "A connection recalled" : "A faint resonance"}
                </p>
                <span className="text-resonance">
                  {"✦".repeat(Math.max(1, discovery.tier))}
                </span>
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
                <span className="font-ui text-sm font-semibold tabular-nums text-resonance">
                  +{discovery.points} resonance
                </span>
                <button
                  onClick={onClose}
                  className="rounded-full border border-line/60 px-6 py-2.5 font-ui text-[11px] uppercase tracking-[0.28em] text-bright transition-colors hover:border-glow/60 hover:bg-glow/10"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
