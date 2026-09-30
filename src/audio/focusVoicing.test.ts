import { describe, expect, it, vi } from "vitest";

import { CASTALIA_CONCEPTS } from "@/content/castalia/concepts";
import type { RelationIntention } from "@/domain/events";
import { tensionCeiling, COMFORT } from "./comfort";
import {
  FOCUS_VOICING,
  audibleEndSeconds,
  fitToBar,
  planPairExchange,
  planReadingBar,
  planSightingAnswer,
  scalePlanGain,
  type ReadingWeight,
  type ResonanceBand,
} from "./focusVoicing";
import { planRelationVoices } from "./grammar";
import { CASTALIA_MODE, registerIndex } from "./mode";
import { motifSpanSeconds, type MotifSource } from "./motif";
import {
  auditComfort,
  makeVoicePlan,
  peakConcurrentTenseNotes,
  peakTenseSummedGain,
  type PlannedBeating,
  type PlannedNote,
  type VoicePlan,
} from "./plan";
import { SCORE, unitSecondsFor } from "./score";

// Several of these run every ordered pair of the 24 concepts (552) through every
// intention and weight. That is a second or two of arithmetic on a fast machine,
// and the whole point of them is that they are exhaustive, so give a slow one room
// rather than sampling.
vi.setConfig({ testTimeout: 60_000 });

const UNIT = unitSecondsFor(2);
const BED = SCORE.grammar.bedGain;
/** The bed as Attend leaves it — the level the focus voices actually speak against. */
const ATTENTION_BED = BED * SCORE.attention.bedGainScale;
/** The quietest deliberate sound in the game: `hoverPing` in sfx.ts. */
const HOVER_PING_GAIN = 0.045;
const INTENTIONS: readonly RelationIntention[] = [
  "echo",
  "passage",
  "tension",
  "ground",
];
const WEIGHTS: readonly ReadingWeight[] = ["hover", "chosen", "recall"];

const SOURCES: readonly MotifSource[] = CASTALIA_CONCEPTS.map((concept) => ({
  conceptId: concept.id,
  motif: concept.motif,
}));

const source = (id: string): MotifSource => {
  const found = SOURCES.find((entry) => entry.conceptId === id);
  if (!found) throw new Error(`missing fixture concept ${id}`);
  return found;
};

const FIBONACCI = source("measure.fibonacci-sequence");
const COUNTERPOINT = source("sound.counterpoint");
const CONSERVATION = source("matter.conservation-of-energy");
const DIVISIONISM = source("image.divisionism");

/** Every ordered pair of distinct concepts: 24 × 23 = 552. */
const PAIRS: readonly (readonly [MotifSource, MotifSource])[] = SOURCES.flatMap(
  (a) => SOURCES.filter((b) => b !== a).map((b) => [a, b] as const)
);

const reading = (
  intention: RelationIntention,
  weight: ReadingWeight,
  a: MotifSource,
  b: MotifSource,
  bedGain: number = ATTENTION_BED
): VoicePlan =>
  planReadingBar({
    seed: `reading:${intention}:${a.conceptId}:${b.conceptId}`,
    mode: CASTALIA_MODE,
    intention,
    a,
    b,
    weight,
    unitSeconds: UNIT,
    ambientGain: BED,
    bedGain,
  });

/** Every pair, planned once per (intention, weight) and shared by the tests below. */
const cache = new Map<string, readonly { a: MotifSource; b: MotifSource; plan: VoicePlan }[]>();
function everyPair(intention: RelationIntention, weight: ReadingWeight) {
  const key = `${intention}:${weight}`;
  let planned = cache.get(key);
  if (planned === undefined) {
    planned = PAIRS.map(([a, b]) => ({ a, b, plan: reading(intention, weight, a, b) }));
    cache.set(key, planned);
  }
  return planned;
}

const loudest = (plan: VoicePlan): number =>
  Math.max(...plan.notes.map((note) => note.gain));

