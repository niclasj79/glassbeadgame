/**
 * THE CONCLUSION, RENDERED (VERTICAL-SLICE-SPEC §14).
 *
 * The conclusion is "an audiovisual reconstruction of the actual session, not a
 * generic cinematic". The domain compiles the event log into a performance
 * score; this module renders that score into voices and adds nothing.
 *
 * The division of labour is deliberate and worth stating, because getting it
 * wrong is how a conclusion starts drifting from the session that produced it:
 *
 *   the domain decides   *what* enters, when, transformed how, how loud,
 *                        whether it closes, and where the climax is;
 *   this module decides  what that sounds like.
 *
 * So there is no rule here that reads an outcome kind. A documented relation and
 * an Open Thread arrive with the same gain and the same duration from the
 * compiler (CAV-006), and nothing below can reintroduce a difference in reward —
 * the only thing this file does with `openEnded` is decline to close the line.
 *
 * INTERFACE ASSUMPTION: `PerformanceScore` below is a narrow structural subset
 * of `ConclusionPerformance` in `src/domain/performance/types.ts`, which another
 * agent owns. It is declared locally rather than imported so the two packages
 * stay independently editable; `conclusion.test.ts` pins the shape.
 *
 * Pure. No Web Audio, no browser, no React.
 */
import type {
  MotifArticulation,
  MotifRegister,
  TimbreId,
} from "@/content/castalia/schema";
import type { RelationIntention } from "@/domain/events";
import { COMFORT, clampBeatingHz } from "./comfort";
import {
  centsForBeatingHz,
  degreeFrequency,
  nearestTenseDegree,
  type WorldMode,
} from "./mode";
import { envelopeFor, type AudioPhrasing } from "./motif";
import {
  makeVoicePlan,
  type AudioVoiceRole,
  type PlannedBeating,
  type PlannedNote,
  type VoicePlan,
} from "./plan";
import { SCORE } from "./score";

// ─── The narrow input contract ──────────────────────────────────────────────

export interface PerformedVoice {
  readonly conceptId: string;
  readonly role: string;
  readonly degrees: readonly number[];
  readonly rhythm: readonly number[];
  readonly register: MotifRegister;
  readonly articulation: MotifArticulation;
  readonly timbre: TimbreId;
  readonly atSeconds: number;
  readonly durationSeconds: number;
  readonly gain: number;
  readonly openEnded: boolean;
}

export interface PerformedPhrasing {
  readonly attack: number;
  readonly legato: number;
  readonly rubato: number;
  readonly weight: number;
  readonly breadth: number;
}

export interface PerformedEntry {
  readonly threadId: string;
  /** Creation order. The performance follows it exactly. */
  readonly order: number;
  readonly conceptIds: readonly [string, string];
  readonly intention: RelationIntention;
  readonly atSeconds: number;
  readonly durationSeconds: number;
  readonly voices: readonly PerformedVoice[];
  readonly dynamic: number;
  readonly phrasing: PerformedPhrasing;
  readonly resolved: boolean;
}

export interface PerformedEnsemble {
  readonly key: string;
  readonly atSeconds: number;
  readonly durationSeconds: number;
  readonly conceptIds: readonly string[];
  readonly voices: readonly PerformedVoice[];
}

export interface PerformedUnresolved {
  readonly threadId: string;
  readonly conceptIds: readonly [string, string];
  readonly fromSeconds: number;
  readonly gain: number;
  readonly floorGain: number;
  readonly decayToFloorSeconds: number;
}

export interface PerformanceScore {
  readonly sessionId: string;
  readonly secondsPerBeat: number;
  readonly entries: readonly PerformedEntry[];
  readonly ensembles: readonly PerformedEnsemble[];
  readonly unresolved: readonly PerformedUnresolved[];
  readonly totalSeconds: number;
}

// ─── Output ─────────────────────────────────────────────────────────────────

