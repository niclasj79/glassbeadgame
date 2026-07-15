import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import { useStore } from "@/state/store";
import { useStore as useVanillaStore } from "zustand";
import { interpretationPresentationStore } from "@/state/interpretationPresentation";
import { productionInterpretation } from "@/runtime/interpretation";
import { GlassPanel } from "../components/GlassPanel";

/** The card is contemplation, not chatter: it waits out a dwell before
 *  appearing, and never shows while a gesture or reveal is in flight. */
const DWELL_MS = 2200;

const AXES = [
  { label: "True", index: 0 },
  { label: "Beautiful", index: 1 },
  { label: "Good", index: 2 },
] as const;

function axisPercent(value: number): number {
  return Math.max(0, Math.min(100, ((value + 1) / 2) * 100));
}

export function BeadInspectCard() {
  const explicitFocus = useStore((s) => s.focusedBeadId);
  const pinned = useStore((s) => s.pinnedInspectId);
  const weaving = useVanillaStore(
    interpretationPresentationStore,
    (state) => state.weaving
  );
  const lensActive = useStore((s) => s.lensActive);
  const setFocusedBead = useStore((s) => s.setFocusedBead);

  // Only a settled focus counts: the pointer must rest on a bead, with no
  // weave in progress, for the dwell period.
  const candidate = weaving ? null : explicitFocus;
  const [dwelled, setDwelled] = useState<string | null>(null);
  useEffect(() => {
    if (!candidate) {
      setDwelled(null);
      return;
    }
    if (candidate === dwelled) return;
    setDwelled(null);
    const t = setTimeout(() => setDwelled(candidate), DWELL_MS);
    return () => clearTimeout(t);
  }, [candidate, dwelled]);

  // A pin (touch long-press) opens instantly and stays until dismissed;
  // otherwise the desktop dwell rule applies.
  const id = pinned ?? (candidate && candidate === dwelled ? candidate : null);
  const concept = id ? conceptById.get(id) : undefined;
  const discipline = concept ? disciplineById.get(concept.discipline) : undefined;
  const close = () => {
    productionInterpretation.closeInspection();
    setFocusedBead(null);
  };

  return (
    <AnimatePresence>
      {concept && discipline && (
        <motion.div
          key={concept.id}
          className="pointer-events-auto absolute bottom-5 left-5 w-[min(350px,calc(100vw-2.5rem))]"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.985 }}
          transition={{ duration: 0.28 }}
        >
          <GlassPanel className="bg-void/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-ui text-[10px] uppercase tracking-[0.32em] text-dim">
                  {lensActive ? "Lens focus" : "Bead"}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="font-display text-2xl leading-none" style={{ color: discipline.color }}>
                    {discipline.glyph}
                  </span>
                  <h3 className="truncate font-display text-2xl font-medium text-bright">
                    {concept.name}
                  </h3>
                </div>
                <p className="mt-0.5 font-ui text-[11px] uppercase tracking-[0.22em] text-dim/80">
                  {discipline.name}
                </p>
              </div>
              <button
                onClick={close}
                aria-label="Close bead focus"
                className="rounded-full border border-line/50 px-2 py-1 font-ui text-[10px] uppercase tracking-[0.18em] text-dim transition-colors hover:border-line hover:text-bright"
              >
                Close
              </button>
            </div>

            <p className="mt-3 line-clamp-4 font-ui text-[12px] leading-relaxed text-dim">
              {concept.description}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {concept.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full border border-line/40 bg-surface/45 px-2.5 py-1 font-ui text-[10px] text-dim"
                >
                  {keyword}
                </span>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {AXES.map((axis) => {
                const value = concept.tbg[axis.index];
                return (
                  <div key={axis.label} className="grid grid-cols-[5.8rem_1fr_2.2rem] items-center gap-2">
                    <span className="font-ui text-[10px] uppercase tracking-[0.2em] text-dim/70">
                      {axis.label}
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-line/45">
                      <span
                        className="block h-full rounded-full bg-glow/70"
                        style={{ width: `${axisPercent(value)}%` }}
                      />
                    </span>
                    <span className="text-right font-ui text-[10px] tabular-nums text-dim/70">
                      {value.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
