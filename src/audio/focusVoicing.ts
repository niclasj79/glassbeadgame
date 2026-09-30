/**
 * THE FOCUS VOICE — what the score says while the player looks, chooses, and
 * returns (M2-012, I-016 to I-019).
 *
 * Attention became a place. The player attends a bead, sweeps a lens over the
 * others, locks a second, and only then hears Echo, Passage, Tension, or Ground
 * *on that pair*, before making the reading. Four moments earn a sound, and this
 * file plans each of them:
 *
 *   sighting   the bead under the lens answers, once, in its own voice;
 *   exchange   the locked pair speaks in turn — the pair is the object;
 *   reading    one bar of the pair in the grammar of the intention being heard;
 *   recall     a committed thread's phrase, returned to softly.
 *
 * Three laws run through all of them, and each is a reason for a line below.
 *
 *  - **Looking asserts nothing.** A sighting is one concept, alone, in the body
 *    it already has. Two motifs sounding together make an interval, and this game
 *    reserves an interval for a relation the player actually declared (the same
 *    argument `beadClink` makes about two discs touching). So a sighting never
 *    sounds the attended motif under the sighted one, and the lock *alternates*
 *    the pair instead of stacking it. The concept is never re-voiced, transposed,
 *    or prettified: a bead learned by ear under attention must be the same bead
 *    when it is answered by the lens.
 *
 *  - **Nothing here reads the record.** Every planner takes motifs, an
 *    intention, and a weight — and nothing else. A plan therefore cannot depend
 *    on whether a pair is documented, an Open Thread, or unresolved, because it
 *    is never told (CAV-006). A preview never closes for the same reason: closing
 *    is what a documented relation does at commit, and a hover that closed would
 *    tell the player something the Game has not yet said.
 *
 *  - **A bar is not a phrase.** A hover is heard in passing, so it must fit in
 *    a second or so and be finished with quickly. That is a matter of *fitting*,
 *    never of rewriting: the reading is planned by `grammar.ts` exactly as it
 *    will be woven — the same interval, the same suspension, the same beating
 *    rate for the same pair — and only its tempo, its length, and its level are
 *    then brought into the bar. Every one of those adjustments shortens a note or
 *    lowers its peak; none lengthens one, adds a voice, or raises a note above the
 *    peak the grammar gave it. The bounds CAV-007 states are on peaks, counts and
 *    rates, so none of them can be lost here.
 *
 * Every level and every duration is in `FOCUS_VOICING`, one table for the person
 * tuning by ear. They are taste, not comfort, and belong beside `SCORE`; they
 * live here only because `score.ts` is not part of this workstream.
 *
 * Pure. No Web Audio, no browser, no React.
 */
import type { RelationIntention } from "@/domain/events";
import { planRelationVoices } from "./grammar";
import type { WorldMode } from "./mode";
import { motifSpanSeconds, renderMotif, type MotifSource } from "./motif";
import { makeVoicePlan, type PlannedNote, type VoicePlan } from "./plan";
import { SCORE } from "./score";

/** The relation-neutral band a candidate carries (CAV-003, CAV-004). */
export type ResonanceBand = "weak" | "medium" | "high";

/**
 * How a reading is being heard.
 *
 *  - `hover`   a pointer resting on a sigil: quiet, short, and finished with fast;
 *  - `chosen`  the reading taken, by a press or by keyboard focus: fuller and one
 *              whole bar;
 *  - `recall`  a committed thread returned to: soft and unhurried — a long bar,
 *              at the phrase's own tempo wherever it fits.
 */
export type ReadingWeight = "hover" | "chosen" | "recall";

interface WeightProfile {
  /** Fraction of the grammar's own level. Strictly below the commit's, which is 1. */
  readonly level: number;
  /**
   * No note begins at or after this many seconds. A phrase longer than the bar is
   * first drawn in, by tempo, until it fits — so the bar holds the whole gesture
   * of the grammar (the answer entering, the handoff crossing) and not only its
   * opening. A phrase that already fits keeps its authored tempo.
   */
  readonly barSeconds: number;
  /** How far past the bar the last notes may ring. */
  readonly tailSeconds: number;
  /** Longest a note may take to arrive. A pedal that swells for 2.4 s is not heard in a bar. */
  readonly attackCapSeconds: number;
}

