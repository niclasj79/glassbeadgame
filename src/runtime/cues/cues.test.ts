import { describe, expect, it, vi } from "vitest";
import type { GestureProfile } from "@/domain/events";
import { toConceptId, toEventId, toThreadId } from "@/domain/ids";
import { createCueBus } from "./createCueBus";
import {
  gesturePhrasing,
  planAttention,
  planCommitMoment,
  planMotifCompleted,
  planPairLocked,
  planReadingPreviewed,
  planSighting,
  planThreadReopened,
} from "./planCues";
import type { CuePayloadMap, PresentationCue } from "./types";

const A = toConceptId("measure.fibonacci-sequence");
const B = toConceptId("sound.counterpoint");
const THREAD = toThreadId("thread:1:s:1");
const EVENT = toEventId("event:woven");

const gesture = (durationMs?: number): GestureProfile =>
  Object.freeze(
    durationMs === undefined
      ? { inputModality: "mouse" as const }
      : { inputModality: "mouse" as const, durationMs }
  );

const woven = (durationMs?: number): CuePayloadMap["thread.woven"] =>
  Object.freeze({
    threadId: THREAD,
    pair: Object.freeze([A, B]) as readonly [typeof A, typeof B],
    intention: "echo" as const,
    gesture: gesture(durationMs),
  });

describe("gesturePhrasing", () => {
  it("is neutral when the modality carries no duration", () => {
    expect(gesturePhrasing(gesture())).toBe(1);
    expect(gesturePhrasing(undefined)).toBe(1);
  });

  it("stretches for deliberate gestures and compresses for decisive ones", () => {
    const quick = gesturePhrasing(gesture(250));
    const slow = gesturePhrasing(gesture(4000));
    expect(quick).toBeLessThan(1);
    expect(slow).toBeGreaterThan(1);
    expect(slow).toBeGreaterThan(quick);
  });

  it("stays inside bounds no gesture can escape", () => {
    for (const ms of [1, 10, 250, 1000, 30_000, 10_000_000]) {
      const value = gesturePhrasing(gesture(ms));
      expect(value).toBeGreaterThanOrEqual(0.85);
      expect(value).toBeLessThanOrEqual(1.25);
    }
  });

  it("is deterministic", () => {
    expect(gesturePhrasing(gesture(1234))).toBe(gesturePhrasing(gesture(1234)));
  });
});

