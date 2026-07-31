/**
 * THE RELATION GRAMMAR — four transformations, each recognisable by ear.
 *
 * This is the file the whole audio layer exists for. A player declares a reading
 * of two concepts; the score has to *say that reading back* in music, distinctly
 * enough that Echo and Passage are never mistaken for each other, and honestly
 * enough that Tension is never quietly resolved into something more comfortable.
 *
 * The four grammars, and the constraint each one is under
 * (VERTICAL-SLICE-SPEC §11, CONTENT-AUDIOVISUAL-REFERENCE cross-category table):
 *
 *   Echo      A's figure returns in B's body, staggered, at a shared interval.
 *             Constraint: never a plain unison. Imitation is only audible as
 *             imitation if the answer is displaced in *time* and in *pitch*
 *             while keeping the *rhythm* — so the stagger is a whole number of
 *             rhythmic units and the answer's rhythm is A's, untouched.
 *
 *   Passage   One line that begins as A and ends as B. Constraint: directional.
 *             Contour, rhythm, register, and timbre all cross over inside one
 *             continuous line, so what you hear is transformation rather than
 *             two motifs played in order.
 *
 *   Tension   A compound tense interval held, with one deliberately detuned
 *             twin producing controlled beating. Constraint: it does not
 *             resolve, ever, and it obeys CAV-007 exactly — 0.8–6.5 Hz beating,
 *             at most three sounding voices, summed gain below the ambient bed,
 *             amplitude to a low floor within twelve seconds while the
 *             instability itself continues.
 *
 *   Ground    An invariant pedal beneath a motif that continues, unaltered,
 *             above it. Constraint: the pedal does not move. Not by a step, not
 *             by an octave. Its whole meaning is that it stays.
 *
 * `planRelationVoices()` is pure: motif + motif + intention → a `VoicePlan`. It
 * touches no AudioContext, so every claim above is asserted in a Node test
 * rather than trusted.
 */
import type { RelationIntention } from "@/domain/events";
import type { MotifArticulation, TimbreId } from "@/content/castalia/schema";
import { clampBeatingHz, tensionCeiling } from "./comfort";
import { COMFORT } from "./comfort";
import {
  anchorDegree,
  deterministicUnit,
  envelopeFor,
  motifSpanSeconds,
  motifUnits,
  phrasedUnitSeconds,
  renderMotif,
  NEUTRAL_PHRASING,
  type AudioPhrasing,
  type MotifSource,
} from "./motif";
import {
  centsForBeatingHz,
  degreeFrequency,
  intervalClass,
  nearestStableDegree,
  nearestTenseDegree,
  pitchClass,
  registerIndex,
  registerAt,
  shiftRegister,
  type WorldMode,
} from "./mode";
import {
  makeVoicePlan,
  type AudioOutcomeKind,
  type PlannedBeating,
  type PlannedNote,
  type VoicePlan,
} from "./plan";
import { SCORE } from "./score";

export interface RelationPlanInput {
  /** Stable identity. Seeds every voice id and all deterministic phrasing. */
  readonly planId: string;
  readonly mode: WorldMode;
  readonly intention: RelationIntention;
  /** The attended concept — the reading's subject. */
  readonly a: MotifSource;
  /** The candidate concept — the reading's object. */
  readonly b: MotifSource;
  /** One rhythm unit: a sixteenth of the world's phrase slot. */
  readonly unitSeconds: number;
  /**
   * The level this relation is *sized against* — how loud it should be relative
   * to the room it speaks into.
   */
  readonly ambientGain: number;
  /**
   * The ambient bed **as it actually sounds right now**, after every scale the
   * score has applied. CAV-007 caps the tense pair below the bed, and the review
   * found that cap being computed against `ambientGain` instead — which during
   * Attunement is a different, louder number. The two are separate fields so
   * that confusing them again requires saying so.
   */
  readonly bedGain: number;
  readonly phrasing?: AudioPhrasing;
  /**
   * Whether the phrase closes. A documented relation closes; an Open Thread and
   * an unresolved outcome do not (CAV-006). Tension never closes regardless.
   */
  readonly resolves: boolean;
  /**
   * Which concept grounds the other, for Ground. Omitted means the lower
   * register grounds, with ties going to the candidate — a deterministic rule,
   * stated rather than inferred, because the content does not author direction
   * for Ground and the audio layer must not invent one.
   */
  readonly ground?: "a" | "b";
  /**
   * The epistemic state this plan speaks for (CAV-006). Carried into the plan's
   * meta so the captioned path can distinguish an Open Thread from a weak
   * outcome, which `resolves` alone cannot — both decline to close.
   */
  readonly outcome?: AudioOutcomeKind;
}

