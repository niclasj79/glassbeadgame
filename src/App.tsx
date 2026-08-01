import { useState } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { ArenaCanvas } from "./scene/ArenaCanvas";
import { TitleScreen } from "./ui/screens/TitleScreen";
import { ConclusionScreen } from "./ui/screens/ConclusionScreen";
import { ArenaHud } from "./ui/arena/ArenaHud";
import { AudioBridge } from "./audio/useAudio";
import { SoundToggle } from "./ui/components/SoundToggle";
import { useStore } from "./state/store";
import { probeWebGL } from "./lib/device";

function WebGLFallback() {
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
      </div>
    </div>
  );
}

export default function App() {
  const phase = useStore((s) => s.phase);
  const [webgl] = useState(probeWebGL);

  if (!webgl) return <WebGLFallback />;

  return (
    <MotionConfig reducedMotion="user">
      <div className="fixed inset-0 overflow-hidden bg-void">
        <ArenaCanvas />
        <AudioBridge />
        {/**
         * NO WAIT MODE.
         *
         * A phase change here is one move — the title being carried out while
         * the instrument turns into view — and the presence group used to play
         * its two halves in series: the arena's chrome was held back until the
         * title had finished leaving, so the camera arrived at an empty page and
         * the player's own press was answered by a queue. The canvas beneath is
         * never unmounted, so the firmament and the page's ruling are already
         * continuous across the change; the surfaces above it now are too.
         */}
        <AnimatePresence>
          {phase === "title" && <TitleScreen key="title" />}
          {phase === "arena" && <ArenaHud key="arena" />}
          {phase === "conclusion" && <ConclusionScreen key="conclusion" />}
        </AnimatePresence>
        <SoundToggle />
      </div>
    </MotionConfig>
  );
}
