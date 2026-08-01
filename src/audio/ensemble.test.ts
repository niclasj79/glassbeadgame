import { beforeEach, describe, expect, it } from "vitest";
import { ambient } from "./ambient";
import { compositionReach } from "./reach";

/**
 * THE RETIRED PROJECTION HAD FIVE LIVE SUBSCRIBERS AND ALL OF THEM NO-OPPED.
 *
 * `session.threads`, `.discoveries`, `.motifs` and `.score` are published empty
 * by the legacy presentation store and nothing has written to them since the
 * legacy scoring model was removed. Every consumer in `src/audio` read one of
 * them, so nothing the player wove ever reached the ambient bed: the choir
 * never gained a voice, no completed motif ever took a seat, and the bed's
 * swell was driven by a score that is always zero.
 *
 * These tests pin the replacements. They deliberately assert against the
 * *domain's* three motif families — `dialectic`, `canon`, `bridge` — because
 * the ensemble used to switch on `triad`, `symposium` and `fugue`, which no
 * detector in the game has produced for a long time: even if the projection had
 * been populated, every completion would have fallen through to the wrong
 * branch.
 */

const FIBONACCI = "measure.fibonacci-sequence";
const COUNTERPOINT = "sound.counterpoint";
const PRIMES = "measure.prime-numbers";
const POLYRHYTHM = "sound.polyrhythm";

describe("the ambient ensemble", () => {
  beforeEach(() => {
    ambient.stop();
  });

  it("seats a voice for each of the domain's motif families", () => {
    expect(ambient.motifPatternCount()).toBe(0);
    ambient.addMotifPattern("completion:1", "dialectic", [
      FIBONACCI,
      COUNTERPOINT,
      PRIMES,
    ]);
    ambient.addMotifPattern("completion:2", "canon", [
      FIBONACCI,
      PRIMES,
      POLYRHYTHM,
    ]);
    ambient.addMotifPattern("completion:3", "bridge", [
      COUNTERPOINT,
      POLYRHYTHM,
      PRIMES,
    ]);
    expect(ambient.motifPatternCount()).toBe(3);
  });

  /**
   * Keyed by the completion rather than by the family. Two Canons on different
   * facets are two recognitions of two different things; the old ensemble kept
   * one seat per family and silently dropped the second.
   */
  it("seats two completions of the same family separately", () => {
    ambient.addMotifPattern("completion:a", "canon", [FIBONACCI, PRIMES]);
    ambient.addMotifPattern("completion:b", "canon", [COUNTERPOINT, POLYRHYTHM]);
    expect(ambient.motifPatternCount()).toBe(2);
  });

  it("ignores a completion it has already seated", () => {
    ambient.addMotifPattern("completion:a", "canon", [FIBONACCI, PRIMES]);
    ambient.addMotifPattern("completion:a", "canon", [FIBONACCI, PRIMES]);
    expect(ambient.motifPatternCount()).toBe(1);
  });

  it("keeps the ensemble bounded however long the session runs", () => {
    for (let i = 0; i < 40; i++) {
      ambient.addMotifPattern(`completion:${i}`, "canon", [FIBONACCI, PRIMES]);
    }
    expect(ambient.motifPatternCount()).toBeLessThanOrEqual(4);
    expect(ambient.motifPatternCount()).toBeGreaterThan(0);
  });

  it("does not carry a previous session's ensemble into the next one", () => {
    ambient.addMotifPattern("completion:a", "bridge", [FIBONACCI, PRIMES]);
    expect(ambient.motifPatternCount()).toBe(1);
    ambient.stop();
    expect(ambient.motifPatternCount()).toBe(0);
  });

  it("gives a woven thread a voice in the choir", () => {
    expect(ambient.activeVoiceCount()).toBe(0);
    ambient.addThreadVoice("thread:1", FIBONACCI, COUNTERPOINT);
    ambient.addThreadVoice("thread:2", PRIMES, POLYRHYTHM);
    expect(ambient.activeVoiceCount()).toBe(2);
  });
});

/**
 * ADR-010 replaced the score with the portrait, and the reviewer rejected
 * repopulating it to feed the bed. The bed follows topology instead.
 */
describe("compositionReach", () => {
  it("is zero before anything is woven", () => {
    expect(compositionReach({ conceptCount: 12, pairs: [] })).toBe(0);
  });

  it("rises when two regions join, not when another pair is added", () => {
    const twoIslands = compositionReach({
      conceptCount: 8,
      pairs: [
        ["a", "b"],
        ["c", "d"],
      ],
    });
    const joined = compositionReach({
      conceptCount: 8,
      pairs: [
        ["a", "b"],
        ["c", "d"],
        ["b", "c"],
      ],
    });
    expect(twoIslands).toBeCloseTo(2 / 8, 6);
    expect(joined).toBeCloseTo(4 / 8, 6);
    expect(joined).toBeGreaterThan(twoIslands);
  });

  it("cannot be raised past a full arena", () => {
    expect(
      compositionReach({
        conceptCount: 4,
        pairs: [
          ["a", "b"],
          ["b", "c"],
          ["c", "d"],
        ],
      })
    ).toBe(1);
  });

  /** A two-bead arena must not reach its ceiling on the first gesture. */
  it("floors the denominator so one thread is never a carried world", () => {
    expect(compositionReach({ conceptCount: 2, pairs: [["a", "b"]] })).toBe(0.5);
  });

  it("ignores a thread from a concept to itself", () => {
    expect(compositionReach({ conceptCount: 8, pairs: [["a", "a"]] })).toBe(0);
  });
});