// ─── Interval selection ─────────────────────────────────────────────────────

/**
 * The interval an Echo imitates at.
 *
 * "Shared interval structure" is taken literally: the answer is transposed by an
 * interval both motifs already contain, so the imitation rhymes with something
 * genuinely present in each. Unison is excluded — an imitation at the unison is
 * a doubling, not an answer. Where the two share nothing, the perfect fifth is
 * the fallback, which is what a canon does when it has no better reason.
 */
export function imitationInterval(
  mode: WorldMode,
  a: MotifSource,
  b: MotifSource
): number {
  const classesOf = (source: MotifSource): Set<number> => {
    const out = new Set<number>();
    for (let i = 1; i < source.motif.degrees.length; i++) {
      out.add(intervalClass(source.motif.degrees[0], source.motif.degrees[i]));
    }
    return out;
  };
  const inA = classesOf(a);
  const inB = classesOf(b);
  const shared = [...inA].filter((c) => c !== 0 && inB.has(c)).sort((x, y) => x - y);
  const stable = shared.filter((c) => mode.stable.includes(c));
  if (stable.length > 0) return stable[stable.length - 1];
  if (shared.length > 0) return shared[shared.length - 1];
  return SCORE.grammar.echoFallbackInterval;
}

/** Shortest distance between two semitone classes, around the circle. */
function classDistance(a: number, b: number): number {
  const d = Math.abs(pitchClass(a) - pitchClass(b));
  return Math.min(d, 12 - d);
}

/**
 * How often each interval class occurs between and within a pair of contours.
 *
 * Cross intervals — every degree of one motif against every degree of the other
 * — weigh more than intervals internal to a single motif, because a Tension is
 * about how the two rub against *each other*. The unison is discarded: it says
 * nothing about how two contours differ, and in this content pack twenty-three
 * of twenty-four motifs open on degree 0, so counting it would drown everything
 * else out. That is exactly how the previous rule became degenerate.
 */
function intervalWeights(a: MotifSource, b: MotifSource): readonly number[] {
  const weight = new Array<number>(12).fill(0);
  for (const da of a.motif.degrees) {
    for (const db of b.motif.degrees) {
      weight[intervalClass(da, db)] += SCORE.grammar.suspensionCrossWeight;
    }
  }
  for (const source of [a, b]) {
    const degrees = source.motif.degrees;
    for (let i = 0; i < degrees.length; i++) {
      for (let j = i + 1; j < degrees.length; j++) {
        weight[intervalClass(degrees[i], degrees[j])] +=
          SCORE.grammar.suspensionWithinWeight;
      }
    }
  }
  weight[0] = 0;
  return weight;
}

/**
 * The tense interval class a Tension suspends on.
 *
 * The previous rule read only the two motifs' *first* degrees. Against the
 * shipped pack that is very nearly a constant — twenty-three of the twenty-four
 * concepts anchor on the same pitch class — so 253 of the 276 possible pairs
 * suspended on the identical minor second, and every Tension in the game sounded
 * like every other one.
 *
 * The rule now reads the whole of both contours. Each tense class is scored by
 * how strongly the pair implies it: an exact occurrence counts heavily, and a
 * class one semitone away counts a little, so a pair whose motifs never actually
 * rub still gets a suspension leaning on the interval they *do* have rather than
 * a default. The pair is canonically ordered first, so the same two concepts
 * always suspend the same way whichever one is the subject.
 *
 * Over the shipped 24 this reaches all five tense classes, and no single class
 * accounts for more than about a third of the pairs.
 */