export const FOCUS_VOICING = Object.freeze({
  /**
   * Seconds between a cue and the first sound it earns. It is scheduling room —
   * the look-ahead scheduler drops a note that is already in the past, and a
   * cue handled a few milliseconds before the next tick would lose its first
   * note — and it is also how long a superseded voice takes to fade. The old
   * voice is gone by the time the new one begins, and 60 ms is still immediate.
   * The lead must not be shorter than the fade, or a new voice begins under the
   * one it replaces.
   */
  leadSeconds: 0.06,
  fadeSeconds: 0.06,

  /**
   * THE SIGHTED BEAD ANSWERS. Levels are fractions of the ambient bed, the same
   * unit the grammar is sized in. The ladder they sit on, from the top: the
   * attended figure on Attend (0.95), the lock (0.72), then these. `weak` is
   * about 0.057 in absolute terms — above the hover ping (0.045), the quietest
   * deliberate sound in the game — so it is clearly audible and never silent.
   */
  sighting: Object.freeze({
    level: Object.freeze({ high: 0.55, medium: 0.42, weak: 0.3 } as const),
    /** A sighting states the opening of the figure, not all of it. */
    barSeconds: 1.1,
    tailSeconds: 0.4,
    /**
     * Onsets at least this far apart. A lens crossing a crowded cluster changes
     * bead many times a second, and an answer per bead would machine-gun. The
     * same reason the glass-contact bounds exist (`COMFORT.contact`).
     */
    windowSeconds: 0.2,
  }),

  /** THE PAIR IS THE OBJECT: the attended figure calls, the second answers. */
  exchange: Object.freeze({
    callLevel: 0.72,
    responseLevel: 0.64,
    /** Each statement is the opening of its figure, at most this long. */
    barSeconds: 0.9,
    tailSeconds: 0.5,
    /** Breath between call and response. The call's tail is cut to it, so they alternate. */
    gapSeconds: 0.12,
  }),

  /** THE READING, HEARD BEFORE IT IS MADE. */
  reading: Object.freeze({
    /**
     * No slower than this fraction of the authored tempo. Below it a phrase is
     * truncated instead, because a figure drawn in far enough stops being that
     * figure.
     */
    minTempo: 0.2,
    /**
     * A Tension's tense pair is capped below the bed (CAV-007), which makes it
     * the quietest of the four, and the low register it suspends in the hardest
     * to hear on a small speaker. Its share of that ceiling is raised so the
     * beating is still there to be heard. `scalePlanGain` never amplifies, so
     * the ceiling itself is untouched.
     */
    tensionLift: 1.3,
    weights: Object.freeze({
      hover: Object.freeze({
        level: 0.42,
        barSeconds: 1.4,
        tailSeconds: 0.35,
        attackCapSeconds: 0.4,
      }),
      chosen: Object.freeze({
        level: 0.62,
        barSeconds: 2.0,
        tailSeconds: 0.6,
        attackCapSeconds: 0.4,
      }),
      recall: Object.freeze({
        level: 0.45,
        barSeconds: 4.0,
        tailSeconds: 1.2,
        attackCapSeconds: 1.4,
      }),
    } as const satisfies Readonly<Record<ReadingWeight, WeightProfile>>),
  }),

  /**
   * THE LANE. Only one thing about the pair is said at a time. Where a sink can
   * take a voice back, that is what happens. Where it cannot, an overlap is
   * bounded instead: each voice still sounding under a new one ducks it to
   * `overlapDuck`, and a voice that would fall below `minScale` is not played
   * rather than played on top. `audibleReleaseFraction` is how far into its
   * release a voice still counts as sounding — an exponential fall is 20 dB down
   * a third of the way through.
   */
  lane: Object.freeze({
    overlapDuck: 0.6,
    minScale: 0.35,
    audibleReleaseFraction: 0.35,
  }),
});

const round5 = (value: number): number => Number(value.toFixed(5));
const round6 = (value: number): number => Number(value.toFixed(6));
const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value;

function assertUnit(unitSeconds: number): void {
  if (unitSeconds <= 0) {
    throw new RangeError("a rhythmic unit must be a positive number of seconds");
  }
}

// ─── Fitting material into a bar ────────────────────────────────────────────

export interface BarFit {
  /** No note begins at or after this many seconds. */
  readonly barSeconds: number;
  /** How far past the bar the last notes may ring. */
  readonly tailSeconds: number;
  /** Longest a note may take to arrive. Omitted means the note keeps its own. */
  readonly attackCapSeconds?: number;
}

