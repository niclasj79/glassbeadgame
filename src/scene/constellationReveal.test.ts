import { describe, expect, it } from "vitest";
import type { FacultyId } from "@/content/castalia/schema";
import { CONSTELLATIONS } from "./constellations";
import {
  FIGURE_BASE,
  FIGURE_COUNT,
  FIGURE_FACULTY_PAIRS,
  easeReveal,
  figureReveal,
} from "./constellationReveal";

const FACULTY: Readonly<Record<string, FacultyId>> = Object.freeze({
  fib: "measure",
  primes: "measure",
  counterpoint: "sound",
  polyrhythm: "sound",
  entropy: "matter",
  girih: "image",
});
const facultyOf = (id: string): FacultyId | undefined => FACULTY[id];
const thread = (a: string, b: string) => ({ pair: [a, b] as const });

/**
 * DESIGN-REVIEW-SCHELL §4. The sky assembles as faculty regions connect: a
 * picture, not a gauge. Every figure belongs to one pair of faculties, and
 * only a thread that crosses between them draws it.
 */
describe("figureReveal", () => {
  it("gives every authored figure one pair of faculties, and every pair one figure", () => {
    expect(FIGURE_COUNT).toBe(CONSTELLATIONS.length);
    const keys = FIGURE_FACULTY_PAIRS.map(([a, b]) => [a, b].sort().join("|"));
    expect(new Set(keys).size).toBe(6);
  });

  it("draws nothing before any faculties have met", () => {
    expect([...figureReveal([], facultyOf)]).toEqual([0, 0, 0, 0, 0, 0]);
    expect(FIGURE_BASE).toBeGreaterThan(0);
    expect(FIGURE_BASE).toBeLessThan(0.5);
  });

  it("makes the monochord legible when Measure meets Sound, and nothing else", () => {
    const reveal = figureReveal([thread("fib", "counterpoint")], facultyOf);
    const monochord = FIGURE_FACULTY_PAIRS.findIndex(
      ([a, b]) => [a, b].sort().join("|") === "measure|sound"
    );
    expect(reveal[monochord]).toBeCloseTo(0.55, 6);
    for (let i = 0; i < FIGURE_COUNT; i++) {
      if (i !== monochord) expect(reveal[i]).toBe(0);
    }
  });

  it("brings a figure the rest of the way in with further crossings, and saturates", () => {
    const one = figureReveal([thread("fib", "counterpoint")], facultyOf);
    const two = figureReveal(
      [thread("fib", "counterpoint"), thread("primes", "polyrhythm")],
      facultyOf
    );
    const four = figureReveal(
      [
        thread("fib", "counterpoint"),
        thread("primes", "polyrhythm"),
        thread("fib", "polyrhythm"),
        thread("primes", "counterpoint"),
      ],
      facultyOf
    );
    const i = FIGURE_FACULTY_PAIRS.findIndex(
      ([a, b]) => [a, b].sort().join("|") === "measure|sound"
    );
    expect(two[i]).toBeGreaterThan(one[i]);
    expect(four[i]).toBeGreaterThan(two[i]);
    expect(four[i]).toBeGreaterThan(0.9);
    expect(four[i]).toBeLessThanOrEqual(1);
  });

  it("counts a thread inside one faculty for nothing, however many there are", () => {
    const reveal = figureReveal(
      [thread("fib", "primes"), thread("counterpoint", "polyrhythm"), thread("fib", "primes")],
      facultyOf
    );
    expect([...reveal]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("does not care which way round a thread was woven", () => {
    const ab = figureReveal([thread("entropy", "girih")], facultyOf);
    const ba = figureReveal([thread("girih", "entropy")], facultyOf);
    expect([...ab]).toEqual([...ba]);
  });

  it("ignores a bead it cannot place", () => {
    expect([...figureReveal([thread("fib", "unknown")], facultyOf)]).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe("easeReveal", () => {
  it("moves toward the target without overshooting", () => {
    const current = new Float32Array(FIGURE_COUNT);
    const target = figureReveal([thread("fib", "counterpoint")], facultyOf);
    for (let frame = 0; frame < 600; frame++) easeReveal(current, target, 1 / 60);
    for (let i = 0; i < FIGURE_COUNT; i++) {
      expect(current[i]).toBeGreaterThanOrEqual(0);
      expect(current[i]).toBeLessThanOrEqual(target[i] + 1e-6);
      expect(current[i]).toBeCloseTo(target[i], 2);
    }
  });

  it("is a fade, not a snap", () => {
    const current = new Float32Array(FIGURE_COUNT);
    const target = new Float32Array(FIGURE_COUNT).fill(1);
    easeReveal(current, target, 1 / 60);
    expect(current[0]).toBeGreaterThan(0);
    expect(current[0]).toBeLessThan(0.1);
  });
});
