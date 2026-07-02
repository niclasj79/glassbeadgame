import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/state/store";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import type { Discovery } from "@/state/types";

function PairLine({ discovery }: { discovery: Discovery }) {
  const a = conceptById.get(discovery.a);
  const b = conceptById.get(discovery.b);
  if (!a || !b) return null;
  const da = disciplineById.get(a.discipline);
  const db = disciplineById.get(b.discipline);
  return (
    <p className="font-ui text-[11px] tracking-wide text-dim">
      <span style={{ color: da?.color }}>{a.name}</span>
      <span className="mx-1.5 text-line">×</span>
      <span style={{ color: db?.color }}>{b.name}</span>
    </p>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function JournalDrawer({ open, onClose }: Props) {
  const discoveries = useStore((s) => s.session?.discoveries ?? []);
  const motifs = useStore((s) => s.session?.motifs ?? []);
  const ordered = [...discoveries].reverse();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="pointer-events-auto absolute inset-0 bg-void/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />
          <motion.aside
            className="pointer-events-auto absolute bottom-0 left-0 top-0 flex w-[min(360px,88vw)] flex-col border-r border-line/50 bg-surface/85 backdrop-blur-2xl"
            initial={{ x: -380 }}
            animate={{ x: 0 }}
            exit={{ x: -380 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            <header className="flex items-center justify-between border-b border-line/40 px-6 py-5">
              <div>
                <h2 className="font-display text-xl font-medium text-bright">
                  Discovery Journal
                </h2>
                <p className="mt-0.5 font-ui text-[11px] uppercase tracking-[0.25em] text-dim">
                  {discoveries.length} {discoveries.length === 1 ? "entry" : "entries"}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close journal"
                className="rounded-full border border-line/50 p-2 text-dim transition-colors hover:border-line hover:text-bright"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {motifs.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {motifs.map((m) => (
                    <span
                      key={m.motifId}
                      className="rounded-full border border-resonance/40 bg-resonance/10 px-3 py-1 font-ui text-[10px] uppercase tracking-[0.2em] text-resonance"
                    >
                      {m.name} +{m.points}
                    </span>
                  ))}
                </div>
              )}

              {ordered.length === 0 && (
                <p className="mt-8 text-center font-display text-sm italic text-dim">
                  Nothing woven yet. The beads are waiting.
                </p>
              )}

              <ul className="space-y-3">
                {ordered.map((d) => (
                  <li
                    key={d.id}
                    className={
                      d.kind === "curated"
                        ? "rounded-2xl border border-line/50 bg-elevated/60 p-4"
                        : "rounded-2xl border border-line/25 bg-surface/40 p-4"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3
                        className={
                          d.kind === "curated"
                            ? "font-display text-base font-medium leading-snug text-bright"
                            : "font-display text-sm italic leading-snug text-dim"
                        }
                      >
                        {d.title}
                      </h3>
                      <span
                        className={
                          d.kind === "curated"
                            ? "shrink-0 font-ui text-xs font-semibold tabular-nums text-resonance"
                            : "shrink-0 font-ui text-xs tabular-nums text-dim"
                        }
                      >
                        +{d.points}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <PairLine discovery={d} />
                    </div>
                    <p
                      className={
                        d.kind === "curated"
                          ? "mt-2 font-ui text-[13px] leading-relaxed text-dim"
                          : "mt-2 line-clamp-2 font-ui text-[12px] leading-relaxed text-dim/70"
                      }
                    >
                      {d.insight}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
