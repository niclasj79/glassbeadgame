import { useEffect, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { ArenaCanvas } from "./scene/ArenaCanvas";
import { TitleScreen } from "./ui/screens/TitleScreen";
import { SetupScreen } from "./ui/screens/SetupScreen";
import { ConclusionScreen } from "./ui/screens/ConclusionScreen";
import { CodexScreen } from "./ui/screens/CodexScreen";
import { ArenaHud } from "./ui/arena/ArenaHud";
import { AudioBridge } from "./audio/useAudio";
import { SoundToggle } from "./ui/components/SoundToggle";
import { useStore } from "./state/store";
import { progressFromHash } from "./game/progress";
import { probeWebGL } from "./lib/device";

function WebGLFallback() {
  const setCodexOpen = useStore((s) => s.setCodexOpen);
  const codexCount = useStore((s) => Object.keys(s.codex).length);
  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden bg-void px-6">
      <div className="max-w-md text-center">
        <p className="font-ui text-[11px] uppercase tracking-[0.55em] text-dim/70">
          Das Glasperlenspiel
        </p>
        <h1 className="mt-4 font-display text-5xl font-medium text-bright">
          The Glass Bead Game
        </h1>
        <p className="mt-6 font-ui text-sm leading-relaxed text-dim">
          This Game is played in three dimensions, and your browser cannot open
          the space for it — WebGL is unavailable. Try a current browser with
          hardware acceleration enabled.
        </p>
        {codexCount > 0 && (
          <button
            onClick={() => setCodexOpen(true)}
            className="mt-8 rounded-full border border-line/60 px-7 py-3 font-ui text-[11px] uppercase tracking-[0.28em] text-bright transition-colors hover:border-glow/60 hover:bg-glow/10"
          >
            Browse your Codex
          </button>
        )}
      </div>
      <CodexScreen />
    </div>
  );
}

export default function App() {
  const phase = useStore((s) => s.phase);
  const mergeProgress = useStore((s) => s.mergeProgress);
  const [webgl] = useState(probeWebGL);
  const [progressImported, setProgressImported] = useState(false);

  useEffect(() => {
    const progress = progressFromHash(window.location.hash);
    if (!progress) return;
    mergeProgress(progress);
    setProgressImported(true);

    const cleanUrl = new URL(window.location.href);
    cleanUrl.hash = "";
    window.history.replaceState(null, "", cleanUrl);

    const t = window.setTimeout(() => setProgressImported(false), 5200);
    return () => window.clearTimeout(t);
  }, [mergeProgress]);

  if (!webgl) return <WebGLFallback />;

  return (
    <MotionConfig reducedMotion="user">
      <div className="fixed inset-0 overflow-hidden bg-void">
        <ArenaCanvas />
        <AudioBridge />
        <AnimatePresence mode="wait">
          {phase === "title" && <TitleScreen key="title" />}
          {phase === "setup" && <SetupScreen key="setup" />}
          {phase === "arena" && <ArenaHud key="arena" />}
          {phase === "conclusion" && <ConclusionScreen key="conclusion" />}
        </AnimatePresence>
        <CodexScreen />
        <SoundToggle />
        <AnimatePresence>
          {progressImported && (
            <motion.div
              className="pointer-events-none absolute left-1/2 top-5 z-30 -translate-x-1/2 rounded-full border border-glow/40 bg-void/80 px-5 py-2.5 font-ui text-[11px] uppercase tracking-[0.24em] text-bright shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              Exploration restored
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
