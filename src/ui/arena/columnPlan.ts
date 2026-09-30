import type { RelationIntention } from "@/domain/events";
import type { ConceptId } from "@/domain/ids";
import { INTENTION_LABELS, sharedFacetsOf } from "@/domain/outcomes";
import type { CommittedThreadV1 } from "@/domain/model";
import { castaliaConceptById } from "@/content/castalia";
import type { CastaliaConcept, FacetId } from "@/content/castalia/schema";
import { intentionVocabularyOf } from "@/game/intentions";
import type { ProductionInterpretation } from "@/runtime/interpretation";
import type {
  FocusColumnSlot,
  FocusMode,
  FocusView,
} from "@/runtime/interactionDraft";
import { castaliaLookup } from "@/runtime/content/castaliaLookup";
import { inspectedConcept } from "../components/inspection";

/**
 * THE COLUMN OF THE FOCUS VIEW — what it holds, decided once (I-015 … I-019).
 *
 * `deriveFocusView` already decides *which* beads the column is about and in
 * what role; the fog, the lens and the test adapter read the same derivation,
 * so none of them can disagree with the cards. This module adds only what the
 * column itself must decide, with no DOM attached so every state can be
 * asserted directly:
 *
 *  - which authored concept each slot shows, and how much of it — a glance
 *    while roaming, a compact card in the focus view, the full card when the
 *    player has asked for it by name;
 *  - which facets both beads carry, from the pack's own facets through the
 *    domain's one definition of "shared" (`sharedFacetsOf`), so the cards and
 *    the captions light exactly the same facets;
 *  - the one line that names the reading being heard;
 *  - whether the margin writes its whole page, only the thread card of a
 *    reopened thread, or nothing while the pair is being composed or a glance
 *    holds the page.
 *
 * HONESTY (I-018, CAV-004). Lit facets are public structure: anyone can read
 * both cards and see them. Nothing here knows a band, a fit, a documented
 * relation, a count or a score, so nothing the column is given can rank a bead
 * or hint at what the record holds. That is a property of the inputs, not a
 * promise of the markup.
 */

/** After this long with the gap still open, the gap says what it is for. */
export const GAP_HINT_DELAY_MS = 3000;

/**
 * The one line of help the focus view has, and it waits for hesitation before
 * it speaks (I-013, I-018): never sooner than `GAP_HINT_DELAY_MS`.
 */
export const GAP_HINT = "Find a second bead.";

/** Said plainly when the pair shares nothing, rather than left as a silence. */
export const NOTHING_SHARED = "These two share no facet Castalia knows.";

export type CardRole = "dwell" | "attended" | "sighted" | "candidate" | "held";

/**
 * How much of a bead a card says.
 *
 *  - `glance`: a dwelt-on bead while roaming — the whole authored card, read
 *    in passing, with nothing on it to press;
 *  - `compact`: a bead in the focus view — faculty and kind, name, caption and
 *    facets, which is what the pair is composed from;
 *  - `full`: a bead the player asked to read by name, with its description,
 *    its dates and the control that sets it aside.
 */
export type CardDetail = "glance" | "compact" | "full";

export interface ColumnCard {
  readonly conceptId: ConceptId;
  readonly concept: CastaliaConcept;
  readonly role: CardRole;
  readonly detail: CardDetail;
}

/** What the margin writes beneath the cards. */
export type MarginRegister =
  /** The whole margin: the open reading, the index, the way back in. */
  | "page"
  /** Only the reading on the page — the thread card of a reopened thread. */
  | "held"
  /**
   * Nothing: the pair is being composed, a glance holds the page for as long
   * as the look lasts, or the Lens has the page.
   */
  | "none";