const note = (
  id: string,
  atSeconds: number,
  envelope: { attack: number; hold: number; release: number },
  extra: Partial<PlannedNote> = {}
): PlannedNote =>
  Object.freeze({
    id,
    conceptId: "c",
    role: "subject",
    timbre: "glass",
    articulation: "sustained",
    register: "mid",
    degree: 0,
    frequency: 220,
    detuneCents: 0,
    atSeconds,
    envelope: Object.freeze(envelope),
    gain: 0.1,
    floorGain: 0,
    openEnded: false,
    tense: false,
    ...extra,
  }) as PlannedNote;

const planOf = (
  notes: readonly PlannedNote[],
  beatings: readonly PlannedBeating[] = []
): VoicePlan =>
  makeVoicePlan({
    id: "fixture",
    kind: "relation",
    intention: "tension",
    notes,
    beatings,
    meta: {
      conceptIds: ["a", "b"],
      grammar: "fixture",
      resolves: false,
      interval: null,
      beatingHz: null,
      outcome: null,
    },
  });

// ─── The table ──────────────────────────────────────────────────────────────

describe("FOCUS_VOICING", () => {
  it("begins a new voice only after the one it replaces has faded", () => {
    expect(FOCUS_VOICING.leadSeconds).toBeGreaterThanOrEqual(FOCUS_VOICING.fadeSeconds);
  });

  it("keeps the ladder of levels in the order the interaction earns them", () => {
    const { sighting, exchange, reading } = FOCUS_VOICING;
    // Looking is quieter than choosing, which is quieter than the pair being fixed,
    // which is quieter than the attended figure on Attend.
    expect(sighting.level.weak).toBeLessThan(sighting.level.medium);
    expect(sighting.level.medium).toBeLessThan(sighting.level.high);
    expect(sighting.level.high).toBeLessThan(exchange.responseLevel);
    expect(exchange.responseLevel).toBeLessThan(exchange.callLevel);
    expect(exchange.callLevel).toBeLessThan(SCORE.attention.foregroundGain);
    // A hover is quieter and shorter than a chosen reading, which stays under the
    // commit's own level (1), and a recall is softer than a choice.
    expect(reading.weights.hover.level).toBeLessThan(reading.weights.chosen.level);
    expect(reading.weights.hover.barSeconds).toBeLessThan(reading.weights.chosen.barSeconds);
    expect(reading.weights.chosen.level).toBeLessThan(1);
    expect(reading.weights.recall.level).toBeLessThan(reading.weights.chosen.level);
    // The Tension lift can raise a level but never past the planner's own.
    for (const weight of WEIGHTS) {
      expect(reading.weights[weight].level * reading.tensionLift).toBeLessThanOrEqual(1);
    }
  });
});

// ─── fitToBar ───────────────────────────────────────────────────────────────

