import type { ConceptPair, RelationIntention } from "../../domain/events";
import type { ConceptId } from "../../domain/ids";

/**
 * The pair-first draft (I-016). The second bead is locked before the reading
 * is chosen, so both cards inform the verb; the durable batch was always
 * pair-first (`pair.selected` before `relation.hypothesized`), and now the
 * surface agrees with it.
 *
 * Sighting — the bead under the lens — is deliberately *not* a stage. It is a
 * look, not a decision, and it lives in presentation state.
 */
export const INTERPRETATION_DRAFT_STAGES = Object.freeze([
  "inactive",
  "attending",
  "locked",
  "reading",
] as const);

export type InterpretationDraftStage =
  (typeof INTERPRETATION_DRAFT_STAGES)[number];

export type InactiveInterpretationDraft = Readonly<{ stage: "inactive" }>;

export type AttendingInterpretationDraft = Readonly<{
  stage: "attending";
  attendedConceptId: ConceptId;
}>;

/** A second bead is fixed; no reading has been chosen yet. */
export type LockedInterpretationDraft = Readonly<{
  stage: "locked";
  attendedConceptId: ConceptId;
  candidateConceptId: ConceptId;
  pair: ConceptPair;
}>;

/** The pair and a chosen reading: the only draft a weave may commit. */
export type ReadingInterpretationDraft = Readonly<{
  stage: "reading";
  attendedConceptId: ConceptId;
  candidateConceptId: ConceptId;
  intention: RelationIntention;
  pair: ConceptPair;
}>;

export type InterpretationDraft =
  | InactiveInterpretationDraft
  | AttendingInterpretationDraft
  | LockedInterpretationDraft
  | ReadingInterpretationDraft;