export type ColumnPlan =
  | Readonly<{
      kind: "inspection";
      /** A pinned bead outside the column's own: it takes the column alone. */
      concept: CastaliaConcept;
    }>
  | Readonly<{
      kind: "slots";
      mode: FocusMode;
      top: ColumnCard | null;
      second: ColumnCard | "gap" | null;
      /**
       * Facets both beads carry, in the domain's order; empty when they share
       * none; null while there are not two beads on the page to compare.
       */
      shared: readonly FacetId[] | null;
      /** The reading being heard on a locked pair — a preview, not a choice. */
      reading: RelationIntention | null;
      margin: MarginRegister;
      /** The column's visible way back: one step, never a durable event. */
      stepBack: boolean;
    }>;

export interface ColumnInput {
  readonly view: FocusView;
  readonly pinnedInspectId: string | null;
  readonly lensActive: boolean;
}

function cardFor(
  slot: FocusColumnSlot,
  pinned: CastaliaConcept | null
): ColumnCard | null {
  if (slot.kind !== "bead") return null;
  const concept = castaliaConceptById.get(String(slot.conceptId));
  // An id the pack cannot resolve draws nothing rather than a bare id.
  if (concept === undefined) return null;
  const detail: CardDetail =
    slot.role === "dwell"
      ? "glance"
      : pinned !== null && pinned.id === concept.id
        ? "full"
        : "compact";
  return Object.freeze({ conceptId: slot.conceptId, concept, role: slot.role, detail });
}

const NO_FACETS: readonly FacetId[] = Object.freeze([]);

/**
 * The column, planned from the focus view and the pinned inspection. Pure and
 * deterministic: the same view always plans the same column.
 */
export function planColumn({ view, pinnedInspectId, lensActive }: ColumnInput): ColumnPlan {
  const pinned = inspectedConcept(pinnedInspectId);
  const top = cardFor(view.column.top, pinned);
  const second: ColumnCard | "gap" | null =
    view.column.second.kind === "gap" ? "gap" : cardFor(view.column.second, pinned);

  if (pinned !== null) {
    // A pinned bead wins over a glance, and opens in full where it already
    // stands when it is one of the pair; anything else takes the column alone.
    const standing =
      view.mode !== "roaming" &&
      (top?.concept.id === pinned.id ||
        (second !== null && second !== "gap" && second.concept.id === pinned.id));
    if (!standing) return Object.freeze({ kind: "inspection", concept: pinned });
  }

  const pair = top !== null && second !== null && second !== "gap" ? second : null;
  const shared =
    top !== null && pair !== null
      ? sharedFacetsOf(top.conceptId, pair.conceptId, castaliaLookup)
      : null;

  return Object.freeze({
    kind: "slots",
    mode: view.mode,
    top,
    second,
    shared: shared === null ? null : shared.length === 0 ? NO_FACETS : shared,
    reading: view.mode === "locked" ? view.previewIntention : null,
    margin: marginRegister(view.mode, top !== null, lensActive),
    stepBack: view.mode !== "roaming",
  });
}

/**
 * What the margin may write beneath the cards.
 *
 * A GLANCE HOLDS THE PAGE FOR AS LONG AS THE LOOK LASTS. While roaming, a
 * dwelt-on bead's card takes the head of the column, and the margin is not
 * drawn beneath it — not closed, only not drawn: its reading is still open in
 * `marginState`, and it is back in the same place the moment the dwell ends.
 * Stacked instead, every deliberate rest of the pointer on a bead would push
 * the thread card a card's height down the page and pull it back up again,
 * and a reading that moves while it is being read is a reading nobody
 * finishes. The thread card still stays until the player's next act (I-018);
 * a look is not an act.
 */
function marginRegister(
  mode: FocusMode,
  glancing: boolean,
  lensActive: boolean
): MarginRegister {
  if (lensActive) return "none";
  if (mode === "roaming") return glancing ? "none" : "page";
  return mode === "held" ? "held" : "none";
}

/** The glyph, name and first-use phrase of a reading (I-007), from the one vocabulary. */
export interface ReadingLine {
  readonly glyph: string;
  readonly text: string;
}

