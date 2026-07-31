import { describe, expect, it } from "vitest";

import { CASTALIA_CONCEPTS, castaliaConceptById } from "@/content/castalia/concepts";
import { RELATION_INTENTIONS } from "@/domain/events";
import { COMFORT } from "./comfort";
import {
  beatingRateFor,
  imitationInterval,
  planRelationVoices,
  suspensionInterval,
  type RelationPlanInput,
} from "./grammar";
import { NEUTRAL_PHRASING, motifUnits, type MotifSource } from "./motif";
import {
  CASTALIA_MODE,
  beatingHzBetween,
  intervalClass,
  isStable,
  isTense,
  registerIndex,
  transposeCents,
} from "./mode";
import {
  auditComfort,
  noteEndSeconds,
  noteLifetime,
  peakConcurrentNotes,
  peakSummedGain,
  type PlannedNote,
} from "./plan";
import { SCORE } from "./score";

const source = (id: string): MotifSource => {
  const concept = castaliaConceptById.get(id);
  if (!concept) throw new Error(`missing fixture concept ${id}`);
  return { conceptId: concept.id, motif: concept.motif };
};

/** The golden path's opening pair (CAV-010). */
const FIBONACCI = source("measure.fibonacci-sequence");
const COUNTERPOINT = source("sound.counterpoint");
/** The reference Passage pair. */
const PERSPECTIVE = source("image.linear-perspective");
const CAMERA = source("image.camera-obscura");
/** The reference Tension pair (CAV-005 replaced consonance/dissonance with these). */
const JUST = source("sound.just-intonation");
const EQUAL = source("sound.equal-temperament");
/** The reference Ground pair. */
const SYMMETRY = source("measure.continuous-symmetry");
const ENERGY = source("matter.conservation-of-energy");

const BED = SCORE.grammar.bedGain;
const UNIT = 0.125;

const base = (
  overrides: Partial<RelationPlanInput> & Pick<RelationPlanInput, "intention" | "a" | "b">
): RelationPlanInput => ({
  planId: `${overrides.intention}:${overrides.a.conceptId}:${overrides.b.conceptId}`,
  mode: CASTALIA_MODE,
  unitSeconds: UNIT,
  ambientGain: BED,
  resolves: true,
  // Metronomic, so entries can be asserted exactly. Gesture is tested separately.
  phrasing: { ...NEUTRAL_PHRASING, rubato: 0 },
  ...overrides,
});

const byRole = (notes: readonly PlannedNote[], role: PlannedNote["role"]) =>
  notes.filter((note) => note.role === role);

// ─── Echo ───────────────────────────────────────────────────────────────────

