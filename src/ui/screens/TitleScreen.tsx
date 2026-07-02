import { motion } from "framer-motion";
import { useStore } from "@/state/store";
import { rankFor, totalConnections } from "@/game/ranks";
import { Button } from "../components/Button";
import { ContinueLinkButton } from "../components/ContinueLinkButton";

const EPIGRAPH =
  "The Glass Bead Game is thus a mode of playing with the total contents and values of our culture.";

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
  const resetProgress = useStore((s) => s.resetProgress);
  const hasProgress =
    codexCount > 0 || lifetimeStats.sessions > 0 || lifetimeStats.totalScore > 0;

  const freshStart = () => {
    if (window.confirm("Clear this browser's Codex and start fresh?")) resetProgress();
  };

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
        className="mt-7 h-px w-24 bg-gradient-to-r from-transparent via-glow/60 to-transparent"
      />

      <motion.blockquote
        {...fadeUp}
        transition={{ duration: 0.9, delay: 0.55 }}
        className="mt-7 max-w-xl text-center font-display text-lg italic leading-relaxed text-dim text-balance"
      >
        "{EPIGRAPH}"
        <footer className="mt-3 font-ui text-[10px] uppercase not-italic tracking-[0.35em] text-dim/60">
          Hermann Hesse
        </footer>
      </motion.blockquote>

      <motion.div
        {...fadeUp}
        transition={{ duration: 0.9, delay: 0.75 }}
        className="mt-12 flex flex-wrap items-center justify-center gap-4"
      >
        <Button onClick={goToSetup}>Begin the Game</Button>
        {codexCount > 0 && (
          <Button variant="ghost" onClick={() => setCodexOpen(true)}>
            Codex - {codexCount}/{totalConnections()}
          </Button>
        )}
        {hasProgress && <ContinueLinkButton />}
        {hasProgress && (
          <Button variant="ghost" onClick={freshStart}>
            Fresh start
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

      {hasProgress && (
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.9, delay: 1 }}
          className="mt-3 max-w-md text-center font-ui text-[11px] leading-relaxed tracking-[0.16em] text-dim/60"
        >
          Progress lives in this browser. A continue URL carries your Codex to another device.
        </motion.p>
      )}
    </motion.div>
  );
}
