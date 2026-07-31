import { describe, expect, it } from "vitest";

import { castaliaConceptById } from "@/content/castalia/concepts";
import type { RelationIntention } from "@/domain/events";
import {
  planAttunement,
  shimmerDegree,
  type AttunementInput,
  type AttunementThread,
} from "./attunement";
import { COMFORT } from "./comfort";
import { CASTALIA_MODE, isTense } from "./mode";
import type { MotifSource } from "./motif";
import { auditComfort, noteLifetime } from "./plan";
import { SCORE } from "./score";

const source = (id: string): MotifSource => {
  const concept = castaliaConceptById.get(id);
  if (!concept) throw new Error(`missing fixture concept ${id}`);
  return { conceptId: concept.id, motif: concept.motif };
};

const BED = SCORE.grammar.bedGain;

const thread = (
  threadId: string,
  intention: RelationIntention,
  aId: string,
  bId: string,
  resolves = true
): AttunementThread => ({
  threadId,
  intention,
  a: source(aId),
  b: source(bId),
  resolves,
});

const THREADS: readonly AttunementThread[] = [
  thread("t1", "echo", "measure.fibonacci-sequence", "sound.counterpoint"),
  thread("t2", "tension", "sound.just-intonation", "sound.equal-temperament", false),
  thread("t3", "ground", "measure.continuous-symmetry", "matter.conservation-of-energy"),
  thread("t4", "passage", "image.linear-perspective", "image.camera-obscura"),
];

const input = (overrides: Partial<AttunementInput> = {}): AttunementInput => ({
  planId: "att",
  mode: CASTALIA_MODE,
  threads: THREADS,
  unitSeconds: 0.125,
  ambientGain: BED,
  ...overrides,
});