describe("Echo — imitation", () => {
  const plan = planRelationVoices(
    base({ intention: "echo", a: FIBONACCI, b: COUNTERPOINT })
  );

  it("answers with the subject's figure in the other concept's body", () => {
    const subject = byRole(plan.notes, "subject");
    const answer = byRole(plan.notes, "answer");
    expect(subject).toHaveLength(FIBONACCI.motif.degrees.length);
    expect(answer).toHaveLength(FIBONACCI.motif.degrees.length);
    expect(answer.every((note) => note.timbre === COUNTERPOINT.motif.timbre)).toBe(
      true
    );
    expect(subject.every((note) => note.timbre === FIBONACCI.motif.timbre)).toBe(true);
  });

  it("is never a plain unison — the answer is displaced in pitch", () => {
    const interval = plan.meta.interval ?? 0;
    expect(interval).not.toBe(0);
    const subject = byRole(plan.notes, "subject");
    const answer = byRole(plan.notes, "answer");
    subject.forEach((note, index) => {
      expect(answer[index].degree - note.degree).toBe(interval);
    });
  });

  it("imitates at an interval both motifs actually contain", () => {
    const interval = imitationInterval(CASTALIA_MODE, FIBONACCI, COUNTERPOINT);
    const classesOf = (m: MotifSource) =>
      m.motif.degrees.slice(1).map((d) => intervalClass(m.motif.degrees[0], d));
    expect(classesOf(FIBONACCI)).toContain(interval);
    expect(classesOf(COUNTERPOINT)).toContain(interval);
  });

  it("falls back to the fifth when two motifs share no interval", () => {
    const a: MotifSource = {
      conceptId: "a",
      motif: {
        degrees: [0, 1],
        rhythm: [2, 2],
        register: "mid",
        articulation: "struck",
        timbre: "wood",
      },
    };
    const b: MotifSource = {
      conceptId: "b",
      motif: {
        degrees: [0, 6],
        rhythm: [2, 2],
        register: "mid",
        articulation: "struck",
        timbre: "metal",
      },
    };
    expect(imitationInterval(CASTALIA_MODE, a, b)).toBe(
      SCORE.grammar.echoFallbackInterval
    );
  });

  it("enters late, on the grid, and overlaps the subject", () => {
    const subject = byRole(plan.notes, "subject");
    const answer = byRole(plan.notes, "answer");
    const entry = answer[0].atSeconds;
    expect(entry).toBeGreaterThan(0);
    // A whole number of rhythmic units: imitation, not drift.
    expect(Math.abs((entry / UNIT) - Math.round(entry / UNIT))).toBeLessThan(1e-6);
    // Strictly inside the subject, so the two are heard together.
    const subjectEnd = subject[subject.length - 1].atSeconds;
    expect(entry).toBeLessThan(subjectEnd + motifUnits(FIBONACCI.motif) * UNIT);
  });

  it("keeps the subject's rhythm exactly — that is what makes it imitation", () => {
    const subject = byRole(plan.notes, "subject");
    const answer = byRole(plan.notes, "answer");
    const gaps = (notes: readonly PlannedNote[]) =>
      notes.slice(1).map((note, i) => Number((note.atSeconds - notes[i].atSeconds).toFixed(6)));
    expect(gaps(answer)).toEqual(gaps(subject));
  });

  it("closes when the relation is documented, and stays open when it is not", () => {
    expect(plan.meta.resolves).toBe(true);
    expect(plan.notes.some((note) => note.role === "residue")).toBe(true);
    expect(plan.notes.every((note) => !note.openEnded)).toBe(true);

    const open = planRelationVoices(
      base({ intention: "echo", a: FIBONACCI, b: COUNTERPOINT, resolves: false })
    );
    expect(open.meta.resolves).toBe(false);
    expect(open.notes.some((note) => note.role === "residue")).toBe(false);
    const last = byRole(open.notes, "answer").at(-1)!;
    expect(last.openEnded).toBe(true);
    expect(isTense(CASTALIA_MODE, last.degree)).toBe(true);
  });
});

// ─── Passage ────────────────────────────────────────────────────────────────

