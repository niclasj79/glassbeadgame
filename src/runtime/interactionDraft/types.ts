import type { ConceptPair, RelationIntention } from "../../domain/events";
import type { ConceptId } from "../../domain/ids";

export const INTERPRETATION_DRAFT_STAGES = Object.freeze([
  "inactive",
  "attending",
  "armed",
  "candidate-selected",
] as const);

export type InterpretationDraftStage =
  (typeof INTERPRETATION_DRAFT_STAGES)[number];

export type InactiveInterpretationDraft = Readonly<{ stage: "inactive" }>;

export type AttendingInterpretationDraft = Readonly<{
  stage: "attending";
  attendedConceptId: ConceptId;
}>;

export type ArmedInterpretationDraft = Readonly<{
  stage: "armed";
  attendedConceptId: ConceptId;
  intention: RelationIntention;
}>;

export type CandidateSelectedInterpretationDraft = Readonly<{
  stage: "candidate-selected";
  attendedConceptId: ConceptId;
  candidateConceptId: ConceptId;
  intention: RelationIntention;
  pair: ConceptPair;
}>;

export type InterpretationDraft =
  | InactiveInterpretationDraft
  | AttendingInterpretationDraft
  | ArmedInterpretationDraft
  | CandidateSelectedInterpretationDraft;
