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
 * So no rule here lets an outcome kind change how much sound an entry gets. A
 * documented relation, a reading, and an Open Thread arrive with the same gain
 * and the same duration from the compiler (CAV-006), and nothing below may
 * reintroduce a difference in reward — the only thing this file does with
 * `openEnded` is decline to close the line. The kind *is* read, in exactly one
 * place and for exactly one purpose: `outcomeOf` names which state of knowledge
 * the entry is in, so the caption track can say it. Naming is not rewarding.
 *
 * INTERFACE ASSUMPTION: `PerformanceScore` below is a narrow structural subset
 * of `ConclusionPerformance` in `src/domain/performance/types.ts`, which another
 * agent owns. It is declared locally rather than imported so the two packages
 * stay independently editable; `conclusion.test.ts` pins the shape.
 *
 * Pure. No Web Audio, no browser, no React.
 */
import type {
  ConceptMotif,
  MotifArticulation,
  MotifRegister,
  TimbreId,
} from "@/content/castalia/schema";
import type { RelationIntention } from "@/domain/events";
import { COMFORT, tensionCeiling } from "./comfort";
import { beatingKeyFor, beatingRateFor, suspensionInterval } from "./grammar";
import {
  centsForBeatingHz,
  degreeFrequency,
  nearestStableDegree,
  nearestTenseDegree,
  registerIndex,
  shiftRegister,
  type WorldMode,
} from "./mode";
import { anchorDegree, envelopeFor, type AudioPhrasing, type MotifSource } from "./motif";
import {
  capTenseGain,
  makeVoicePlan,
  type AudioOutcomeKind,
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

/**
 * The three shapes an outcome can take in the compiled score. Structurally the
 * domain's `ThreadOutcomeKind`; declared locally so the two packages stay
 * independently editable.
 */
export type PerformedOutcomeKind = "documented" | "open-thread" | "unresolved";

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
  readonly outcomeKind: PerformedOutcomeKind;
  /**
   * The authored material behind this entry speaks for the record.
   *
   * `outcomeKind === "documented"` does not answer this and the caption track
   * must not pretend it does: an interpretive relation is documented — the Game
   * has something authored to say — but it is the Game's own reading and
   * asserts nothing beyond the two structures compared.
   */
  readonly speaksForRecord: boolean;
  readonly resolved: boolean;
  /** Structural weight in the final web, 0–1. Sizes the arrival, never the level. */
  readonly weight: number;
  /** This entry is the web's high point. Exactly one carries it, or none. */
  readonly isClimax: boolean;
}

/**
 * The authored ending: two held voices made from the climax thread's own
 * motifs, which either come to rest or deliberately do not.
 */
export interface PerformedCoda {
  readonly threadId: string;
  readonly conceptIds: readonly [string, string];
  readonly atSeconds: number;
  readonly durationSeconds: number;
  readonly voices: readonly PerformedVoice[];
  readonly resolves: boolean;
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
  /** Null only when nothing was woven, and there is therefore nothing to end. */
  readonly coda: PerformedCoda | null;
  readonly totalSeconds: number;
}

// ─── Output ─────────────────────────────────────────────────────────────────

