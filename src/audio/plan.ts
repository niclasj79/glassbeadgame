/**
 * THE VOICE PLAN — what the audio layer decides, written down before it sounds.
 *
 * Every musical decision in this module is made as data first and scheduled
 * second. That split is what makes the grammar testable: `planRelationVoices()`
 * returns a `VoicePlan` in a Node test with no AudioContext anywhere, and the
 * scheduler's only job is to be a faithful, boring renderer of it.
 *
 * It is also what makes the accessible paths first-class rather than fallbacks.
 * A caption is generated from the same plan the synthesiser receives, so a muted
 * player and a hearing player are told the same thing by construction — there is
 * no second code path that could drift into saying less.
 *
 * Pure. No Web Audio, no browser, no React.
 */
import type {
  MotifArticulation,
  MotifRegister,
  TimbreId,
} from "@/content/castalia/schema";
import type { RelationIntention } from "@/domain/events";
import { COMFORT, tensionCeiling } from "./comfort";

export const AUDIO_VOICE_ROLES = Object.freeze([
  /** The line that states the figure first. */
  "subject",
  /** The line that answers it — imitation, destination, or suspension. */
  "answer",
  /** The invariant base a Ground sits on. */
  "pedal",
  /** Harmonic reinforcement of a pedal. */
  "ground",
  /** The detuned twin that produces controlled beating. */
  "shadow",
  /** A completed motif's ensemble voice, or a conclusion ensemble. */
  "ensemble",
  /** What is left sounding after the phrase: a handoff tail, an open end. */
  "residue",
] as const);
export type AudioVoiceRole = (typeof AUDIO_VOICE_ROLES)[number];

export const VOICE_PLAN_KINDS = Object.freeze([
  "relation",
  "attention",
  "attunement",
  "conclusion",
  "ensemble",
] as const);
export type VoicePlanKind = (typeof VOICE_PLAN_KINDS)[number];

/**
 * The three epistemic states an outcome can be in (CAV-006). They differ in
 * *resolution*, never in reward — but they are genuinely different states, and
 * a muted player must be able to tell them apart, because for them the caption
 * track is the experience.
 */
export const AUDIO_OUTCOME_KINDS = Object.freeze([
  /** The record carries this relation. The figure closes. */
  "documented",
  /** A specific question, held open. Same weight, but unclosed. */
  "open-thread",
  /** No grounded relation yet. Quiet and short — never dim, never grey. */
  "unresolved",
] as const);
export type AudioOutcomeKind = (typeof AUDIO_OUTCOME_KINDS)[number];

/**
 * Three segments, in seconds. Their sum is the voice's whole life — there is no
 * open-ended sustain anywhere in this module, which is how "every voice has a
 * bounded lifetime" (ARCHITECTURE §10) is guaranteed structurally instead of by
 * remembering to stop things.
 */
export interface VoiceEnvelope {
  readonly attack: number;
  readonly hold: number;
  readonly release: number;
}

export interface PlannedNote {
  /** Unique within the plan. Stable across replays of the same plan. */
  readonly id: string;
  /** The concept this voice speaks for, or null for structural voices. */
  readonly conceptId: string | null;
  readonly role: AudioVoiceRole;
  readonly timbre: TimbreId;
  readonly articulation: MotifArticulation;
  readonly register: MotifRegister;
  /** Semitone offset from the mode's tonic, before detuning. */
  readonly degree: number;
  /** Resolved through the world mode. Hz. */
  readonly frequency: number;
  /** Deliberate mistuning on top of the mode pitch. Carries beating. */
  readonly detuneCents: number;
  readonly atSeconds: number;
  readonly envelope: VoiceEnvelope;
  readonly gain: number;
  /**
   * Level the voice decays to during its hold and then sustains, as an absolute
   * gain. Zero means an ordinary note. Non-zero is how instability persists
   * without persisting loudly (CAV-007).
   */
  readonly floorGain: number;
  /** The voice ends on an unresolved degree and does not close (CAV-006). */
  readonly openEnded: boolean;
  /**
   * This voice is one of a deliberately tense simultaneity — a suspension, its
   * answer, or the detuned twin that beats against it.
   *
   * It is a property of the *note*, not of the plan's intention, and that is the
   * point: CAV-007 bounds "voices in a tense interval class at any instant", and
   * an instant can contain voices from more than one plan. Attunement stacked
   * six of them precisely because the bound was checked per plan. Marking the
   * voice lets `auditComfort()` prove the bound over any timeline, however it
   * was assembled.
   */
  readonly tense: boolean;
}

