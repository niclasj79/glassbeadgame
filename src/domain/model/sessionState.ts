import type {
  ConceptPair,
  GestureProfile,
  RelationIntention,
} from "../events";
import type {
  ConceptId,
  ContentPackVersion,
  DocumentedRelationId,
  EventId,
  MotifCompletionId,
  MotifKindId,
  OpenThreadId,
  SessionId,
  ThreadId,
  WorldId,
} from "../ids";

export interface RelationHypothesisV1 {
  readonly pair: ConceptPair;
  readonly intention: RelationIntention;
}

export interface CommittedThreadV1 {
  readonly id: ThreadId;
  readonly pair: ConceptPair;
  readonly intention: RelationIntention;
  readonly gesture: GestureProfile;
  readonly eventId: EventId;
  readonly sequence: number;
  readonly committedAt: number;
}

export interface DocumentedRelationOutcomeV1 {
  readonly type: "documented-relation";
  readonly eventId: EventId;
  readonly sequence: number;
  readonly revealedAt: number;
  readonly threadId: ThreadId;
  readonly documentedRelationId: DocumentedRelationId;
}

export interface OpenThreadOutcomeV1 {
  readonly type: "open-thread";
  readonly eventId: EventId;
  readonly sequence: number;
  readonly createdAt: number;
  readonly threadId: ThreadId;
  readonly openThreadId: OpenThreadId;
}

export type ThreadOutcomeV1 = DocumentedRelationOutcomeV1 | OpenThreadOutcomeV1;

export interface CompletedMotifV1 {
  readonly eventId: EventId;
  readonly sequence: number;
  readonly completedAt: number;
  readonly completionId: MotifCompletionId;
  readonly motifKindId: MotifKindId;
  readonly conceptIds: readonly ConceptId[];
  readonly threadIds: readonly ThreadId[];
}

export interface SessionStateV1 {
  readonly sessionId: SessionId;
  readonly seed: string;
  readonly contentPackVersion: ContentPackVersion;
  readonly worldId: WorldId;
  readonly conceptIds: readonly ConceptId[];
  readonly lastSequence: number;
  readonly at: number;
  readonly attendedConceptId: ConceptId | null;
  readonly selectedPair: ConceptPair | null;
  readonly hypothesis: RelationHypothesisV1 | null;
  readonly threads: readonly CommittedThreadV1[];
  readonly outcomes: readonly ThreadOutcomeV1[];
  readonly completedMotifs: readonly CompletedMotifV1[];
  readonly attunementActive: boolean;
  readonly concluded: boolean;
}
