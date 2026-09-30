import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { RelationIntention } from "@/domain/events";
import type { FacetId } from "@/content/castalia/schema";
import { productionInterpretation } from "@/runtime/interpretation";
import { useFocusView } from "@/state/interpretationPresentation";
import { useStore } from "@/state/store";
import { useStudy } from "@/state/studies";
import {
  QUIET_CONTROL,
  READING_PLATE,
  READING_STACK,
  ReadingColumn,
} from "../components/ReadingColumn";
import { useGapHint, useMarginState } from "./arenaColumnHooks";
import { BeadCompact, BeadDetails, BeadPlate } from "./BeadInspectCard";
import {
  GAP_HINT,
  NOTHING_SHARED,
  planColumn,
  readingLine,
  type ColumnCard,
  type ColumnPlan,
} from "./columnPlan";
import { MarginSurface } from "./Marginalia";
import { openReading, type MarginState } from "./marginState";
import { useHeldWhileLeaving } from "./presence";
import { StudyNote } from "./StudyNote";
import { studyNote, type StudyNoteModel } from "./studyMode";

/**
 * THE RIGHT COLUMN OF THE FOCUS VIEW (I-015, I-018, I-019).
 *
 * One reserved column, written from its head, and everything the arena reads
 * at length is written in it in one order, so no surface can ever lie over
 * another:
 *
 *   roaming   the margin — the last thread card, the way back in; a dwelt-on
 *             bead's card takes the head of the page for as long as the look
 *             lasts, and the margin is back in place the moment it ends
 *   focus     the attended bead's card locked at the top; beneath it the gap,
 *             an empty outline that asks for a second bead and, only after
 *             three seconds of hesitation, says so; the bead under the lens
 *             fills it, and the facets both carry are lit in both cards
 *   locked    both cards stay; the reading being heard is named beneath them
 *   held      a reopened thread: both bead cards, and the thread's own card
 *
 * The column decides none of this. `deriveFocusView` decides which beads it is
 * about, `planColumn` what each card says, and `marginState` what the margin
 * holds; this file only sets it on the page. The world stays the primary
 * interface: nothing here counts, ranks, scores or hints at the record, and
 * the only help it offers waits to be needed.
 *
 * IN A STUDY the brief is the first note on the page, above all of it and in
 * every one of these states (`StudyNote`, STUDIES-SPEC §7); in the Free Game
 * there is no brief and the page is exactly as above (R4).
 */

function entrance(reducedMotion: boolean) {
  // Reduced motion shortens the arrival and removes its travel; it does not
  // remove the continuity, because a card that simply appears reads as a glitch.
  return {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reducedMotion ? 0.14 : 0.28,
      ease: [0.22, 1, 0.36, 1],
    },
  } as const;
}

interface SlotCardProps {
  readonly slot: "top" | "second";
  readonly card: ColumnCard;
  readonly shared: readonly FacetId[] | null;
  readonly lensActive: boolean;
  readonly reducedMotion: boolean;
  readonly onCloseInspection: () => void;
}

/**
 * One bead's card in one slot. A glance catches nothing — it is read in
 * passing while the pointer rests on the bead, and it closes the moment the
 * pointer leaves — so it is transparent to the pointer; every other card is a
 * plate the player can point at, select and scroll.
 */
function SlotCard({
  slot,
  card,
  shared,
  lensActive,
  reducedMotion,
  onCloseInspection,
}: SlotCardProps) {
  return (
    <motion.figure
      data-testid={slot === "top" ? "focus-card-top" : "focus-card-second"}
      data-role={card.role}
      data-concept-id={card.concept.id}
      data-detail={card.detail}
      {...entrance(reducedMotion)}
      className={card.detail === "glance" ? "pointer-events-none m-0 w-full" : READING_PLATE}
    >
      {card.detail === "compact" ? (
        <BeadCompact concept={card.concept} role={card.role} shared={shared} />
      ) : (
        <BeadDetails
          concept={card.concept}
          lensActive={lensActive}
          shared={shared}
          onClose={card.detail === "full" ? onCloseInspection : undefined}
        />
      )}
    </motion.figure>
  );
}

/**
 * THE GAP (I-018). An empty slot the size of a card, with a faint outline: the
 * invitation is the shape of what is missing. Its one line of help appears
 * only after hesitation (I-013) — `hintShown` is the gap's own clock, never a
 * timer of this component's.
 */