/**
 * A deliberate beat between two near-equal frequencies. Recorded separately
 * from the notes that produce it because the *rate* is the thing the comfort
 * envelope bounds, and a bound you cannot read is not a bound.
 */
export interface PlannedBeating {
  readonly id: string;
  readonly conceptIds: readonly [string, string];
  readonly frequencies: readonly [number, number];
  readonly beatingHz: number;
  readonly atSeconds: number;
  readonly gain: number;
  readonly floorGain: number;
  readonly decayToFloorSeconds: number;
}

/** Everything a caption needs, decided at plan time rather than re-derived. */
export interface VoicePlanMeta {
  readonly conceptIds: readonly string[];
  /** One clause naming the transformation. Never praise, never a claim. */
  readonly grammar: string;
  /** The phrase closes. Tension is never true; an Open Thread is never true. */
  readonly resolves: boolean;
  /** Interval of imitation or suspension, in semitones, where one applies. */
  readonly interval: number | null;
  /** Deliberate beat rate, where one applies. */
  readonly beatingHz: number | null;
  /**
   * Which epistemic state produced this plan, where one did. `resolves` alone
   * cannot carry it: a documented Tension, an Open Thread, and a weak outcome
   * all decline to close, and the captioned path has to distinguish them.
   */
  readonly outcome: AudioOutcomeKind | null;
}

/**
 * What a planner supplies. `outcome` is optional here and required on the way
 * out, so a plan always states an answer — `null` for the plans that genuinely
 * have no epistemic status, such as a weave landing.
 */
export type VoicePlanMetaInput = Omit<VoicePlanMeta, "outcome"> & {
  readonly outcome?: AudioOutcomeKind | null;
};

export interface VoicePlan {
  readonly id: string;
  readonly kind: VoicePlanKind;
  readonly intention: RelationIntention | null;
  readonly notes: readonly PlannedNote[];
  readonly beatings: readonly PlannedBeating[];
  readonly durationSeconds: number;
  readonly meta: VoicePlanMeta;
}

export function noteLifetime(note: PlannedNote): number {
  return note.envelope.attack + note.envelope.hold + note.envelope.release;
}

export function noteEndSeconds(note: PlannedNote): number {
  return note.atSeconds + noteLifetime(note);
}

export function planDurationSeconds(
  notes: readonly PlannedNote[],
  beatings: readonly PlannedBeating[] = []
): number {
  let end = 0;
  for (const note of notes) end = Math.max(end, noteEndSeconds(note));
  for (const beating of beatings) {
    end = Math.max(end, beating.atSeconds + COMFORT.tension.lifetimeSeconds);
  }
  return Number(end.toFixed(4));
}

export function makeVoicePlan(input: {
  readonly id: string;
  readonly kind: VoicePlanKind;
  readonly intention: RelationIntention | null;
  readonly notes: readonly PlannedNote[];
  readonly beatings?: readonly PlannedBeating[];
  readonly meta: VoicePlanMetaInput;
}): VoicePlan {
  const beatings = Object.freeze([...(input.beatings ?? [])]);
  const notes = Object.freeze([...input.notes]);
  return Object.freeze({
    id: input.id,
    kind: input.kind,
    intention: input.intention,
    notes,
    beatings,
    durationSeconds: planDurationSeconds(notes, beatings),
    meta: Object.freeze({ ...input.meta, outcome: input.meta.outcome ?? null }),
  });
}

/**
 * Lay several plans onto one timeline, so a composite — an Attunement cycle, a
 * conclusion — can be audited as the single thing a listener actually hears.
 *
 * This is what makes CAV-007 checkable where it was breached: the bound is on
 * an *instant*, and an instant does not know which plan a voice came from.
 */
