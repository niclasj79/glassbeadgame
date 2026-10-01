/**
 * THE HARMONY THAT MOVES (ADR-017, M4-002).
 *
 * The root cycle, the chord over each root, the voice leading between them,
 * the ground's strike, and what the cycle does to every concept's identity
 * note — read from the authored pack, not from a fixture.
 */
import { describe, expect, it } from "vitest";

import { CASTALIA_CONCEPTS } from "@/content/castalia";
import { aurora, castalia, ember, tide } from "@/themes/worlds";
import { COMFORT } from "./comfort";
import {
  chordFor,
  groundStrike,
  groundStrikeSlots,
  identityIsConsonant,
  leadVoices,
  nextVoicing,
  rootForPhrase,
  voiceChord,
  type Chord,
} from "./harmony";
import {
  CASTALIA_MODE,
  degreeFrequency,
  intervalClass,
  isStable,
  isTense,
  pitchClass,
  ratioForClass,
} from "./mode";
import { SCORE } from "./score";

const CYCLE = [0, 5, 9, 7] as const;
const WORLDS = [castalia, tide, ember, aurora] as const;

/** The pad over each phrase of `phrases`, led from the first. */
const voicings = (phrases: number): number[][] => {
  const out: number[][] = [];
  let previous: number[] | null = null;
  for (let phrase = 0; phrase < phrases; phrase += 1) {
    previous = nextVoicing(previous, rootForPhrase(phrase));
    out.push(previous);
  }
  return out;
};

describe("the root cycle", () => {
  it("walks 0, 5, 9, 7 one phrase at a time and returns", () => {
    expect(SCORE.harmony.rootCycle).toEqual([0, 5, 9, 7]);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(rootForPhrase)).toEqual([
      0, 5, 9, 7, 0, 5, 9, 7, 0,
    ]);
  });

  it("walks only the mode's stable degrees, and every session opens at home", () => {
    for (const root of CYCLE) expect(isStable(CASTALIA_MODE, root)).toBe(true);
    expect(rootForPhrase(0)).toBe(0);
  });
});

describe("the chord over each root", () => {
  it("is the root, its fifth and one colour, by rule", () => {
    expect(CYCLE.map((root) => chordFor(root))).toEqual([
      [0, 7, 4],
      [5, 0, 9],
      [9, 4, 0],
      [7, 0, 4],
    ]);
  });

  it("holds only stable degrees, and no two of its tones rub", () => {
    // Every stable degree, not only the cycle's: the rule is general.
    for (const root of CASTALIA_MODE.stable) {
      const chord = chordFor(root);
      expect(new Set(chord).size).toBe(3);
      for (const tone of chord) expect(isStable(CASTALIA_MODE, tone)).toBe(true);
      for (const a of chord) {
        for (const b of chord) expect(isStable(CASTALIA_MODE, intervalClass(a, b))).toBe(true);
      }
    }
  });

  it("takes the fifth below where the fifth above is tense, as over 7", () => {
    expect(isTense(CASTALIA_MODE, 7 + 7)).toBe(true);
    expect(chordFor(7)[1]).toBe(0);
    for (const root of [0, 5, 9]) expect(chordFor(root)[1]).toBe(pitchClass(root + 7));
  });

  it("colours with the third, and with the sixth only over 7, which has no stable third", () => {
    const colourStep = (root: number): number => pitchClass(chordFor(root)[2] - root);
    expect(CYCLE.map(colourStep)).toEqual([4, 4, 3, 9]);
  });

  it("is a just triad: every interval inside it is one of the mode's stable ratios", () => {
    const stableRatios = CASTALIA_MODE.stable.map((step) => ratioForClass(CASTALIA_MODE, step));
    for (const root of CYCLE) {
      const tones = voiceChord(chordFor(root), 0).map((degree) =>
        degreeFrequency(CASTALIA_MODE, degree, "low")
      );
      for (const low of tones) {
        for (const high of tones) {
          if (high <= low) continue;
          let ratio = high / low;
          while (ratio >= 2) ratio /= 2;
          expect(stableRatios.some((stable) => Math.abs(stable - ratio) < 1e-9)).toBe(true);
        }
      }
    }
  });
});

