import { motion } from "framer-motion";
import { startSession } from "@/runtime/session";
import { Button } from "../components/Button";
import { TITLE_EPIGRAPH } from "./titleEpigraph";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

/**
 * One door.
 *
 * The prototype's title offered four: Begin, Today's Draw, the Codex, and a
 * progress menu carrying a rank. Three of them were entrances to systems that
 * no longer exist — the daily draw seeded a discipline pick the slice does not
 * make, and the Codex and rank both counted curated connections against a
 * corpus that has been deleted. What is left is the only choice the Game ever
 * needed the player to make: start.
 */
export function TitleScreen() {
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
        {TITLE_EPIGRAPH.quotation}
        {/* Cited, not merely name-dropped. See titleEpigraph.ts for why the
            fragment number is given and a translator is not. */}
        <footer className="mx-auto mt-3 max-w-xs font-ui text-[10px] uppercase not-italic leading-relaxed tracking-[0.22em] text-dim/60">
          {TITLE_EPIGRAPH.attribution}
        </footer>
      </motion.blockquote>

      <motion.div
        {...fadeUp}
        transition={{ duration: 0.9, delay: 0.75 }}
        className="mt-12"
      >
        <Button onClick={() => startSession()}>Begin</Button>
      </motion.div>
    </motion.div>
  );
}
