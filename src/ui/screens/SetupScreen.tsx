import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { disciplines } from "@/content/disciplines";
import type { DisciplineId } from "@/content/types";
import { useStore } from "@/state/store";
import { Button } from "../components/Button";

const MAX_PICKS = 3;

export function SetupScreen() {
  const beginSession = useStore((s) => s.beginSession);
  const returnToTitle = useStore((s) => s.returnToTitle);
  const [picks, setPicks] = useState<DisciplineId[]>([]);

  const toggle = (id: DisciplineId) => {
    setPicks((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length < MAX_PICKS
          ? [...prev, id]
          : prev
    );
  };

  const ready = picks.length >= 2 && picks.length <= MAX_PICKS;

  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.7 }}
        className="font-ui text-[11px] uppercase tracking-[0.5em] text-dim/70"
      >
        The Draw
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7 }}
        className="mt-3 font-display text-4xl font-medium text-bright md:text-5xl"
      >
        Choose your disciplines
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.7 }}
        className="mt-3 font-ui text-sm text-dim"
      >
        Two or three. The Game will draw its beads from them.
      </motion.p>

      <div className="mt-10 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
        {disciplines.map((d, i) => {
          const selected = picks.includes(d.id);
          return (
            <motion.button
              key={d.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.06, duration: 0.6 }}
              onClick={() => toggle(d.id)}
              aria-pressed={selected}
              className={clsx(
                "group flex flex-col items-center gap-2 rounded-2xl border px-4 py-6 backdrop-blur-md transition-all duration-300",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-glow/60",
                selected
                  ? "bg-elevated/80"
                  : "border-line/40 bg-surface/50 hover:border-line/80 hover:bg-surface/80"
              )}
              style={
                selected
                  ? {
                      borderColor: `${d.color}aa`,
                      boxShadow: `0 0 34px -8px ${d.color}66, inset 0 0 24px -14px ${d.color}44`,
                    }
                  : undefined
              }
            >
              <span
                className="font-display text-3xl transition-transform duration-300 group-hover:scale-110"
                style={{ color: d.color, textShadow: selected ? `0 0 18px ${d.color}88` : "none" }}
              >
                {d.glyph}
              </span>
              <span
                className={clsx(
                  "font-ui text-xs uppercase tracking-[0.22em] transition-colors",
                  selected ? "text-bright" : "text-dim group-hover:text-bright"
                )}
              >
                {d.name}
              </span>
            </motion.button>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.7 }}
        className="mt-11 flex items-center gap-4"
      >
        <Button variant="ghost" onClick={returnToTitle}>
          Back
        </Button>
        <Button disabled={!ready} onClick={() => ready && beginSession(picks)}>
          {ready ? "Enter the Arena" : `Choose ${Math.max(0, 2 - picks.length)} more`}
        </Button>
      </motion.div>
    </motion.div>
  );
}