describe("Passage — transformation across the interval", () => {
  const plan = planRelationVoices(
    base({ intention: "passage", a: PERSPECTIVE, b: CAMERA })
  );
  const steps = plan.notes.filter((note) => note.id.includes(":step:"));

  it("is one continuous line, strictly ordered in time", () => {
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].atSeconds).toBeGreaterThan(steps[i - 1].atSeconds);
    }
  });

  it("hands off timbre from source to destination", () => {
    expect(steps[0].timbre).toBe(PERSPECTIVE.motif.timbre);
    expect(steps[steps.length - 1].timbre).toBe(CAMERA.motif.timbre);
    expect(PERSPECTIVE.motif.timbre).not.toBe(CAMERA.motif.timbre);
  });

  it("hands off register monotonically, never wandering back", () => {
    const indices = steps.map((note) => registerIndex(note.register));
    const from = registerIndex(PERSPECTIVE.motif.register);
    const to = registerIndex(CAMERA.motif.register);
    expect(indices[0]).toBe(from);
    expect(indices[indices.length - 1]).toBe(to);
    const rising = to >= from;
    for (let i = 1; i < indices.length; i++) {
      if (rising) expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
      else expect(indices[i]).toBeLessThanOrEqual(indices[i - 1]);
    }
  });

  it("begins on the source's contour and arrives on the destination's", () => {
    expect(steps[0].degree).toBe(PERSPECTIVE.motif.degrees[0]);
    expect(steps[steps.length - 1].degree).toBe(
      CAMERA.motif.degrees[CAMERA.motif.degrees.length - 1]
    );
  });

  it("transforms rather than concatenating: the middle is neither motif", () => {
    const middle = steps.slice(1, -1).map((note) => note.degree);
    const isPureSource = middle.every((d) => PERSPECTIVE.motif.degrees.includes(d));
    const isPureDestination = middle.every((d) => CAMERA.motif.degrees.includes(d));
    expect(isPureSource && isPureDestination).toBe(false);
  });

  it("carries a sustained tone under the crossing so the handoff is audible", () => {
    const carrier = plan.notes.find((note) => note.role === "residue");
    expect(carrier).toBeDefined();
    expect(carrier!.timbre).toBe(CAMERA.motif.timbre);
    expect(carrier!.articulation).toBe("sustained");
  });

  it("stops short of arriving when the reading is not documented", () => {
    const open = planRelationVoices(
      base({ intention: "passage", a: PERSPECTIVE, b: CAMERA, resolves: false })
    );
    const last = open.notes.filter((n) => n.id.includes(":step:")).at(-1)!;
    expect(last.openEnded).toBe(true);
    expect(isTense(CASTALIA_MODE, last.degree)).toBe(true);
  });
});

// ─── Tension ────────────────────────────────────────────────────────────────

