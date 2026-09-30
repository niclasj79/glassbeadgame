import type { ConceptPair, RelationIntention } from "../../domain/events";
import type { ConceptId, ThreadId } from "../../domain/ids";
import type { QualityTier } from "../../lib/device";
import type { InterpretationDraft } from "./types";

/**
 * THE FOCUS VIEW — one derivation for every surface (I-015 … I-020).
 *
 * The fog, the lens, the sharp beads, the two cards in the right column and the
 * test adapter all answer the same question — "what is the player attending
 * to right now?" — and they must never answer it differently. So they do not
 * answer it at all: they read this pure function of the draft and a handful of
 * presentation facts.
 *
 * Nothing here knows a band, a facet, a documented relation or a pixel. What
 * glows through the fog, and how brightly, belongs to the renderer; what the
 * cards say belongs to the column. This decides only *which* state the world
 * is in and *which* beads the state is about.
 *
 *   roaming  nothing attended; a dwelt-on bead may show its card
 *   focus    one bead attended; the lens sights the second; the gap waits
 *   locked   a pair fixed (with or without a chosen reading); sigils bloom
 *   held     a committed thread reopened for reading; nothing is being made
 */
export type FocusMode = "roaming" | "focus" | "locked" | "held";

export type FocusColumnSlot =
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "gap" }>
  | Readonly<{
      kind: "bead";
      conceptId: ConceptId;
      role: "dwell" | "attended" | "sighted" | "candidate" | "held";
    }>;

export interface FocusViewProfile {
  readonly reducedMotion: boolean;
  readonly qualityTier: QualityTier;
}

export interface FocusViewInput {
  readonly draft: InterpretationDraft;
  /** The settled bead under the lens while attending. */
  readonly sightedConceptId: ConceptId | null;
  /** A bead dwelt on while roaming (I-015). */
  readonly dwellConceptId: ConceptId | null;
  /** A reading previewed by pointer hover over a sigil (not a choice). */
  readonly previewIntention: RelationIntention | null;
  /** A committed thread reopened for reading (I-019). */
  readonly reopened: Readonly<{ threadId: ThreadId; pair: ConceptPair }> | null;
  /** A weave hold is in progress. */
  readonly holding: boolean;
  readonly profile: FocusViewProfile;
}

export interface FocusView {
  readonly mode: FocusMode;
  /**
   * The fog. `blur` is the softening; it is withheld under reduced motion and
   * on the engraved low tier, where the fog is dim-only (I-017).
   */
  readonly fog: Readonly<{ active: boolean; blur: boolean }>;
  /** The pointer is a lens only while sighting, and never during a hold. */
  readonly lensActive: boolean;
  /** Beads that stay fully sharp and lit through the fog. */
  readonly sharpConceptIds: readonly ConceptId[];
  readonly attendedConceptId: ConceptId | null;
  /** Sighted (focus), candidate (locked) or the second bead of a held thread. */
  readonly secondConceptId: ConceptId | null;
  /** The reading being heard: the chosen one, else a hovered preview. */
  readonly previewIntention: RelationIntention | null;
  readonly sigilsVisible: boolean;
  readonly reopenedThreadId: ThreadId | null;
  readonly column: Readonly<{ top: FocusColumnSlot; second: FocusColumnSlot }>;
}

const EMPTY: FocusColumnSlot = Object.freeze({ kind: "empty" });
const GAP: FocusColumnSlot = Object.freeze({ kind: "gap" });
const NO_BEADS: readonly ConceptId[] = Object.freeze([]);

function bead(
  conceptId: ConceptId,
  role: "dwell" | "attended" | "sighted" | "candidate" | "held"
): FocusColumnSlot {
  return Object.freeze({ kind: "bead", conceptId, role });
}

function fogFor(profile: FocusViewProfile): FocusView["fog"] {
  return Object.freeze({
    active: true,
    blur: !profile.reducedMotion && profile.qualityTier !== "potato",
  });
}

const CLEAR_FOG: FocusView["fog"] = Object.freeze({ active: false, blur: false });

export function deriveFocusView(input: FocusViewInput): FocusView {
  const { draft, profile } = input;

  if (draft.stage === "attending") {
    const sighted =
      input.sightedConceptId !== null &&
      input.sightedConceptId !== draft.attendedConceptId
        ? input.sightedConceptId
        : null;
    return Object.freeze({
      mode: "focus",
      fog: fogFor(profile),
      lensActive: !input.holding,
      sharpConceptIds: Object.freeze(
        sighted === null
          ? [draft.attendedConceptId]
          : [draft.attendedConceptId, sighted]
      ),
      attendedConceptId: draft.attendedConceptId,
      secondConceptId: sighted,
      previewIntention: null,
      sigilsVisible: false,
      reopenedThreadId: null,
      column: Object.freeze({
        top: bead(draft.attendedConceptId, "attended"),
        second: sighted === null ? GAP : bead(sighted, "sighted"),
      }),
    });
  }

  if (draft.stage === "locked" || draft.stage === "reading") {
    return Object.freeze({
      mode: "locked",
      fog: fogFor(profile),
      lensActive: false,
      sharpConceptIds: Object.freeze([
        draft.attendedConceptId,
        draft.candidateConceptId,
      ]),
      attendedConceptId: draft.attendedConceptId,
      secondConceptId: draft.candidateConceptId,
      previewIntention:
        draft.stage === "reading" ? draft.intention : input.previewIntention,
      sigilsVisible: true,
      reopenedThreadId: null,
      column: Object.freeze({
        top: bead(draft.attendedConceptId, "attended"),
        second: bead(draft.candidateConceptId, "candidate"),
      }),
    });
  }

  if (input.reopened !== null) {
    const [first, second] = input.reopened.pair;
    return Object.freeze({
      mode: "held",
      fog: fogFor(profile),
      lensActive: false,
      sharpConceptIds: Object.freeze([first, second]),
      attendedConceptId: first,
      secondConceptId: second,
      previewIntention: null,
      sigilsVisible: false,
      reopenedThreadId: input.reopened.threadId,
      column: Object.freeze({
        top: bead(first, "held"),
        second: bead(second, "held"),
      }),
    });
  }

  return Object.freeze({
    mode: "roaming",
    fog: CLEAR_FOG,
    lensActive: false,
    sharpConceptIds: NO_BEADS,
    attendedConceptId: null,
    secondConceptId: null,
    previewIntention: null,
    sigilsVisible: false,
    reopenedThreadId: null,
    column: Object.freeze({
      top: input.dwellConceptId === null ? EMPTY : bead(input.dwellConceptId, "dwell"),
      second: EMPTY,
    }),
  });
}
