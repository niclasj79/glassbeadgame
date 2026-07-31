import { describe, expect, it } from "vitest";

import { COMFORT, clampBeatingHz, clampLifetimeSeconds } from "./comfort";
import { CASTALIA_MODE, degreeFrequency } from "./mode";
import {
  auditComfort,
  makeVoicePlan,
  noteEndSeconds,
  noteLifetime,
  notesSoundingAt,
  peakConcurrentNotes,
  peakSummedGain,
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
  ...overrides,
});

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
  intention: "tension" | null = null,
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
      auditComfort(plan([note(), note({ id: "n2" })], [beating()], "tension"), {
        ambientGain: 0.19,
      })
    ).toEqual([]);
  });

  it("catches beating above the ceiling", () => {
    const problems = auditComfort(plan([note()], [beating({ beatingHz: 9 })]), {
      ambientGain: 0.19,
    });
    expect(problems.join(" ")).toContain("ceiling");
  });

  it("catches beating below the minimum, which reads as drift not instability", () => {
    const problems = auditComfort(plan([note()], [beating({ beatingHz: 0.2 })]), {
      ambientGain: 0.19,
    });
    expect(problems.join(" ")).toContain("below");
  });

  it("catches a fourth voice in a tense interval class", () => {
    const notes = [0, 1, 2, 3].map((i) => note({ id: `n${i}`, atSeconds: i * 0.1 }));
    const problems = auditComfort(plan(notes, [beating()], "tension"), {
      ambientGain: 0.19,
    });
    expect(problems.join(" ")).toContain("voices sound at once");
  });

  it("catches a Tension louder than the ambient bed", () => {
    const problems = auditComfort(plan([note({ gain: 0.5 })], [beating()], "tension"), {
      ambientGain: 0.19,
    });
    expect(problems.join(" ")).toContain("ambient bed ceiling");
  });

  it("catches a Tension that claims to resolve", () => {
    const problems = auditComfort(
      plan([note()], [beating()], "tension", true),
      { ambientGain: 0.19 }
    );
    expect(problems.join(" ")).toContain("may not declare that it resolves");
  });

  it("catches an unbounded voice", () => {
    const problems = auditComfort(
      plan([note({ envelope: { attack: 1, hold: 60, release: 1 } })]),
      { ambientGain: 0.19 }
    );
    expect(problems.join(" ")).toContain("beyond the");
  });
});
