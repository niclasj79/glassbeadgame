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
import type { StudyMark } from "@/domain/studies/types";

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

/**
 * The bead settled under the lens while attending (I-017, I-018) — or none,
 * when the lens has left every bead and the gap is open again. Its band is the
 * same relation-neutral band `attention.enter` already published; its shared
 * facets are public structure. Neither says whether the pair is documented.
 */
export interface AttentionSightedPayload {
  readonly attendedConceptId: ConceptId;
  readonly sighted: Readonly<{
    conceptId: ConceptId;
    band: "weak" | "medium" | "high";
    sharedFacets: readonly FacetId[];
  }> | null;
}

/** A second bead fixed: the pair is the object of the act (I-016). */
export interface PairLockedPayload {
  readonly pair: ConceptPair;
  readonly sharedFacets: readonly FacetId[];
}

/**
 * A reading heard on the locked pair before it is made. `chosen` is false for
 * a pointer hovering a sigil and true once the reading is chosen (a press, or
 * keyboard focus on the radio). Nothing here says which reading the record
 * prefers; that is known only after commit.
 */
export interface ReadingPreviewedPayload {
  readonly pair: ConceptPair;
  readonly intention: RelationIntention;
  readonly chosen: boolean;
}

/** A committed thread opened again for reading (I-019). Changes nothing durable. */
export interface ThreadReopenedPayload {
  readonly threadId: ThreadId;
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

/**
 * A Study solved (STUDIES-SPEC §6, §7): one coordinated moment, staged after
 * the commit that completed the answer has settled, or at once for a declared
 * silence. It carries the form of the answer and nothing else — no outcome,
 * no documented flag — so no director can pay one kind of truth more than
 * another (R2, CAV-006).
 */
export interface StudySolvedPayload {
  readonly studyId: string;
  readonly by: "threads" | "silence";
  /** The player's answer, in line order. Empty for a silence. */
  readonly threadIds: readonly ThreadId[];
  /**
   * The answer's beads in the order its line reads them, so the world and the
   * score can answer at them without reading the session. Empty for a silence.
   */
  readonly conceptIds: readonly ConceptId[];
  /** Marks of form: words, never points. Empty for a silence. */
  readonly marks: readonly StudyMark[];
  /**
   * The brief as the margin shows it. The caption layer holds no Study, and
   * must not (the Studies load with the Studies), so the words travel here.
   */
  readonly brief: string;
}

/**
 * Silence declared on a Study that can be solved: "Not yet — it can be done
 * with these beads", and nothing more (STUDIES-SPEC §5). A caption and a
 * margin line; it never interrupts and never hints.
 */
export interface StudyNotYetPayload {
  readonly studyId: string;
  readonly statement: "can-be-done";
}

export interface CuePayloadMap {
  readonly "attention.enter": AttentionEnterPayload;
  readonly "attention.clear": Readonly<Record<string, never>>;
  readonly "attention.sighted": AttentionSightedPayload;
  readonly "pair.locked": PairLockedPayload;
  readonly "reading.previewed": ReadingPreviewedPayload;
  readonly "thread.reopened": ThreadReopenedPayload;
  readonly "weave.released": ThreadWovenPayload;
  readonly "thread.woven": ThreadWovenPayload;
  readonly "outcome.documented": DocumentedOutcomePayload;
  readonly "outcome.open-thread": OpenThreadOutcomePayload;
  readonly "outcome.unresolved": UnresolvedOutcomePayload;
  readonly "motif.completed": MotifCompletedPayload;
  readonly "attunement.changed": AttunementPayload;
  readonly "conclusion.perform": ConclusionPayload;
  readonly "study.solved": StudySolvedPayload;
  readonly "study.not-yet": StudyNotYetPayload;
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