describe("fitToBar", () => {
  const long = planOf([
    note("n0", 0, { attack: 1.4, hold: 12, release: 6.6 }, { floorGain: 0.02 }),
    note("n1", 0.5, { attack: 0.1, hold: 0.3, release: 0.4 }),
    note("n2", 1.0, { attack: 0.1, hold: 0.3, release: 4 }),
    note("n3", 1.6, { attack: 0.1, hold: 0.3, release: 0.4 }),
    note("n4", 2.5, { attack: 0.1, hold: 0.3, release: 0.4 }),
  ]);
  const fit = { barSeconds: 1.6, tailSeconds: 0.4, attackCapSeconds: 0.4 };

  it("drops every note that would begin at or after the bar", () => {
    const fitted = fitToBar(long, fit);
    expect(fitted.notes.map((n) => n.id)).toEqual(["n0", "n1", "n2"]);
  });

  it("only ever shortens: onsets stay, nothing lengthens, nothing gets louder", () => {
    const fitted = fitToBar(long, fit);
    for (const shaped of fitted.notes) {
      const original = long.notes.find((n) => n.id === shaped.id)!;
      expect(shaped.atSeconds).toBe(original.atSeconds);
      expect(shaped.envelope.attack).toBeLessThanOrEqual(original.envelope.attack);
      expect(shaped.envelope.hold).toBeLessThanOrEqual(original.envelope.hold);
      expect(shaped.envelope.release).toBeLessThanOrEqual(original.envelope.release);
      expect(shaped.gain).toBeLessThanOrEqual(original.gain);
    }
  });

  it("lets nothing ring past the bar's tail", () => {
    for (const shaped of fitToBar(long, fit).notes) {
      const end =
        shaped.atSeconds +
        shaped.envelope.attack +
        shaped.envelope.hold +
        shaped.envelope.release;
      expect(end).toBeLessThanOrEqual(fit.barSeconds + fit.tailSeconds + 1e-4);
    }
  });

  it("caps a slow attack, and leaves a quick one alone", () => {
    const fitted = fitToBar(long, fit);
    expect(fitted.notes[0].envelope.attack).toBe(fit.attackCapSeconds);
    expect(fitted.notes[1].envelope.attack).toBe(0.1);
  });

  it("scales hold and release together, so a note keeps its shape", () => {
    const fitted = fitToBar(long, fit);
    const before = long.notes[0].envelope;
    const after = fitted.notes[0].envelope;
    expect(after.hold / after.release).toBeCloseTo(before.hold / before.release, 3);
  });

  it("holds a tense voice's level instead of decaying it to a floor", () => {
    const fitted = fitToBar(long, fit);
    expect(long.notes[0].floorGain).toBeGreaterThan(0);
    expect(fitted.notes.every((n) => n.floorGain === 0)).toBe(true);
  });

  it("trims a beating record to the bar, and drops one that begins after it", () => {
    const beatings: PlannedBeating[] = [
      {
        id: "early",
        conceptIds: ["a", "b"],
        frequencies: [130, 132],
        beatingHz: 2,
        atSeconds: 0.2,
        gain: 0.03,
        floorGain: 0.005,
        decayToFloorSeconds: 12,
      },
      {
        id: "late",
        conceptIds: ["a", "b"],
        frequencies: [130, 132],
        beatingHz: 2,
        atSeconds: 3,
        gain: 0.03,
        floorGain: 0.005,
        decayToFloorSeconds: 12,
      },
    ];
    const tense = planOf(
      [note("t0", 0.2, { attack: 1.4, hold: 12, release: 6.6 }, { tense: true })],
      beatings
    );
    const fitted = fitToBar(tense, fit);
    expect(fitted.beatings.map((b) => b.id)).toEqual(["early"]);
    expect(fitted.beatings[0].decayToFloorSeconds).toBeLessThan(12);
    expect(fitted.beatings[0].decayToFloorSeconds).toBeLessThanOrEqual(
      fitted.notes[0].envelope.hold
    );
    expect(fitted.beatings[0].floorGain).toBe(0);
  });

  it("keeps the plan's identity and meaning", () => {
    const fitted = fitToBar(long, fit);
    expect(fitted.id).toBe(long.id);
    expect(fitted.kind).toBe(long.kind);
    expect(fitted.intention).toBe(long.intention);
    expect(fitted.meta).toEqual(long.meta);
  });
});

describe("scalePlanGain", () => {
  const plan = planOf([note("n0", 0, { attack: 0.1, hold: 0.5, release: 0.5 }, { floorGain: 0.02 })]);

  it("brings every level down by the factor", () => {
    const scaled = scalePlanGain(plan, 0.5);
    expect(scaled.notes[0].gain).toBeCloseTo(0.05, 6);
    expect(scaled.notes[0].floorGain).toBeCloseTo(0.01, 6);
  });

  it("never brings a level up — the ceiling a planner sized cannot be lost here", () => {
    expect(scalePlanGain(plan, 2)).toBe(plan);
    expect(scalePlanGain(plan, 1)).toBe(plan);
  });

  it("treats a nonsense factor as silence rather than as loud", () => {
    expect(scalePlanGain(plan, Number.NaN).notes[0].gain).toBe(0);
    expect(scalePlanGain(plan, -3).notes[0].gain).toBe(0);
  });
});

describe("audibleEndSeconds", () => {
  it("is where the last voice falls silent, counting notes and not the beating record", () => {
    const plan = planOf([
      note("a", 0, { attack: 0.1, hold: 0.4, release: 0.5 }),
      note("b", 1, { attack: 0.1, hold: 0.4, release: 0.5 }),
    ]);
    expect(audibleEndSeconds(plan)).toBe(2);
  });
});