export const CONCLUSION_SECTION_KINDS = Object.freeze([
  "entry",
  "ensemble",
  "unresolved",
  "coda",
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
  /** The level the performance is sized against. */
  readonly ambientGain: number;
  /** The bed the conclusion actually leaves sounding. Caps the tense voices. */
  readonly bedGain: number;
  /**
   * The authored motif for a concept, or null if the pack cannot supply one.
   *
   * The compiler hands the conclusion identities, not music. Everything an
   * *entry* needs is already compiled into its voices; an unresolved thread is
   * the one thing that is not, because nothing was performed for it — so this
   * module has to look the two concepts up to sound them. Without this seam the
   * loose ends of every session were the same two hard-coded pitches.
   */
  readonly motifFor: (conceptId: string) => ConceptMotif | null;
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
 *
 * `originSeconds` is where the section this voice belongs to begins. Note times
 * are **section-relative**, because that is what the scheduler expects: it plays
 * a plan at a moment and adds each note's own time to it. Entries and ensembles
 * used to hand it the compiler's absolute times *and* be played at the section's
 * absolute time, so every entry after the first was scheduled at twice its
 * offset — a five-thread conclusion drifted a minute apart from the score it was
 * supposed to be a reconstruction of. Unresolved threads were always relative,
 * which is why nothing had noticed.
 */
export function renderPerformedVoice(
  voice: PerformedVoice,
  options: {
    readonly mode: WorldMode;
    readonly idPrefix: string;
    readonly phrasing: AudioPhrasing;
    readonly gainScale: number;
    readonly originSeconds?: number;
  }
): readonly PlannedNote[] {
  const count = voice.degrees.length;
  if (count === 0) return Object.freeze([]);
  let units = 0;
  for (let i = 0; i < count; i++) units += Math.max(1, voice.rhythm[i] ?? 1);
  const unitSeconds = Math.max(0.02, voice.durationSeconds) / units;

  const notes: PlannedNote[] = [];
  let cursor = Math.max(0, voice.atSeconds - (options.originSeconds ?? 0));
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
        tense: false,
      })
    );
    cursor += length;
  }
  return Object.freeze(notes);
}

/**
 * WHICH STATE OF KNOWLEDGE THIS ENTRY IS IN.
 *
 * It used to be `resolved ? "documented" : "open-thread"`, which is wrong in
 * both directions: a Tension over a real record was captioned as an Open Thread,
 * and — the case the review named — so was an *interpretive* relation, a reading
 * the Game offers about two structures. That told the player the Game had
 * nothing authored to say when in fact it had something authored to say and was
 * being careful about how far it went.
 *
 * The kind alone cannot carry it, because "documented" covers both a record and
 * a reading. The pair does: kind says whether the Game has authored material,
 * `speaksForRecord` says whether that material speaks for the record.
 */
function outcomeOf(entry: PerformedEntry): AudioOutcomeKind {
  switch (entry.outcomeKind) {
    case "documented":
      return entry.speaksForRecord ? "documented" : "reading";
    case "open-thread":
      return "open-thread";
    case "unresolved":
      return "unresolved";
    default: {
      const exhaustive: never = entry.outcomeKind;
      return exhaustive;
    }
  }
}

/**
 * THE ARRIVAL.
 *
 * The compiler locates the web's high point from the web itself and says so on
 * the entry. Before this, the renderer read only dynamic, phrasing and voices,
 * so the structurally justified peak of the player's own composition sounded
 * exactly like every other entry — the conclusion had a shape on paper and none
 * in the ear.
 *
 * What arrival is made of here is register and width, never level:
 *
 *  - the voices are spread a register apart, so the entry opens out;
 *  - each line is doubled at the octave, an orchestral arrival gesture;
 *  - and the doubling's level is *subtracted from the line it doubles*, so the
 *    summed gain at every instant is identical to the same entry rendered
 *    ordinarily. `weight` decides how much of the entry's level moves to the
 *    octave, so a light climax opens out less — it never gets louder.
 *
 * A climax that is merely louder is a score in disguise (ADR-010), and this is
 * the arithmetic that makes "arrival, not volume" a fact rather than an
 * intention.
 */
function climaxDoubleShare(weight: number): number {
  const floor = SCORE.conclusion.climaxWeightFloor;
  return (
    SCORE.conclusion.climaxDoubleShare *
    (floor + (1 - floor) * clamp(weight, 0, 1))
  );
}

