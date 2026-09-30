import { Suspense, lazy, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { ArenaCanvas } from "./scene/ArenaCanvas";
import { TitleScreen } from "./ui/screens/TitleScreen";
import { ThresholdScreen } from "./ui/screens/ThresholdScreen";
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

/**
 * THE CONCLUSION LOADS WITH THE CONCLUSION.
 *
 * `scripts/bundle-budgets.json` has been raised twice, and its own note says the
 * answer to a third is to stop measuring total JavaScript and start measuring
 * what a player downloads before the title appears. This is the other half of
 * that: the portrait, the annotation's reading surfaces, the plate and the share
 * codec are reachable only after a Game has been concluded, and none of them
 * needs to be in the first byte a stranger fetches.
 *
 * It is prefetched the moment the arena opens rather than on the phase change.
 * A player has twelve to eighteen minutes between those two events, so by the
 * time Conclude is pressed the chunk is in memory and `Suspense` never actually
 * suspends — which matters, because a spinner between the last thread and the
 * reading would land exactly where the game is quietest. The fallback below is
 * therefore what a failed prefetch looks like, not what a normal Game looks
 * like, and it is deliberately a held blank rather than a spinner: the
 * conclusion opens on darkness anyway.
 */
const ConclusionScreen = lazy(async () => ({
  default: (await import("./ui/screens/ConclusionScreen")).ConclusionScreen,
}));

/**
 * THE ARENA'S PAGE LOADS AFTER THE TITLE.
 *
 * The same prescription, one screen earlier. The focus view's column, the
 * margin and its thread cards, the bead card and the accessible mirror are
 * reachable only from the arena, and the title never shows any of them, so
 * none of them belongs in what a stranger downloads before the title appears
 * (`scripts/bundle-budgets.json`: "the answer is another dynamic import, not
 * another number").
 *
 * It is prefetched as soon as the title has painted, not when the arena opens:
 * the threshold alone gives it seconds, so `Suspense` does not suspend in
 * ordinary play. The fallback is a held blank for the same reason as the
 * conclusion's — the arena's own world is already drawn beneath it.
 */
const ArenaHud = lazy(async () => ({
  default: (await import("./ui/arena/ArenaHud")).ArenaHud,
}));

const prefetchArenaHud = (): void => {
  void import("./ui/arena/ArenaHud");
};

const prefetchConclusion = (): void => {
  void import("./ui/screens/ConclusionScreen");
};

export default function App() {
  const phase = useStore((s) => s.phase);
  const [webgl] = useState(probeWebGL);

  useEffect(() => {
    prefetchArenaHud();
  }, []);

  useEffect(() => {
    if (phase === "arena") prefetchConclusion();
  }, [phase]);

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
          {phase === "threshold" && <ThresholdScreen key="threshold" />}
          {phase === "arena" && (
            <Suspense key="arena" fallback={null}>
              <ArenaHud />
            </Suspense>
          )}
          {phase === "conclusion" && (
            <Suspense key="conclusion" fallback={null}>
              <ConclusionScreen />
            </Suspense>
          )}
        </AnimatePresence>
        <SoundToggle />
      </div>
    </MotionConfig>
  );
}