// ─── The sighted bead answers ───────────────────────────────────────────────

describe("planSightingAnswer", () => {
  const sighting = (
    sighted: MotifSource,
    band: ResonanceBand,
    ambientGain: number = BED
  ): VoicePlan =>
    planSightingAnswer({
      planId: `sighted:${sighted.conceptId}:${band}`,
      mode: CASTALIA_MODE,
      sighted,
      band,
      unitSeconds: UNIT,
      ambientGain,
    });

  it("is the sighted concept's own figure, unaltered, in its own body", () => {
    const plan = sighting(FIBONACCI, "medium");
    expect(plan.notes.map((n) => n.degree)).toEqual([...FIBONACCI.motif.degrees]);
    for (const n of plan.notes) {
      expect(n.timbre).toBe(FIBONACCI.motif.timbre);
      expect(n.register).toBe(FIBONACCI.motif.register);
      expect(n.articulation).toBe(FIBONACCI.motif.articulation);
      expect(n.conceptId).toBe(FIBONACCI.conceptId);
    }
    expect(plan.meta.conceptIds).toEqual([FIBONACCI.conceptId]);
  });

  it("answers at a level set by the band: high above medium above weak", () => {
    const high = sighting(FIBONACCI, "high").notes[0].gain;
    const medium = sighting(FIBONACCI, "medium").notes[0].gain;
    const weak = sighting(FIBONACCI, "weak").notes[0].gain;
    expect(high).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(weak);
  });

  it("never lets a weak sighting fall silent — it stays above the hover ping", () => {
    for (const concept of SOURCES) {
      const plan = sighting(concept, "weak");
      expect(plan.notes.length).toBeGreaterThan(0);
      for (const n of plan.notes) expect(n.gain).toBeGreaterThan(HOVER_PING_GAIN);
    }
  });

  it("sits under the attended figure and under the lock, so looking is quieter than acting", () => {
    const high = sighting(FIBONACCI, "high").notes[0].gain;
    expect(high).toBeLessThan(BED * SCORE.attention.foregroundGain);
    expect(FOCUS_VOICING.sighting.level.high).toBeLessThan(
      FOCUS_VOICING.exchange.responseLevel
    );
  });

  it("is a fraction of the bed it is given, not an absolute", () => {
    const loud = sighting(FIBONACCI, "medium", BED).notes[0].gain;
    const quiet = sighting(FIBONACCI, "medium", BED / 2).notes[0].gain;
    expect(quiet).toBeCloseTo(loud / 2, 4);
  });

  it("states only the opening of a long figure, and no note begins after the bar", () => {
    const plan = sighting(CONSERVATION, "high");
    // Four notes of 1.5 s each; only the first begins inside the bar.
    expect(plan.notes).toHaveLength(1);
    for (const shaped of SOURCES.map((s) => sighting(s, "medium"))) {
      for (const n of shaped.notes) {
        expect(n.atSeconds).toBeLessThan(FOCUS_VOICING.sighting.barSeconds);
      }
      expect(audibleEndSeconds(shaped)).toBeLessThanOrEqual(
        FOCUS_VOICING.sighting.barSeconds + FOCUS_VOICING.sighting.tailSeconds + 1e-4
      );
    }
  });

  it("says nothing but the sighted figure: one concept, no interval against another", () => {
    for (const concept of SOURCES) {
      const plan = sighting(concept, "high");
      expect(new Set(plan.notes.map((n) => n.conceptId))).toEqual(
        new Set([concept.conceptId])
      );
      expect(plan.meta.resolves).toBe(false);
      expect(plan.intention).toBeNull();
      expect(plan.kind).toBe("attention");
    }
  });

  it("is deterministic", () => {
    expect(sighting(COUNTERPOINT, "high")).toEqual(sighting(COUNTERPOINT, "high"));
  });

  it("refuses a nonsensical grid", () => {
    expect(() =>
      planSightingAnswer({
        planId: "x",
        mode: CASTALIA_MODE,
        sighted: FIBONACCI,
        band: "high",
        unitSeconds: 0,
        ambientGain: BED,
      })
    ).toThrow(RangeError);
  });
});

