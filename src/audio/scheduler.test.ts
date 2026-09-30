import { beforeEach, describe, expect, it } from "vitest";

import { COMFORT } from "./comfort";
import { CASTALIA_MODE, degreeFrequency } from "./mode";
import { createPlanQueue, realizeVoicePlan } from "./scheduler";
import { makeVoicePlan, type PlannedNote, type VoicePlan } from "./plan";
import { createVoiceBudget, voiceBudget, type RetireVoice } from "./voices";

const plan = (id: string): VoicePlan =>
  makeVoicePlan({
    id,
    kind: "relation",
    intention: "echo",
    notes: [
      {
        id: `${id}:n`,
        conceptId: "c",
        role: "subject",
        timbre: "glass",
        articulation: "struck",
        register: "mid",
        degree: 0,
        frequency: degreeFrequency(CASTALIA_MODE, 0, "mid"),
        detuneCents: 0,
        atSeconds: 0,
        envelope: { attack: 0.01, hold: 0.1, release: 0.5 },
        gain: 0.05,
        floorGain: 0,
        openEnded: false,
        tense: false,
      },
    ],
    meta: {
      conceptIds: ["c"],
      grammar: "imitation",
      resolves: true,
      interval: 7,
      beatingHz: null,
      outcome: "documented",
    },
  });

describe("the look-ahead queue", () => {
  it("stores absolute times and releases them in order", () => {
    const queue = createPlanQueue();
    queue.push(plan("c"), 30);
    queue.push(plan("a"), 10);
    queue.push(plan("b"), 20);
    expect(queue.pending()).toBe(3);
    expect(queue.drain(20).map((entry) => entry.plan.id)).toEqual(["a", "b"]);
    expect(queue.pending()).toBe(1);
    expect(queue.drain(100).map((entry) => entry.plan.id)).toEqual(["c"]);
  });

  it("releases nothing before its time", () => {
    const queue = createPlanQueue();
    queue.push(plan("a"), 10);
    expect(queue.drain(9.99)).toEqual([]);
    expect(queue.pending()).toBe(1);
  });

  it("refuses work past its capacity rather than growing without bound", () => {
    const queue = createPlanQueue({ capacity: 2 });
    expect(queue.push(plan("a"), 1)).toBe(true);
    expect(queue.push(plan("b"), 2)).toBe(true);
    // Refusing the newest drops one gesture; accepting it would delay every
    // note already scheduled behind a backlog.
    expect(queue.push(plan("c"), 3)).toBe(false);
    expect(queue.pending()).toBe(2);
  });

  it("empties on reset", () => {
    const queue = createPlanQueue();
    queue.push(plan("a"), 1);
    queue.reset();
    expect(queue.pending()).toBe(0);
  });

  it("drops the newest waiting plan with an id, and says whether there was one", () => {
    const queue = createPlanQueue();
    queue.push(plan("a"), 10);
    queue.push(plan("b"), 20);
    queue.push(plan("a"), 30);
    expect(queue.remove("a")).toBe(true);
    expect(queue.drain(100).map((entry) => [entry.plan.id, entry.at])).toEqual([
      ["a", 10],
      ["b", 20],
    ]);
    expect(queue.remove("nobody")).toBe(false);
  });
});

describe("the voice budget", () => {
  it("admits voices up to its ceiling and refuses the rest", () => {
    const budget = createVoiceBudget(3);
    expect(budget.claim(0, 5)).toBe(true);
    expect(budget.claim(0, 5)).toBe(true);
    expect(budget.claim(0, 5)).toBe(true);
    expect(budget.claim(0, 5)).toBe(false);
    expect(budget.active(0)).toBe(3);
  });

  it("frees slots as voices end, because every voice ends", () => {
    const budget = createVoiceBudget(2);
    budget.claim(0, 1);
    budget.claim(0, 10);
    expect(budget.claim(0, 10)).toBe(false);
    // The first voice's lifetime has passed.
    expect(budget.claim(2, 10)).toBe(true);
    expect(budget.active(2)).toBe(2);
  });

  it("defaults to the comfort table's ceiling", () => {
    const budget = createVoiceBudget();
    for (let i = 0; i < COMFORT.voice.maxConcurrent; i++) {
      expect(budget.claim(0, 5)).toBe(true);
    }
    expect(budget.claim(0, 5)).toBe(false);
    budget.reset();
    expect(budget.active(0)).toBe(0);
  });
});

// ─── Taking a plan back ─────────────────────────────────────────────────────

interface Recorded {
  readonly gains: { events: [string, number, number?][] }[];
  readonly stops: number[];
}

