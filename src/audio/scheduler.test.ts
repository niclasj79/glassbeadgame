import { describe, expect, it } from "vitest";

import { COMFORT } from "./comfort";
import { CASTALIA_MODE, degreeFrequency } from "./mode";
import { createPlanQueue } from "./scheduler";
import { makeVoicePlan, type VoicePlan } from "./plan";
import { createVoiceBudget } from "./voices";

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
      },
    ],
    meta: {
      conceptIds: ["c"],
      grammar: "imitation",
      resolves: true,
      interval: 7,
      beatingHz: null,
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