// ─── The pair is the object ─────────────────────────────────────────────────

describe("planPairExchange", () => {
  const exchange = (attended: MotifSource, second: MotifSource): VoicePlan =>
    planPairExchange({
      planId: `locked:${attended.conceptId}:${second.conceptId}`,
      mode: CASTALIA_MODE,
      attended,
      second,
      unitSeconds: UNIT,
      ambientGain: BED,
    });

  it("gives the attended figure first, then the second — call and response", () => {
    const plan = exchange(FIBONACCI, COUNTERPOINT);
    const call = plan.notes.filter((n) => n.conceptId === FIBONACCI.conceptId);
    const response = plan.notes.filter((n) => n.conceptId === COUNTERPOINT.conceptId);
    expect(call.length).toBeGreaterThan(0);
    expect(response.length).toBeGreaterThan(0);
    expect(call.every((n) => n.role === "subject")).toBe(true);
    expect(response.every((n) => n.role === "answer")).toBe(true);
    expect(plan.notes.slice(0, call.length)).toEqual(call);
    expect(Math.min(...response.map((n) => n.atSeconds))).toBeGreaterThan(
      Math.max(...call.map((n) => n.atSeconds))
    );
  });

  it("never sounds the two together, for any pair — that would be an interval no one has chosen", () => {
    for (const [a, b] of PAIRS) {
      const plan = exchange(a, b);
      const call = plan.notes.filter((n) => n.conceptId === a.conceptId);
      const response = plan.notes.filter((n) => n.conceptId === b.conceptId);
      const callEnds = Math.max(
        ...call.map((n) => n.atSeconds + n.envelope.attack + n.envelope.hold + n.envelope.release)
      );
      const responseBegins = Math.min(...response.map((n) => n.atSeconds));
      expect(callEnds).toBeLessThanOrEqual(responseBegins + 1e-4);
    }
  });

  it("keeps each figure unaltered and in its own body", () => {
    const plan = exchange(FIBONACCI, COUNTERPOINT);
    const call = plan.notes.filter((n) => n.conceptId === FIBONACCI.conceptId);
    const response = plan.notes.filter((n) => n.conceptId === COUNTERPOINT.conceptId);
    expect(call.map((n) => n.degree)).toEqual([...FIBONACCI.motif.degrees].slice(0, call.length));
    expect(response.map((n) => n.degree)).toEqual(
      [...COUNTERPOINT.motif.degrees].slice(0, response.length)
    );
    expect(call.every((n) => n.timbre === FIBONACCI.motif.timbre)).toBe(true);
    expect(response.every((n) => n.timbre === COUNTERPOINT.motif.timbre)).toBe(true);
  });

  it("is moderate: above any sighting, below the attended figure and the commit", () => {
    const plan = exchange(FIBONACCI, COUNTERPOINT);
    const call = plan.notes.find((n) => n.role === "subject")!.gain;
    const response = plan.notes.find((n) => n.role === "answer")!.gain;
    expect(call).toBeGreaterThan(response);
    expect(response).toBeGreaterThan(BED * FOCUS_VOICING.sighting.level.high);
    expect(call).toBeLessThan(BED * SCORE.attention.foregroundGain);
    expect(call).toBeLessThan(BED * SCORE.grammar.subjectGain);
  });

  it("states a short figure whole and cuts a long one to the bar", () => {
    const short = exchange(DIVISIONISM, FIBONACCI);
    expect(
      short.notes.filter((n) => n.conceptId === DIVISIONISM.conceptId)
    ).toHaveLength(DIVISIONISM.motif.degrees.length);
    const long = exchange(CONSERVATION, FIBONACCI);
    expect(
      long.notes.filter((n) => n.conceptId === CONSERVATION.conceptId).length
    ).toBeLessThan(CONSERVATION.motif.degrees.length);
    expect(motifSpanSeconds(DIVISIONISM.motif, UNIT)).toBeLessThan(
      FOCUS_VOICING.exchange.barSeconds
    );
  });

  it("is deterministic and asserts nothing", () => {
    const plan = exchange(FIBONACCI, COUNTERPOINT);
    expect(plan).toEqual(exchange(FIBONACCI, COUNTERPOINT));
    expect(plan.meta.resolves).toBe(false);
    expect(plan.intention).toBeNull();
    expect(plan.meta.conceptIds).toEqual([FIBONACCI.conceptId, COUNTERPOINT.conceptId]);
  });
});