/** Never let a note be shorter than this: a click is not a note. */
const MIN_BODY_SECONDS = 0.05;

function fitNote(note: PlannedNote, fit: BarFit): PlannedNote | null {
  // Never begins after the bar. Onsets are otherwise untouched: rhythm is the
  // identity of a figure, and a fitted bar keeps every rhythm it keeps at all.
  if (note.atSeconds >= fit.barSeconds) return null;
  const room = fit.barSeconds + fit.tailSeconds - note.atSeconds;
  const attack = Math.min(
    note.envelope.attack,
    fit.attackCapSeconds ?? Number.POSITIVE_INFINITY,
    Math.max(0.005, room - MIN_BODY_SECONDS)
  );
  const bodyRoom = Math.max(0, room - attack);
  const body = note.envelope.hold + note.envelope.release;
  const scale = body > bodyRoom && body > 0 ? bodyRoom / body : 1;
  return Object.freeze({
    ...note,
    envelope: Object.freeze({
      attack: round5(attack),
      hold: round5(note.envelope.hold * scale),
      release: round5(note.envelope.release * scale),
    }),
    // A floor is how an instability persists past the twelve seconds CAV-007
    // bounds. A bar is shorter than that, so it holds its level and lets go.
    floorGain: 0,
  });
}

function fitNotes(
  notes: readonly PlannedNote[],
  fit: BarFit
): readonly PlannedNote[] {
  const fitted: PlannedNote[] = [];
  for (const note of notes) {
    const next = fitNote(note, fit);
    if (next !== null) fitted.push(next);
  }
  return fitted;
}

/**
 * Fit a plan into a bar.
 *
 * This can only shorten. A note that would begin after the bar is dropped; a note
 * that would ring past the bar's tail has its hold and release scaled together,
 * so its shape survives; a slow attack is capped. Nothing is lengthened, moved,
 * or raised above its planned peak, which is why a tense simultaneity that was
 * inside CAV-007 when the grammar planned it is inside it afterwards (it only
 * ever has fewer, or shorter, voices at no higher a peak), and why the audit in
 * the tests can be run on the result.
 *
 * One thing it does change, deliberately: a tense voice's floor. The floor is how
 * an instability persists beyond the twelve seconds CAV-007 bounds; a bar is a
 * second or two, so the voice holds its peak and lets go instead of decaying.
 */