function GapSlot({
  hintShown,
  reducedMotion,
}: {
  readonly hintShown: boolean;
  readonly reducedMotion: boolean;
}) {
  return (
    <div
      data-testid="focus-gap"
      className="pointer-events-none flex min-h-[7.5rem] w-full items-center justify-center border border-dashed border-line/50 px-4 py-3"
    >
      {hintShown && (
        <motion.p
          data-testid="focus-gap-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reducedMotion ? 0.14 : 0.6, ease: "easeOut" }}
          className="text-center font-display text-body italic text-faint"
        >
          {GAP_HINT}
        </motion.p>
      )}
    </div>
  );
}

/** The reading being heard on the locked pair, named once, in the sigil's own words. */
function ReadingLineView({ intention }: { readonly intention: RelationIntention }) {
  const line = readingLine(intention);
  return (
    <p
      data-testid="focus-reading"
      data-intention={intention}
      className="flex items-baseline gap-2 font-display text-lead italic leading-snug text-vellum"
    >
      <span aria-hidden="true" className="not-italic text-brass">
        {line.glyph}
      </span>
      <span>{line.text}</span>
    </p>
  );
}

type SlotsPlan = Extract<ColumnPlan, { kind: "slots" }>;

interface FocusSlotsProps {
  readonly plan: SlotsPlan;
  readonly hintShown: boolean;
  readonly lensActive: boolean;
  readonly reducedMotion: boolean;
  readonly onCloseInspection: () => void;
  readonly onStepBack: () => void;
}

function FocusSlots({
  plan,
  hintShown,
  lensActive,
  reducedMotion,
  onCloseInspection,
  onStepBack,
}: FocusSlotsProps) {
  const { top, second } = plan;
  const pairCard = second !== null && second !== "gap" ? second : null;
  const cards = (
    <>
      {top !== null && (
        <SlotCard
          key={`top:${top.concept.id}`}
          slot="top"
          card={top}
          shared={plan.shared}
          lensActive={lensActive}
          reducedMotion={reducedMotion}
          onCloseInspection={onCloseInspection}
        />
      )}
      {second === "gap" && (
        <GapSlot key="second:gap" hintShown={hintShown} reducedMotion={reducedMotion} />
      )}
      {pairCard !== null && (
        <SlotCard
          key={`second:${pairCard.concept.id}`}
          slot="second"
          card={pairCard}
          shared={plan.shared}
          lensActive={lensActive}
          reducedMotion={reducedMotion}
          onCloseInspection={onCloseInspection}
        />
      )}
    </>
  );
  /* Two compact cards stand side by side at the foot of a phone, so the pair
     costs one card's height and the bead lower-left is not covered; on a wide
     page, and whenever a card is open in full, they stand one above the other. */
  const sideBySide =
    top !== null && second !== null && top.detail === "compact" && pairCard?.detail !== "full";

  return (
    <>
      {(top !== null || second !== null) && (
        <div
          className={
            sideBySide
              ? "grid w-full grid-cols-2 items-start gap-4 md:grid-cols-1 md:gap-6"
              : "grid w-full grid-cols-1 gap-5 md:gap-6"
          }
        >
          {cards}
        </div>
      )}
      {plan.shared !== null && plan.shared.length === 0 && (
        <p
          data-testid="focus-nothing-shared"
          className="font-display text-body italic leading-snug text-dim"
        >
          {NOTHING_SHARED}
        </p>
      )}
      {plan.reading !== null && <ReadingLineView intention={plan.reading} />}
      {/* The column's own way back, one step at a time (I-010, I-016). Touch
          has no Escape key, and I-011 gives it a visible target rather than a
          background tap; everyone else gets the same quiet mark. */}
      {plan.stepBack && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="focus-step-back"
            onClick={onStepBack}
            className={QUIET_CONTROL}
          >
            Step back
          </button>
        </div>
      )}
    </>
  );
}

export interface ColumnSurfaceProps {
  readonly plan: ColumnPlan;
  readonly margin: MarginState;
  /** The gap's line may be shown: three seconds of the gap standing open. */
  readonly hintShown: boolean;
  readonly lensActive: boolean;
  readonly reducedMotion: boolean;
  readonly onCloseInspection: () => void;
  readonly onStepBack: () => void;
  readonly onSetAside: () => void;
  readonly onReopen: (id: string) => void;
  readonly onToggleIndex: () => void;
  readonly onReadMore: () => void;
  readonly onReadLess: () => void;
  /** The Study being played, as its brief's note; absent in the Free Game. */
  readonly study?: StudyNoteModel | null;
  /** Sets the brief aside, or reopens it. */
  readonly onToggleBrief?: () => void;
}

const NOTHING_TO_TOGGLE = (): void => undefined;

/**
 * The column with no store attached, so every state of the focus view can be
 * rendered and read. `ArenaColumn` is the subscription and nothing else.
 */
