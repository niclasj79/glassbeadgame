import { useMemo } from "react";
import { motion } from "framer-motion";
import { buildAnnotation } from "@/domain/annotation";
import { buildPortrait } from "@/domain/portrait";
import { castaliaLookup } from "@/runtime/content/castaliaLookup";
import { startSession } from "@/runtime/session";
import { domainSessionStore } from "@/state/domainSession";
import { useStore } from "@/state/store";
import { useStore as useVanillaStore } from "zustand";
import { PortraitPlate } from "./PortraitPlate";

/**
 * THE CONCLUSION
 *
 * A thin shell around `PortraitPlate`. Everything on the plate is derived from
 * the canonical event log — the same log the arena appended to, replayed — so
 * the reading a player is given at the end is a reading of the Game they
 * actually played and nothing else.
 *
 * The legacy plate is gone entirely: score, rank sigil, codex-new markers, the
 * share-progress link, and the list of curated connections all counted against
 * a corpus that no longer ships. ADR-010 replaces the number with the portrait.
 */
export function ConclusionScreen() {
  const domainSession = useVanillaStore(domainSessionStore, (s) => s.session);
  const returnToTitle = useStore((s) => s.returnToTitle);

  const reading = useMemo(() => {
    if (!domainSession) return null;
    return {
      portrait: buildPortrait(domainSession, castaliaLookup),
      annotation: buildAnnotation(domainSession, castaliaLookup),
      threadCount: domainSession.threads.length,
    };
  }, [domainSession]);

  if (!reading) return null;

  return (
    <motion.div
      className="absolute inset-0 z-10 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 1 } }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <PortraitPlate
        portrait={reading.portrait}
        annotation={reading.annotation}
        threadCount={reading.threadCount}
        onAnother={() => startSession()}
        onLeave={returnToTitle}
      />
    </motion.div>
  );
}