/** Spread the entry's lines apart in register: lowest down, highest up. */
function spreadVoices(
  voices: readonly PerformedVoice[]
): readonly PerformedVoice[] {
  if (voices.length < 2) {
    return voices.map((voice) =>
      Object.freeze({ ...voice, register: shiftRegister(voice.register, 1) })
    );
  }
  let lowest = 0;
  let highest = 0;
  voices.forEach((voice, index) => {
    if (registerIndex(voice.register) < registerIndex(voices[lowest].register)) {
      lowest = index;
    }
    if (registerIndex(voice.register) >= registerIndex(voices[highest].register)) {
      highest = index;
    }
  });
  // Two lines in the same register would otherwise both move; the lowest index
  // wins the descent and the highest the ascent, so the choice is deterministic.
  if (lowest === highest) highest = lowest === 0 ? voices.length - 1 : 0;
  return voices.map((voice, index) =>
    index === lowest
      ? Object.freeze({ ...voice, register: shiftRegister(voice.register, -1) })
      : index === highest
        ? Object.freeze({ ...voice, register: shiftRegister(voice.register, 1) })
        : voice
  );
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
  const share = entry.isClimax ? climaxDoubleShare(entry.weight) : 0;
  const voices = entry.isClimax ? spreadVoices(entry.voices) : entry.voices;

  const notes: PlannedNote[] = [];
  voices.forEach((voice, index) => {
    const line = renderPerformedVoice(voice, {
      mode: options.mode,
      idPrefix: `${entry.threadId}:${index}`,
      phrasing,
      gainScale: dynamic * (1 - share),
      originSeconds: entry.atSeconds,
    });
    if (share === 0) {
      notes.push(...line);
      return;
    }
    // The octave lives immediately beside the note it doubles, so thinning at
    // reduced intensity shortens the line rather than quietly removing the
    // doubling and leaving the climax the one entry that got quieter.
    const octave = renderPerformedVoice(
      Object.freeze({ ...voice, register: shiftRegister(voice.register, 1) }),
      {
        mode: options.mode,
        idPrefix: `${entry.threadId}:${index}:octave`,
        phrasing,
        gainScale: dynamic * share,
        originSeconds: entry.atSeconds,
      }
    );
    for (let i = 0; i < line.length; i++) {
      notes.push(line[i]);
      const twin = octave[i];
      if (twin !== undefined) notes.push(twin);
    }
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
        outcome: outcomeOf(entry),
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
        originSeconds: ensemble.atSeconds,
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
        outcome: null,
      },
    }),
  });
}

/** The fallback voice for a concept the pack cannot name. Deliberately plain. */
const FALLBACK_MOTIF: ConceptMotif = Object.freeze({
  degrees: Object.freeze([0]),
  rhythm: Object.freeze([4]),
  register: "low" as MotifRegister,
  articulation: "sustained" as MotifArticulation,
  timbre: "glass" as TimbreId,
});

/**
 * An unresolved Tension keeps sounding to the end of the performance — but no
 * single voice is unbounded, so it is re-stated at its comfort lifetime instead
 * of held open. The restatements are capped, so a very long conclusion cannot
 * allocate without limit.
 *
 * What it re-states is *those two concepts*. The review found every loose end in
 * every session sounding the same two hard-coded pitches through the same two
 * hard-coded bodies, which made the conclusion stop being a reconstruction of a
 * particular session at exactly the moment the session was most itself. The
 * pitches, registers, bodies, suspension interval, and beat rate below are all
 * the pair's own — and they are the same ones `planTension()` would have chosen,
 * so an unresolved thread sounds continuous with how it sounded when it was woven.
 */
