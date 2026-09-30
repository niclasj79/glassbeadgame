import { motion } from "framer-motion";
import { facetById } from "@/content/castalia/facets";
import { facultyById } from "@/content/castalia/faculties";
import type { CastaliaConcept, FacetId } from "@/content/castalia/schema";
import {
  QUIET_CONTROL,
  READING_PLATE,
  ReadingRule,
} from "../components/ReadingColumn";
import { ROLE_LEAD, type CardRole } from "./columnPlan";

/**
 * THE BEAD CARD — what a bead will say when it is asked directly.
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
 * The full card is the one surface in the game that renders a concept
 * description, and it used to clamp that description to four lines and
 * truncate the title, with no expand control anywhere. What the clamp cut was
 * not filler. Fibonacci's description ended "…arrangements in plants. It …",
 * and the sentence behind the ellipsis is "It is also badly over-claimed, which
 * makes it a good test of how carefully one is willing to look" — the caveat,
 * which is exactly the sentence a pack that refuses to overstate cannot afford
 * to hide. Descriptions are authored to a 700-character ceiling and currently
 * run 233–307, so there was nothing to save.
 *
 * AND IT IS READ WHERE READING HAPPENS (IMP-5).
 *
 * The card used to be a rounded glass panel pinned to the lower left, over the
 * instrument, at 10–12px — while the reserved column on the right, built for
 * exactly this content and ruled for it, stood empty in the same frame. It is
 * set in `components/ReadingColumn` now, in the margin's measure, on the
 * margin's page, under the margin's rule, at the margin's type sizes.
 *
 * THREE LENGTHS OF ONE CARD (I-015, I-018).
 *
 * The focus view reads beads at three lengths, and they are one card rather
 * than three so the type, the rule and the facet line cannot drift apart:
 * the whole card, pinned by name, with the control that sets it aside; the
 * same whole card as a glance, opened by dwelling while roaming, with nothing
 * on it to press; and the compact card of the focus view — faculty and kind,
 * name, caption and facets — which is what a pair is composed from.
 */

/**
 * A facet named as the pack names it, with the pack's own one-clause gloss.
 *
 * "No Common Measure" and "Return" are precise and completely opaque on first
 * contact, so each name carries its gloss on hover and on focus, and in its
 * accessible name too, so the keyboard and screen-reader routes learn the same
 * thing the pointer does. A glance has nothing to press, so its names are not
 * focusable and carry no hover mark.
 *
 * A LIT FACET IS SAID THREE WAYS, NEVER IN COLOUR ALONE: in weight, in the
 * star it carries, and in a solid rule under it where an unlit name has a
 * dotted one. A monochrome screenshot still shows which facets both beads
 * carry.
 */
function FacetName({
  facetId,
  lit,
  interactive,
}: {
  readonly facetId: FacetId;
  readonly lit: boolean;
  readonly interactive: boolean;
}) {
  const facet = facetById.get(facetId);
  const name = facet?.name ?? String(facetId);
  const mark = lit
    ? "border-b border-solid border-brass/70 font-semibold text-vellum"
    : interactive
      ? "border-b border-dotted border-line/60"
      : "";
  return (
    <abbr
      data-testid={`facet-${String(facetId)}`}
      data-shared={lit ? "true" : undefined}
      title={facet ? `${name} — ${facet.gloss}` : name}
      aria-label={facet ? `${name}. ${facet.gloss}` : name}
      tabIndex={interactive ? 0 : undefined}
      className={
        "no-underline " +
        (interactive
          ? "cursor-help focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/70 "
          : "") +
        mark
      }
    >
      {lit && (
        <span aria-hidden="true" className="mr-1 font-normal text-brass">
          ✦
        </span>
      )}
      {name}
    </abbr>
  );
}

export interface FacetLineProps {
  /** The card's own facets, in the order the pack authors them. */
  readonly facets: readonly FacetId[];
  /**
   * Facets the other bead on the page carries too, in the domain's order —
   * empty when they share none, null when there is no other bead to compare.
   */
  readonly shared: readonly FacetId[] | null;
  readonly interactive: boolean;
}

/**
 * THE FACET LINE, WITH WHAT THE PAIR SHARES LIT FIRST (I-018).
 *
 * When two beads stand in the column, the facets both carry lead the line in
 * both cards, in the same order, so the eye finds the same words at the head of
 * each card; the card's other facets follow in the pack's order. This is public
 * structure — both beads carry these facets whatever the record says about the
 * pair — and it is the one thing the column offers to inform the reading.
 */
