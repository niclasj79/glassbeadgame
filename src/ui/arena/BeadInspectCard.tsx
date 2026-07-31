import { AnimatePresence, motion } from "framer-motion";
import { castaliaConceptById } from "@/content/castalia";
import { facetById } from "@/content/castalia/facets";
import { facultyById } from "@/content/castalia/faculties";
import { useStore } from "@/state/store";
import { productionInterpretation } from "@/runtime/interpretation";
import { GlassPanel } from "../components/GlassPanel";

/**
 * THE INSPECTION CARD — what a bead will say when it is asked directly.
 *
 * Every line here is authored content read verbatim: the caption, the
 * description, the facets the concept genuinely carries, and where it sits in
 * time. Nothing is computed, scored, or ranked.
 *
 * It used to read the prototype pack, which meant it also drew three meters —
 * True, Beautiful, Good — from an authored coordinate triple. Those are gone
 * with that pack, and they are not replaced: the Game has no standing to tell a
 * player how good an idea is, and a bar chart saying so was the loudest place
 * it claimed otherwise. The facets took their place because a facet is a
 * structural property two concepts can actually be shown to share, which is
 * what the player is about to do with this bead.
 */
export function BeadInspectCard() {
  const pinned = useStore((s) => s.pinnedInspectId);
  const lensActive = useStore((s) => s.lensActive);
  const setFocusedBead = useStore((s) => s.setFocusedBead);

  // Inspection is deliberate: long-press or the semantic Details action pins
  // it. Ordinary hover/focus never places a card over the arena.
  const concept = pinned ? castaliaConceptById.get(pinned) : undefined;
  const faculty = concept ? facultyById.get(concept.faculty) : undefined;
  const close = () => {
    productionInterpretation.closeInspection();
    setFocusedBead(null);
  };

  return (
    <AnimatePresence>
      {concept && (
        <motion.div
          key={concept.id}
          className="pointer-events-auto absolute bottom-5 left-5 w-[min(350px,calc(100vw-2.5rem))]"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.985 }}
          transition={{ duration: 0.28 }}
        >
          <GlassPanel className="bg-void/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-ui text-[10px] uppercase tracking-[0.32em] text-dim">
                  {lensActive ? "Lens focus" : "Bead"}
                </p>
                <h3 className="mt-1.5 truncate font-display text-2xl font-medium text-bright">
                  {concept.name}
                </h3>
                <p
                  className="mt-0.5 font-ui text-[11px] uppercase tracking-[0.22em]"
                  style={{ color: faculty?.ink }}
                >
                  {faculty?.name ?? "Unattributed"} · {concept.kind}
                </p>
              </div>
              <button
                onClick={close}
                aria-label="Close bead focus"
                className="rounded-full border border-line/50 px-2 py-1 font-ui text-[10px] uppercase tracking-[0.18em] text-dim transition-colors hover:border-line hover:text-bright"
              >
                Close
              </button>
            </div>

            <p className="mt-3 font-ui text-[12px] leading-relaxed text-vellum">
              {concept.caption}
            </p>
            <p className="mt-2 line-clamp-4 font-ui text-[12px] leading-relaxed text-dim">
              {concept.description}
            </p>

            {/* The facets, named as the pack names them. These are the handles
                a connection can actually be built from, so they are the last
                thing read before the player goes back to the arena. */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {concept.facets.map((facetId) => (
                <span
                  key={String(facetId)}
                  className="rounded-full border border-line/40 bg-surface/45 px-2.5 py-1 font-ui text-[10px] text-dim"
                >
                  {facetById.get(facetId)?.name ?? String(facetId)}
                </span>
              ))}
            </div>

            <p className="engraved mt-3 normal-case tracking-[0.12em] text-faint">
              {concept.era}
            </p>
          </GlassPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
