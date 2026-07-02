import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { ArenaCanvas } from "./scene/ArenaCanvas";
import { TitleScreen } from "./ui/screens/TitleScreen";
import { SetupScreen } from "./ui/screens/SetupScreen";
import { ConclusionScreen } from "./ui/screens/ConclusionScreen";
import { CodexScreen } from "./ui/screens/CodexScreen";
import { ArenaHud } from "./ui/arena/ArenaHud";
import { AudioBridge } from "./audio/useAudio";
import { SoundToggle } from "./ui/components/SoundToggle";
import { useStore } from "./state/store";
import { probeWebGL } from "./lib/device";

function WebGLFallback() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-void px-6">
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
  const webgl = useMemo(probeWebGL, []);

  if (!webgl) return <WebGLFallback />;

  return (
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
    </div>
  );
}
