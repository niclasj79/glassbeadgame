import { describe, expect, it } from "vitest";
import { toConceptId } from "@/domain/ids";
import { buildSessionFixture } from "@/domain/outcomes/testing/buildSessionFixture";
import { compileConclusion } from "@/domain/performance";
import { castaliaLookup } from "@/runtime/content/castaliaLookup";
import {
  revealAfter,
  revealSchedule,
  type PerformanceTiming,
} from "./conclusionReveal";

/**
 * GAP-4. `performance.entries` had no consumer outside the domain module. The
 * conclusion built a portrait and an annotation, stamped them at t = 0 with a
 * stagger assembled from hard-coded constants, and let a forty-second
 * reconstruction of the session play behind a document that had already
 * finished arriving.
 *
 * Every assertion below is made against a performance the real compiler
 * produced from a real replayed session, because the defect was precisely that
 * the page's timing had nothing to do with that object.
 */

const FIXTURE = buildSessionFixture({
  conceptIds: [
    toConceptId("measure.fibonacci-sequence"),
    toConceptId("sound.counterpoint"),
    toConceptId("measure.prime-numbers"),
    toConceptId("sound.polyrhythm"),
  ],
  threads: [
    {
      a: toConceptId("measure.fibonacci-sequence"),
      b: toConceptId("sound.counterpoint"),
      intention: "echo",
    },
    {
      a: toConceptId("measure.prime-numbers"),
      b: toConceptId("sound.polyrhythm"),
      intention: "tension",
    },
  ],
  concluded: true,
});

const PERFORMANCE = compileConclusion(FIXTURE.state, castaliaLookup);
const PARTS = { sentences: 5, threads: 2, readings: 6 };

const timesOf = (
  steps: readonly { atSeconds: number; kind: string }[],
  kind: string
): number[] =>
  steps.filter((step) => step.kind === kind).map((step) => step.atSeconds);

describe("the reading on the performance's clock", () => {
  it("enters each thread at the second the compiler put its voice at (GAP-4)", () => {
    const steps = revealSchedule(PERFORMANCE, PARTS);
    const entries = [...PERFORMANCE.entries].sort((a, b) => a.order - b.order);
    expect(entries.length).toBeGreaterThan(1);

    // One for one with the compiled entries, at their times, in creation order.
    expect(timesOf(steps, "thread")).toEqual(entries.map((e) => e.atSeconds));
  });

  it("spans the performance rather than arriving complete (GAP-4)", () => {
    const steps = revealSchedule(PERFORMANCE, PARTS);
    const last = steps[steps.length - 1].atSeconds;
    // The old page finished within its own hard-coded 1.1s stagger while the
    // score ran on for the better part of a minute.
    expect(last).toBeGreaterThanOrEqual(PERFORMANCE.totalSeconds);
    expect(last).toBeGreaterThan(8);

    // And it is genuinely partial in between. The threads do not all enter at
    // once, and nothing is whole until the very last step.
    const threads = timesOf(steps, "thread");
    expect(threads[0]).toBeLessThan(threads[threads.length - 1]);
    expect(new Set(threads).size).toBe(threads.length);

    const beforeClose = revealAfter(steps, steps.length - 1);
    expect(beforeClose.closed).toBe(false);
    const atFirstThread = revealAfter(
      steps,
      steps.findIndex((step) => step.kind === "thread") + 1
    );
    expect(atFirstThread.threads).toBe(1);
    expect(atFirstThread.readings).toBe(0);
  });

  it("does not characterise the web until the web has finished sounding", () => {
    const steps = revealSchedule(PERFORMANCE, PARTS);
    const voicesEnd = PERFORMANCE.entries.reduce(
      (end, entry) => Math.max(end, entry.atSeconds + entry.durationSeconds),
      0
    );
    expect(voicesEnd).toBeGreaterThan(0);
    for (const at of timesOf(steps, "reading")) {
      expect(at).toBeGreaterThanOrEqual(voicesEnd);
    }
    expect(timesOf(steps, "reading")).toHaveLength(PARTS.readings);
  });

  it("takes its tempo from the performance, not from a constant", () => {
    const slow: PerformanceTiming = {
      secondsPerBeat: 1.2,
      totalSeconds: 40,
      entries: [{ order: 0, atSeconds: 0, durationSeconds: 8 }],
    };
    const quick: PerformanceTiming = { ...slow, secondsPerBeat: 0.6 };
    expect(timesOf(revealSchedule(slow, PARTS), "sentence")).not.toEqual(
      timesOf(revealSchedule(quick, PARTS), "sentence")
    );
    expect(timesOf(revealSchedule(slow, PARTS), "sentence")[1]).toBe(1.2);
  });

  it("closes no earlier than the performance does", () => {
    const steps = revealSchedule(PERFORMANCE, PARTS);
    const close = timesOf(steps, "close");
    expect(close).toHaveLength(1);
    expect(close[0]).toBeGreaterThanOrEqual(PERFORMANCE.totalSeconds);
    // Nothing is scheduled after the close: the page is whole when the
    // performance ends, whatever else happens.
    expect(steps[steps.length - 1].kind).toBe("close");
  });

  it("is a list of times and nothing else — there is no progress in it", () => {
    const steps = revealSchedule(PERFORMANCE, PARTS);
    for (const step of steps) {
      expect(Object.keys(step).sort()).toEqual(["atSeconds", "kind"]);
    }
    // Completing early is the length of the list. No fraction, no elapsed, no
    // "N of M" anywhere in the model (ADR-010).
    const whole = revealAfter(steps, steps.length);
    expect(whole).toEqual({
      sentences: PARTS.sentences,
      threads: PARTS.threads,
      readings: PARTS.readings,
      closed: true,
    });
    expect(revealAfter(steps, 0)).toEqual({
      sentences: 0,
      threads: 0,
      readings: 0,
      closed: false,
    });
  });

  it("still carries a thread the compiler produced no entry for", () => {
    // A register line is the record of something the player said. It may be
    // late, but it may never be dropped.
    const thin: PerformanceTiming = {
      secondsPerBeat: 1,
      totalSeconds: 12,
      entries: [{ order: 0, atSeconds: 0, durationSeconds: 6 }],
    };
    const steps = revealSchedule(thin, { sentences: 1, threads: 3, readings: 6 });
    expect(timesOf(steps, "thread")).toHaveLength(3);
    expect(revealAfter(steps, steps.length).threads).toBe(3);
  });
});
