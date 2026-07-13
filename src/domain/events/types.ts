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

export const RELATION_INTENTIONS = ["echo", "passage", "tension", "ground"] as const;
export type RelationIntention = (typeof RELATION_INTENTIONS)[number];

export const INPUT_MODALITIES = [
  "mouse",
  "touch",
  "pen",
  "keyboard",
  "controller",
  "unknown",
] as const;
export type InputModality = (typeof INPUT_MODALITIES)[number];

export type ConceptPair = readonly [ConceptId, ConceptId];

export interface GestureProfile {
  readonly inputModality: InputModality;
  readonly durationMs?: number;
  readonly pathLengthViewport?: number;
  readonly curvature?: number;
  readonly averageSpeedViewportPerSecond?: number;
  readonly speedVariance?: number;
  readonly pressure?: number;
}

type EmptyPayload = Readonly<Record<string, never>>;

export interface SessionEventPayloadsV1 {
  readonly "session.started": {
    readonly seed: string;
    readonly contentPackVersion: ContentPackVersion;
    readonly worldId: WorldId;
    readonly conceptIds: readonly ConceptId[];
  };
  readonly "bead.attended": {
    readonly conceptId: ConceptId;
  };
  readonly "pair.selected": {
    readonly pair: ConceptPair;
  };
  readonly "relation.hypothesized": {
    readonly pair: ConceptPair;
    readonly intention: RelationIntention;
  };
  readonly "thread.committed": {
    readonly threadId: ThreadId;
    readonly pair: ConceptPair;
    readonly intention: RelationIntention;
    readonly gesture: GestureProfile;
  };
  readonly "documented-relation.revealed": {
    readonly threadId: ThreadId;
    readonly documentedRelationId: DocumentedRelationId;
  };
  readonly "open-thread.created": {
    readonly threadId: ThreadId;
    readonly openThreadId: OpenThreadId;
  };
  readonly "motif.completed": {
    readonly completionId: MotifCompletionId;
    readonly motifKindId: MotifKindId;
    readonly conceptIds: readonly ConceptId[];
    readonly threadIds: readonly ThreadId[];
  };
  readonly "attunement.entered": EmptyPayload;
  readonly "attunement.exited": EmptyPayload;
  readonly "session.concluded": EmptyPayload;
}

export type SessionEventTypeV1 = keyof SessionEventPayloadsV1;

export type SessionEventOfTypeV1<Type extends SessionEventTypeV1> = Readonly<{
  schemaVersion: 1;
  id: EventId;
  sessionId: SessionId;
  sequence: number;
  at: number;
  type: Type;
  payload: Readonly<SessionEventPayloadsV1[Type]>;
}>;

export type SessionEventV1 = {
  [Type in SessionEventTypeV1]: SessionEventOfTypeV1<Type>;
}[SessionEventTypeV1];

export type CreateSessionEventInputV1<Type extends SessionEventTypeV1> = Readonly<{
  sessionId: SessionId;
  sequence: number;
  at: number;
  type: Type;
  payload: SessionEventPayloadsV1[Type];
}>;

export type AnyCreateSessionEventInputV1 = {
  [Type in SessionEventTypeV1]: CreateSessionEventInputV1<Type>;
}[SessionEventTypeV1];