/** The smallest AudioContext `playVoice` runs against, recording what a retirement asks of it. */
function recordingContext(currentTime: number) {
  const record: Recorded = { gains: [], stops: [] };
  const param = (events: [string, number, number?][]) => ({
    value: 1,
    setValueAtTime: (v: number, t: number) => events.push(["set", v, t]),
    linearRampToValueAtTime: (v: number, t: number) => events.push(["ramp", v, t]),
    exponentialRampToValueAtTime: (v: number, t: number) => events.push(["exp", v, t]),
    cancelScheduledValues: (t: number) => events.push(["cancel", t]),
    setTargetAtTime: () => {},
  });
  const node = () => ({ connect: () => {}, disconnect: () => {} });
  const ctx = {
    currentTime,
    createGain: () => {
      const events: [string, number, number?][] = [];
      record.gains.push({ events });
      return { ...node(), gain: param(events) };
    },
    createOscillator: () => ({
      ...node(),
      type: "sine",
      frequency: { value: 0 },
      setPeriodicWave: () => {},
      start: () => {},
      stop: (t: number) => record.stops.push(t),
      addEventListener: () => {},
    }),
    createPeriodicWave: () => ({}),
    createBiquadFilter: () => ({ ...node(), type: "lowpass", frequency: { value: 0 }, Q: { value: 1 } }),
  };
  return { ctx: ctx as unknown as AudioContext, record };
}

const note = (id: string, atSeconds: number): PlannedNote => ({
  id,
  conceptId: "c",
  role: "subject",
  timbre: "glass",
  articulation: "struck",
  register: "mid",
  degree: 0,
  frequency: degreeFrequency(CASTALIA_MODE, 0, "mid"),
  detuneCents: 0,
  atSeconds,
  envelope: { attack: 0.01, hold: 0.4, release: 0.8 },
  gain: 0.05,
  floorGain: 0,
  openEnded: false,
  tense: false,
});

const twoNotes = makeVoicePlan({
  id: "retirable",
  kind: "relation",
  intention: null,
  notes: [note("n0", 0), note("n1", 0.5)],
  meta: {
    conceptIds: ["c"],
    grammar: "fixture",
    resolves: false,
    interval: null,
    beatingHz: null,
    outcome: null,
  },
});

const buses = () => {
  const bus = { connect: () => {}, disconnect: () => {} } as unknown as AudioNode;
  return { music: bus, tension: bus, tensionCeiling: 1 };
};

describe("taking a plan back", () => {
  beforeEach(() => voiceBudget.reset());

  it("asks for no extra node from a plan nobody will retire", () => {
    const plain = recordingContext(10);
    realizeVoicePlan(plain.ctx, buses(), twoNotes, 10);
    voiceBudget.reset();
    const asked = recordingContext(10);
    const retirers: RetireVoice[] = [];
    realizeVoicePlan(asked.ctx, buses(), twoNotes, 10, retirers);
    expect(retirers).toHaveLength(2);
    // One gate per voice, and only for the caller that asked.
    expect(asked.record.gains.length - plain.record.gains.length).toBe(2);
  });

  it("fades a voice that has begun, from where it is, and stops its source", () => {
    const { ctx, record } = recordingContext(10);
    const retirers: RetireVoice[] = [];
    realizeVoicePlan(ctx, buses(), twoNotes, 10, retirers);
    // The gate is the first gain each voice creates: it sits after the envelope.
    retirers[0](10.2, 0.06);
    const gate = record.gains[0].events;
    expect(gate).toContainEqual(["set", 1, 10.2]);
    expect(gate).toContainEqual(["ramp", 0, 10.26]);
    expect(record.stops).toContain(10.28);
  });

  it("never lets a voice that has not begun begin", () => {
    const { ctx, record } = recordingContext(10);
    const retirers: RetireVoice[] = [];
    realizeVoicePlan(ctx, buses(), twoNotes, 10, retirers);
    retirers[1](10.2, 0.06); // due at 10.5
    const gate = record.gains.find((g) => g.events.some((e) => e[0] === "set" && e[1] === 0))!.events;
    expect(gate).toContainEqual(["set", 0, 10.2]);
    expect(gate.some((e) => e[0] === "ramp")).toBe(false);
  });

  it("gives the voice budget back what a retired voice no longer uses", () => {
    const { ctx } = recordingContext(10);
    const retirers: RetireVoice[] = [];
    realizeVoicePlan(ctx, buses(), twoNotes, 10, retirers);
    expect(voiceBudget.active(10.3)).toBe(2);
    retirers.forEach((retire) => retire(10.2, 0.06));
    expect(voiceBudget.active(10.3)).toBe(0);
  });
});