export function suspensionInterval(
  mode: WorldMode,
  a: MotifSource,
  b: MotifSource
): number {
  const [first, second] = a.conceptId <= b.conceptId ? [a, b] : [b, a];
  const weight = intervalWeights(first, second);
  let best = mode.tense[0];
  let bestScore = -1;
  for (const candidate of mode.tense) {
    let score = 0;
    for (let observed = 1; observed < 12; observed += 1) {
      const distance = classDistance(observed, candidate);
      if (distance === 0) score += weight[observed] * SCORE.grammar.suspensionExactWeight;
      else if (distance === 1) score += weight[observed];
    }
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/**
 * The beat rate a relation takes. Deterministic, and inside CAV-007 by
 * construction — the band comes from the comfort table and only the position
 * within it is taste.
 */
export function beatingRateFor(planId: string): number {
  const span = COMFORT.beating.maxHz - COMFORT.beating.minHz;
  // Weighted toward the slower half: slow beating reads as breathing, fast
  // beating reads as a fault.
  const unit = deterministicUnit(`beat:${planId}`);
  return clampBeatingHz(
    COMFORT.beating.minHz +
      span * (SCORE.grammar.beatingBandFloor + unit * SCORE.grammar.beatingBandSpread)
  );
}

/** The key two concepts beat by, so the same relation always beats alike. */
export function beatingKeyFor(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

// ─── Echo ───────────────────────────────────────────────────────────────────

function planEcho(input: RelationPlanInput): VoicePlan {
  const { mode, a, b, planId } = input;
  const phrasing = input.phrasing ?? NEUTRAL_PHRASING;
  const interval = imitationInterval(mode, a, b);
  const units = motifUnits(a.motif);
  // A whole number of units, strictly inside the subject, so entries overlap.
  const staggerUnits = Math.min(
    Math.max(1, Math.round(units * SCORE.grammar.echoStaggerFraction)),
    Math.max(1, units - 1)
  );
  // Quantised *after* phrasing, not before. The subject is laid out on the
  // gesture's own grid, so a stagger measured in nominal units lands between
  // that grid's lines under any breadth but the neutral one — which is exactly
  // what stopped the imitation reading as imitation.
  const unit = phrasedUnitSeconds(input.unitSeconds, phrasing);
  const stagger = staggerUnits * unit;
  const bed = input.ambientGain;

  const subject = renderMotif(a, {
    mode,
    at: 0,
    unitSeconds: input.unitSeconds,
    gain: bed * SCORE.grammar.subjectGain,
    role: "subject",
    idPrefix: `${planId}:subject`,
    phrasing,
  });

  const lastDegree = a.motif.degrees[a.motif.degrees.length - 1] ?? 0;
  // The answer speaks for B — B's body, B's articulation — using A's figure.
  // That is the imitation: the same thought in another voice.
  const answer = renderMotif(
    { conceptId: b.conceptId, motif: a.motif },
    {
      mode,
      at: stagger,
      unitSeconds: input.unitSeconds,
      gain: bed * SCORE.grammar.answerGain,
      role: "answer",
      idPrefix: `${planId}:answer`,
      timbre: b.motif.timbre,
      register: b.motif.register,
      articulation: b.motif.articulation,
      transpose: interval,
      phrasing,
      openEnded: !input.resolves,
      finalDegree: input.resolves
        ? undefined
        : nearestTenseDegree(mode, lastDegree + interval) - interval,
    }
  );

  const notes: PlannedNote[] = [...subject, ...answer];

  if (input.resolves) {
    // The two entries agree on one pitch. Nothing new is asserted by it; it is
    // the cadence that tells the ear the imitation was complete.
    const at = stagger + motifSpanSeconds(a.motif, input.unitSeconds, phrasing);
    const degree = nearestStableDegree(mode, anchorDegree(a.motif));
    notes.push(
      Object.freeze({
        id: `${planId}:close`,
        conceptId: a.conceptId,
        role: "residue" as const,
        timbre: a.motif.timbre,
        articulation: "rung" as MotifArticulation,
        register: a.motif.register,
        degree,
        frequency: degreeFrequency(mode, degree, a.motif.register),
        detuneCents: 0,
        atSeconds: Number(at.toFixed(5)),
        envelope: envelopeFor("rung", input.unitSeconds * 4, phrasing),
        gain: Number((bed * SCORE.grammar.residueGain).toFixed(5)),
        floorGain: 0,
        openEnded: false,
        tense: false,
      })
    );
  }

  return makeVoicePlan({
    id: planId,
    kind: "relation",
    intention: "echo",
    notes,
    meta: {
      conceptIds: [a.conceptId, b.conceptId],
      grammar: "imitation",
      resolves: input.resolves,
      interval,
      beatingHz: null,
      outcome: input.outcome ?? null,
    },
  });
}

// ─── Passage ────────────────────────────────────────────────────────────────

function sampleContour(degrees: readonly number[], position: number): number {
  if (degrees.length === 0) return 0;
  const index = Math.round(position * (degrees.length - 1));
  return degrees[Math.min(degrees.length - 1, Math.max(0, index))];
}

function sampleRhythm(rhythm: readonly number[], position: number, fallback: number): number {
  if (rhythm.length === 0) return fallback;
  const index = Math.round(position * (rhythm.length - 1));
  return Math.max(1, rhythm[Math.min(rhythm.length - 1, Math.max(0, index))] ?? fallback);
}

function planPassage(input: RelationPlanInput): VoicePlan {
  const { mode, a, b, planId } = input;
  const phrasing = input.phrasing ?? NEUTRAL_PHRASING;
  const bed = input.ambientGain;

  const steps = a.motif.degrees.length + b.motif.degrees.length;
  const fromRegister = registerIndex(a.motif.register);
  const toRegister = registerIndex(b.motif.register);
  const crossover = Math.floor(steps / 2);

  const notes: PlannedNote[] = [];
  let cursor = 0;

  for (let i = 0; i < steps; i++) {
    const w = steps === 1 ? 1 : i / (steps - 1);
    const fromA = sampleContour(a.motif.degrees, w);
    const fromB = sampleContour(b.motif.degrees, w);
    // The contour itself is what transforms — an interpolation, rounded to the
    // mode's semitone grid, so the line audibly leaves one shape and arrives at
    // the other rather than jump-cutting between two motifs.
    let degree = Math.round(fromA * (1 - w) + fromB * w);
    if (i === 0) degree = a.motif.degrees[0] ?? degree;
    if (i === steps - 1) {
      const target = b.motif.degrees[b.motif.degrees.length - 1] ?? degree;
      degree = input.resolves ? target : nearestTenseDegree(mode, target);
    }

    const past = i >= crossover;
    const timbre: TimbreId = past ? b.motif.timbre : a.motif.timbre;
    const articulation: MotifArticulation = past
      ? b.motif.articulation
      : a.motif.articulation;
    const register = registerAt(fromRegister + (toRegister - fromRegister) * w);
    const units =
      sampleRhythm(a.motif.rhythm, w, 2) * (1 - w) +
      sampleRhythm(b.motif.rhythm, w, 2) * w;
    const length = Math.max(1, units) * input.unitSeconds;

    notes.push(
      Object.freeze({
        id: `${planId}:step:${i}`,
        conceptId: past ? b.conceptId : a.conceptId,
        role: (i === 0 ? "subject" : past ? "answer" : "subject") as PlannedNote["role"],
        timbre,
        articulation,
        register,
        degree,
        frequency: degreeFrequency(mode, degree, register),
        detuneCents: 0,
        atSeconds: Number(cursor.toFixed(5)),
        envelope: envelopeFor(articulation, length, phrasing),
        gain: Number(
          (
            bed *
            (SCORE.grammar.subjectGain * (1 - w) + SCORE.grammar.answerGain * w)
          ).toFixed(5)
        ),
        floorGain: 0,
        openEnded: !input.resolves && i === steps - 1,
        tense: false,
      })
    );
    cursor += length;
  }

  // The carrier: one quiet sustained tone under the crossing, in the
  // destination's body. It is what makes the handoff audible as a handoff
  // rather than as an edit.
  const carrierAt = notes[Math.min(crossover, notes.length - 1)].atSeconds;
  const carrierDegree = nearestStableDegree(mode, anchorDegree(b.motif));
  const carrierRegister = shiftRegister(b.motif.register, -1);
  notes.push(
    Object.freeze({
      id: `${planId}:carrier`,
      conceptId: b.conceptId,
      role: "residue" as const,
      timbre: b.motif.timbre,
      articulation: "sustained" as MotifArticulation,
      register: carrierRegister,
      degree: carrierDegree,
      frequency: degreeFrequency(mode, carrierDegree, carrierRegister),
      detuneCents: 0,
      atSeconds: Number(Math.max(0, carrierAt - input.unitSeconds).toFixed(5)),
      envelope: envelopeFor("sustained", input.unitSeconds * 6, phrasing),
      gain: Number((bed * SCORE.grammar.residueGain).toFixed(5)),
      floorGain: 0,
      openEnded: false,
      tense: false,
    })
  );

  return makeVoicePlan({
    id: planId,
    kind: "relation",
    intention: "passage",
    notes,
    meta: {
      conceptIds: [a.conceptId, b.conceptId],
      grammar: "translation",
      resolves: input.resolves,
      interval: null,
      beatingHz: null,
      outcome: input.outcome ?? null,
    },
  });
}

// ─── Tension ────────────────────────────────────────────────────────────────

function planTension(input: RelationPlanInput): VoicePlan {
  const { mode, a, b, planId } = input;
  const phrasing = input.phrasing ?? NEUTRAL_PHRASING;
  const interval = suspensionInterval(mode, a, b);
  // Rounded *before* it is turned into a tuning, so the rate the plan reports is
  // exactly the rate the detuned twin will produce. A caption that says 2.0 Hz
  // and a voice that beats at 2.0496 Hz would be a small lie.
  //
  // Seeded by the *pair*, not by the plan id: the same two concepts beat at the
  // same rate in ordinary play, in Attunement, and in the conclusion, so the
  // rate is part of that relation's identity rather than of one performance.
  const beatingHz = Number(
    beatingRateFor(beatingKeyFor(a.conceptId, b.conceptId)).toFixed(4)
  );

  // Everything sounding in a tense interval class shares one budget, and that
  // budget sits below the ambient bed *as the bed actually sounds now*
  // (CAV-007). Headroom keeps rounding from creeping over the line.
  const budget = tensionCeiling(input.bedGain) * SCORE.grammar.tensionHeadroom;
  const shares = SCORE.grammar.tensionShares;
  const shareTotal = shares[0] + shares[1] + shares[2];

  const lowRegister = shiftRegister(
    registerIndex(a.motif.register) <= registerIndex(b.motif.register)
      ? a.motif.register
      : b.motif.register,
    0
  );
  const lowDegree = anchorDegree(a.motif);
  const lowFrequency = degreeFrequency(mode, lowDegree, lowRegister);

  // The suspension is *compound* — an octave plus the tense interval. A minor
  // second in the bass is mud; a minor ninth is a suspension. This is also what
  // keeps the two pitches' own difference frequency far above the beating band,
  // so the only pulsation a player hears is the one the plan asked for.
  const highRegister = shiftRegister(lowRegister, 1);
  const highDegree = lowDegree + interval;

  const attack = SCORE.grammar.tensionAttackSeconds;
  const decay = COMFORT.tension.decayToFloorSeconds;
  const release = Math.max(
    0,
    COMFORT.tension.lifetimeSeconds - attack - decay
  );
  const envelope = Object.freeze({ attack, hold: decay, release });

  const build = (
    id: string,
    conceptId: string,
    timbre: TimbreId,
    register: PlannedNote["register"],
    degree: number,
    share: number,
    detuneCents: number,
    at: number
  ): PlannedNote => {
    const gain = (budget * share) / shareTotal;
    return Object.freeze({
      id,
      conceptId,
      role: (id.endsWith("shadow")
        ? "shadow"
        : id.endsWith("subject")
          ? "subject"
          : "answer") as PlannedNote["role"],
      timbre,
      articulation: "sustained" as MotifArticulation,
      register,
      degree,
      frequency: degreeFrequency(mode, degree, register),
      detuneCents,
      atSeconds: Number(at.toFixed(5)),
      envelope,
      gain: Number(gain.toFixed(5)),
      floorGain: Number((gain * COMFORT.tension.floorFraction).toFixed(6)),
      // A Tension never closes. Not when it is documented, not when the player
      // was right, not ever — that is the whole point of the category.
      openEnded: true,
      // All three sound inside the tense interval class, and all three share the
      // budget CAV-007 caps. Marking them is what lets the bound be enforced
      // across a timeline rather than inside one plan.
      tense: true,
    });
  };

  const stagger = input.unitSeconds * 2;
  const notes: readonly PlannedNote[] = Object.freeze([
    build(
      `${planId}:subject`,
      a.conceptId,
      a.motif.timbre,
      lowRegister,
      lowDegree,
      shares[0],
      0,
      0
    ),
    build(
      `${planId}:answer`,
      b.conceptId,
      b.motif.timbre,
      highRegister,
      highDegree,
      shares[1],
      0,
      stagger
    ),
    // The twin: same pitch as the subject, mistuned by exactly enough cents to
    // beat at the planned rate. This — not the interval — is the pulsation.
    build(
      `${planId}:shadow`,
      a.conceptId,
      "glass",
      lowRegister,
      lowDegree,
      shares[2],
      centsForBeatingHz(lowFrequency, beatingHz),
      stagger * 0.5
    ),
  ]);

  const beating: PlannedBeating = Object.freeze({
    id: `${planId}:beating`,
    conceptIds: [a.conceptId, b.conceptId] as const,
    frequencies: [
      Number(lowFrequency.toFixed(4)),
      Number((lowFrequency + beatingHz).toFixed(4)),
    ] as const,
    beatingHz,
    atSeconds: Number((stagger * 0.5).toFixed(5)),
    gain: notes[2].gain,
    floorGain: notes[2].floorGain,
    decayToFloorSeconds: decay,
  });

  void phrasing; // Tension is sustained; gesture must not soften the friction.

  return makeVoicePlan({
    id: planId,
    kind: "relation",
    intention: "tension",
    notes,
    beatings: [beating],
    meta: {
      conceptIds: [a.conceptId, b.conceptId],
      grammar: "displacement",
      resolves: false,
      interval: 12 + interval,
      beatingHz: beating.beatingHz,
      outcome: input.outcome ?? null,
    },
  });
}

// ─── Ground ─────────────────────────────────────────────────────────────────

function planGround(input: RelationPlanInput): VoicePlan {
  const { mode, a, b, planId } = input;
  const phrasing = input.phrasing ?? NEUTRAL_PHRASING;
  const bed = input.ambientGain;

  const which =
    input.ground ??
    (registerIndex(a.motif.register) < registerIndex(b.motif.register) ? "a" : "b");
  const base = which === "a" ? a : b;
  const above = which === "a" ? b : a;

  // The pedal sits a register below whatever grounds, floored at `sub`, and on
  // a stable degree — a ground that is itself unstable is not a ground.
  const pedalRegister = shiftRegister(base.motif.register, -1);
  const pedalDegree = nearestStableDegree(mode, anchorDegree(base.motif));

  const passes = SCORE.grammar.groundPasses;
  const spanAbove = motifSpanSeconds(above.motif, input.unitSeconds, phrasing);
  const entry = input.unitSeconds * SCORE.grammar.groundEntryUnits;
  const total = entry + spanAbove * passes;

  const pedalEnvelope = Object.freeze({
    attack: Math.min(2.4, total * 0.18),
    hold: total * 0.72,
    release: Math.min(6, total * 0.5),
  });

  const notes: PlannedNote[] = [
    Object.freeze({
      id: `${planId}:pedal`,
      conceptId: base.conceptId,
      role: "pedal" as const,
      timbre: base.motif.timbre,
      articulation: "sustained" as MotifArticulation,
      register: pedalRegister,
      degree: pedalDegree,
      frequency: degreeFrequency(mode, pedalDegree, pedalRegister),
      detuneCents: 0,
      atSeconds: 0,
      envelope: pedalEnvelope,
      gain: Number((bed * SCORE.grammar.pedalGain).toFixed(5)),
      floorGain: 0,
      openEnded: false,
      tense: false,
    }),
    // The fifth above the pedal: stabilising harmonic function, not a melody.
    // In just intonation 3/2 is exact, so it locks to the pedal and disappears
    // into it as reinforcement rather than arriving as a second voice.
    Object.freeze({
      id: `${planId}:reinforce`,
      conceptId: base.conceptId,
      role: "ground" as const,
      timbre: base.motif.timbre,
      articulation: "sustained" as MotifArticulation,
      register: pedalRegister,
      degree: pedalDegree + 7,
      frequency: degreeFrequency(mode, pedalDegree + 7, pedalRegister),
      detuneCents: 0,
      atSeconds: Number((input.unitSeconds * 2).toFixed(5)),
      envelope: pedalEnvelope,
      gain: Number((bed * SCORE.grammar.groundGain).toFixed(5)),
      floorGain: 0,
      openEnded: false,
      tense: false,
    }),
  ];

  // The grounded motif continues above, unaltered. Its degrees are exactly as
  // authored — Ground supports a concept, it does not transform it.
  for (let pass = 0; pass < passes; pass++) {
    const isLastPass = pass === passes - 1;
    const lastDegree = above.motif.degrees[above.motif.degrees.length - 1] ?? 0;
    notes.push(
      ...renderMotif(above, {
        mode,
        at: entry + spanAbove * pass,
        unitSeconds: input.unitSeconds,
        gain: bed * SCORE.grammar.subjectGain,
        role: "subject",
        idPrefix: `${planId}:above:${pass}`,
        phrasing,
        openEnded: isLastPass && !input.resolves,
        finalDegree:
          isLastPass && !input.resolves
            ? nearestTenseDegree(mode, lastDegree)
            : undefined,
      })
    );
  }

  return makeVoicePlan({
    id: planId,
    kind: "relation",
    intention: "ground",
    notes,
    meta: {
      conceptIds: [base.conceptId, above.conceptId],
      grammar: "foundation",
      resolves: input.resolves,
      interval: pitchClass(anchorDegree(above.motif) - pedalDegree),
      beatingHz: null,
      outcome: input.outcome ?? null,
    },
  });
}

// ─── Entry point ────────────────────────────────────────────────────────────

/**
 * Plan the voices for one declared relation.
 *
 * Pure: motif + motif + intention → a scheduled voice plan. Deterministic under
 * a fixed `planId` — two replays of the same session produce byte-identical
 * plans, which is what lets the conclusion sound like the session that made it.
 */
export function planRelationVoices(input: RelationPlanInput): VoicePlan {
  if (input.unitSeconds <= 0) {
    throw new RangeError("a rhythmic unit must be a positive number of seconds");
  }
  if (input.ambientGain <= 0) {
    throw new RangeError("the ambient bed gain must be positive");
  }
  if (input.bedGain <= 0) {
    throw new RangeError("the audible bed gain must be positive");
  }
  switch (input.intention) {
    case "echo":
      return planEcho(input);
    case "passage":
      return planPassage(input);
    case "tension":
      return planTension(input);
    case "ground":
      return planGround(input);
  }
}

export { planEcho, planPassage, planTension, planGround };
