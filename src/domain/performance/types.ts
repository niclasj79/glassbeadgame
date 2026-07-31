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
  /** The entry closes. Open Threads and Tensions do not. */
  readonly resolved: boolean;
  /** Structural weight in the final web. The climax is the maximum. */
  readonly weight: number;
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
  readonly totalBeats: number;
  readonly totalSeconds: number;
}