export const CONCLUSION_SECTION_KINDS = Object.freeze([
  "entry",
  "ensemble",
  "unresolved",
] as const);
export type ConclusionSectionKind = (typeof CONCLUSION_SECTION_KINDS)[number];

export interface ConclusionSection {
  readonly kind: ConclusionSectionKind;
  readonly threadId: string | null;
  /** Seconds from the start of the performance. */
  readonly atSeconds: number;
  readonly plan: VoicePlan;
}

export interface ConclusionAudioPlan {
  readonly sessionId: string;
  readonly sections: readonly ConclusionSection[];
  readonly totalSeconds: number;
}

export interface ConclusionRenderOptions {
  readonly mode: WorldMode;
  readonly ambientGain: number;
}

// ─── Rendering ──────────────────────────────────────────────────────────────

const KNOWN_ROLES: readonly AudioVoiceRole[] = Object.freeze([
  "subject",
  "answer",
  "pedal",
  "ground",
  "shadow",
  "ensemble",
  "residue",
]);

function roleOf(role: string): AudioVoiceRole {
  const match = KNOWN_ROLES.find((known) => known === role);
  return match ?? "ensemble";
}

function phrasingOf(phrasing: PerformedPhrasing): AudioPhrasing {
  return {
    attack: phrasing.attack,
    legato: phrasing.legato,
    rubato: phrasing.rubato,
    weight: phrasing.weight,
    breadth: phrasing.breadth,
  };
}

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/**
 * One compiled voice → the notes that realise it.
 *
 * The compiler states a duration for the whole line and a rhythm for its notes;
 * the rhythm is normalised into that duration rather than re-derived from a
 * tempo here, so the audio cannot land anywhere the score did not put it.
 */
export function renderPerformedVoice(
  voice: PerformedVoice,
  options: {
    readonly mode: WorldMode;
    readonly idPrefix: string;
    readonly phrasing: AudioPhrasing;
    readonly gainScale: number;
  }
): readonly PlannedNote[] {
  const count = voice.degrees.length;
  if (count === 0) return Object.freeze([]);
  let units = 0;
  for (let i = 0; i < count; i++) units += Math.max(1, voice.rhythm[i] ?? 1);
  const unitSeconds = Math.max(0.02, voice.durationSeconds) / units;

  const notes: PlannedNote[] = [];
  let cursor = voice.atSeconds;
  for (let i = 0; i < count; i++) {
    const length = Math.max(1, voice.rhythm[i] ?? 1) * unitSeconds;
    const isLast = i === count - 1;
    // The only thing `openEnded` changes is the last degree. A line that does
    // not close ends somewhere unstable; it is not shorter and it is not quieter.
    const degree =
      isLast && voice.openEnded
        ? nearestTenseDegree(options.mode, voice.degrees[i])
        : voice.degrees[i];
    notes.push(
      Object.freeze({
        id: `${options.idPrefix}:${i}`,
        conceptId: voice.conceptId,
        role: roleOf(voice.role),
        timbre: voice.timbre,
        articulation: voice.articulation,
        register: voice.register,
        degree,
        frequency: degreeFrequency(options.mode, degree, voice.register),
        detuneCents: 0,
        atSeconds: Number(cursor.toFixed(5)),
        envelope: envelopeFor(voice.articulation, length, options.phrasing),
        gain: Number((voice.gain * options.gainScale).toFixed(6)),
        floorGain: 0,
        openEnded: isLast && voice.openEnded,
      })
    );
    cursor += length;
  }
  return Object.freeze(notes);
}

