import { describe, expect, it } from "vitest";

import {
  COMFORT,
  clampBeatingHz,
  clampLifetimeSeconds,
  tensionCeiling,
} from "./comfort";
import { CASTALIA_MODE, degreeFrequency } from "./mode";
import {
  auditComfort,
  capTenseGain,
  makeVoicePlan,
  mergePlans,
  noteEndSeconds,
  noteLifetime,
  notesSoundingAt,
  peakConcurrentNotes,
  peakSummedGain,
  peakTenseSummedGain,
  type PlannedBeating,
  type PlannedNote,
} from "./plan";

const note = (overrides: Partial<PlannedNote> = {}): PlannedNote => ({
  id: "n",
  conceptId: "c",
  role: "subject",
  timbre: "glass",
  articulation: "sustained",
  register: "mid",
  degree: 0,
  frequency: degreeFrequency(CASTALIA_MODE, 0, "mid"),
  detuneCents: 0,
  atSeconds: 0,
  envelope: { attack: 0.1, hold: 1, release: 0.4 },
  gain: 0.05,
  floorGain: 0,
  openEnded: false,
  tense: false,
  ...overrides,
});

/** A voice inside a deliberately tense simultaneity. */
const tenseNote = (overrides: Partial<PlannedNote> = {}): PlannedNote =>
  note({ tense: true, ...overrides });

const beating = (overrides: Partial<PlannedBeating> = {}): PlannedBeating => ({
  id: "b",
  conceptIds: ["a", "b"],
  frequencies: [110, 112],
  beatingHz: 2,
  atSeconds: 0,
  gain: 0.04,
  floorGain: 0.008,
  decayToFloorSeconds: COMFORT.tension.decayToFloorSeconds,
  ...overrides,
});

const plan = (
  notes: readonly PlannedNote[],
  beatings: readonly PlannedBeating[] = [],
  intention: "tension" | "echo" | null = null,
  resolves = false
) =>
  makeVoicePlan({
    id: "p",
    kind: "relation",
    intention,
    notes,
    beatings,
    meta: {
      conceptIds: ["a", "b"],
      grammar: "test",
      resolves,
      interval: null,
      beatingHz: null,
      outcome: null,
    },
  });

describe("the comfort table", () => {
  it("clamps a requested beat rate into the accepted band", () => {
    expect(clampBeatingHz(0.1)).toBe(COMFORT.beating.minHz);
    expect(clampBeatingHz(40)).toBe(COMFORT.beating.maxHz);
    expect(clampBeatingHz(Number.NaN)).toBe(COMFORT.beating.minHz);
    expect(clampBeatingHz(3)).toBe(3);
  });

  it("clamps a voice lifetime however long it was asked for", () => {
    expect(clampLifetimeSeconds(1000)).toBe(COMFORT.voice.maxLifetimeSeconds);
    expect(clampLifetimeSeconds(-1)).toBe(0);
  });

  it("keeps the working maximum under the absolute ceiling", () => {
    expect(COMFORT.beating.maxHz).toBeLessThan(COMFORT.beating.ceilingHz);
    expect(COMFORT.beating.minHz).toBeLessThan(COMFORT.beating.maxHz);
  });
});

describe("plan geometry", () => {
  it("computes each voice's lifetime and end", () => {
    const n = note();
    expect(noteLifetime(n)).toBeCloseTo(1.5, 9);
    expect(noteEndSeconds(note({ atSeconds: 2 }))).toBeCloseTo(3.5, 9);
  });

  it("reports what is sounding, and the peak of it", () => {
    const p = plan([
      note({ id: "a", atSeconds: 0 }),
      note({ id: "b", atSeconds: 0.5 }),
      note({ id: "c", atSeconds: 10 }),
    ]);
    expect(notesSoundingAt(p, 0.6).map((n) => n.id)).toEqual(["a", "b"]);
    expect(notesSoundingAt(p, 5)).toEqual([]);
    expect(peakConcurrentNotes(p)).toBe(2);
    expect(peakSummedGain(p)).toBeCloseTo(0.1, 9);
  });

  it("takes a plan's duration from its longest tail", () => {
    expect(plan([note({ atSeconds: 3 })]).durationSeconds).toBeCloseTo(4.5, 4);
  });
});

