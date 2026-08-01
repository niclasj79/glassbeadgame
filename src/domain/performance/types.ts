import type { InputModality, RelationIntention } from "../events";
import type { ConceptId, SessionId, ThreadId } from "../ids";
import type { MotifKind } from "../motifs/types";
import type { ThreadOutcomeKind } from "../outcomes/types";
import type {
  MotifArticulation,
  MotifRegister,
  TimbreId,
} from "@/content/castalia/schema";

/**
 * THE CONCLUSION PERFORMANCE (VERTICAL-SLICE-SPEC §14).
 *
 * A pure data structure: an audio director and a scene director can render it
 * without adding a single rule of their own. Every decision that carries
 * meaning — which voice enters, when, transformed how, how loud, whether it
 * closes — is made here, from the event log, and written down.
 *
 * Times are given twice, in beats and in seconds, because the Web Audio clock
 * schedules in seconds while musical structure is stated in beats. Both derive
 * from one tempo, so they cannot drift apart.
 *
 * Three constraints are structural rather than editorial:
 *
 *  - Documented outcomes and Open Threads receive the *same* gain and the same
 *    duration (CAV-006). They differ in whether they close. The player must
 *    never learn to prefer one kind of truth because it sounds better.
 *  - Unresolved threads are short and quiet — that is what nothing-to-say
 *    sounds like — and are never dim, never grey, never a penalty.
 *  - The climax is located from the player's web. There is no threshold
 *    constant anywhere in this module that says "climax now".
 */

/** How a relation intention transforms the two concept motifs (§11, §18). */
export const INTENTION_TRANSFORMATIONS = Object.freeze([
  /** Echo: the answer restates the subject's rhythm at a staggered entry. */
  "imitation",
  /** Passage: the source's contour arrives in the destination's body. */
  "translation",
  /** Tension: the answer is displaced in pitch and in phase, and stays so. */
  "displacement",
  /** Ground: one voice becomes a pedal beneath the other. */
  "foundation",
] as const);
export type IntentionTransformation = (typeof INTENTION_TRANSFORMATIONS)[number];

export const VOICE_ROLES = Object.freeze([
  "subject",
  "answer",
  "ground",
  "ensemble",
  "residue",
] as const);
export type VoiceRole = (typeof VOICE_ROLES)[number];

/**
 * Gesture, normalised into phrasing (VERTICAL-SLICE-SPEC §9).
 *
 * Fields a modality cannot produce are 0.5 — neutral — not 0. A keyboard weave
 * has no path length; it is not a weak weave (I-009).
 */
export interface PhrasingProfile {
  readonly modality: InputModality;
  /** Sharpness of onset, from gesture speed. */
  readonly attack: number;
  /** Connectedness, from path curvature. */
  readonly legato: number;
  /** Elasticity of timing, from speed variance. */
  readonly rubato: number;
  /** Body, from pointer pressure. */
  readonly weight: number;
  /** Span of the phrase, from path length. */
  readonly breadth: number;
}

export interface PerformanceVoice {
  readonly conceptId: ConceptId;
  readonly role: VoiceRole;
  /** Scale degrees relative to the world mode, after transformation. */
  readonly degrees: readonly number[];
  /** Relative durations aligned to `degrees`, after transformation. */
  readonly rhythm: readonly number[];
  readonly register: MotifRegister;
  readonly articulation: MotifArticulation;
  readonly timbre: TimbreId;
  readonly atBeat: number;
  readonly atSeconds: number;
  readonly durationBeats: number;
  readonly durationSeconds: number;
  readonly gain: number;
  /** The line ends unclosed, on an unresolved degree (CAV-006). */
  readonly openEnded: boolean;
}

export interface PerformanceEntry {
  readonly threadId: ThreadId;
  /** Creation order. The performance follows it exactly. */
  readonly order: number;
  readonly sequence: number;
  readonly conceptIds: readonly [ConceptId, ConceptId];
  readonly intention: RelationIntention;
  readonly transformation: IntentionTransformation;
  readonly outcomeKind: ThreadOutcomeKind;
  readonly atBeat: number;
  readonly atSeconds: number;
  readonly durationBeats: number;
  readonly durationSeconds: number;
  readonly voices: readonly PerformanceVoice[];
  readonly dynamic: number;
  /** Web density at the moment this thread entered, 0–1. */
  readonly density: number;
  readonly phrasing: PhrasingProfile;
  /**
   * True when the authored material behind this entry speaks for the record.
   *
   * `outcomeKind === "documented"` does not answer this: an interpretive
   * relation is documented — the Game has something authored to say — but it is
   * the Game's own reading and asserts nothing beyond the two structures
   * compared. A surface that prints "the record" or "documented" must read this,
   * not the kind.
   */
  readonly speaksForRecord: boolean;
  /**
   * The entry closes. Open Threads, Tensions, and readings the Game merely
   * offers do not — closing is a claim that the record settled the matter.
   */
  readonly resolved: boolean;
  /** Structural weight in the final web. The climax is the maximum. */
  readonly weight: number;
  /**
   * This entry is the web's high point.
   *
   * Exactly one entry carries it, or none when nothing was woven. It is stated
   * on the entry as well as in `climax` because a renderer walks entries and
   * would otherwise have to re-derive the arrival by comparing thread ids — and
   * a renderer that has to re-derive something usually ends up not doing it.
   */
  readonly isClimax: boolean;
}