function renderEntry(
  entry: PerformedEntry,
  options: ConclusionRenderOptions
): ConclusionSection {
  const phrasing = phrasingOf(entry.phrasing);
  const dynamic = clamp(
    entry.dynamic,
    SCORE.conclusion.dynamicFloor,
    SCORE.conclusion.dynamicCeiling
  );
  const notes: PlannedNote[] = [];
  entry.voices.forEach((voice, index) => {
    notes.push(
      ...renderPerformedVoice(voice, {
        mode: options.mode,
        idPrefix: `${entry.threadId}:${index}`,
        phrasing,
        gainScale: dynamic,
      })
    );
  });

  return Object.freeze({
    kind: "entry" as const,
    threadId: entry.threadId,
    atSeconds: entry.atSeconds,
    plan: makeVoicePlan({
      id: `conclusion:${entry.threadId}`,
      kind: "conclusion",
      intention: entry.intention,
      notes,
      meta: {
        conceptIds: entry.conceptIds,
        grammar: entry.intention,
        resolves: entry.resolved,
        interval: null,
        beatingHz: null,
      },
    }),
  });
}

function renderEnsemble(
  ensemble: PerformedEnsemble,
  options: ConclusionRenderOptions
): ConclusionSection {
  const notes: PlannedNote[] = [];
  ensemble.voices.forEach((voice, index) => {
    notes.push(
      ...renderPerformedVoice(voice, {
        mode: options.mode,
        idPrefix: `${ensemble.key}:${index}`,
        phrasing: {
          attack: 0.5,
          legato: 0.65,
          rubato: 0.4,
          weight: 0.5,
          breadth: 0.5,
        },
        gainScale: 1,
      })
    );
  });
  return Object.freeze({
    kind: "ensemble" as const,
    threadId: null,
    atSeconds: ensemble.atSeconds,
    plan: makeVoicePlan({
      id: `conclusion:ensemble:${ensemble.key}`,
      kind: "ensemble",
      intention: null,
      notes,
      meta: {
        conceptIds: ensemble.conceptIds,
        grammar: "ensemble",
        resolves: true,
        interval: null,
        beatingHz: null,
      },
    }),
  });
}

/**
 * An unresolved Tension keeps sounding to the end of the performance — but no
 * single voice is unbounded, so it is re-stated at its comfort lifetime instead
 * of held open. The restatements are capped, so a very long conclusion cannot
 * allocate without limit.
 */