describe("attunement", () => {
  it("gives every thread its own window, in creation order", () => {
    const plan = planAttunement(input());
    expect(plan.channels.map((c) => c.threadId)).toEqual(["t1", "t2", "t3", "t4"]);
  });

  it("makes threads individually audible — the windows do not overlap", () => {
    const plan = planAttunement(input());
    for (let i = 1; i < plan.channels.length; i++) {
      const previous = plan.channels[i - 1];
      expect(plan.channels[i].atSeconds).toBeGreaterThanOrEqual(
        previous.atSeconds + previous.spanSeconds
      );
    }
  });

  it("leaves real silence between them", () => {
    const plan = planAttunement(input());
    for (let i = 1; i < plan.channels.length; i++) {
      const previous = plan.channels[i - 1];
      const gap =
        plan.channels[i].atSeconds - (previous.atSeconds + previous.spanSeconds);
      expect(gap).toBeCloseTo(SCORE.attunement.channelGapSeconds, 4);
    }
  });

  it("drops the bed so a single thread can be heard at all", () => {
    const plan = planAttunement(input());
    expect(plan.bedGainScale).toBeLessThan(1);
    expect(plan.densityScale).toBeLessThan(0.5);
  });

  it("keeps each channel in its own grammar", () => {
    const plan = planAttunement(input());
    const byThread = new Map(plan.channels.map((c) => [c.threadId, c]));
    expect(byThread.get("t1")!.plan.intention).toBe("echo");
    expect(byThread.get("t2")!.plan.beatings).toHaveLength(1);
    expect(
      byThread.get("t3")!.plan.notes.some((note) => note.role === "pedal")
    ).toBe(true);
    expect(byThread.get("t4")!.plan.intention).toBe("passage");
  });

  it("shimmers on a pitch its grammar chose, not a decorative one", () => {
    const echoShimmer = shimmerDegree(CASTALIA_MODE, THREADS[0]);
    const tensionShimmer = shimmerDegree(CASTALIA_MODE, THREADS[1]);
    // A Tension's shimmer degree is itself unstable; an Echo's is the interval
    // it imitates by.
    expect(isTense(CASTALIA_MODE, tensionShimmer - THREADS[1].a.motif.degrees[0])).toBe(
      true
    );
    expect(echoShimmer).not.toBe(THREADS[0].a.motif.degrees[0]);

    const plan = planAttunement(input());
    const shimmer = plan.channels[0].plan.notes.find(
      (note) => note.role === "ensemble"
    );
    expect(shimmer).toBeDefined();
    expect(shimmer!.register).toBe("air");
    expect(shimmer!.degree).toBe(echoShimmer);
  });

  it("gives a Tension channel no extra partial — its beating is its shimmer", () => {
    const plan = planAttunement(input());
    const tension = plan.channels.find((c) => c.threadId === "t2")!;
    expect(tension.plan.notes.some((note) => note.role === "ensemble")).toBe(false);
    expect(tension.plan.notes.length).toBeLessThanOrEqual(3);
    expect(tension.plan.beatings).toHaveLength(1);
  });

  it("adds no new assertions — every channel names a thread that already exists", () => {
    const plan = planAttunement(input());
    const known = new Set(THREADS.map((t) => t.threadId));
    for (const channel of plan.channels) {
      expect(known.has(channel.threadId)).toBe(true);
      const thread = THREADS.find((t) => t.threadId === channel.threadId)!;
      expect(channel.plan.meta.conceptIds).toContain(thread.a.conceptId);
      expect(channel.plan.meta.conceptIds).toContain(thread.b.conceptId);
      // A Tension the player left open stays open here too.
      if (thread.intention === "tension") {
        expect(channel.plan.meta.resolves).toBe(false);
      }
    }
  });

  it("condenses a long channel without changing what it says", () => {
    const plan = planAttunement(input({ maxChannelSeconds: 4 }));
    const tension = plan.channels.find((c) => c.threadId === "t2")!;
    expect(tension.spanSeconds).toBeLessThanOrEqual(4.001);
    // Onsets — the rhythm — are untouched; only the sustain shortens.
    expect(tension.plan.notes.map((n) => n.atSeconds)).toEqual(
      planAttunement(input({ maxChannelSeconds: 60 }))
        .channels.find((c) => c.threadId === "t2")!
        .plan.notes.map((n) => n.atSeconds)
    );
    expect(tension.plan.beatings[0].decayToFloorSeconds).toBeLessThanOrEqual(
      COMFORT.tension.decayToFloorSeconds
    );
  });

  it("rotates rather than piling up when the web is large", () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      thread(`t${i}`, "echo", "measure.fibonacci-sequence", "sound.counterpoint")
    );
    const first = planAttunement(input({ threads: many, cycleIndex: 0 }));
    const second = planAttunement(input({ threads: many, cycleIndex: 1 }));
    expect(first.channels).toHaveLength(SCORE.attunement.maxChannelsPerCycle);
    expect(first.deferredThreadIds).toHaveLength(
      many.length - SCORE.attunement.maxChannelsPerCycle
    );
    expect(second.channels[0].threadId).not.toBe(first.channels[0].threadId);
  });

  it("stays inside the comfort envelope in every channel", () => {
    const plan = planAttunement(input());
    for (const channel of plan.channels) {
      expect(
        auditComfort(channel.plan, {
          ambientGain: BED * SCORE.attunement.channelGainScale,
        })
      ).toEqual([]);
      for (const note of channel.plan.notes) {
        expect(noteLifetime(note)).toBeLessThanOrEqual(
          COMFORT.voice.maxLifetimeSeconds
        );
      }
    }
  });

  it("has nothing to say when nothing is woven", () => {
    const plan = planAttunement(input({ threads: [] }));
    expect(plan.channels).toEqual([]);
    expect(plan.cycleSeconds).toBe(0);
  });

  it("refuses a nonsensical grid", () => {
    expect(() => planAttunement(input({ unitSeconds: 0 }))).toThrow(RangeError);
  });
});