// ─── The reading, heard before it is made ───────────────────────────────────

describe("planReadingBar — inside CAV-007, for every pair", () => {
  // A relation's tense ceiling is a fraction of the bed as it sounds. Attend
  // thins it to 0.72 and Attunement to 0.55; the nominal bed is the loosest.
  const BEDS = [BED, ATTENTION_BED, BED * SCORE.attunement.bedGainScale];

  it("passes the whole comfort audit for every intention and weight", () => {
    for (const intention of INTENTIONS) {
      for (const weight of WEIGHTS) {
        for (const { plan } of everyPair(intention, weight)) {
          expect(auditComfort(plan, { bedGain: ATTENTION_BED })).toEqual([]);
        }
      }
    }
  });

  it("passes it at every bed a Tension can be heard against, because only its ceiling depends on the bed", () => {
    for (const weight of WEIGHTS) {
      for (const { a, b } of everyPair("tension", weight)) {
        for (const bedGain of BEDS) {
          const plan = reading("tension", weight, a, b, bedGain);
          expect(auditComfort(plan, { bedGain })).toEqual([]);
        }
      }
    }
  });

  it("gives a Tension at most three tense voices and keeps them under the ceiling it was sized for", () => {
    for (const weight of WEIGHTS) {
      for (const { a, b } of everyPair("tension", weight)) {
        for (const bedGain of BEDS) {
          const plan = reading("tension", weight, a, b, bedGain);
          expect(peakConcurrentTenseNotes(plan)).toBeLessThanOrEqual(
            COMFORT.tension.maxConcurrentVoices
          );
          expect(peakTenseSummedGain(plan)).toBeLessThanOrEqual(
            tensionCeiling(bedGain) + 1e-9
          );
        }
      }
    }
  });

  it("keeps every voice's life bounded by its bar and tail", () => {
    for (const intention of INTENTIONS) {
      for (const weight of ["hover", "chosen"] as const) {
        const profile = FOCUS_VOICING.reading.weights[weight];
        for (const { plan } of everyPair(intention, weight)) {
          expect(audibleEndSeconds(plan)).toBeLessThanOrEqual(
            profile.barSeconds + profile.tailSeconds + 1e-4
          );
          for (const n of plan.notes) {
            expect(n.atSeconds).toBeLessThan(profile.barSeconds);
          }
        }
      }
    }
  });
});

