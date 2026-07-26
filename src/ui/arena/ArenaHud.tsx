import { motion } from "framer-motion";
import { productionInterpretation } from "@/runtime/interpretation";
import { useStore } from "@/state/store";
import { BeadInspectCard } from "./BeadInspectCard";
import { InterpretationControls } from "./InterpretationControls";

/** The world remains primary; these controls mirror its interpretation actions accessibly. */
export function ArenaHud() {
  const lensActive = useStore((state) => state.lensActive);
  const cycleLens = useStore((state) => state.cycleLens);
  const returnToTitle = useStore((state) => state.returnToTitle);

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
          onClick={() => {
            productionInterpretation.reset();
            returnToTitle();
          }}
          className="rounded-full border border-line/40 bg-surface/60 px-4 py-2 font-ui text-[11px] uppercase tracking-[0.2em] text-dim backdrop-blur-md"
        >
          Leave arena
        </button>
      </div>
      {!lensActive && <InterpretationControls />}
      <BeadInspectCard />
    </motion.div>
  );
}
