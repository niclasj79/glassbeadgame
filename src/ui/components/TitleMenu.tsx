import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/state/store";
import { GlassPanel } from "./GlassPanel";
import { ContinueLinkButton } from "./ContinueLinkButton";

/**
 * The quiet corner of the title screen: device-transfer and the one
 * destructive action, folded away from the primary composition —
 * Fresh start demands a deliberate second step.
 */
export function TitleMenu() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const resetProgress = useStore((s) => s.resetProgress);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirming(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="absolute bottom-5 left-5 z-20">
      <button
        onClick={() => {
          setOpen((v) => !v);
          setConfirming(false);
        }}
        aria-label="Progress and transfer options"
        aria-expanded={open}
        className="rounded-full border border-line/40 bg-surface/50 p-3 text-dim backdrop-blur-md transition-colors hover:border-line/80 hover:text-bright"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-14 left-0 w-[290px]"
          >
            <GlassPanel className="p-4">
              <p className="font-ui text-[10px] uppercase tracking-[0.35em] text-dim">
                Your progress
              </p>
              <p className="mt-2 font-ui text-[11px] leading-relaxed text-dim/80">
                Progress lives in this browser. A continue URL carries your Codex to
                another device.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <ContinueLinkButton />
                {!confirming ? (
                  <button
                    onClick={() => setConfirming(true)}
                    className="rounded-full border border-line/40 px-4 py-2 text-left font-ui text-[11px] uppercase tracking-[0.22em] text-dim transition-colors hover:border-line/80 hover:text-bright"
                  >
                    Fresh start…
                  </button>
                ) : (
                  <div className="rounded-2xl border border-red-400/30 bg-red-400/5 p-3">
                    <p className="font-ui text-[11px] leading-relaxed text-bright">
                      This erases your Codex, rank, and archive in this browser.
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => {
                          resetProgress();
                          setOpen(false);
                          setConfirming(false);
                        }}
                        className="rounded-full border border-red-400/50 bg-red-400/10 px-4 py-1.5 font-ui text-[10px] uppercase tracking-[0.2em] text-red-200 transition-colors hover:bg-red-400/20"
                      >
                        Erase
                      </button>
                      <button
                        onClick={() => setConfirming(false)}
                        className="rounded-full border border-line/50 px-4 py-1.5 font-ui text-[10px] uppercase tracking-[0.2em] text-dim transition-colors hover:text-bright"
                      >
                        Keep
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