describe("planReadingBar — four intentions, four different readings", () => {
  const signature = (plan: VoicePlan): string =>
    plan.notes
      .map((n) => `${n.role}:${n.conceptId}:${n.timbre}:${n.register}:${n.degree}`)
      .join("|");

  it("are distinguishable for every pair, at every weight", () => {
    for (const weight of WEIGHTS) {
      for (const [a, b] of PAIRS.filter(([x, y]) => x.conceptId < y.conceptId)) {
        const plans = INTENTIONS.map((intention) => reading(intention, weight, a, b));
        expect(new Set(plans.map((p) => p.meta.grammar)).size).toBe(4);
        expect(new Set(plans.map(signature)).size).toBe(4);
        expect(plans.map((p) => p.intention)).toEqual([...INTENTIONS]);
      }
    }
  });

  it("names the four grammars the way the woven relation does", () => {
    const grammars = INTENTIONS.map(
      (intention) => reading(intention, "chosen", FIBONACCI, COUNTERPOINT).meta.grammar
    );
    expect(grammars).toEqual(["imitation", "translation", "displacement", "foundation"]);
  });

  it("Echo: the same figure returns in the second concept's own body, at the woven interval", () => {
    for (const weight of WEIGHTS) {
      for (const { a, b, plan } of everyPair("echo", weight)) {
        const answers = plan.notes.filter((n) => n.role === "answer");
        expect(answers.length).toBeGreaterThan(0);
        expect(answers.every((n) => n.timbre === b.motif.timbre)).toBe(true);
        expect(answers.every((n) => n.conceptId === b.conceptId)).toBe(true);
        const woven = planRelationVoices({
          planId: "relation:t",
          mode: CASTALIA_MODE,
          intention: "echo",
          a,
          b,
          unitSeconds: UNIT,
          ambientGain: BED,
          bedGain: ATTENTION_BED,
          resolves: false,
        });
        // The preview is not a different reading: the interval is the one the
        // weave will sound for this pair.
        expect(plan.meta.interval).toBe(woven.meta.interval);
        expect(plan.meta.interval).not.toBe(0);
      }
    }
  });

  it("Passage: one line that begins as the first concept and reaches the second, for every pair", () => {
    for (const weight of WEIGHTS) {
      for (const { a, b, plan } of everyPair("passage", weight)) {
        expect(plan.notes[0].conceptId).toBe(a.conceptId);
        const reachesSecond = plan.notes.some(
          (n) => n.conceptId === b.conceptId && n.role !== "residue"
        );
        expect(reachesSecond).toBe(true);
      }
    }
  });

  it("Tension: the woven suspension and the woven beating rate, heard as at least two beats", () => {
    for (const weight of WEIGHTS) {
      for (const { a, b, plan } of everyPair("tension", weight)) {
        const woven = planRelationVoices({
          planId: "relation:t",
          mode: CASTALIA_MODE,
          intention: "tension",
          a,
          b,
          unitSeconds: UNIT,
          ambientGain: BED,
          bedGain: ATTENTION_BED,
          resolves: false,
        });
        expect(plan.meta.interval).toBe(woven.meta.interval);
        expect(plan.meta.beatingHz).toBe(woven.meta.beatingHz);
        expect(plan.meta.beatingHz!).toBeGreaterThanOrEqual(COMFORT.beating.minHz);
        expect(plan.meta.beatingHz!).toBeLessThanOrEqual(COMFORT.beating.maxHz);
        const twin = plan.notes.find((n) => n.role === "shadow")!;
        const plateau = twin.envelope.attack + twin.envelope.hold;
        expect(plan.meta.beatingHz! * plateau).toBeGreaterThanOrEqual(2);
        expect(plan.notes.every((n) => n.tense)).toBe(true);
        expect(plan.meta.resolves).toBe(false);
      }
    }
  });

  it("Ground: a pedal that does not move, in a lower register, under the figure that continues", () => {
    for (const weight of WEIGHTS) {
      for (const { a, b, plan } of everyPair("ground", weight)) {
        const pedals = plan.notes.filter((n) => n.role === "pedal");
        expect(pedals).toHaveLength(1);
        const base = plan.meta.conceptIds[0] === a.conceptId ? a : b;
        expect(registerIndex(pedals[0].register)).toBeLessThanOrEqual(
          registerIndex(base.motif.register)
        );
        const woven = planRelationVoices({
          planId: "relation:t",
          mode: CASTALIA_MODE,
          intention: "ground",
          a,
          b,
          unitSeconds: UNIT,
          ambientGain: BED,
          bedGain: ATTENTION_BED,
          resolves: false,
        });
        const wovenPedal = woven.notes.find((n) => n.role === "pedal")!;
        expect(pedals[0].degree).toBe(wovenPedal.degree);
        expect(pedals[0].frequency).toBe(wovenPedal.frequency);
        expect(plan.notes.some((n) => n.role === "subject")).toBe(true);
      }
    }
  });
});

