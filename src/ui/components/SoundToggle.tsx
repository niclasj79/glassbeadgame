import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/state/store";
import { ACKNOWLEDGE_LIFT_REM, OPENING_CORNER_MS } from "@/scene/opening";
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
      className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-elevated/60"
    >
      <span>
        <span className="block font-ui text-body tracking-wide text-bright">
          {label}
        </span>
        {sublabel && (
          <span className="mt-1 block font-ui text-caption leading-relaxed text-dim">
            {sublabel}
          </span>
        )}
      </span>
      <span
        className={
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors " +
          (on ? "border-gold/70 bg-gold/25" : "border-line/60 bg-surface")
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

/**
 * The sound corner.
 *
 * The headphone note used to float into the arena two and a half seconds into
 * every first session and sit there until dismissed — a card with two buttons,
 * present in literally every frame of play until acknowledged. That is exactly
 * the modal interruption the specification asks to recede, and it was arriving
 * during the one part of the experience that is supposed to be uninterrupted.
 *
 * It now appears on the title screen, before a Game exists to interrupt, as one
 * quiet line beside the control it concerns. The honest off-switch did not
 * move: it lives in the panel, where someone bothered by beating tones will
 * look for it.
 *
 * AND IT LEAVES WITH THE TITLE IT BELONGS TO. On a screencast of a real press
 * the note was still in the corner at 288 ms, by which time the arena had drawn
 * all twelve beads — title furniture sitting on a Game that had already begun.
 * It used to dissolve on its own clock, a plain 400 ms fade begun at the phase
 * change; it is now carried out on the same axis and the same curve as the type
 * (`scene/opening.ts`), so the corner is part of one departure rather than a
 * second, slower one. It goes sooner than the block does, because it is the
 * smallest thing on the page and the last that should still be readable.
 */
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

  // Before the Game, never during it. Retires itself once the player has opened
  // the panel, because at that point they have met the setting properly.
  const showHeadphoneNote =
    phase === "title" &&
    binaural &&
    !muted &&
    !hintsSeen.headphones &&
    !open;

  useEffect(() => {
    if (open && !hintsSeen.headphones) markHintSeen("headphones");
  }, [open, hintsSeen.headphones, markHintSeen]);

  return (
    <div ref={ref} className="absolute bottom-5 right-5 z-20">
      <AnimatePresence>
        {showHeadphoneNote && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 1.6, duration: 1.2 } }}
            exit={{
              opacity: 0,
              y: `-${ACKNOWLEDGE_LIFT_REM}rem`,
              transition: {
                duration: OPENING_CORNER_MS / 1000,
                ease: [0.32, 0, 0.24, 1],
              },
            }}
            className="engraved absolute bottom-3 right-14 w-52 text-right leading-relaxed"
          >
            Headphones deepen the bed
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22 }}
            className="absolute bottom-14 right-0 w-[286px]"
          >
            <GlassPanel className="p-2.5">
              <Row
                label={muted ? "Sound off" : "Sound on"}
                on={!muted}
                onToggle={() => setMuted(!muted)}
              />
              <Row
                label="Binaural resonance"
                sublabel="A gentle 6 Hz beat between the ears. Headphones only; turn it off if beating tones bother you."
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
        className="rounded-full border border-line/40 bg-surface/50 p-3 text-dim backdrop-blur-md transition-colors hover:border-brass/70 hover:text-bright"
      >
        <SpeakerIcon muted={muted} />
      </button>
    </div>
  );
}