describe("planCommitMoment", () => {
  const documented = (): CuePayloadMap["outcome.documented"] =>
    Object.freeze({
      threadId: THREAD,
      pair: Object.freeze([A, B]) as readonly [typeof A, typeof B],
      intention: "echo" as const,
      // The planner must not read into the relation; a stub proves that.
      relation: {} as CuePayloadMap["outcome.documented"]["relation"],
      evidence: "contested" as const,
      reception: "refined" as const,
    });

  const openThread = (): CuePayloadMap["outcome.open-thread"] =>
    Object.freeze({
      threadId: THREAD,
      pair: Object.freeze([A, B]) as readonly [typeof A, typeof B],
      intention: "echo" as const,
      question: "Does the proportion appear in the construction, or only in the count?",
      sharedFacet: "proportion" as CuePayloadMap["outcome.open-thread"]["sharedFacet"],
    });

  it("acknowledges the weave immediately", () => {
    const plan = planCommitMoment({
      woven: woven(600),
      wovenEventId: EVENT,
      outcome: { kind: "documented", payload: documented(), eventId: EVENT },
    });
    expect(plan.cues[0].type).toBe("thread.woven");
    expect(plan.cues[0].startAt).toBe(0);
  });

  it("stages the outcome after the weave has landed, never before", () => {
    const plan = planCommitMoment({
      woven: woven(600),
      wovenEventId: EVENT,
      outcome: { kind: "documented", payload: documented(), eventId: EVENT },
    });
    const [first, second] = plan.cues;
    expect(second.startAt).toBeGreaterThan(0);
    expect(second.startAt).toBeCloseTo(first.startAt + first.duration, 6);
  });

  it("gives an Open Thread the same budget and reach as a documented relation", () => {
    // CAV-006: outcomes differ in resolution, never in reward. If an Open
    // Thread were quieter or shorter, players would learn to prefer one kind
    // of truth because it pays better.
    const shared = { woven: woven(600), wovenEventId: EVENT };
    const doc = planCommitMoment({
      ...shared,
      outcome: { kind: "documented", payload: documented(), eventId: EVENT },
    });
    const open = planCommitMoment({
      ...shared,
      outcome: { kind: "open-thread", payload: openThread(), eventId: EVENT },
    });
    expect(open.duration).toBeCloseTo(doc.duration, 6);
    expect(open.cues[1].channels).toEqual(doc.cues[1].channels);
  });

  it("keeps an unresolved outcome short but still reaches every director", () => {
    const plan = planCommitMoment({
      woven: woven(600),
      wovenEventId: EVENT,
      outcome: {
        kind: "unresolved",
        payload: Object.freeze({
          threadId: THREAD,
          pair: Object.freeze([A, B]) as readonly [typeof A, typeof B],
          intention: "echo" as const,
          statement: "The Game has no grounded relation here yet.",
        }),
      },
    });
    expect(plan.cues[1].duration).toBeGreaterThan(0);
    expect(plan.cues[1].channels).toContain("caption");
    expect(plan.cues[1].channels).toContain("audio");
  });

  it("lets Tension take longer to resolve than Ground", () => {
    const span = (intention: "tension" | "ground"): number =>
      planCommitMoment({
        woven: { ...woven(600), intention },
        wovenEventId: EVENT,
        outcome: { kind: "documented", payload: documented(), eventId: EVENT },
      }).duration;
    expect(span("tension")).toBeGreaterThan(span("ground"));
  });

  it("produces identical plans for identical input", () => {
    const build = () =>
      planCommitMoment({
        woven: woven(600),
        wovenEventId: EVENT,
        outcome: { kind: "documented", payload: documented(), eventId: EVENT },
      });
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it("derives cue ids from the staged event so replay is stable", () => {
    const plan = planCommitMoment({
      woven: woven(600),
      wovenEventId: EVENT,
      outcome: { kind: "documented", payload: documented(), eventId: EVENT },
    });
    for (const cue of plan.cues) expect(cue.id).toContain(String(EVENT));
  });
});

describe("ephemeral plans", () => {
  it("never claims a durable source event for a look, a lock, a reading or a reopening", () => {
    const pair = Object.freeze([A, B]) as readonly [typeof A, typeof B];
    for (const plan of [
      planSighting({ attendedConceptId: A, sighted: null }),
      planPairLocked({ pair, sharedFacets: [] }),
      planReadingPreviewed({ pair, intention: "tension", chosen: true }),
      planThreadReopened({ threadId: THREAD, pair, intention: "echo" }),
    ]) {
      expect(plan.cues[0].sourceEventId).toBeNull();
    }
  });

  it("changes the preview immediately when a reading is heard (I-016)", () => {
    const pair = Object.freeze([A, B]) as readonly [typeof A, typeof B];
    const plan = planReadingPreviewed({ pair, intention: "tension", chosen: false });
    expect(plan.cues[0].startAt).toBe(0);
  });

  it("keeps a look off the camera and out of the hand; a choice reaches both", () => {
    const pair = Object.freeze([A, B]) as readonly [typeof A, typeof B];
    const looks = [
      planSighting({ attendedConceptId: A, sighted: null }).cues[0],
      planReadingPreviewed({ pair, intention: "echo", chosen: false }).cues[0],
    ];
    for (const cue of looks) {
      expect(cue.channels).not.toContain("camera");
      expect(cue.channels).not.toContain("haptics");
    }
    const acts = [
      planPairLocked({ pair, sharedFacets: [] }).cues[0],
      planReadingPreviewed({ pair, intention: "echo", chosen: true }).cues[0],
    ];
    for (const cue of acts) {
      expect(cue.channels).toEqual(
        expect.arrayContaining(["scene", "camera", "audio", "haptics", "caption"])
      );
    }
  });

  it("reaches every director when attention opens space", () => {
    const plan = planAttention(
      { conceptId: A, candidates: [{ conceptId: B, band: "high" }] },
      null
    );
    expect(plan.cues[0].channels).toEqual(
      expect.arrayContaining(["scene", "camera", "audio", "ui", "caption"])
    );
  });
});

describe("createCueBus", () => {
  const bus = (start = 0) => {
    let now = start;
    return {
      set: (value: number) => {
        now = value;
      },
      bus: createCueBus({ now: () => now }),
    };
  };

  it("delivers a zero-offset cue synchronously to every subscribed channel", () => {
    const { bus: cueBus } = bus();
    const scene = vi.fn();
    const audio = vi.fn();
    cueBus.subscribe("scene", scene);
    cueBus.subscribe("audio", audio);
    cueBus.publish(
      planReadingPreviewed({ pair: Object.freeze([A, B]) as readonly [typeof A, typeof B], intention: "echo", chosen: true })
    );
    expect(scene).toHaveBeenCalledTimes(1);
    expect(audio).toHaveBeenCalledTimes(1);
  });

  it("delivers one cue to every director at the same tick", () => {
    // The whole reason the bus exists: no per-director timers, so no drift.
    const { set, bus: cueBus } = bus();
    const order: string[] = [];
    cueBus.subscribe("scene", () => order.push("scene"));
    cueBus.subscribe("audio", () => order.push("audio"));
    cueBus.subscribe("ui", () => order.push("ui"));
    cueBus.publish(
      planCommitMoment({
        woven: woven(600),
        wovenEventId: EVENT,
        outcome: {
          kind: "unresolved",
          payload: Object.freeze({
            threadId: THREAD,
            pair: Object.freeze([A, B]) as readonly [typeof A, typeof B],
            intention: "echo" as const,
            statement: "Nothing grounded yet.",
          }),
        },
      })
    );
    order.length = 0;
    expect(cueBus.pending()).toBe(1);
    set(10);
    cueBus.tick(10);
    expect(order).toEqual(["scene", "audio", "ui"]);
    expect(cueBus.pending()).toBe(0);
  });

  it("holds a deferred cue until its time actually arrives", () => {
    const { bus: cueBus } = bus();
    const seen: PresentationCue[] = [];
    cueBus.subscribe("scene", (cue) => seen.push(cue));
    cueBus.publish(
      planCommitMoment({
        woven: woven(600),
        wovenEventId: EVENT,
        outcome: {
          kind: "unresolved",
          payload: Object.freeze({
            threadId: THREAD,
            pair: Object.freeze([A, B]) as readonly [typeof A, typeof B],
            intention: "echo" as const,
            statement: "Nothing grounded yet.",
          }),
        },
      })
    );
    expect(seen).toHaveLength(1);
    cueBus.tick(0.1);
    expect(seen).toHaveLength(1);
    cueBus.tick(5);
    expect(seen).toHaveLength(2);
  });

  it("drops everything pending on reset, so cancellation leaves no residue", () => {
    const { bus: cueBus } = bus();
    const scene = vi.fn();
    cueBus.subscribe("scene", scene);
    cueBus.publish(
      planCommitMoment({
        woven: woven(600),
        wovenEventId: EVENT,
        outcome: {
          kind: "unresolved",
          payload: Object.freeze({
            threadId: THREAD,
            pair: Object.freeze([A, B]) as readonly [typeof A, typeof B],
            intention: "echo" as const,
            statement: "Nothing grounded yet.",
          }),
        },
      })
    );
    cueBus.reset();
    cueBus.tick(100);
    expect(scene).toHaveBeenCalledTimes(1);
    expect(cueBus.pending()).toBe(0);
  });

  it("lets a director unsubscribe from inside its own handler", () => {
    const { bus: cueBus } = bus();
    const calls: number[] = [];
    const off = cueBus.subscribe("scene", () => {
      calls.push(1);
      off();
    });
    cueBus.publish(
      planReadingPreviewed({ pair: Object.freeze([A, B]) as readonly [typeof A, typeof B], intention: "echo", chosen: true })
    );
    cueBus.publish(
      planReadingPreviewed({ pair: Object.freeze([A, B]) as readonly [typeof A, typeof B], intention: "ground", chosen: true })
    );
    expect(calls).toHaveLength(1);
  });

  it("refuses a plan that would pin the presentation open", () => {
    const cueBus = createCueBus({ now: () => 0, maxPlanSeconds: 1 });
    expect(() =>
      cueBus.publish(
        planCommitMoment({
          woven: woven(600),
          wovenEventId: EVENT,
          outcome: {
            kind: "unresolved",
            payload: Object.freeze({
              threadId: THREAD,
              pair: Object.freeze([A, B]) as readonly [typeof A, typeof B],
              intention: "echo" as const,
              statement: "Nothing grounded yet.",
            }),
          },
        })
      )
    ).toThrow(RangeError);
  });
});

describe("planMotifCompleted", () => {
  const motif = (): CuePayloadMap["motif.completed"] =>
    Object.freeze({
      motifKindId: "bridge" as CuePayloadMap["motif.completed"]["motifKindId"],
      conceptIds: Object.freeze([A, B]),
      threadIds: Object.freeze([THREAD]),
      reason: "Counterpoint is the only crossing here.",
    });

  it("enters at once when nothing precedes it", () => {
    const plan = planMotifCompleted(motif(), EVENT);
    expect(plan.cues[0].startAt).toBe(0);
  });

  /**
   * A motif is completed by a commit whose outcome is staged a settle after
   * the weave lands. Staged at 0 s, the motif arrived *before* that outcome
   * and the outcome note then covered it: in the recorded playtest a Bridge
   * formed on the third thread and the only trace was the Attune mark. The
   * progression now passes the commit moment's span, and the motif follows it.
   */
  it("waits for the commit moment it completed, when told how long that is", () => {
    const moment = planCommitMoment({
      woven: woven(600),
      wovenEventId: EVENT,
      outcome: {
        kind: "open-thread",
        eventId: EVENT,
        payload: {
          threadId: THREAD,
          pair: Object.freeze([A, B]) as readonly [typeof A, typeof B],
          intention: "echo",
          question: "Does the proportion appear in the construction?",
          sharedFacet: "proportion" as CuePayloadMap["outcome.open-thread"]["sharedFacet"],
        },
      },
    });
    const plan = planMotifCompleted(motif(), EVENT, moment.duration);
    expect(plan.cues[0].startAt).toBeCloseTo(moment.duration, 6);
    expect(plan.duration).toBeCloseTo(moment.duration + 4.5, 6);
  });

  it("refuses to be staged before the commit that made it", () => {
    expect(() => planMotifCompleted(motif(), EVENT, -1)).toThrow(RangeError);
  });
});
