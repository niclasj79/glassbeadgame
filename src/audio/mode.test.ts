import { describe, expect, it } from "vitest";

import {
  CASTALIA_MODE,
  REGISTER_ORDER,
  beatingHzBetween,
  centsBetween,
  centsForBeatingHz,
  degreeFrequency,
  intervalClass,
  isStable,
  isTense,
  nearestStableDegree,
  nearestTenseDegree,
  pitchClass,
  ratioForClass,
  registerIndex,
  shiftRegister,
  transposeCents,
} from "./mode";

describe("the world mode", () => {
  it("no longer guarantees that every simultaneity is consonant", () => {
    // The point of the whole file: there are degrees the mode calls tense, and
    // a plan can ask for them. The prototype's pentatonic gamut had none.
    expect(CASTALIA_MODE.tense.length).toBeGreaterThan(0);
    for (const semitone of CASTALIA_MODE.tense) {
      expect(CASTALIA_MODE.stable).not.toContain(semitone);
    }
    expect(CASTALIA_MODE.stable).toContain(0);
  });

  it("tunes stable intervals as exact ratios, so they do not beat", () => {
    expect(ratioForClass(CASTALIA_MODE, 7)).toBeCloseTo(3 / 2, 12);
    expect(ratioForClass(CASTALIA_MODE, 4)).toBeCloseTo(5 / 4, 12);
    expect(ratioForClass(CASTALIA_MODE, 5)).toBeCloseTo(4 / 3, 12);
  });

  it("renders the overtone series motif as the actual overtone series", () => {
    // sound.overtone-series authors [0, 12, 19, 24, 28]. Under just intonation
    // that is 1 : 2 : 3 : 4 : 5 — the concept's motif is the thing it describes.
    const base = degreeFrequency(CASTALIA_MODE, 0, "sub");
    for (const [degree, multiple] of [
      [12, 2],
      [19, 3],
      [24, 4],
      [28, 5],
    ] as const) {
      expect(degreeFrequency(CASTALIA_MODE, degree, "sub") / base).toBeCloseTo(
        multiple,
        9
      );
    }
  });

  it("places registers an octave apart", () => {
    const mid = degreeFrequency(CASTALIA_MODE, 0, "mid");
    expect(degreeFrequency(CASTALIA_MODE, 0, "high") / mid).toBeCloseTo(2, 9);
    expect(degreeFrequency(CASTALIA_MODE, 0, "low") / mid).toBeCloseTo(0.5, 9);
  });

  it("keeps extreme degrees audible by folding octaves, never by clamping", () => {
    const top = degreeFrequency(CASTALIA_MODE, 60, "air");
    expect(top).toBeGreaterThan(24);
    expect(top).toBeLessThan(11000);
    // Folding preserves pitch class; clamping would not.
    const ratio = top / degreeFrequency(CASTALIA_MODE, 0, "mid");
    expect(Math.abs(Math.log2(ratio) % 1)).toBeLessThan(1e-9);
  });

  it("equal temperament spreads the error evenly", () => {
    const equal = { ...CASTALIA_MODE, temperament: "equal" as const };
    expect(ratioForClass(equal, 7)).toBeCloseTo(Math.pow(2, 7 / 12), 12);
    // The narrowed fifth: about two cents flat of just.
    const cents = centsBetween(ratioForClass(equal, 7), ratioForClass(CASTALIA_MODE, 7));
    expect(cents).toBeGreaterThan(1.5);
    expect(cents).toBeLessThan(2.5);
  });
});

describe("beating", () => {
  it("turns a target rate into a tuning, and back again", () => {
    const hz = 220;
    for (const target of [0.8, 2.4, 6.5]) {
      const cents = centsForBeatingHz(hz, target);
      const detuned = transposeCents(hz, cents);
      expect(beatingHzBetween(hz, detuned)).toBeCloseTo(target, 9);
    }
  });

  it("is a property of the two frequencies, not of the interval name", () => {
    // The same interval class beats at very different rates in different
    // registers. This is exactly why the grammar sets a rate rather than
    // trusting an interval to be comfortable.
    const low = beatingHzBetween(
      degreeFrequency(CASTALIA_MODE, 0, "sub"),
      degreeFrequency(CASTALIA_MODE, 1, "sub")
    );
    const high = beatingHzBetween(
      degreeFrequency(CASTALIA_MODE, 0, "air"),
      degreeFrequency(CASTALIA_MODE, 1, "air")
    );
    expect(high).toBeGreaterThan(low * 8);
  });
});

describe("degrees and registers", () => {
  it("normalises pitch and interval classes", () => {
    expect(pitchClass(-1)).toBe(11);
    expect(pitchClass(25)).toBe(1);
    expect(intervalClass(0, 19)).toBe(7);
    expect(intervalClass(5, 4)).toBe(11);
  });

  it("classifies every semitone as stable or tense, never both or neither", () => {
    for (let semitone = 0; semitone < 12; semitone++) {
      expect(isStable(CASTALIA_MODE, semitone) !== isTense(CASTALIA_MODE, semitone)).toBe(
        true
      );
    }
  });

  it("finds the nearest stable and tense degrees without leaving the octave", () => {
    expect(nearestStableDegree(CASTALIA_MODE, 7)).toBe(7);
    expect(isStable(CASTALIA_MODE, nearestStableDegree(CASTALIA_MODE, 6))).toBe(true);
    expect(isTense(CASTALIA_MODE, nearestTenseDegree(CASTALIA_MODE, 7))).toBe(true);
    expect(nearestStableDegree(CASTALIA_MODE, 18)).toBeGreaterThanOrEqual(12);
    expect(nearestStableDegree(CASTALIA_MODE, 18)).toBeLessThan(24);
  });

  it("saturates the register ladder instead of running off it", () => {
    expect(shiftRegister("air", 3)).toBe("air");
    expect(shiftRegister("sub", -3)).toBe("sub");
    expect(registerIndex("mid")).toBe(2);
    expect(REGISTER_ORDER).toHaveLength(5);
  });
});
