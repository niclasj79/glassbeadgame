import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import { composeAnnotation } from "@/content/annotations";
import type { Discovery, SessionMemory } from "@/state/types";
import { GlassPanel } from "../components/GlassPanel";
import { Button } from "../components/Button";

function PairLine({ discovery }: { discovery: Discovery }) {
  const a = conceptById.get(discovery.a);
  const b = conceptById.get(discovery.b);
  const da = a ? disciplineById.get(a.discipline) : undefined;
  const db = b ? disciplineById.get(b.discipline) : undefined;
  if (!a || !b) return null;
  return (
    <p className="mt-2 font-ui text-[11px] uppercase tracking-[0.18em] text-dim">
      <span style={{ color: da?.color }}>{a.name}</span>
      <span className="mx-2 text-line">x</span>
      <span style={{ color: db?.color }}>{b.name}</span>
    </p>
  );
}

function Timeline({ discoveries, index }: { discoveries: Discovery[]; index: number }) {
  return (
    <div className="mt-5 flex items-center gap-1.5">
      {discoveries.map((d, i) => (
        <div key={`${d.id}-${i}`} className="flex flex-1 items-center gap-1.5">
          <span
            className={
              i <= index
                ? "h-2.5 w-2.5 rounded-full bg-resonance shadow-[0_0_12px_hsl(var(--resonance)/0.8)]"
                : "h-2.5 w-2.5 rounded-full bg-line/70"
            }
            title={d.title}
          />
          {i < discoveries.length - 1 && (
            <span className={i < index ? "h-px flex-1 bg-resonance/70" : "h-px flex-1 bg-line/55"} />
          )}
        </div>
      ))}
    </div>
  );
}

interface Props {
  memory: SessionMemory | null;
  onClose: () => void;
}

export function SessionReplay({ memory, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const discoveries = memory?.discoveries ?? [];
  const current = discoveries[index];

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [memory?.id]);

  useEffect(() => {
    if (!playing || discoveries.length <= 1) return;
    const t = window.setTimeout(() => {
      setIndex((i) => {
        if (i >= discoveries.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 3400);
    return () => window.clearTimeout(t);
  }, [playing, discoveries.length, index]);

  const annotation = useMemo(
    () => (memory ? composeAnnotation({ ...memory, startedAt: memory.endedAt, interaction: {
      mode: "idle",
      fromId: null,
      sticky: false,
      reveal: null,
    }, curatedAvailable: 0, insight: 0, illuminationsUsed: 0, themeId: "castalia" }) : ""),
    [memory]
  );

  return (
    <AnimatePresence>
      {memory && current && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-void/88 px-5 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <GlassPanel className="w-full max-w-2xl bg-void/82 p-6 shadow-[0_30px_120px_-28px_rgba(0,0,0,0.95)] sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="font-ui text-[10px] uppercase tracking-[0.45em] text-dim">
                  The Performance
                </p>
                <h2 className="mt-2 font-display text-4xl font-medium text-bright">
                  Discovery Chain
                </h2>
                <p className="mt-1 font-ui text-[11px] uppercase tracking-[0.2em] text-dim/70">
                  Step {index + 1} of {discoveries.length}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-line/50 px-4 py-2 font-ui text-[10px] uppercase tracking-[0.22em] text-dim transition-colors hover:border-line hover:text-bright"
              >
                Close
              </button>
            </div>

            <Timeline discoveries={discoveries} index={index} />

            <motion.div
              key={`${current.id}-${index}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mt-6"
            >
              <p className="font-ui text-[10px] uppercase tracking-[0.32em] text-dim">
                {current.kind === "curated" ? "Luminous discovery" : "Faint resonance"}
              </p>
              <h3 className="mt-2 font-display text-3xl font-medium leading-tight text-bright">
                {current.title}
              </h3>
              <PairLine discovery={current} />
              <p className="mt-4 font-display text-lg italic leading-relaxed text-bright/90">
                {current.insight}
              </p>
              {current.quote && (
                <blockquote className="mt-4 border-l-2 border-glow/45 pl-4">
                  <p className="font-display text-sm italic leading-relaxed text-dim">
                    "{current.quote.text}"
                  </p>
                  <footer className="mt-1 font-ui text-[10px] uppercase tracking-[0.24em] text-dim/65">
                    {current.quote.source}
                  </footer>
                </blockquote>
              )}
            </motion.div>

            {annotation && (
              <p className="mt-6 border-t border-line/40 pt-4 font-display text-base italic leading-relaxed text-dim">
                {annotation}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                >
                  Back
                </Button>
                <Button
                  variant="ghost"
                  disabled={index >= discoveries.length - 1}
                  onClick={() => setIndex((i) => Math.min(discoveries.length - 1, i + 1))}
                >
                  Next
                </Button>
              </div>
              <Button onClick={() => setPlaying((p) => !p)}>
                {playing ? "Pause" : "Play chain"}
              </Button>
            </div>
          </GlassPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
