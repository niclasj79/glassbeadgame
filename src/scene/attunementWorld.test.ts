import { describe, expect, it } from "vitest";
import type { RelationIntention } from "@/domain/events";
import {
  ATTUNED_THREAD_FLOOR,
  attunedPresence,
  mirrorTravel,
  voiceTravel,
} from "./Attunement";

/**
 * ATTUNEMENT DREW NOTHING.
 *
 * Spec §13 calls it a held heightened state in which "threads become
 * individually audible; relation channels shimmer according to their grammar".
 * The audio half was implemented literally; the world's half was one line —
 * `frameState.timeScaleTarget` — so a captured frame of the held state was
 * pixel-for-pixel a captured frame of ordinary play apart from how fast things
 * drifted. A held state you cannot see is not a state.
 *
 * These tests pin the two claims the world now makes, and the two it refuses to.
 */

const INTENTIONS: readonly RelationIntention[] = [
  "echo",
  "passage",
  "tension",
  "ground",
];

describe("voiceTravel", () => {
  it("says nothing at all when the thread is not speaking", () => {
    expect(voiceTravel("echo", -0.01).positions).toEqual([]);
    expect(voiceTravel("echo", 1.5).positions).toEqual([]);
    expect(voiceTravel("echo", Number.NaN).strength).toBe(0);
  });

  /** Imitation arrives from both ends at once, as the ribbon's growth does. */
  it("brings an Echo in from both ends and meets in the middle", () => {
    const start = voiceTravel("echo", 0);
    expect(start.positions).toEqual([0, 1]);
    const end = voiceTravel("echo", 1);
    expect(end.positions[0]).toBeCloseTo(0.5, 6);
    expect(end.positions[1]).toBeCloseTo(0.5, 6);
  });

  it("takes a Passage one way only", () => {
    expect(voiceTravel("passage", 0).positions).toEqual([0]);
    expect(voiceTravel("passage", 1).positions).toEqual([1]);
    const mid = voiceTravel("passage", 0.5).positions[0];
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  /**
   * The one claim a Tension makes is that it does not resolve. Its light must
   * never reach either end, at any point in its window.
   */
  it("never lets a Tension arrive", () => {
    for (let i = 0; i <= 100; i++) {
      const at = voiceTravel("tension", i / 100).positions[0];
      expect(at).toBeGreaterThan(0.2);
      expect(at).toBeLessThan(0.8);
    }
  });

  it("settles a Ground early and leaves it seated", () => {
    expect(voiceTravel("ground", 0.5).positions[0]).toBe(1);
    expect(voiceTravel("ground", 1).positions[0]).toBe(1);
  });

  /**
   * The grammar changes the path, never the payment. A player who saw one
   * intention light brighter than another would learn it was worth more —
   * which is the failure `ribbon.ts` refuses in its own fragment shader, for
   * exactly this reason.
   */
  it("spends the same light on every intention", () => {
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const strengths = INTENTIONS.map(
        (intention) => voiceTravel(intention, progress).strength
      );
      for (const strength of strengths) {
        expect(strength).toBeCloseTo(strengths[0], 10);
      }
    }
  });

  it("opens and closes on silence rather than snapping on", () => {
    expect(voiceTravel("passage", 0).strength).toBeCloseTo(0, 10);
    expect(voiceTravel("passage", 1).strength).toBeCloseTo(0, 10);
    expect(voiceTravel("passage", 0.5).strength).toBeCloseTo(1, 10);
  });
});

describe("attunedPresence", () => {
  it("leaves the ordinary web fully present", () => {
    expect(attunedPresence(false, false, false)).toBe(1);
    expect(attunedPresence(false, true, false)).toBe(1);
  });

  it("brings the speaking thread forward and lets the others recede", () => {
    expect(attunedPresence(true, true, true)).toBe(1);
    expect(attunedPresence(true, true, false)).toBe(ATTUNED_THREAD_FLOOR);
  });

  /**
   * A thread that vanished while another spoke would be a claim about which
   * relation matters. The floor is a recession, not a removal.
   */
  it("never removes a relation from the world", () => {
    expect(ATTUNED_THREAD_FLOOR).toBeGreaterThan(0);
  });

  /**
   * The condition that keeps the world honest: if no channel is sounding —
   * a context never unlocked, a queue not running — nothing recedes, because
   * there is nothing for it to recede behind.
   */
  it("dims nothing while no channel is actually sounding", () => {
    expect(attunedPresence(true, false, false)).toBe(1);
    expect(attunedPresence(true, false, true)).toBe(1);
  });
});

describe("mirrorTravel", () => {
  /**
   * The choir alternates which of a thread's two beads speaks first, and has
   * recorded it in `frameState.pulses.flip` since it was written — a field with
   * no reader anywhere in the repository. The light walks from whichever bead
   * is actually sounding.
   */
  it("reads a one-way grammar from the other end", () => {
    expect(mirrorTravel(voiceTravel("passage", 0)).positions).toEqual([1]);
    expect(mirrorTravel(voiceTravel("passage", 1)).positions).toEqual([0]);
  });

  it("leaves an Echo unchanged, because an imitation reads the same reversed", () => {
    const forward = voiceTravel("echo", 0.4);
    const mirrored = [...mirrorTravel(forward).positions].sort((a, b) => a - b);
    const original = [...forward.positions].sort((a, b) => a - b);
    mirrored.forEach((at, i) => expect(at).toBeCloseTo(original[i], 10));
  });

  it("spends the same light either way round", () => {
    for (const intention of INTENTIONS) {
      const forward = voiceTravel(intention, 0.6);
      expect(mirrorTravel(forward).strength).toBe(forward.strength);
    }
  });
});
