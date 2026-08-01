import { motion } from "framer-motion";
import { facetById } from "@/content/castalia/facets";
import { facultyById } from "@/content/castalia/faculties";
import type { CastaliaConcept } from "@/content/castalia/schema";
import { useStore } from "@/state/store";
import { productionInterpretation } from "@/runtime/interpretation";
import { inspectedConcept } from "../components/inspection";
import {
  QUIET_CONTROL,
  READING_MEASURE,
  READING_PLATE,
  ReadingColumn,
  ReadingRule,
} from "../components/ReadingColumn";

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
 *
 * AND IT IS READ WHERE READING HAPPENS (IMP-5).
 *
 * The card used to be a rounded glass panel pinned to the lower left, over the
 * instrument, at 10–12px — while the reserved column on the right, built for
 * exactly this content and ruled for it, stood empty in the same frame. Two
 * surfaces of the same class obeyed two different layout laws, and the one that
 * fires first destroyed the world it describes: the panel crossed outside the
 * page's inner rule and clipped the bead's own label to a fragment.
 *
 * It is set in `components/ReadingColumn` now, in the margin's measure, on the
 * margin's page, under the margin's rule, at the margin's type sizes. The only
 * thing that distinguishes it from an outcome reading is what it says.
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
    <>
      {/* Brass, not gold: a bead is authored material, not a settled claim
          about two things at once. Gold is spent only on the record. */}
      <ReadingRule />
      <p className="engraved mb-2">
        {lensActive ? "Lens focus" : "Bead"} ·{" "}
        {/* The faculty is named as well as inked. A faculty told in colour
            alone is a faculty a monochrome screenshot does not carry. */}
        <span style={{ color: faculty?.ink }}>
          {faculty?.name ?? "Unattributed"}
        </span>{" "}
        · {concept.kind}
      </p>
      <h2
        data-testid="bead-name"
        className="font-display text-title font-medium leading-tight text-vellum"
      >
        {concept.name}
      </h2>

      <p className="prose-castalia mt-2 max-w-none text-body leading-relaxed">
        {concept.caption}
      </p>
      <p
        data-testid="bead-description"
        className="prose-castalia mt-2 max-w-none text-body leading-relaxed"
      >
        {concept.description}
      </p>

      {/* The facets, named as the pack names them, set as the register sets a
          reading: an engraved run, not a row of filled chips. These are the
          handles a connection can actually be built from, so they are the last
          thing read before the player goes back to the arena. */}
      {concept.facets.length > 0 && (
        <p
          data-testid="bead-facets"
          className="engraved mt-4 normal-case tracking-[0.12em] text-dim"
        >
          {concept.facets
            .map((facetId) => facetById.get(facetId)?.name ?? String(facetId))
            .join(" · ")}
        </p>
      )}

      <p className="engraved mt-2 normal-case tracking-[0.12em] text-faint">
        {concept.era}
      </p>

      {/* The same control row, in the same place, as the margin's "Set aside". */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="bead-close"
          onClick={onClose}
          aria-label="Close bead focus"
          className={QUIET_CONTROL}
        >
          Set aside
        </button>
      </div>
    </>
  );
}

export interface BeadPlateProps extends BeadDetailsProps {
  readonly reducedMotion: boolean;
}

/**
 * The card in the column, with no store attached, so the layout law it obeys
 * can be compared directly against the margin's — which is the whole of IMP-5
 * and was untestable while the only surface carrying it needed the store.
 *
 * Closing is immediate rather than animated out: the player asked for the world
 * back, and an exit that outlived the state change would put two reading
 * columns on the glass while it played.
 */
export function BeadPlate({
  concept,
  lensActive,
  onClose,
  reducedMotion,
}: BeadPlateProps) {
  return (
    <ReadingColumn label="The bead" testId="bead-inspect" lit>
      <motion.figure
        key={concept.id}
        data-testid="bead-plate"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reducedMotion ? 0.14 : 0.28,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={`${READING_PLATE} ${READING_MEASURE}`}
      >
        <BeadDetails concept={concept} lensActive={lensActive} onClose={onClose} />
      </motion.figure>
    </ReadingColumn>
  );
}

export function BeadInspectCard() {
  const pinned = useStore((s) => s.pinnedInspectId);
  const lensActive = useStore((s) => s.lensActive);
  const setFocusedBead = useStore((s) => s.setFocusedBead);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);

  // Inspection is deliberate: long-press or the semantic Details action pins
  // it. Ordinary hover/focus never places a card over the arena.
  const concept = inspectedConcept(pinned);
  const close = () => {
    productionInterpretation.closeInspection();
    setFocusedBead(null);
  };

  /*
   * The column is rendered only while a bead is inspected, and `Marginalia`
   * yields its own column on the same condition in the same store update, so
   * there is exactly one reading column on the page at any moment and its page
   * is never drawn twice.
   */
  if (concept === null) return null;

  return (
    <BeadPlate
      concept={concept}
      lensActive={lensActive}
      onClose={close}
      reducedMotion={reducedMotion}
    />
  );
}