/**
 * "Echo — shares a form": the reading being heard, named in the words the
 * sigil itself uses. No fit, no recommendation, no comparison with the other
 * three — nothing on this line can say which reading the record prefers.
 */
export function readingLine(intention: RelationIntention): ReadingLine {
  const vocabulary = intentionVocabularyOf(intention);
  return Object.freeze({
    glyph: vocabulary.icon,
    text: `${vocabulary.label} — ${vocabulary.description}`,
  });
}

/** How a card is introduced to a screen reader; position says it to the eye. */
export const ROLE_LEAD: Readonly<Record<CardRole, string>> = Object.freeze({
  dwell: "Bead",
  attended: "Attended",
  sighted: "Under the lens",
  candidate: "Second bead",
  held: "In this thread",
});

// ─── The gap's one line, and when it may be said ────────────────────────────

/** Timers, injected so the hint's timing can be proved with a fake clock. */
export interface HintTimers {
  readonly set: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  readonly clear: (handle: ReturnType<typeof setTimeout>) => void;
}

const GLOBAL_TIMERS: HintTimers = Object.freeze({
  set: (callback: () => void, ms: number) => setTimeout(callback, ms),
  clear: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
});

export interface GapHint {
  /**
   * Tell the clock where the gap stands: the attended bead's id while the gap
   * is open, null once a bead fills it or the view has moved on.
   */
  readonly observe: (gapFor: string | null) => void;
  readonly shown: () => boolean;
  readonly dispose: () => void;
}

/**
 * HESITATION, MEASURED ONCE.
 *
 * The gap is the invitation; the line only follows hesitation (I-013). So the
 * clock runs only while the gap is continuously open for one attended bead:
 * sighting a bead closes the gap and stops it, and every re-opening starts it
 * again from nothing, because a player sweeping the lens is looking, not
 * stuck. It is kept out of React so the three seconds can be asserted with a
 * fake clock rather than trusted.
 */
export function createGapHint(
  onChange: (shown: boolean) => void,
  timers: HintTimers = GLOBAL_TIMERS
): GapHint {
  let current: string | null = null;
  let shown = false;
  let handle: ReturnType<typeof setTimeout> | null = null;

  const stop = (): void => {
    if (handle === null) return;
    timers.clear(handle);
    handle = null;
  };
  const show = (value: boolean): void => {
    if (shown === value) return;
    shown = value;
    onChange(value);
  };

  return Object.freeze({
    observe: (gapFor: string | null) => {
      if (gapFor === current) return;
      stop();
      show(false);
      current = gapFor;
      if (gapFor === null) return;
      handle = timers.set(() => {
        handle = null;
        show(true);
      }, GAP_HINT_DELAY_MS);
    },
    shown: () => shown,
    dispose: () => {
      stop();
      current = null;
    },
  });
}

// ─── The mirror's list of woven threads (I-019) ─────────────────────────────

const nameOf = (id: ConceptId): string =>
  castaliaConceptById.get(String(id))?.name ?? String(id);

/**
 * "Fibonacci Sequence · Echo · Counterpoint" — the reading the player
 * composed, in the direction they composed it, exactly as the conclusion's
 * register names it. Never the outcome: the list is a way back to a thread,
 * not a summary of how it fared.
 */
export function wovenThreadLabel(
  thread: Pick<CommittedThreadV1, "pair" | "intention">
): string {
  return [
    nameOf(thread.pair[0]),
    INTENTION_LABELS[thread.intention],
    nameOf(thread.pair[1]),
  ].join(" · ");
}

/**
 * Activating a woven thread in the mirror reopens it — unless a weave is
 * being held, which no other activation may interrupt either.
 */
export function reopenWovenThread(
  interpretation: Pick<ProductionInterpretation, "isHolding" | "reopenThread">,
  threadId: CommittedThreadV1["id"]
): void {
  if (interpretation.isHolding()) return;
  interpretation.reopenThread(threadId);
}