export function FacetLine({ facets, shared, interactive }: FacetLineProps) {
  if (facets.length === 0) return null;
  const lit = shared === null ? [] : shared.filter((id) => facets.includes(id));
  const rest = facets.filter((id) => !lit.includes(id));
  return (
    <p
      data-testid="bead-facets"
      className="engraved mt-3 normal-case tracking-[0.12em] text-dim"
    >
      {lit.length > 0 && (
        <>
          <span className="sr-only">Both carry: </span>
          <span data-testid="focus-shared-facets" data-facets={lit.join(" ")}>
            {lit.map((facetId, index) => (
              <span key={String(facetId)}>
                {index > 0 && <span aria-hidden="true"> · </span>}
                <FacetName facetId={facetId} lit interactive={interactive} />
              </span>
            ))}
          </span>
          {rest.length > 0 && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="sr-only">Also: </span>
            </>
          )}
        </>
      )}
      {rest.map((facetId, index) => (
        <span key={String(facetId)}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          <FacetName facetId={facetId} lit={false} interactive={interactive} />
        </span>
      ))}
    </p>
  );
}

/**
 * The faculty is named as well as inked. A faculty told in colour alone is a
 * faculty a monochrome screenshot does not carry.
 */
function FacultyAndKind({ concept }: { readonly concept: CastaliaConcept }) {
  const faculty = facultyById.get(concept.faculty);
  return (
    <>
      <span style={{ color: faculty?.ink }}>{faculty?.name ?? "Unattributed"}</span> ·{" "}
      {concept.kind}
    </>
  );
}

export interface BeadDetailsProps {
  readonly concept: CastaliaConcept;
  readonly lensActive: boolean;
  /**
   * Present on a card the player asked for by name, which they can set aside.
   * Absent on a glance: a dwell card closes when the dwell ends (I-015).
   */
  readonly onClose?: () => void;
  /** Facets the other bead on the page carries too, lit in this card. */
  readonly shared?: readonly FacetId[] | null;
}

/**
 * The whole card with no store attached, so what it prints of a concept can be
 * asserted directly. The clamp was invisible to every test in the suite because
 * the only surface that carried it could not be rendered without the store.
 */
export function BeadDetails({
  concept,
  lensActive,
  onClose,
  shared = null,
}: BeadDetailsProps) {
  return (
    <>
      {/* Brass, not gold: a bead is authored material, not a settled claim
          about two things at once. Gold is spent only on the record. */}
      <ReadingRule />
      <p className="engraved mb-2">
        {lensActive ? "Lens focus" : "Bead"} · <FacultyAndKind concept={concept} />
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

      {/* The facets, set as the register sets a reading: an engraved run, not
          a row of filled chips. These are the handles a connection can
          actually be built from, so they are the last thing read before the
          player goes back to the arena. */}
      <FacetLine
        facets={concept.facets}
        shared={shared}
        interactive={onClose !== undefined}
      />

      <p className="engraved mt-2 normal-case tracking-[0.12em] text-faint">
        {concept.era}
      </p>

      {/* The same control row, in the same place, as the margin's "Set aside". */}
      {onClose !== undefined && (
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
      )}
    </>
  );
}

export interface BeadCompactProps {
  readonly concept: CastaliaConcept;
  readonly role: CardRole;
  readonly shared: readonly FacetId[] | null;
}

/**
 * THE COMPACT CARD OF THE FOCUS VIEW (I-018).
 *
 * Faculty and kind, name, caption and facets: what the pair is composed from,
 * and short enough that two of them sit side by side at the foot of a phone
 * without covering the bead they describe. The description and the dates are
 * one explicit request away (the details control, a long press, `I`), which
 * opens this same bead's whole card where it stands.
 *
 * Its role is said to a screen reader and not drawn: to the eye, the top of the
 * column is the attended bead and the slot beneath it is the second.
 */
export function BeadCompact({ concept, role, shared }: BeadCompactProps) {
  return (
    <>
      <ReadingRule />
      <p className="engraved mb-1.5">
        <span className="sr-only">{ROLE_LEAD[role]} · </span>
        <FacultyAndKind concept={concept} />
      </p>
      <h2
        data-testid="bead-name"
        className="font-display text-lead font-medium leading-tight text-vellum md:text-title"
      >
        {concept.name}
      </h2>
      <p className="prose-castalia mt-1.5 max-w-none text-body leading-snug">
        {concept.caption}
      </p>
      <FacetLine facets={concept.facets} shared={shared} interactive />
    </>
  );
}

export interface BeadPlateProps extends BeadDetailsProps {
  readonly reducedMotion: boolean;
}

/**
 * A pinned bead that is not one of the column's own, holding the column alone
 * until it is set aside. Same plate, same measure, same entrance as the
 * margin's reading (IMP-5).
 *
 * Closing is immediate rather than animated out: the player asked for the world
 * back, and an exit that outlived the state change would put two plates in the
 * column while it played.
 */
export function BeadPlate({
  concept,
  lensActive,
  onClose,
  shared = null,
  reducedMotion,
}: BeadPlateProps) {
  return (
    <div data-testid="bead-inspect" className="pointer-events-none w-full">
      <motion.figure
        key={concept.id}
        data-testid="bead-plate"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reducedMotion ? 0.14 : 0.28,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={READING_PLATE}
      >
        <BeadDetails
          concept={concept}
          lensActive={lensActive}
          onClose={onClose}
          shared={shared}
        />
      </motion.figure>
    </div>
  );
}
