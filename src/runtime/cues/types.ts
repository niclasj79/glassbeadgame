/**
 * PRESENTATION CUES — the one staging boundary (ADR-009).
 *
 * Domain events say what happened. Cues say how that meaning is staged, and
 * they exist so that a single semantic moment produces a single coordinated
 * response. The failure this prevents is specific and was visible in the
 * prototype: scene, audio, camera, and UI each subscribing independently to the
 * same store change and each approximating the moment slightly differently, so
 * the glass, the chord, and the camera arrive at three different times.
 *
 * A cue carries *meaning plus timing*, never rendering instructions. It says
 * "a documented relation of this evidence class resolved on this thread, over
 * 2.4 seconds, and the player's reading was refined rather than confirmed."
 * What that looks like belongs to the scene director; what it sounds like
 * belongs to the audio director. Neither may invent a rule the domain did not
 * state, and neither may decide the moment happened at a different time.
 */
import type {
  ConceptPair,
  GestureProfile,
  RelationIntention,
} from "@/domain/events";
import type {
  ConceptId,
  EventId,
  MotifKindId,
  ThreadId,
} from "@/domain/ids";
import type {
  DocumentedRelation,
  EvidenceClass,
  FacetId,
} from "@/content/castalia/schema";

/** How the authored relation received the player's declared reading (CAV-002). */
export type IntentionReception = "confirmed" | "refined" | "complicated";

export type CueChannel =
  | "scene"
  | "camera"
  | "audio"
  | "ui"
  | "haptics"
  | "caption";

// ─── Payloads ───────────────────────────────────────────────────────────────

export interface AttentionEnterPayload {
  readonly conceptId: ConceptId;
  /**
   * Relation-neutral candidate bands. Deliberately no strength number and no
   * documented flag: a preview may suggest possibility, never correctness.
   */
  readonly candidates: readonly {
    readonly conceptId: ConceptId;
    readonly band: "weak" | "medium" | "high";
  }[];
}

export interface IntentionArmedPayload {
  readonly conceptId: ConceptId;
  readonly intention: RelationIntention;
}

export interface CandidateLatchedPayload {
  readonly pair: ConceptPair;
  readonly intention: RelationIntention;
}

export interface ThreadWovenPayload {
  readonly threadId: ThreadId;
  readonly pair: ConceptPair;
  readonly intention: RelationIntention;
  /** Gesture shapes articulation and phrasing only — never intellectual validity. */
  readonly gesture: GestureProfile;
}

export interface DocumentedOutcomePayload {
  readonly threadId: ThreadId;
  readonly pair: ConceptPair;
  readonly intention: RelationIntention;
  readonly relation: DocumentedRelation;
  readonly evidence: EvidenceClass;
  readonly reception: IntentionReception;
}

export interface OpenThreadOutcomePayload {
  readonly threadId: ThreadId;
  readonly pair: ConceptPair;
  readonly intention: RelationIntention;
  /** The specific question this exact reading raises. Never generic praise. */
  readonly question: string;
  readonly sharedFacet: FacetId;
}

export interface UnresolvedOutcomePayload {
  readonly threadId: ThreadId;
  readonly pair: ConceptPair;
  readonly intention: RelationIntention;
  /** A short true statement that nothing is grounded here yet. */
  readonly statement: string;
}

export interface MotifCompletedPayload {
  readonly motifKindId: MotifKindId;
  readonly conceptIds: readonly ConceptId[];
  readonly threadIds: readonly ThreadId[];
  /** Why this motif formed, in the player's terms. */
  readonly reason: string;
}

export interface AttunementPayload {
  readonly active: boolean;
}

export interface ConclusionPayload {
  /**
   * The compiled performance, produced by the domain from the event log. The
   * directors render it; they do not recompute it, so the conclusion cannot
   * drift from the session that produced it.
   */
  readonly performance: unknown;
}

export interface CuePayloadMap {
  readonly "attention.enter": AttentionEnterPayload;
  readonly "attention.clear": Readonly<Record<string, never>>;
  readonly "intention.armed": IntentionArmedPayload;
  readonly "candidate.latched": CandidateLatchedPayload;
  readonly "weave.released": ThreadWovenPayload;
  readonly "thread.woven": ThreadWovenPayload;
  readonly "outcome.documented": DocumentedOutcomePayload;
  readonly "outcome.open-thread": OpenThreadOutcomePayload;
  readonly "outcome.unresolved": UnresolvedOutcomePayload;
  readonly "motif.completed": MotifCompletedPayload;
  readonly "attunement.changed": AttunementPayload;
  readonly "conclusion.perform": ConclusionPayload;
}

export type CueType = keyof CuePayloadMap;

export type PresentationCueOfType<Type extends CueType> = Readonly<{
  readonly id: string;
  readonly type: Type;
  /**
   * The domain event this stages, or null for cues that stage an ephemeral
   * draft transition. Ephemeral cues never imply a durable mutation.
   */
  readonly sourceEventId: EventId | null;
  /** Seconds after the plan is published. Directors must honour this exactly. */
  readonly startAt: number;
  readonly duration: number;
  /** Which directors should act. A cue with no channels is a bug, not a no-op. */
  readonly channels: readonly CueChannel[];
  readonly payload: CuePayloadMap[Type];
}>;

export type PresentationCue = {
  [Type in CueType]: PresentationCueOfType<Type>;
}[CueType];

/** One coordinated response to one semantic moment. */
export interface CuePlan {
  readonly id: string;
  readonly cues: readonly PresentationCue[];
  /** Total span, so a director can reserve time without scanning every cue. */
  readonly duration: number;
}