function renderUnresolved(
  unresolved: PerformedUnresolved,
  endsAt: number,
  options: ConclusionRenderOptions
): ConclusionSection {
  /*
   * "To the end" means to the end of the *performance*, and the performance now
   * ends with an authored coda. The loose ends therefore ring up to the coda and
   * hand it over: the coda is itself the statement that the web left a Tension
   * open, so the two are the same fact and must not talk over each other.
   *
   * Two things follow, and both matter. The last authored sound is genuinely
   * last, instead of being buried under held voices that outlive it. And the
   * CAV-007 bound on concurrent tense voices is kept over the assembled
   * timeline: three loose-end voices *plus* a suspended coda would be five.
   */
  const available = Math.max(0, endsAt - unresolved.fromSeconds);
  const repeats = Math.min(
    SCORE.conclusion.unresolvedRepeats,
    Math.max(1, Math.ceil(available / COMFORT.tension.lifetimeSeconds))
  );

  const [idA, idB] = unresolved.conceptIds;
  const a: MotifSource = {
    conceptId: idA,
    motif: options.motifFor(idA) ?? FALLBACK_MOTIF,
  };
  const b: MotifSource = {
    conceptId: idB,
    motif: options.motifFor(idB) ?? FALLBACK_MOTIF,
  };

  const interval = suspensionInterval(options.mode, a, b);
  const beatingHz = Number(
    beatingRateFor(beatingKeyFor(idA, idB)).toFixed(4)
  );

  // The same construction the grammar uses: the lower of the two registers
  // carries the suspension, and the answer sits a compound interval above it, so
  // the pair suspends rather than turning to mud in the bass.
  const lowRegister =
    registerIndex(a.motif.register) <= registerIndex(b.motif.register)
      ? a.motif.register
      : b.motif.register;
  const highRegister = shiftRegister(lowRegister, 1);
  const lowDegree = anchorDegree(a.motif);
  const highDegree = lowDegree + interval;
  const lowFrequency = degreeFrequency(options.mode, lowDegree, lowRegister);
  const highFrequency = degreeFrequency(options.mode, highDegree, highRegister);

  const attack = SCORE.grammar.tensionAttackSeconds;

  // CAV-007 again, at the one place the conclusion can breach it: the three
  // shares below sum to exactly the peak, so capping the peak caps the sum. The
  // ceiling is a fraction of the bed the conclusion actually leaves sounding.
  const ceiling = tensionCeiling(options.bedGain) * SCORE.grammar.tensionHeadroom;
  const peak = Math.min(unresolved.gain, ceiling);
  const floor = Math.min(
    unresolved.floorGain,
    peak * COMFORT.tension.floorFraction
  );
  const shares = SCORE.grammar.tensionShares;
  const shareTotal = shares[0] + shares[1] + shares[2];

  const notes: PlannedNote[] = [];
  const beatings: PlannedBeating[] = [];

  for (let repeat = 0; repeat < repeats; repeat++) {
    const at = repeat * COMFORT.tension.lifetimeSeconds;
    /*
     * A re-statement takes its full comfort lifetime unless the performance
     * ends first, in which case it takes what is left. A stub shorter than a
     * statement is dropped rather than clipped — an instability that flickers
     * for half a second reads as a fault, which is exactly what CAV-007 asks
     * this material not to sound like.
     */
    const span = Math.min(
      COMFORT.tension.lifetimeSeconds,
      Math.max(0, available - at)
    );
    if (span < SCORE.conclusion.minUnresolvedHoldSeconds) continue;
    /*
     * The three voices of a suspension enter staggered, so each one is given
     * the span that is left *after its own entry*. Sharing one envelope across
     * the three let the later two outlive the statement by their stagger — 0.4s
     * of a hold that was supposed to have handed over to the ending.
     */
    const envelopeFrom = (offset: number) => {
      const length = Math.max(0, span - offset);
      const holdAttack = Math.min(attack, length * 0.3);
      const decay = Math.min(
        unresolved.decayToFloorSeconds,
        COMFORT.tension.decayToFloorSeconds,
        Math.max(0, length - holdAttack)
      );
      return Object.freeze({
        attack: holdAttack,
        hold: decay,
        release: Math.max(0, length - holdAttack - decay),
      });
    };
    const decay = envelopeFrom(0).hold;
    const shared = {
      articulation: "sustained" as MotifArticulation,
      openEnded: true,
      tense: true,
    };
    notes.push(
      Object.freeze({
        ...shared,
        id: `${unresolved.threadId}:hold:${repeat}`,
        conceptId: idA,
        role: "subject" as const,
        envelope: envelopeFrom(0),
        timbre: a.motif.timbre,
        register: lowRegister,
        degree: lowDegree,
        frequency: lowFrequency,
        detuneCents: 0,
        atSeconds: Number(at.toFixed(5)),
        gain: Number(((peak * shares[0]) / shareTotal).toFixed(6)),
        floorGain: Number(((floor * shares[0]) / shareTotal).toFixed(6)),
      }),
      Object.freeze({
        ...shared,
        id: `${unresolved.threadId}:suspend:${repeat}`,
        conceptId: idB,
        role: "answer" as const,
        envelope: envelopeFrom(0.4),
        timbre: b.motif.timbre,
        register: highRegister,
        degree: highDegree,
        frequency: highFrequency,
        detuneCents: 0,
        atSeconds: Number((at + 0.4).toFixed(5)),
        gain: Number(((peak * shares[1]) / shareTotal).toFixed(6)),
        floorGain: Number(((floor * shares[1]) / shareTotal).toFixed(6)),
      }),
      Object.freeze({
        ...shared,
        id: `${unresolved.threadId}:shadow:${repeat}`,
        conceptId: idA,
        role: "shadow" as const,
        envelope: envelopeFrom(0.2),
        // The twin is glass wherever it appears: it is not a third concept
        // speaking, it is the first one beating against itself.
        timbre: "glass" as const,
        register: lowRegister,
        degree: lowDegree,
        frequency: lowFrequency,
        detuneCents: Number(
          centsForBeatingHz(lowFrequency, beatingHz).toFixed(4)
        ),
        atSeconds: Number((at + 0.2).toFixed(5)),
        gain: Number(((peak * shares[2]) / shareTotal).toFixed(6)),
        floorGain: Number(((floor * shares[2]) / shareTotal).toFixed(6)),
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
        beatingHz,
        atSeconds: Number((at + 0.2).toFixed(5)),
        gain: Number(((peak * shares[2]) / shareTotal).toFixed(6)),
        floorGain: Number(((floor * shares[2]) / shareTotal).toFixed(6)),
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
        interval: 12 + interval,
        beatingHz,
        outcome: "unresolved",
      },
    }),
  });
}