describe("Tension — controlled instability", () => {
  const plan = planRelationVoices(base({ intention: "tension", a: JUST, b: EQUAL }));

  it("never resolves, whatever the record says", () => {
    expect(plan.meta.resolves).toBe(false);
    expect(plan.notes.every((note) => note.openEnded)).toBe(true);

    const documented = planRelationVoices(
      base({ intention: "tension", a: JUST, b: EQUAL, resolves: true })
    );
    expect(documented.meta.resolves).toBe(false);
    expect(documented.notes.every((note) => note.openEnded)).toBe(true);
  });

  it("suspends on a tense interval class the pair itself implies", () => {
    const interval = suspensionInterval(CASTALIA_MODE, JUST, EQUAL);
    expect(isTense(CASTALIA_MODE, interval)).toBe(true);
    const subject = byRole(plan.notes, "subject")[0];
    const answer = byRole(plan.notes, "answer")[0];
    expect(intervalClass(subject.degree, answer.degree)).toBe(interval);
    // Compound, not a second in the bass: the upper voice sounds more than an
    // octave clear of the lower, so the pair suspends instead of turning to mud.
    expect(answer.frequency / subject.frequency).toBeGreaterThan(2);
    expect(plan.meta.interval).toBe(12 + interval);
  });

  it("beats inside the accepted band, and says at what rate", () => {
    expect(plan.beatings).toHaveLength(1);
    const beating = plan.beatings[0];
    expect(beating.beatingHz).toBeGreaterThanOrEqual(COMFORT.beating.minHz);
    expect(beating.beatingHz).toBeLessThanOrEqual(COMFORT.beating.maxHz);
    expect(beating.beatingHz).toBeLessThan(COMFORT.beating.ceilingHz);
    expect(plan.meta.beatingHz).toBe(beating.beatingHz);
  });

  it("produces the beat from a detuned twin, so the rate is what was planned", () => {
    const shadow = byRole(plan.notes, "shadow")[0];
    const subject = byRole(plan.notes, "subject")[0];
    expect(shadow.degree).toBe(subject.degree);
    expect(shadow.detuneCents).toBeGreaterThan(0);
    const rate = beatingHzBetween(
      shadow.frequency,
      transposeCents(shadow.frequency, shadow.detuneCents)
    );
    expect(rate).toBeCloseTo(plan.beatings[0].beatingHz, 6);
  });

  it("sounds at most three voices at once", () => {
    expect(peakConcurrentNotes(plan)).toBeLessThanOrEqual(
      COMFORT.tension.maxConcurrentVoices
    );
  });

  it("keeps its summed gain below the ambient bed", () => {
    expect(peakSummedGain(plan)).toBeLessThan(BED);
    expect(peakSummedGain(plan)).toBeLessThanOrEqual(
      BED * COMFORT.tension.gainFractionOfBed
    );
  });

  it("decays to a low floor within twelve seconds while continuing to sound", () => {
    const beating = plan.beatings[0];
    expect(beating.decayToFloorSeconds).toBeLessThanOrEqual(
      COMFORT.tension.decayToFloorSeconds
    );
    expect(beating.floorGain).toBeGreaterThan(0);
    expect(beating.floorGain).toBeLessThan(beating.gain);
    for (const note of plan.notes) {
      expect(note.floorGain).toBeGreaterThan(0);
      expect(note.envelope.hold).toBeLessThanOrEqual(
        COMFORT.tension.decayToFloorSeconds
      );
      // Persisting is not the same as unbounded.
      expect(noteLifetime(note)).toBeLessThanOrEqual(COMFORT.tension.lifetimeSeconds);
    }
  });

  it("is not softened by an expressive gesture", () => {
    const gentle = planRelationVoices(
      base({
        intention: "tension",
        a: JUST,
        b: EQUAL,
        phrasing: { attack: 0, legato: 1, rubato: 1, weight: 0, breadth: 1 },
      })
    );
    expect(gentle.notes.map((n) => n.gain)).toEqual(plan.notes.map((n) => n.gain));
    expect(gentle.beatings[0].beatingHz).toBe(plan.beatings[0].beatingHz);
  });

  it("gives the same pair the same rate every time", () => {
    expect(beatingRateFor("x")).toBe(beatingRateFor("x"));
    expect(planRelationVoices(base({ intention: "tension", a: JUST, b: EQUAL }))).toEqual(
      plan
    );
  });
});

// ─── Ground ─────────────────────────────────────────────────────────────────

describe("Ground — an invariant base", () => {
  const plan = planRelationVoices(
    base({ intention: "ground", a: SYMMETRY, b: ENERGY, ground: "a" })
  );

  it("holds exactly one pitch, and does not move it", () => {
    const pedal = byRole(plan.notes, "pedal");
    expect(pedal).toHaveLength(1);
    expect(pedal[0].atSeconds).toBe(0);
    expect(isStable(CASTALIA_MODE, pedal[0].degree)).toBe(true);
    expect(pedal[0].articulation).toBe("sustained");
  });

  it("puts the base beneath everything else", () => {
    const pedal = byRole(plan.notes, "pedal")[0];
    const above = plan.notes.filter(
      (note) => note.role !== "pedal" && note.role !== "ground"
    );
    for (const note of above) {
      expect(registerIndex(pedal.register)).toBeLessThanOrEqual(
        registerIndex(note.register)
      );
    }
    expect(registerIndex(pedal.register)).toBeLessThan(
      registerIndex(SYMMETRY.motif.register)
    );
  });

  it("outlasts the motif it supports", () => {
    const pedal = byRole(plan.notes, "pedal")[0];
    const above = plan.notes.filter((note) => note.role === "subject");
    const lastAbove = Math.max(...above.map((note) => note.atSeconds));
    expect(noteEndSeconds(pedal)).toBeGreaterThan(lastAbove);
  });

  it("reinforces the pedal at the exact fifth, which locks rather than beats", () => {
    const pedal = byRole(plan.notes, "pedal")[0];
    const reinforce = byRole(plan.notes, "ground")[0];
    expect(reinforce.degree - pedal.degree).toBe(7);
    expect(reinforce.frequency / pedal.frequency).toBeCloseTo(3 / 2, 6);
  });

  it("lets the grounded motif continue above, unaltered", () => {
    const above = plan.notes.filter((note) => note.role === "subject");
    const expected = [
      ...ENERGY.motif.degrees,
      ...ENERGY.motif.degrees,
    ];
    expect(above.map((note) => note.degree)).toEqual(expected);
    expect(above.every((note) => note.timbre === ENERGY.motif.timbre)).toBe(true);
    expect(above[0].atSeconds).toBeGreaterThan(0);
  });

  it("chooses the lower register to ground when the caller does not say", () => {
    const inferred = planRelationVoices(
      base({ intention: "ground", a: SYMMETRY, b: ENERGY })
    );
    const pedal = byRole(inferred.notes, "pedal")[0];
    // Conservation of Energy is authored in `sub`; Continuous Symmetry in `low`.
    expect(pedal.conceptId).toBe(ENERGY.conceptId);
  });
});

