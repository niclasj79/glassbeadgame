import { AnimatePresence, motion } from "framer-motion";
import { castaliaConceptById } from "@/content/castalia";
import { facetById } from "@/content/castalia/facets";
import { facultyById } from "@/content/castalia/faculties";
import type { CastaliaConcept } from "@/content/castalia/schema";
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
 *
 * READ VERBATIM MEANS READ IN FULL.
 *
 * This is the only surface in the game that renders a concept description, and
 * it used to clamp that description to four lines and truncate the title, with
 * no expand control anywhere. What the clamp cut was not filler. Fibonacci's
 * description ended "…arrangements in plants. It …", and the sentence behind
 * the ellipsis is "It is also badly over-claimed, which makes it a good test of
 * how carefully one is willing to look" — the caveat, which is exactly the
 * sentence a pack that refuses to overstate cannot afford to hide. Descriptions
 * are authored to a 700-character ceiling and currently run 233–307, so there
 * was nothing to save: the clamp cost the game its own honesty and bought about
 * two lines of card.
 */
export interface BeadDetailsProps {
  readonly concept: CastaliaConcept;
  readonly lensActive: boolean;
  readonly onClose: () => void;
}

/**
 * The card with no store attached, so what it prints of a concept can be
 * asserted directly. The clamp was invisible to every test in the suite because
 * the only surface that carried it could not be rendered without the store.
 */
export function BeadDetails({ concept, lensActive, onClose }: BeadDetailsProps) {
  const faculty = facultyById.get(concept.faculty);
  return (
    /* The ceiling is insurance, not a clamp: at the authored maximum this card
       is well inside a phone viewport, and it exists only so a future long
       description scrolls rather than running off the top of the screen where
       nothing could reach it. */
    <GlassPanel className="max-h-[80vh] overflow-y-auto overscroll-contain bg-void/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-ui text-[10px] uppercase tracking-[0.32em] text-dim">
            {lensActive ? "Lens focus" : "Bead"}
          </p>
          <h3
            data-testid="bead-name"
            className="mt-1.5 font-display text-2xl font-medium leading-tight text-bright"
          >
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
          onClick={onClose}
          aria-label="Close bead focus"
          className="rounded-full border border-line/50 px-2 py-1 font-ui text-[10px] uppercase tracking-[0.18em] text-dim transition-colors hover:border-line hover:text-bright"
        >
          Close
        </button>
      </div>

      <p className="mt-3 font-ui text-[12px] leading-relaxed text-vellum">
        {concept.caption}
      </p>
      <p
        data-testid="bead-description"
        className="mt-2 font-ui text-[12px] leading-relaxed text-dim"
      >
        {concept.description}
      </p>

      {/* The facets, named as the pack names them. These are the handles a
          connection can actually be built from, so they are the last thing read
          before the player goes back to the arena. */}
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
  );
}

export function BeadInspectCard() {
  const pinned = useStore((s) => s.pinnedInspectId);
  const lensActive = useStore((s) => s.lensActive);
  const setFocusedBead = useStore((s) => s.setFocusedBead);

  // Inspection is deliberate: long-press or the semantic Details action pins
  // it. Ordinary hover/focus never places a card over the arena.
  const concept = pinned ? castaliaConceptById.get(pinned) : undefined;
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
          <BeadDetails
            concept={concept}
            lensActive={lensActive}
            onClose={close}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