export function mergePlans(
  id: string,
  kind: VoicePlanKind,
  parts: readonly { readonly plan: VoicePlan; readonly atSeconds: number }[]
): VoicePlan {
  const notes: PlannedNote[] = [];
  const beatings: PlannedBeating[] = [];
  for (const part of parts) {
    for (const note of part.plan.notes) {
      notes.push(
        Object.freeze({
          ...note,
          id: `${part.plan.id}#${note.id}`,
          atSeconds: Number((note.atSeconds + part.atSeconds).toFixed(5)),
        })
      );
    }
    for (const beating of part.plan.beatings) {
      beatings.push(
        Object.freeze({
          ...beating,
          id: `${part.plan.id}#${beating.id}`,
          atSeconds: Number((beating.atSeconds + part.atSeconds).toFixed(5)),
        })
      );
    }
  }
  const intentions = new Set(parts.map((part) => part.plan.intention));
  return makeVoicePlan({
    id,
    kind,
    intention: intentions.size === 1 ? [...intentions][0] : null,
    notes,
    beatings,
    meta: {
      conceptIds: [
        ...new Set(parts.flatMap((part) => part.plan.meta.conceptIds)),
      ],
      grammar: "composite",
      resolves: parts.every((part) => part.plan.meta.resolves),
      interval: null,
      beatingHz: null,
      outcome: null,
    },
  });
}

/** Notes sounding at `t`, in plan-relative seconds. */
export function notesSoundingAt(
  plan: VoicePlan,
  t: number
): readonly PlannedNote[] {
  return plan.notes.filter(
    (note) => note.atSeconds <= t && t < noteEndSeconds(note)
  );
}

/** The greatest number of notes sounding at once anywhere in the plan. */
export function peakConcurrentNotes(plan: VoicePlan): number {
  let peak = 0;
  for (const note of plan.notes) {
    peak = Math.max(peak, notesSoundingAt(plan, note.atSeconds).length);
  }
  return peak;
}

/** Summed gain at `t`, using each voice's peak level. Conservative on purpose. */
export function summedGainAt(plan: VoicePlan, t: number): number {
  return notesSoundingAt(plan, t).reduce((total, note) => total + note.gain, 0);
}

export function peakSummedGain(plan: VoicePlan): number {
  let peak = 0;
  for (const note of plan.notes) {
    peak = Math.max(peak, summedGainAt(plan, note.atSeconds));
  }
  return peak;
}

// ─── The tense simultaneity, measured ───────────────────────────────────────

/** Tense voices sounding at `t`, in plan-relative seconds. */
export function tenseNotesSoundingAt(
  plan: VoicePlan,
  t: number
): readonly PlannedNote[] {
  return notesSoundingAt(plan, t).filter((note) => note.tense);
}

/**
 * The greatest number of tense voices sounding at once. This is the quantity
 * CAV-007 bounds at three, and it is measured over the whole timeline rather
 * than per plan — see `PlannedNote.tense`.
 */
export function peakConcurrentTenseNotes(plan: VoicePlan): number {
  let peak = 0;
  for (const note of plan.notes) {
    if (!note.tense) continue;
    peak = Math.max(peak, tenseNotesSoundingAt(plan, note.atSeconds).length);
  }
  return peak;
}

/** Greatest summed peak level of the tense voices alone. */
export function peakTenseSummedGain(plan: VoicePlan): number {
  let peak = 0;
  for (const note of plan.notes) {
    if (!note.tense) continue;
    const summed = tenseNotesSoundingAt(plan, note.atSeconds).reduce(
      (total, sounding) => total + sounding.gain,
      0
    );
    peak = Math.max(peak, summed);
  }
  return peak;
}

/**
 * Bring a plan's tense voices under an absolute ceiling, proportionally.
 *
 * The gain staging in `engine.ts` calls its tense path a ceiling; a `GainNode`
 * multiplies and therefore is not one. This is the arithmetic half of making
 * that claim true: whatever a plan asks for, what leaves here sums to at most
 * `ceiling`, and the balance between the three tense voices is preserved so the
 * suspension still sounds like itself, only quieter.
 */