describe("the comfort audit", () => {
  it("passes a plan inside the envelope", () => {
    expect(
      auditComfort(
        plan([tenseNote(), tenseNote({ id: "n2" })], [beating()], "tension"),
        { bedGain: 0.19 }
      )
    ).toEqual([]);
  });

  it("catches beating above the ceiling", () => {
    const problems = auditComfort(plan([note()], [beating({ beatingHz: 9 })]), {
      bedGain: 0.19,
    });
    expect(problems.join(" ")).toContain("ceiling");
  });

  it("catches beating below the minimum, which reads as drift not instability", () => {
    const problems = auditComfort(plan([note()], [beating({ beatingHz: 0.2 })]), {
      bedGain: 0.19,
    });
    expect(problems.join(" ")).toContain("below");
  });

  it("catches a fourth voice in a tense interval class", () => {
    const notes = [0, 1, 2, 3].map((i) =>
      tenseNote({ id: `n${i}`, atSeconds: i * 0.1 })
    );
    const problems = auditComfort(plan(notes, [beating()], "tension"), {
      bedGain: 0.19,
    });
    expect(problems.join(" ")).toContain("voices sound at once");
  });

  it("counts tense voices, not voices — a four-part Echo is not a breach", () => {
    const notes = [0, 1, 2, 3].map((i) => note({ id: `n${i}`, atSeconds: i * 0.1 }));
    expect(auditComfort(plan(notes, [], "echo"), { bedGain: 0.19 })).toEqual([]);
  });

  it("catches tense voices stacked from more than one plan", () => {
    // The Attunement defect, reduced to its essentials: two plans that are each
    // legal, laid onto one timeline, are not.
    const legal = plan(
      [tenseNote({ id: "x" }), tenseNote({ id: "y", gain: 0.04 })],
      [],
      "tension"
    );
    expect(auditComfort(legal, { bedGain: 0.19 })).toEqual([]);
    const stacked = mergePlans("merged", "attunement", [
      { plan: legal, atSeconds: 0 },
      { plan: legal, atSeconds: 0.2 },
    ]);
    expect(auditComfort(stacked, { bedGain: 0.19 }).join(" ")).toContain(
      "voices sound at once"
    );
  });

  it("catches a Tension louder than the ambient bed", () => {
    const problems = auditComfort(
      plan([tenseNote({ gain: 0.5 })], [beating()], "tension"),
      { bedGain: 0.19 }
    );
    expect(problems.join(" ")).toContain("ambient bed ceiling");
  });

  it("caps tense voices at the ceiling without touching the rest", () => {
    const loud = plan(
      [tenseNote({ id: "t", gain: 0.5 }), note({ id: "m", gain: 0.2 })],
      [beating({ gain: 0.5 })],
      "tension"
    );
    const bounded = capTenseGain(loud, tensionCeiling(0.19));
    expect(peakTenseSummedGain(bounded)).toBeCloseTo(tensionCeiling(0.19), 6);
    expect(bounded.notes.find((n) => n.id === "m")!.gain).toBe(0.2);
    expect(auditComfort(bounded, { bedGain: 0.19 })).toEqual([]);
  });

  it("catches a Tension that claims to resolve", () => {
    const problems = auditComfort(
      plan([note()], [beating()], "tension", true),
      { bedGain: 0.19 }
    );
    expect(problems.join(" ")).toContain("may not declare that it resolves");
  });

  it("catches an unbounded voice", () => {
    const problems = auditComfort(
      plan([note({ envelope: { attack: 1, hold: 60, release: 1 } })]),
      { bedGain: 0.19 }
    );
    expect(problems.join(" ")).toContain("beyond the");
  });
});
