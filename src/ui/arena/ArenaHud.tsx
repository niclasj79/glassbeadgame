import { motion } from "framer-motion";
import { productionInterpretation } from "@/runtime/interpretation";
import { sessionProgression } from "@/runtime/progression";
import { useStore } from "@/state/store";
import { BeadInspectCard } from "./BeadInspectCard";
import { InterpretationControls } from "./InterpretationControls";
import { Marginalia } from "./Marginalia";

/** The world remains primary; these controls mirror its interpretation actions accessibly. */
export function ArenaHud() {
  const lensActive = useStore((state) => state.lensActive);
  const cycleLens = useStore((state) => state.cycleLens);

  /**
   * THE ONLY WAY OUT.
   *
   * Until this existed `sessionProgression.conclude()` had no caller anywhere
   * in the application: the arena could weave indefinitely and the log never
   * received `session.concluded`, so the portrait and the annotation — both
   * compiled from the concluded log — were unreachable in play. "Leave arena"
   * used to abandon the session instead, which threw the Game away rather than
   * finishing it.
   *
   * Concluding is deliberately one plain word rather than a highlighted button.
   * The player decides when the composition has said what they meant it to say
   * (spec §14); the HUD must not imply that the Game is waiting to be completed.
   */
  const conclude = () => {
    productionInterpretation.reset();
    sessionProgression.conclude();
    useStore.getState().finishConcluding();
  };

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="pointer-events-auto absolute right-4 top-4 flex gap-2">
        <button
          type="button"
          aria-pressed={lensActive}
          onClick={() => {
            productionInterpretation.reset();
            cycleLens();
          }}
          className="rounded-full border border-line/40 bg-surface/60 px-4 py-2 font-ui text-[11px] uppercase tracking-[0.2em] text-dim backdrop-blur-md"
        >
          {lensActive ? "Close Lens" : "The Lens"}
        </button>
        <button
          type="button"
          onClick={conclude}
          title="End this Game and read what it made"
          className="rounded-full border border-line/40 bg-surface/60 px-4 py-2 font-ui text-[11px] uppercase tracking-[0.2em] text-dim backdrop-blur-md transition-colors hover:border-brass/60 hover:text-bright"
        >
          Conclude
        </button>
      </div>
      {!lensActive && <InterpretationControls />}
      {!lensActive && <Marginalia />}
      <BeadInspectCard />
    </motion.div>
  );
}