function renderUnresolved(
  unresolved: PerformedUnresolved,
  score: PerformanceScore,
  options: ConclusionRenderOptions
): ConclusionSection {
  const remaining = Math.max(0, score.totalSeconds - unresolved.fromSeconds);
  const repeats = Math.min(
    SCORE.conclusion.unresolvedRepeats,
    Math.max(1, Math.ceil(remaining / COMFORT.tension.lifetimeSeconds))
  );
  const beatingHz = clampBeatingHz(
    COMFORT.beating.minHz +
      (COMFORT.beating.maxHz - COMFORT.beating.minHz) * 0.35
  );
  const decay = Math.min(
    unresolved.decayToFloorSeconds,
    COMFORT.tension.decayToFloorSeconds
  );
  const attack = SCORE.grammar.tensionAttackSeconds;
  const release = Math.max(0, COMFORT.tension.lifetimeSeconds - attack - decay);

  // CAV-007 again, at the one place the conclusion can breach it: the three
  // shares below sum to exactly the peak, so capping the peak caps the sum.
  const ceiling =
    options.ambientGain *
    COMFORT.tension.gainFractionOfBed *
    SCORE.grammar.tensionHeadroom;
  const peak = Math.min(unresolved.gain, ceiling);
  const floor = Math.min(
    unresolved.floorGain,
    peak * COMFORT.tension.floorFraction
  );

  const notes: PlannedNote[] = [];
  const beatings: PlannedBeating[] = [];

  for (let repeat = 0; repeat < repeats; repeat++) {
    const at = repeat * COMFORT.tension.lifetimeSeconds;
    const lowFrequency = degreeFrequency(options.mode, 0, "low");
    const highFrequency = degreeFrequency(options.mode, 13, "low");
    const shared = {
      articulation: "sustained" as MotifArticulation,
      envelope: Object.freeze({ attack, hold: decay, release }),
      openEnded: true,
    };
    notes.push(
      Object.freeze({
        ...shared,
        id: `${unresolved.threadId}:hold:${repeat}`,
        conceptId: unresolved.conceptIds[0],
        role: "subject" as const,
        timbre: "glass" as const,
        register: "low" as const,
        degree: 0,
        frequency: lowFrequency,
        detuneCents: 0,
        atSeconds: Number(at.toFixed(5)),
        gain: Number((peak * 0.55).toFixed(6)),
        floorGain: Number((floor * 0.55).toFixed(6)),
      }),
      Object.freeze({
        ...shared,
        id: `${unresolved.threadId}:suspend:${repeat}`,
        conceptId: unresolved.conceptIds[1],
        role: "answer" as const,
        timbre: "voice" as const,
        register: "low" as const,
        degree: 13,
        frequency: highFrequency,
        detuneCents: 0,
        atSeconds: Number((at + 0.4).toFixed(5)),
        gain: Number((peak * 0.3).toFixed(6)),
        floorGain: Number((floor * 0.3).toFixed(6)),
      }),
      Object.freeze({
        ...shared,
        id: `${unresolved.threadId}:shadow:${repeat}`,
        conceptId: unresolved.conceptIds[0],
        role: "shadow" as const,
        timbre: "glass" as const,
        register: "low" as const,
        degree: 0,
        frequency: lowFrequency,
        detuneCents: Number(
          centsForBeatingHz(lowFrequency, beatingHz).toFixed(4)
        ),
        atSeconds: Number((at + 0.2).toFixed(5)),
        gain: Number((peak * 0.15).toFixed(6)),
        floorGain: Number((floor * 0.15).toFixed(6)),
      })
    );
    beatings.push(
      Object.freeze({
        id: `${unresolved.threadId}:beating:${repeat}`,
        conceptIds: unresolved.conceptIds,
        frequencies: [
          Number(lowFrequency.toFixed(4)),
          Number((lowFrequency + beatingHz).toFixed(4)),
        ] as const,
        beatingHz: Number(beatingHz.toFixed(4)),
        atSeconds: Number((at + 0.2).toFixed(5)),
        gain: Number((peak * 0.15).toFixed(6)),
        floorGain: Number((floor * 0.15).toFixed(6)),
        decayToFloorSeconds: decay,
      })
    );
  }

  return Object.freeze({
    kind: "unresolved" as const,
    threadId: unresolved.threadId,
    atSeconds: unresolved.fromSeconds,
    plan: makeVoicePlan({
      id: `conclusion:unresolved:${unresolved.threadId}`,
      kind: "conclusion",
      intention: "tension",
      notes,
      beatings,
      meta: {
        conceptIds: unresolved.conceptIds,
        grammar: "displacement",
        resolves: false,
        interval: 13,
        beatingHz: Number(beatingHz.toFixed(4)),
      },
    }),
  });
}

/**
 * Render a compiled performance.
 *
 * Entries are emitted in creation order — the compiler's `order`, not its
 * `atSeconds`, because creation order is the thing the specification promises
 * and a compiler bug that reordered times should be visible rather than
 * silently sorted away.
 */
export function planConclusionPerformance(
  score: PerformanceScore,
  options: ConclusionRenderOptions
): ConclusionAudioPlan {
  const entries = [...score.entries].sort((a, b) => a.order - b.order);
  const sections: ConclusionSection[] = entries.map((entry) =>
    renderEntry(entry, options)
  );
  for (const ensemble of score.ensembles) {
    sections.push(renderEnsemble(ensemble, options));
  }
  for (const unresolved of score.unresolved) {
    sections.push(renderUnresolved(unresolved, score, options));
  }

  let total = score.totalSeconds;
  for (const section of sections) {
    total = Math.max(total, section.atSeconds + section.plan.durationSeconds);
  }

  return Object.freeze({
    sessionId: score.sessionId,
    sections: Object.freeze(sections),
    totalSeconds: Number(total.toFixed(4)),
  });
}