// ─── Properties across the whole pack ───────────────────────────────────────

describe("every grammar, over the whole content pack", () => {
  const pairs = CASTALIA_CONCEPTS.map((concept, index) => [
    { conceptId: concept.id, motif: concept.motif },
    {
      conceptId: CASTALIA_CONCEPTS[(index + 7) % CASTALIA_CONCEPTS.length].id,
      motif: CASTALIA_CONCEPTS[(index + 7) % CASTALIA_CONCEPTS.length].motif,
    },
  ] as const);

  it("stays inside the comfort envelope for every pair and every intention", () => {
    for (const [a, b] of pairs) {
      for (const intention of RELATION_INTENTIONS) {
        for (const resolves of [true, false]) {
          const plan = planRelationVoices(base({ intention, a, b, resolves }));
          expect(auditComfort(plan, { ambientGain: BED })).toEqual([]);
        }
      }
    }
  });

  it("bounds every voice's lifetime, everywhere", () => {
    for (const [a, b] of pairs) {
      for (const intention of RELATION_INTENTIONS) {
        const plan = planRelationVoices(base({ intention, a, b }));
        for (const note of plan.notes) {
          expect(noteLifetime(note)).toBeLessThanOrEqual(
            COMFORT.voice.maxLifetimeSeconds
          );
        }
      }
    }
  });

  it("makes the four intentions structurally distinguishable", () => {
    for (const [a, b] of pairs) {
      const plans = RELATION_INTENTIONS.map((intention) =>
        planRelationVoices(base({ intention, a, b }))
      );
      const signatures = plans.map((plan) => plan.meta.grammar);
      expect(new Set(signatures).size).toBe(RELATION_INTENTIONS.length);
      // Only Tension beats; only Ground pedals; only Echo names an imitation
      // interval and doubles its note count.
      const [echo, passage, tension, ground] = plans;
      expect(tension.beatings).toHaveLength(1);
      expect(echo.beatings).toHaveLength(0);
      expect(passage.beatings).toHaveLength(0);
      expect(ground.beatings).toHaveLength(0);
      expect(ground.notes.some((note) => note.role === "pedal")).toBe(true);
      expect(echo.notes.some((note) => note.role === "pedal")).toBe(false);
      expect(echo.meta.interval).not.toBeNull();
    }
  });

  it("refuses a nonsensical grid or an inaudible bed", () => {
    expect(() =>
      planRelationVoices(base({ intention: "echo", a: FIBONACCI, b: COUNTERPOINT, unitSeconds: 0 }))
    ).toThrow(RangeError);
    expect(() =>
      planRelationVoices(base({ intention: "echo", a: FIBONACCI, b: COUNTERPOINT, ambientGain: 0 }))
    ).toThrow(RangeError);
  });
});