/**
 * THE LAST SOUND.
 *
 * The compiler composes the ending from the climax thread's two motifs and says
 * whether it closes. This decides what closing *is*, because that is a question
 * about the world mode and the mode lives here: the answering voice is placed a
 * stable interval above the ground when the performance comes to rest, and a
 * tense one when the web still carries a Tension nothing took hold of. The
 * interval is measured against the ground rather than against the tonic, so the
 * two voices genuinely lock — in just intonation a stable class is an exact
 * ratio and does not beat at all.
 *
 * Both forms are the same length and the same level. The ending differs in
 * resolution, never in reward (CAV-006), and the one that does not resolve is
 * not a punishment for leaving a Tension open — it is an accurate report.
 */
function renderCoda(
  coda: PerformedCoda,
  atSeconds: number,
  options: ConclusionRenderOptions
): ConclusionSection {
  const [ground, answer] = coda.voices;
  const notes: PlannedNote[] = [];

  /*
   * ONE LEVEL FOR BOTH ENDINGS.
   *
   * The form that does not close is a suspension, and CAV-007 bounds a
   * suspension's summed gain below the ambient bed. Applying that bound only to
   * the form that needs it would have made the ending that does not close the
   * quieter of the two — a difference in *reward* between two outcomes that
   * differ only in resolution, which is precisely what CAV-006 forbids and what
   * this file's own header promises it will not reintroduce.
   *
   * So the ending is sized against the bed either way. It is one held sonority
   * in a room whose generative bed is being taken out from under it, and bed
   * level is the right size for that whether or not it comes to rest.
   */
  const ceiling = tensionCeiling(options.bedGain) * SCORE.grammar.tensionHeadroom;
  const asked = coda.voices.reduce((total, voice) => total + voice.gain, 0);
  const levelScale = asked > ceiling && asked > 0 ? ceiling / asked : 1;

  const held = (
    voice: PerformedVoice,
    id: string,
    role: AudioVoiceRole,
    degree: number,
    atSeconds: number
  ): PlannedNote =>
    Object.freeze({
      id,
      conceptId: voice.conceptId,
      role,
      timbre: voice.timbre,
      articulation: "sustained" as MotifArticulation,
      register: voice.register,
      degree,
      frequency: degreeFrequency(options.mode, degree, voice.register),
      detuneCents: 0,
      atSeconds: Number(atSeconds.toFixed(5)),
      envelope: envelopeFor("sustained", Math.max(0.5, voice.durationSeconds)),
      gain: Number((voice.gain * levelScale).toFixed(6)),
      floorGain: 0,
      openEnded: !coda.resolves,
      // A suspension has two members and both of them are tense; a sonority that
      // comes to rest has none. Marked on the note so `auditComfort` can measure
      // the ending on the same timeline as everything else.
      tense: !coda.resolves,
    });

  const groundDegree = ground?.degrees[0] ?? 0;
  if (ground !== undefined) {
    notes.push(
      held(
        ground,
        `${coda.threadId}:coda:ground`,
        "pedal",
        groundDegree,
        // Section-relative: the section itself is placed at `coda.atSeconds`.
        0
      )
    );
  }
  let interval = 0;
  if (answer !== undefined) {
    const reach = (answer.degrees[0] ?? 0) - groundDegree;
    interval = coda.resolves
      ? nearestStableDegree(options.mode, reach)
      : nearestTenseDegree(options.mode, reach);
    notes.push(
      held(
        answer,
        `${coda.threadId}:coda:answer`,
        "answer",
        groundDegree + interval,
        Math.max(0, answer.atSeconds - coda.atSeconds)
      )
    );
  }

  const plan = makeVoicePlan({
    id: `conclusion:coda:${coda.threadId}`,
    kind: "conclusion",
    intention: null,
    notes,
    meta: {
      conceptIds: coda.conceptIds,
      grammar: coda.resolves ? "coda" : "coda:unclosed",
      resolves: coda.resolves,
      interval,
      beatingHz: null,
      // The ending reports on the web, not on any one pair's epistemic status.
      outcome: null,
    },
  });

  return Object.freeze({
    kind: "coda" as const,
    threadId: coda.threadId,
    atSeconds,
    // Belt and braces, at the second place a bound can be lost: `levelScale`
    // above already brings both forms under the ceiling, so for the suspended
    // form this is provably a no-op — and if it ever stops being one, that is a
    // defect it will have caught rather than shipped.
    plan: coda.resolves ? plan : capTenseGain(plan, ceiling),
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

  /*
   * WHERE THE ROOM IS EMPTY AGAIN.
   *
   * The compiler states the ending in beats, and it is right about the beat: the
   * coda begins where the last thread and the last ensemble have finished
   * *on the grid*. Sounding them is not on the grid — an articulation rings past
   * its note, and a sustained line rings a long way past it. Left at the compiled
   * moment the ending arrived while four voices were still decaying over it, at
   * a fraction of their level, which is not an ending anyone would hear.
   *
   * So the beat is a floor and this is the adjustment: the ending speaks when
   * the room is clear, or when the compiler placed it, whichever is later, plus
   * a breath. It is the one time in this module that a compiled moment is not
   * obeyed exactly, and the reason is the one thing the compiler cannot know —
   * how long the bodies it chose actually ring for.
   */
  const clearAt = sections.reduce(
    (last, section) => Math.max(last, section.atSeconds + section.plan.durationSeconds),
    0
  );
  const silentAt =
    score.coda === null ? score.totalSeconds : Math.max(score.coda.atSeconds, clearAt);

  // The loose ends ring up to the silence and hand over; the ending speaks after
  // it. Nothing sounds in between, which is what makes the ending an ending.
  for (const unresolved of score.unresolved) {
    sections.push(renderUnresolved(unresolved, silentAt, options));
  }
  if (score.coda !== null) {
    sections.push(
      renderCoda(
        score.coda,
        silentAt + SCORE.conclusion.breathBeforeCodaSeconds,
        options
      )
    );
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
