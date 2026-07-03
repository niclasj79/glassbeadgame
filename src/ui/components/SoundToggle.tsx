import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/state/store";
import { GlassPanel } from "./GlassPanel";

function SpeakerIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 5L6 9H3v6h3l5 4V5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M22 9l-6 6M16 9l6 6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 5L6 9H3v6h3l5 4V5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 8.5a5 5 0 010 7M18.5 6a9 9 0 010 12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Row({
  label,
  sublabel,
  on,
  onToggle,
}: {
  label: string;
  sublabel?: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-elevated/60"
    >
      <span>
        <span className="block font-ui text-[12px] tracking-wide text-bright">{label}</span>
        {sublabel && (
          <span className="mt-0.5 block font-ui text-[10px] leading-relaxed text-dim">
            {sublabel}
          </span>
        )}
      </span>
      <span
        className={
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors " +
          (on ? "border-glow/70 bg-glow/30" : "border-line/60 bg-surface")
        }
      >
        <span
          className={
            "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-bright transition-all " +
            (on ? "left-[18px]" : "left-0.5")
          }
        />
      </span>
    </button>
  );
}

/** Sound corner: mute + the binaural bed, with a first-listen headphone note. */
export function SoundToggle() {
  const muted = useStore((s) => s.settings.muted);
  const binaural = useStore((s) => s.settings.binaural);
  const hintsSeen = useStore((s) => s.settings.hintsSeen);
  const setMuted = useStore((s) => s.setMuted);
  const setBinaural = useStore((s) => s.setBinaural);
  const markHintSeen = useStore((s) => s.markHintSeen);
  const phase = useStore((s) => s.phase);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // One-time headphone note when the cosmos first sounds — it doubles as
  // the binaural bed's honest off-switch.
  const showHeadphoneNote =
    phase === "arena" && binaural && !muted && !hintsSeen.headphones;

  return (
    <div ref={ref} className="absolute bottom-5 right-5 z-20">
      <AnimatePresence>
        {showHeadphoneNote && !open && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 2.5, duration: 0.8 } }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="absolute bottom-14 right-0 w-[270px]"
          >
            <GlassPanel className="p-4">
              <p className="font-ui text-[11px] leading-relaxed text-bright">
                Best experienced with headphones — a subtle binaural resonance is
                woven into the sound.
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => markHintSeen("headphones")}
                  className="rounded-full border border-glow/50 bg-glow/10 px-4 py-1.5 font-ui text-[10px] uppercase tracking-[0.2em] text-bright transition-colors hover:bg-glow/20"
                >
                  Keep it
                </button>
                <button
                  onClick={() => {
                    setBinaural(false);
                    markHintSeen("headphones");
                  }}
                  className="rounded-full border border-line/50 px-4 py-1.5 font-ui text-[10px] uppercase tracking-[0.2em] text-dim transition-colors hover:text-bright"
                >
                  Turn off
                </button>
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22 }}
            className="absolute bottom-14 right-0 w-[280px]"
          >
            <GlassPanel className="p-2.5">
              <Row
                label={muted ? "Sound off" : "Sound on"}
                on={!muted}
                onToggle={() => setMuted(!muted)}
              />
              <Row
                label="Binaural resonance"
                sublabel="A gentle 6 Hz beat between the ears. Headphones only; off if beating tones bother you."
                on={binaural}
                onToggle={() => setBinaural(!binaural)}
              />
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Sound options"
        aria-expanded={open}
        className="rounded-full border border-line/40 bg-surface/50 p-3 text-dim backdrop-blur-md transition-colors hover:border-line/80 hover:text-bright"
      >
        <SpeakerIcon muted={muted} />
      </button>
    </div>
  );
}