export const ENSEMBLE_STRUCTURES = Object.freeze([
  /** Canon: staggered entries of the same recurring figure. */
  "stagger",
  /** Dialectic: two opposed voices with a third beneath them. */
  "triad",
  /** Bridge: one voice spanning two registers that were separate. */
  "span",
] as const);
export type EnsembleStructure = (typeof ENSEMBLE_STRUCTURES)[number];

export interface PerformanceEnsemble {
  readonly key: string;
  readonly motifKind: MotifKind;
  readonly structure: EnsembleStructure;
  readonly atBeat: number;
  readonly atSeconds: number;
  readonly durationBeats: number;
  readonly durationSeconds: number;
  readonly conceptIds: readonly ConceptId[];
  readonly threadIds: readonly ThreadId[];
  readonly voices: readonly PerformanceVoice[];
  readonly reason: string;
}

/**
 * A Tension the web never took hold of. It keeps sounding to the end of the
 * performance, decaying to a low floor within the comfort bound accepted in
 * CAV-007 rather than either resolving or becoming an irritant.
 */
export interface UnresolvedVoice {
  readonly threadId: ThreadId;
  readonly conceptIds: readonly [ConceptId, ConceptId];
  readonly fromBeat: number;
  readonly fromSeconds: number;
  readonly gain: number;
  readonly floorGain: number;
  readonly decayToFloorSeconds: number;
  readonly reason: string;
}

export const CAMERA_HINT_KINDS = Object.freeze([
  "answer",
  "traverse",
  "hold",
  "settle",
  "gather",
  "widen",
  "rest",
] as const);
export type CameraHintKind = (typeof CAMERA_HINT_KINDS)[number];

export interface CameraHint {
  readonly atBeat: number;
  readonly atSeconds: number;
  readonly kind: CameraHintKind;
  readonly conceptIds: readonly ConceptId[];
  readonly threadId: ThreadId | null;
  /** Why the camera is being asked to do this. Never decorative. */
  readonly reason: string;
}

export interface PerformanceClimax {
  readonly threadId: ThreadId;
  readonly order: number;
  readonly atBeat: number;
  readonly atSeconds: number;
  readonly weight: number;
  /** Composed from what actually made this the web's heaviest moment. */
  readonly reason: string;
}

/**
 * THE LAST GESTURE (VERTICAL-SLICE-SPEC §14).
 *
 * A performance that merely runs out of entries does not end; it stops. The coda
 * is the one authored event that closes the reconstruction, and it is composed
 * of the *climax thread's own two motifs* — the web's heaviest moment, stated
 * once more as a single held sonority, so the ending is this session's ending
 * and not a stock cadence bolted onto every session alike.
 *
 * Whether it closes is not a matter of taste and not a reward:
 *
 *  - a web that left no Tension unheld closes, because there is nothing still
 *    ringing that closing would misrepresent;
 *  - a web that still carries a Tension nothing took hold of deliberately does
 *    NOT close. Ending such a session on a resolution would be the Game
 *    claiming a settlement the session never reached.
 *
 * It is the same length and the same weight either way (CAV-006). The two forms
 * differ in resolution, exactly as the outcomes they report on do.
 */
export interface PerformanceCoda {
  /** The climax thread, whose pair the coda is built from. */
  readonly threadId: ThreadId;
  readonly conceptIds: readonly [ConceptId, ConceptId];
  readonly atBeat: number;
  readonly atSeconds: number;
  readonly durationBeats: number;
  readonly durationSeconds: number;
  /** Two held voices: a ground, and the answer that arrives — or does not. */
  readonly voices: readonly PerformanceVoice[];
  /** False when the web still carries a Tension nothing took hold of. */
  readonly resolves: boolean;
  /** Why the performance ends the way it does. Never decorative, never praise. */
  readonly reason: string;
}

export interface ConclusionPerformance {
  readonly sessionId: SessionId;
  readonly seed: string;
  readonly tempoBpm: number;
  readonly beatsPerBar: number;
  readonly secondsPerBeat: number;
  readonly entries: readonly PerformanceEntry[];
  readonly ensembles: readonly PerformanceEnsemble[];
  readonly unresolved: readonly UnresolvedVoice[];
  readonly camera: readonly CameraHint[];
  /** Null only when nothing was woven. */
  readonly climax: PerformanceClimax | null;
  /**
   * The authored ending. Null only when nothing was woven — a session with no
   * threads has nothing of its own to close on, and inventing a cadence for it
   * would be fabricated significance.
   */
  readonly coda: PerformanceCoda | null;
  readonly totalBeats: number;
  readonly totalSeconds: number;
}