describe("planReadingBar — weights", () => {
  it("makes a hover quieter and shorter than a chosen reading, for every pair", () => {
    for (const intention of INTENTIONS) {
      const hover = everyPair(intention, "hover");
      const chosen = everyPair(intention, "chosen");
      hover.forEach(({ plan }, index) => {
        expect(loudest(plan)).toBeLessThan(loudest(chosen[index].plan));
        expect(audibleEndSeconds(plan)).toBeLessThanOrEqual(
          audibleEndSeconds(chosen[index].plan) + 1e-4
        );
      });
    }
  });

  it("makes a hover strictly shorter than a chosen reading wherever a phrase fills its bar", () => {
    for (const intention of INTENTIONS) {
      const hover = reading(intention, "hover", FIBONACCI, COUNTERPOINT);
      const chosen = reading(intention, "chosen", FIBONACCI, COUNTERPOINT);
      expect(audibleEndSeconds(hover)).toBeLessThan(audibleEndSeconds(chosen));
    }
  });

  it("recalls a thread softly and unhurried — quieter than chosen, at the authored tempo", () => {
    for (const intention of INTENTIONS) {
      const recall = reading(intention, "recall", FIBONACCI, COUNTERPOINT);
      const chosen = reading(intention, "chosen", FIBONACCI, COUNTERPOINT);
      expect(loudest(recall)).toBeLessThan(loudest(chosen));
    }
    const echo = reading("echo", "recall", FIBONACCI, COUNTERPOINT);
    const subject = echo.notes.filter((n) => n.role === "subject");
    // Fibonacci's second note begins one rhythm unit after the first, as authored.
    expect(subject[1].atSeconds - subject[0].atSeconds).toBeCloseTo(
      FIBONACCI.motif.rhythm[0] * UNIT,
      1
    );
  });

  it("never draws a figure in past the minimum tempo — beyond it the phrase is cut, not rushed", () => {
    for (const { a, plan } of everyPair("echo", "hover")) {
      const subject = plan.notes.filter((n) => n.role === "subject");
      if (subject.length < 2) continue;
      const authored = a.motif.rhythm[0] * UNIT;
      expect(subject[1].atSeconds - subject[0].atSeconds).toBeGreaterThanOrEqual(
        authored * FOCUS_VOICING.reading.minTempo - 0.02
      );
    }
  });

  it("keeps the Tension quiet by the ceiling, not by the level table", () => {
    const tension = reading("tension", "chosen", FIBONACCI, COUNTERPOINT);
    const echo = reading("echo", "chosen", FIBONACCI, COUNTERPOINT);
    expect(peakTenseSummedGain(tension)).toBeLessThan(tensionCeiling(ATTENTION_BED));
    expect(loudest(tension)).toBeLessThan(loudest(echo));
  });
});

describe("planReadingBar — what it does not know", () => {
  it("never closes: a preview claims nothing about the record (CAV-006)", () => {
    for (const intention of INTENTIONS) {
      for (const weight of WEIGHTS) {
        const plan = reading(intention, weight, FIBONACCI, COUNTERPOINT);
        expect(plan.meta.resolves).toBe(false);
        expect(plan.meta.outcome).toBeNull();
      }
    }
  });

  it("is a pure function of the pair, the intention, and the weight", () => {
    for (const intention of INTENTIONS) {
      expect(reading(intention, "hover", FIBONACCI, COUNTERPOINT)).toEqual(
        reading(intention, "hover", FIBONACCI, COUNTERPOINT)
      );
    }
  });

  it("gives each weight its own plan id, and the same voices the same identity", () => {
    const hover = reading("echo", "hover", FIBONACCI, COUNTERPOINT);
    const chosen = reading("echo", "chosen", FIBONACCI, COUNTERPOINT);
    expect(hover.id).not.toBe(chosen.id);
    expect(hover.id.endsWith(":hover")).toBe(true);
    expect(chosen.notes[0].id).toBe(hover.notes[0].id);
  });

  it("refuses a nonsensical grid", () => {
    expect(() =>
      planReadingBar({
        seed: "x",
        mode: CASTALIA_MODE,
        intention: "echo",
        a: FIBONACCI,
        b: COUNTERPOINT,
        weight: "hover",
        unitSeconds: -1,
        ambientGain: BED,
        bedGain: BED,
      })
    ).toThrow(RangeError);
  });
});