export function fitToBar(plan: VoicePlan, fit: BarFit): VoicePlan {
  const notes = fitNotes(plan.notes, fit);
  const shortestTenseHold = notes
    .filter((note) => note.tense)
    .reduce((least, note) => Math.min(least, note.envelope.hold), Number.POSITIVE_INFINITY);
  const beatings = plan.beatings
    .filter((beating) => beating.atSeconds < fit.barSeconds)
    .map((beating) =>
      Object.freeze({
        ...beating,
        floorGain: 0,
        decayToFloorSeconds: round5(
          Math.min(beating.decayToFloorSeconds, shortestTenseHold)
        ),
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

/**
 * Bring a plan's level down. It never brings it up: a factor above one is one,
 * so the ceiling a planner sized a tense simultaneity under cannot be lost here.
 */
export function scalePlanGain(plan: VoicePlan, factor: number): VoicePlan {
  const scale = clamp(Number.isFinite(factor) ? factor : 0, 0, 1);
  if (scale === 1) return plan;
  return makeVoicePlan({
    id: plan.id,
    kind: plan.kind,
    intention: plan.intention,
    notes: plan.notes.map((note) =>
      Object.freeze({
        ...note,
        gain: round6(note.gain * scale),
        floorGain: round6(note.floorGain * scale),
      })
    ),
    beatings: plan.beatings.map((beating) =>
      Object.freeze({
        ...beating,
        gain: round6(beating.gain * scale),
        floorGain: round6(beating.floorGain * scale),
      })
    ),
    meta: plan.meta,
  });
}

/** The same plan under another id. Notes keep theirs, so humanising stays the same. */
function withId(plan: VoicePlan, id: string): VoicePlan {
  return makeVoicePlan({
    id,
    kind: plan.kind,
    intention: plan.intention,
    notes: plan.notes,
    beatings: plan.beatings,
    meta: plan.meta,
  });
}

/** Seconds from a plan's start to where its last voice falls silent. Notes only. */
export function audibleEndSeconds(plan: VoicePlan): number {
  let end = 0;
  for (const note of plan.notes) {
    end = Math.max(
      end,
      note.atSeconds +
        note.envelope.attack +
        note.envelope.hold +
        note.envelope.release
    );
  }
  return round5(end);
}

const shiftNotes = (
  notes: readonly PlannedNote[],
  offset: number
): readonly PlannedNote[] =>
  notes.map((note) =>
    Object.freeze({ ...note, atSeconds: round5(note.atSeconds + offset) })
  );

// ─── 1. The sighted bead answers ────────────────────────────────────────────

export interface SightingInput {
  readonly planId: string;
  readonly mode: WorldMode;
  /** The bead under the lens. Its own figure, in its own body, alone. */
  readonly sighted: MotifSource;
  readonly band: ResonanceBand;
  readonly unitSeconds: number;
  /** The bed the level is a fraction of. */
  readonly ambientGain: number;
}

/**
 * One statement of the sighted concept's figure at a level set by its band —
 * high above medium above weak, and weak still clearly there.
 *
 * The band says how much material for thought a bead offers; it does not say the
 * pair is right, and the sound does not either. There is no target-lock ping,
 * nothing that arrives only for the strongest bead, and no interval against the
 * attended figure. The answer is the concept, a little louder or a little softer.
 */
export function planSightingAnswer(input: SightingInput): VoicePlan {
  assertUnit(input.unitSeconds);
  const table = FOCUS_VOICING.sighting;
  const notes = renderMotif(input.sighted, {
    mode: input.mode,
    at: 0,
    unitSeconds: input.unitSeconds,
    gain: input.ambientGain * table.level[input.band],
    role: "answer",
    idPrefix: `${input.planId}:answer`,
  });
  return fitToBar(
    makeVoicePlan({
      id: input.planId,
      kind: "attention",
      intention: null,
      notes,
      meta: {
        conceptIds: [input.sighted.conceptId],
        grammar: "sighting",
        // Attention asserts nothing and therefore never closes anything.
        resolves: false,
        interval: null,
        beatingHz: null,
        outcome: null,
      },
    }),
    { barSeconds: table.barSeconds, tailSeconds: table.tailSeconds }
  );
}

// ─── 2. The pair is the object ──────────────────────────────────────────────

export interface ExchangeInput {
  readonly planId: string;
  readonly mode: WorldMode;
  /** The attended bead. It calls. */
  readonly attended: MotifSource;
  /** The bead just locked. It answers. */
  readonly second: MotifSource;
  readonly unitSeconds: number;
  readonly ambientGain: number;
}

/**
 * Call and response: the attended figure states its opening, a breath, then the
 * second bead states its own. Never together — that would be an interval, and no
 * reading has been chosen yet. Each figure is unaltered and in its own body; what
 * the lock adds is only that they are now heard as two halves of one thing.
 */
export function planPairExchange(input: ExchangeInput): VoicePlan {
  assertUnit(input.unitSeconds);
  const table = FOCUS_VOICING.exchange;

  const statement = (
    source: MotifSource,
    level: number,
    role: PlannedNote["role"],
    tailSeconds: number
  ): { notes: readonly PlannedNote[]; span: number } => {
    // How long the figure really lasts, when that is less than the bar. The
    // fit is taken against *that*, so a short figure does not ring past its own
    // end into whatever follows it.
    const span = Math.min(
      table.barSeconds,
      motifSpanSeconds(source.motif, input.unitSeconds)
    );
    return {
      notes: fitNotes(
        renderMotif(source, {
          mode: input.mode,
          at: 0,
          unitSeconds: input.unitSeconds,
          gain: input.ambientGain * level,
          role,
          idPrefix: `${input.planId}:${role}`,
        }),
        { barSeconds: span, tailSeconds }
      ),
      span,
    };
  };

  // The call may not ring into the response: its tail is cut to the breath.
  const call = statement(input.attended, table.callLevel, "subject", table.gapSeconds);
  const response = statement(
    input.second,
    table.responseLevel,
    "answer",
    table.tailSeconds
  );
  const answersAt = round5(call.span + table.gapSeconds);

  return makeVoicePlan({
    id: input.planId,
    kind: "attention",
    intention: null,
    notes: [...call.notes, ...shiftNotes(response.notes, answersAt)],
    meta: {
      conceptIds: [input.attended.conceptId, input.second.conceptId],
      grammar: "exchange",
      resolves: false,
      interval: null,
      beatingHz: null,
      outcome: null,
    },
  });
}

// ─── 3. The reading, heard before it is made ────────────────────────────────

export interface ReadingInput {
  /**
   * Seeds every voice id, and with them the deterministic phrasing and
   * humanising. The weight is not part of it, so the same pair in the same
   * grammar sounds like itself whether it is hovered, chosen, or recalled.
   */
  readonly seed: string;
  readonly mode: WorldMode;
  readonly intention: RelationIntention;
  /** The attended concept — the reading's subject. */
  readonly a: MotifSource;
  /** The concept locked beside it — the reading's object. */
  readonly b: MotifSource;
  readonly weight: ReadingWeight;
  readonly unitSeconds: number;
  /** The level the grammar is sized against — the bed. */
  readonly ambientGain: number;
  /**
   * The bed **as it sounds now**. The Tension ceiling is a fraction of it and of
   * nothing else, exactly as in `planRelationVoices`.
   */
  readonly bedGain: number;
}

/**
 * Where a phrase ends, for the purpose of fitting its tempo to a bar: the last
 * moment its *melodic* voices are still arriving. A pedal and a carrier are
 * sustained under the melody and would make every Ground and Passage look ten
 * seconds long; a Tension does not depend on the motifs' lengths at all.
 *
 * Ground is measured over one pass of the grounded figure. The grammar plays it
 * twice, and a bar has room for one.
 */
function phraseSeconds(planned: VoicePlan, input: ReadingInput): number {
  if (input.intention === "tension") return 0;
  if (input.intention === "ground") {
    // The grammar names the concept it grounds *on* first and the one that
    // continues above it second; the figure that has to fit is the second.
    const above =
      planned.meta.conceptIds[1] === input.a.conceptId ? input.a : input.b;
    return (
      input.unitSeconds * SCORE.grammar.groundEntryUnits +
      motifSpanSeconds(above.motif, input.unitSeconds)
    );
  }
  let end = 0;
  for (const note of planned.notes) {
    if (note.role !== "subject" && note.role !== "answer") continue;
    end = Math.max(end, note.atSeconds + note.envelope.attack + note.envelope.hold);
  }
  return end;
}

/**
 * One bar of the pair in the grammar of one intention.
 *
 * The plan is the woven relation, made by `planRelationVoices` — so Echo still
 * imitates at the pair's shared interval, Passage still hands one figure into
 * the other, Tension still holds its compound suspension and beats at its
 * pair-keyed rate, and Ground still keeps its pedal still. It is planned as an
 * *unclosed* phrase. Then it is brought into the bar: half of all authored
 * motifs last longer than a slot, and Echo's answer enters half a figure late, so
 * a long pair would otherwise reach the end of its bar before the imitation had
 * begun — and a hovered Passage would never reach the second concept at all. The
 * tempo is drawn in until the phrase fits (never below `minTempo`), so each bar
 * is a complete sketch of its grammar rather than the front half of one; every
 * note that would still begin after the bar is dropped, and the tails are
 * clipped. Only then is it made quieter.
 *
 * Nothing about the record is an input, and the result is a pure function of the
 * pair, the intention, and the weight — reproducible under a fixed state.
 */
export function planReadingBar(input: ReadingInput): VoicePlan {
  assertUnit(input.unitSeconds);
  const table = FOCUS_VOICING.reading;
  const weight: WeightProfile = table.weights[input.weight];

  const plan = (unitSeconds: number): VoicePlan =>
    planRelationVoices({
      planId: input.seed,
      mode: input.mode,
      intention: input.intention,
      a: input.a,
      b: input.b,
      unitSeconds,
      ambientGain: input.ambientGain,
      bedGain: input.bedGain,
      // A preview claims nothing about the record, so it does not close.
      resolves: false,
    });

  let planned = plan(input.unitSeconds);
  const phrase = phraseSeconds(planned, input);
  if (phrase > weight.barSeconds) {
    const tempo = clamp(weight.barSeconds / phrase, table.minTempo, 1);
    planned = plan(input.unitSeconds * tempo);
  }

  const fitted = fitToBar(planned, {
    barSeconds: weight.barSeconds,
    tailSeconds: weight.tailSeconds,
    attackCapSeconds: weight.attackCapSeconds,
  });
  const level =
    weight.level * (input.intention === "tension" ? table.tensionLift : 1);
  return withId(scalePlanGain(fitted, level), `${input.seed}:${input.weight}`);
}