describe("the voice leading", () => {
  it("opens on the chord from the pad's floor, low to high", () => {
    expect(voiceChord(chordFor(0))).toEqual([7, 12, 16]);
  });

  it("moves each voice at most a fourth, and sounds every tone of the next chord", () => {
    const [first, ...rest] = voicings(9);
    let previous = first;
    rest.forEach((voicing, index) => {
      const chord: Chord = chordFor(rootForPhrase(index + 1));
      expect(new Set(voicing.map(pitchClass))).toEqual(new Set(chord));
      voicing.forEach((degree, voice) => {
        expect(Math.abs(degree - previous[voice])).toBeLessThanOrEqual(5);
      });
      previous = voicing;
    });
  });

  it("moves by step or not at all across the cycle, and comes home to where it began", () => {
    expect(voicings(5)).toEqual([
      [7, 12, 16], // G2 C3 E3 over C
      [9, 12, 17], // A2 C3 F3 over F
      [9, 12, 16], // A2 C3 E3 over A
      [7, 12, 16], // G2 C3 E3 over G
      [7, 12, 16], // and home, with nothing drifted
    ]);
  });

  it("settles rather than rises where two ways move alike", () => {
    // A tritone away either way: the voice goes down.
    expect(leadVoices([0, 12, 24], [6, 6, 6])).toEqual([-6, 6, 18]);
  });

  it("chooses the least motion in all, then the most downward, of every way to share the tones", () => {
    const nearest = (from: number, tone: number): number => {
      const up = pitchClass(tone - from);
      return up < 6 ? from + up : from - (12 - up);
    };
    const orders = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    const cost = (from: readonly number[], to: readonly number[]) => ({
      motion: to.reduce((sum, degree, voice) => sum + Math.abs(degree - from[voice]), 0),
      rise: to.reduce((sum, degree, voice) => sum + degree - from[voice], 0),
    });
    for (const fromRoot of CASTALIA_MODE.stable) {
      for (let floor = 0; floor < 12; floor += 1) {
        const from = voiceChord(chordFor(fromRoot), floor);
        for (const toRoot of CASTALIA_MODE.stable) {
          const next = chordFor(toRoot);
          const every = orders.map((order) =>
            cost(from, from.map((degree, voice) => nearest(degree, next[order[voice]])))
          );
          const least = Math.min(...every.map((way) => way.motion));
          const lowest = Math.min(
            ...every.filter((way) => way.motion === least).map((way) => way.rise)
          );
          expect(cost(from, leadVoices(from, next))).toEqual({ motion: least, rise: lowest });
        }
      }
    }
  });

  it("returns a voicing unchanged when the chord does not change", () => {
    expect(leadVoices([7, 12, 16], chordFor(7))).toEqual([7, 12, 16]);
  });
});