export function capTenseGain(plan: VoicePlan, ceiling: number): VoicePlan {
  const peak = peakTenseSummedGain(plan);
  if (peak <= ceiling || peak <= 0) return plan;
  const scale = ceiling / peak;
  const notes = plan.notes.map((note) =>
    note.tense
      ? Object.freeze({
          ...note,
          gain: Number((note.gain * scale).toFixed(6)),
          floorGain: Number((note.floorGain * scale).toFixed(6)),
        })
      : note
  );
  const beatings = plan.beatings.map((beating) =>
    Object.freeze({
      ...beating,
      gain: Number((beating.gain * scale).toFixed(6)),
      floorGain: Number((beating.floorGain * scale).toFixed(6)),
    })
  );
  return makeVoicePlan({
    id: plan.id,
    kind: plan.kind,
    intention: plan.intention,
    notes,
    beatings,
    meta: plan.meta,
  });
}

export interface ComfortAuditInput {
  /**
   * The ambient bed gain **as it actually sounds at this moment** — after every
   * bed scale the score has applied. The tense ceiling is a fraction of this and
   * of nothing else (CAV-007).
   */
  readonly bedGain: number;
}

/**
 * Returns the plan's comfort violations as plain sentences. Empty means the plan
 * is inside CAV-007. Used by the tests, and by the director in development, so
 * a violation is caught at plan time rather than heard by a player.
 */
export function auditComfort(
  plan: VoicePlan,
  input: ComfortAuditInput
): readonly string[] {
  const problems: string[] = [];

  for (const beating of plan.beatings) {
    if (beating.beatingHz > COMFORT.beating.ceilingHz) {
      problems.push(
        `beating ${beating.beatingHz.toFixed(2)} Hz exceeds the ${COMFORT.beating.ceilingHz} Hz ceiling`
      );
    } else if (beating.beatingHz > COMFORT.beating.maxHz) {
      problems.push(
        `beating ${beating.beatingHz.toFixed(2)} Hz exceeds the ${COMFORT.beating.maxHz} Hz working maximum`
      );
    }
    if (beating.beatingHz < COMFORT.beating.minHz) {
      problems.push(
        `beating ${beating.beatingHz.toFixed(2)} Hz is below the ${COMFORT.beating.minHz} Hz minimum`
      );
    }
    if (beating.decayToFloorSeconds > COMFORT.tension.decayToFloorSeconds) {
      problems.push(
        `instability takes ${beating.decayToFloorSeconds}s to reach its floor, beyond ${COMFORT.tension.decayToFloorSeconds}s`
      );
    }
  }

  // Measured over the notes themselves rather than over `plan.intention`, so a
  // merged timeline — an Attunement cycle, a conclusion — is audited as the one
  // thing a listener hears rather than as several plans that each behaved.
  const peak = peakConcurrentTenseNotes(plan);
  if (peak > COMFORT.tension.maxConcurrentVoices) {
    problems.push(
      `${peak} voices sound at once in a tense interval class, beyond ${COMFORT.tension.maxConcurrentVoices}`
    );
  }
  const ceiling = tensionCeiling(input.bedGain);
  const summedTense = peakTenseSummedGain(plan);
  if (summedTense > ceiling + 1e-9) {
    problems.push(
      `tense summed gain ${summedTense.toFixed(3)} is not below the ambient bed ceiling ${ceiling.toFixed(3)}`
    );
  }

  if (plan.intention === "tension" && plan.meta.resolves) {
    problems.push("a Tension plan may not declare that it resolves");
  }

  for (const note of plan.notes) {
    if (noteLifetime(note) > COMFORT.voice.maxLifetimeSeconds) {
      problems.push(
        `voice ${note.id} lives ${noteLifetime(note).toFixed(1)}s, beyond the ${COMFORT.voice.maxLifetimeSeconds}s bound`
      );
    }
  }

  if (plan.notes.length > COMFORT.voice.maxConcurrent) {
    problems.push(
      `plan schedules ${plan.notes.length} voices, beyond the ${COMFORT.voice.maxConcurrent} ceiling`
    );
  }

  return Object.freeze(problems);
}
