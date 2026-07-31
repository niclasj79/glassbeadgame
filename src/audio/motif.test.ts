import { describe, expect, it } from "vitest";

import { castaliaConceptById } from "@/content/castalia/concepts";
import { CASTALIA_MODE, degreeFrequency } from "./mode";
import {
  ARTICULATION_SHAPE,
  NEUTRAL_PHRASING,
  anchorDegree,
  deterministicUnit,
  envelopeFor,
  motifSpanSeconds,
  motifUnits,
  renderMotif,
  type MotifSource,
} from "./motif";
import { COMFORT } from "./comfort";
import { noteLifetime } from "./plan";

const source = (id: string): MotifSource => {
  const concept = castaliaConceptById.get(id);
  if (!concept) throw new Error(`missing fixture concept ${id}`);
  return { conceptId: concept.id, motif: concept.motif };
};

const FIBONACCI = source("measure.fibonacci-sequence");
const COUNTERPOINT = source("sound.counterpoint");
const UNIT = 0.125;

describe("rendering a concept motif", () => {
  it("plays the authored contour, in order, unaltered", () => {
    const notes = renderMotif(FIBONACCI, {
      mode: CASTALIA_MODE,
      at: 0,
      unitSeconds: UNIT,
      gain: 0.1,
      role: "subject",
      idPrefix: "t",
    });
    expect(notes.map((note) => note.degree)).toEqual([...FIBONACCI.motif.degrees]);
    expect(notes.every((note) => note.timbre === FIBONACCI.motif.timbre)).toBe(true);
    expect(notes.every((note) => note.register === FIBONACCI.motif.register)).toBe(
      true
    );
  });

  it("gives each note its authored rhythmic length", () => {
    const notes = renderMotif(FIBONACCI, {
      mode: CASTALIA_MODE,
      at: 0,
      unitSeconds: UNIT,
      gain: 0.1,
      role: "subject",
      idPrefix: "t",
      phrasing: { ...NEUTRAL_PHRASING, rubato: 0 },
    });
    // Fibonacci's rhythm is 1, 1, 2, 3, 5 — the sequence itself.
    const starts = notes.map((note) => note.atSeconds);
    let cursor = 0;
    FIBONACCI.motif.rhythm.forEach((units, index) => {
      expect(starts[index]).toBeCloseTo(cursor, 6);
      cursor += units * UNIT;
    });
    expect(motifUnits(FIBONACCI.motif)).toBe(12);
  });

  it("resolves pitch through the world mode", () => {
    const notes = renderMotif(COUNTERPOINT, {
      mode: CASTALIA_MODE,
      at: 0,
      unitSeconds: UNIT,
      gain: 0.1,
      role: "subject",
      idPrefix: "t",
    });
    for (const note of notes) {
      expect(note.frequency).toBeCloseTo(
        degreeFrequency(CASTALIA_MODE, note.degree, note.register),
        9
      );
    }
  });

  it("lends another body without changing the figure — this is what Echo needs", () => {
    const own = renderMotif(FIBONACCI, {
      mode: CASTALIA_MODE,
      at: 0,
      unitSeconds: UNIT,
      gain: 0.1,
      role: "subject",
      idPrefix: "t",
      phrasing: { ...NEUTRAL_PHRASING, rubato: 0 },
    });
    const lent = renderMotif(FIBONACCI, {
      mode: CASTALIA_MODE,
      at: 0,
      unitSeconds: UNIT,
      gain: 0.1,
      role: "answer",
      idPrefix: "t",
      timbre: COUNTERPOINT.motif.timbre,
      phrasing: { ...NEUTRAL_PHRASING, rubato: 0 },
    });
    expect(lent.map((n) => n.degree)).toEqual(own.map((n) => n.degree));
    expect(lent.map((n) => n.atSeconds)).toEqual(own.map((n) => n.atSeconds));
    expect(lent.every((n) => n.timbre === COUNTERPOINT.motif.timbre)).toBe(true);
  });

  it("is deterministic — the same motif renders identically every time", () => {
    const options = {
      mode: CASTALIA_MODE,
      at: 0,
      unitSeconds: UNIT,
      gain: 0.1,
      role: "subject" as const,
      idPrefix: "same",
    };
    expect(renderMotif(FIBONACCI, options)).toEqual(renderMotif(FIBONACCI, options));
    expect(deterministicUnit("x")).toBe(deterministicUnit("x"));
    expect(deterministicUnit("x")).not.toBe(deterministicUnit("y"));
  });

  it("never lets a voice outlive the comfort bound", () => {
    for (const concept of castaliaConceptById.values()) {
      const notes = renderMotif(
        { conceptId: concept.id, motif: concept.motif },
        {
          mode: CASTALIA_MODE,
          at: 0,
          unitSeconds: 0.5,
          gain: 0.1,
          role: "subject",
          idPrefix: concept.id,
        }
      );
      for (const note of notes) {
        expect(noteLifetime(note)).toBeLessThanOrEqual(
          COMFORT.voice.maxLifetimeSeconds
        );
      }
    }
  });
});

describe("articulation", () => {
  it("gives the six articulations audibly different envelopes", () => {
    const shapes = Object.entries(ARTICULATION_SHAPE).map(([name, shape]) => ({
      name,
      ratio: shape.attack / (shape.attack + shape.hold + shape.release),
    }));
    const struck = shapes.find((s) => s.name === "struck")!;
    const bowed = shapes.find((s) => s.name === "bowed")!;
    const sustained = shapes.find((s) => s.name === "sustained")!;
    // A struck note is nearly all decay; a bowed one has a real approach.
    expect(struck.ratio).toBeLessThan(0.02);
    expect(bowed.ratio).toBeGreaterThan(0.15);
    expect(sustained.ratio).toBeGreaterThan(bowed.ratio * 0.5);
  });

  it("lets gesture bend the envelope without changing which notes sound", () => {
    const sharp = envelopeFor("bowed", 1, { ...NEUTRAL_PHRASING, attack: 1 });
    const drawn = envelopeFor("bowed", 1, { ...NEUTRAL_PHRASING, attack: 0 });
    expect(sharp.attack).toBeLessThan(drawn.attack);
    // Bounded: even the sharpest gesture leaves a bowed note bowed.
    expect(sharp.attack).toBeGreaterThan(0);
  });

  it("keeps a percussive articulation percussive under any phrasing", () => {
    const drawn = envelopeFor("struck", 1, { ...NEUTRAL_PHRASING, attack: 0 });
    expect(drawn.attack).toBeLessThan(0.05);
  });
});

describe("motif geometry", () => {
  it("reports the span a motif occupies on the grid", () => {
    expect(motifSpanSeconds(FIBONACCI.motif, UNIT)).toBeCloseTo(12 * UNIT, 9);
  });

  it("anchors a concept on its first degree", () => {
    expect(anchorDegree(FIBONACCI.motif)).toBe(FIBONACCI.motif.degrees[0]);
  });
});