describe("the concepts' identity notes over the cycle (ADR-017)", () => {
  const identities = CASTALIA_CONCEPTS.map((concept) => ({
    id: concept.id,
    degree: concept.motif.degrees[0] ?? 0,
    register: concept.motif.register,
  }));

  /** The identity note's ratio to the root, both as they sound, folded into one octave. */
  const ratioOverRoot = (identity: (typeof identities)[number], root: number): number => {
    let ratio =
      degreeFrequency(CASTALIA_MODE, identity.degree, identity.register) /
      degreeFrequency(CASTALIA_MODE, root, "low");
    while (ratio >= 2) ratio /= 2;
    while (ratio < 1) ratio *= 2;
    return ratio;
  };
  const stableRatios = CASTALIA_MODE.stable.map((step) => ratioForClass(CASTALIA_MODE, step));
  const isStableRatio = (ratio: number): boolean =>
    stableRatios.some((stable) => Math.abs(stable - ratio) < 1e-9);

  it("reads twenty-four identity notes: twenty-three on the tonic and one on 7", () => {
    expect(identities).toHaveLength(24);
    expect(identities.filter((identity) => pitchClass(identity.degree) === 0)).toHaveLength(23);
    expect(identities.filter((identity) => pitchClass(identity.degree) !== 0)).toEqual([
      { id: "matter.entropy", degree: 7, register: "low" },
    ]);
  });

  it("keeps every identity note on the tonic consonant over every root, over the mode's ratios", () => {
    for (const identity of identities) {
      if (pitchClass(identity.degree) !== 0) continue;
      for (const root of CYCLE) {
        expect(identityIsConsonant(identity.degree, root)).toBe(true);
        expect(isStableRatio(ratioOverRoot(identity, root))).toBe(true);
      }
    }
  });

  /**
   * THE ONE THE CYCLE DOES NOT KEEP.
   *
   * ADR-017 and the packet promise every identity note consonant over every
   * root of 0, 5, 9, 7. Entropy's identity note is 7: over F it is a major
   * second (9/8) and over A a minor seventh (9/5), both tense in this mode. No
   * chord or voicing can change that, because the claim is about the root. The
   * cycle is the director's and the content is out of this packet's scope, so
   * the exception is pinned here, by name, until the director settles it —
   * with a different cycle (only 0, 3, 4 and 7 keep both C and G consonant),
   * with Entropy's motif, or by accepting it. The test fails if the cycle or
   * the content changes in either direction.
   */
  it("finds exactly one identity note tense, over exactly two roots: Entropy over 5 and 9", () => {
    const tense: string[] = [];
    for (const identity of identities) {
      for (const root of CYCLE) {
        const consonant = identityIsConsonant(identity.degree, root);
        expect(consonant).toBe(isStableRatio(ratioOverRoot(identity, root)));
        if (!consonant) tense.push(`${identity.id} over ${root}`);
      }
    }
    expect(tense).toEqual(["matter.entropy over 5", "matter.entropy over 9"]);
  });
});

describe("the ground's strike", () => {
  it("holds the whole phrase where the phrase and its crossfade fit a voice's life, and divides it where not", () => {
    const { phraseSlots, crossfadeSeconds } = SCORE.harmony;
    for (const world of WORLDS) {
      const slotSeconds = world.music.slotSeconds;
      const slots = groundStrikeSlots(slotSeconds);
      expect(phraseSlots % slots).toBe(0);
      expect(slots * slotSeconds + crossfadeSeconds).toBeLessThanOrEqual(
        COMFORT.voice.maxLifetimeSeconds
      );
      const phraseFits =
        phraseSlots * slotSeconds + crossfadeSeconds <= COMFORT.voice.maxLifetimeSeconds;
      expect(slots === phraseSlots).toBe(phraseFits);
    }
    // Castalia turns on the phrase boundary and nowhere else.
    expect(groundStrikeSlots(castalia.music.slotSeconds)).toBe(phraseSlots);
  });

  it("is the drone on the root and the pad's three voices, crossfaded across the boundary", () => {
    const voices = groundStrike(5, [9, 12, 17], 24, 0.14);
    expect(voices.map((voice) => [voice.timbre, voice.degree, voice.gain])).toEqual([
      ["glass", 5, 0.14],
      ["voice", 9, SCORE.harmony.padGain],
      ["voice", 12, SCORE.harmony.padGain],
      ["voice", 17, SCORE.harmony.padGain],
    ]);
    for (const voice of voices) {
      // Attacks over two seconds from the strike; its release begins exactly
      // at the next strike and takes the same two seconds.
      expect(voice.attack).toBe(2);
      expect(voice.attack + voice.hold).toBe(24);
      expect(voice.release).toBe(2);
    }
  });

  it("keeps the chord's three voices together at or under twice the one-note pad's gain", () => {
    const pad = groundStrike(0, voiceChord(chordFor(0)), 24, 0.14).filter(
      (voice) => voice.timbre === "voice"
    );
    expect(pad).toHaveLength(3);
    expect(pad.reduce((sum, voice) => sum + voice.gain, 0)).toBeLessThanOrEqual(2 * 0.05);
  });

  it("never asks a voice of the ground to outlive the lifetime bound, in any world", () => {
    for (const world of WORLDS) {
      const span = groundStrikeSlots(world.music.slotSeconds) * world.music.slotSeconds;
      for (const voice of groundStrike(0, [7, 12, 16], span, world.music.droneGain)) {
        expect(voice.attack + voice.hold + voice.release).toBeLessThanOrEqual(
          COMFORT.voice.maxLifetimeSeconds
        );
      }
    }
  });
});