export function ColumnSurface({
  plan,
  margin,
  hintShown,
  lensActive,
  reducedMotion,
  onCloseInspection,
  onStepBack,
  onSetAside,
  onReopen,
  onToggleIndex,
  onReadMore,
  onReadLess,
  study = null,
  onToggleBrief = NOTHING_TO_TOGGLE,
}: ColumnSurfaceProps) {
  const register = plan.kind === "inspection" ? "none" : plan.margin;
  const cardsWritten =
    plan.kind === "inspection" || plan.top !== null || plan.second !== null;
  const readingWritten = register !== "none" && openReading(margin) !== null;
  const briefWritten = study !== null && (study.open || study.notYet !== null);

  // While the Lens is open it owns the page, as it always has: nothing is
  // written in the column but a bead the player is looking at. (A Study has
  // no Lens, and its brief is never taken off the page.)
  if (lensActive && !cardsWritten && study === null) return null;

  return (
    <ReadingColumn
      label="The margin"
      testId="focus-column"
      lit={cardsWritten || readingWritten || briefWritten}
    >
      <div
        className={READING_STACK}
        data-mode={plan.kind === "inspection" ? "inspection" : plan.mode}
      >
        {study !== null && (
          <StudyNote
            note={study}
            reducedMotion={reducedMotion}
            onToggleBrief={onToggleBrief}
          />
        )}
        {plan.kind === "inspection" ? (
          <BeadPlate
            concept={plan.concept}
            lensActive={lensActive}
            onClose={onCloseInspection}
            reducedMotion={reducedMotion}
          />
        ) : (
          <FocusSlots
            plan={plan}
            hintShown={hintShown}
            lensActive={lensActive}
            reducedMotion={reducedMotion}
            onCloseInspection={onCloseInspection}
            onStepBack={onStepBack}
          />
        )}
        {register !== "none" && (
          <MarginSurface
            state={margin}
            register={register}
            reducedMotion={reducedMotion}
            onSetAside={onSetAside}
            onReopen={onReopen}
            onToggleIndex={onToggleIndex}
            onReadMore={onReadMore}
            onReadLess={onReadLess}
          />
        )}
      </div>
    </ReadingColumn>
  );
}

/**
 * The arena's column: the focus view, the pinned inspection and the margin's
 * memory, read once and handed to `ColumnSurface`. Stays mounted for the whole
 * arena, so the margin's readings survive the Lens opening and closing.
 *
 * In a Study it also reads which Study is being played and its last *not yet*
 * from the Study store, and holds whether the brief is open. A new Study
 * session remounts it (`ArenaHud`), so a restarted Study opens with its brief
 * open and its margin clean.
 */
export function ArenaColumn() {
  const view = useFocusView();
  const pinnedInspectId = useStore((state) => state.pinnedInspectId);
  const lensActive = useStore((state) => state.lensActive);
  const reducedMotion = useStore((state) => state.settings.reducedMotion);
  const setFocusedBead = useStore((state) => state.setFocusedBead);
  const [margin, marginActions] = useMarginState();
  // Held while the page leaves, so the brief does not lift off a fading column.
  const studyId = useHeldWhileLeaving(useStudy((state) => state.studyId));
  const notYet = useHeldWhileLeaving(useStudy((state) => state.notYet));
  const [briefOpen, setBriefOpen] = useState(true);
  const study = useMemo(
    () => (studyId === null ? null : studyNote(studyId, notYet, briefOpen)),
    [studyId, notYet, briefOpen]
  );
  const toggleBrief = useCallback(() => setBriefOpen((open) => !open), []);

  const plan = planColumn({ view, pinnedInspectId, lensActive });
  const gapFor =
    plan.kind === "slots" && plan.second === "gap" && plan.top !== null
      ? plan.top.concept.id
      : null;
  const hintShown = useGapHint(gapFor);

  const closeInspection = useCallback(() => {
    productionInterpretation.closeInspection();
    setFocusedBead(null);
  }, [setFocusedBead]);
  const stepBack = useCallback(() => {
    productionInterpretation.cancel();
  }, []);

  return (
    <ColumnSurface
      plan={plan}
      margin={margin}
      hintShown={hintShown}
      lensActive={lensActive}
      reducedMotion={reducedMotion}
      onCloseInspection={closeInspection}
      onStepBack={stepBack}
      onSetAside={marginActions.setAside}
      onReopen={marginActions.reopen}
      onToggleIndex={marginActions.toggleIndex}
      onReadMore={marginActions.readMore}
      onReadLess={marginActions.readLess}
      study={study}
      onToggleBrief={toggleBrief}
    />
  );
}
