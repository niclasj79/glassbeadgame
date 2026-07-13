import { useMemo } from "react";
import { motion } from "framer-motion";
import { startSession } from "@/runtime/session";
import { useStore } from "@/state/store";
import { rankFor, totalConnections } from "@/game/ranks";
import { dailyPicks, dailySeed, utcDateKey } from "@/lib/daily";
import { disciplineById } from "@/content/disciplines";
import { epigraphForToday } from "@/content/epigraphs";
import { Button } from "../components/Button";
import { TitleMenu } from "../components/TitleMenu";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export function TitleScreen() {
  const goToSetup = useStore((s) => s.goToSetup);
  const setCodexOpen = useStore((s) => s.setCodexOpen);
  const codexCount = useStore((s) => Object.keys(s.codex).length);
  const lifetimeStats = useStore((s) => s.lifetimeStats);
  const lastDaily = useStore((s) => s.lastDaily);
  const unlocks = useStore((s) => s.unlocks);
  const hasProgress =
    codexCount > 0 || lifetimeStats.sessions > 0 || lifetimeStats.totalScore > 0;

  const epigraph = useMemo(() => epigraphForToday(unlocks), [unlocks]);
  const todayPicks = useMemo(dailyPicks, []);
  const playedToday = lastDaily?.date === utcDateKey();
  const dailyGlyphs = todayPicks
    .map((d) => disciplineById.get(d)?.glyph ?? "?")
    .join(" × ");
  const isMagister = rankFor(codexCount).name === "Magister Ludi";

  const startDaily = () =>
    startSession(todayPicks, { seed: dailySeed(), daily: true });

  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.7 } }}
    >
      <motion.p
        {...fadeUp}
        transition={{ duration: 0.9, delay: 0.15 }}
        className="font-ui text-[11px] uppercase tracking-[0.6em] text-dim/70"
      >
        Das Glasperlenspiel
      </motion.p>

      <motion.h1
        {...fadeUp}
        transition={{ duration: 0.9, delay: 0.3 }}
        className="mt-5 text-center font-display text-6xl font-medium tracking-wide text-bright md:text-8xl"
      >
        The Glass Bead Game
      </motion.h1>

      <motion.div
        {...fadeUp}
        transition={{ duration: 0.9, delay: 0.45 }}
        className={
          "mt-7 h-px w-24 bg-gradient-to-r from-transparent to-transparent " +
          (isMagister ? "via-resonance/70" : "via-glow/60")
        }
      />

      <motion.blockquote
        {...fadeUp}
        transition={{ duration: 0.9, delay: 0.55 }}
        className="mt-7 max-w-xl text-center font-display text-lg italic leading-relaxed text-dim text-balance"
      >
        "{epigraph.text}"
        <footer className="mt-3 font-ui text-[10px] uppercase not-italic tracking-[0.35em] text-dim/60">
          {epigraph.source}
        </footer>
      </motion.blockquote>

      <motion.div
        {...fadeUp}
        transition={{ duration: 0.9, delay: 0.75 }}
        className="mt-12 flex flex-wrap items-center justify-center gap-4"
      >
        <Button onClick={goToSetup}>Begin the Game</Button>
        <button
          onClick={startDaily}
          className="rounded-full border border-glow-3/40 bg-glow-3/5 px-7 py-3.5 font-ui text-xs uppercase tracking-[0.28em] text-bright transition-all duration-300 hover:border-glow-3/70 hover:bg-glow-3/15"
          title="One shared draw for the whole world today"
        >
          {playedToday
            ? `Today's Draw ✓ ${lastDaily?.score} · replay`
            : `Today's Draw · ${dailyGlyphs}`}
        </button>
        {codexCount > 0 && (
          <Button variant="ghost" onClick={() => setCodexOpen(true)}>
            Codex · {codexCount}/{totalConnections()}
          </Button>
        )}
      </motion.div>

      {codexCount > 0 && (
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.9, delay: 0.9 }}
          className="mt-6 font-ui text-[10px] uppercase tracking-[0.4em] text-dim/60"
        >
          {rankFor(codexCount).name} of the Order
        </motion.p>
      )}

      {hasProgress && <TitleMenu />}
    </motion.div>
  );
}
