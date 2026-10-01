/**
 * THE PULSE, AS PATTERNS (ADR-017, M4-002).
 *
 * The pure half of the pulse: the loping cell, the fill, the second voice, the
 * thinning under attention and Attunement, the reduced and silent profiles —
 * and the guard rails that keep all of it on the conductor's grid and out of
 * Tension's signature.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ATTENTION_RELEASED } from "./attention";
import { HAND_DIVISION } from "./conductor";
import { AUDIO_INTENSITIES, type AudioIntensity } from "./intensity";
import {
  BRUSH_SIXTEENTH,
  BRUSH_WEIGHT,
  FILL_LANDING_SIXTEENTH,
  FILL_SIXTEENTHS,
  PULSE_BRUSH_ENTRY,
  PULSE_DIVISION,
  PULSE_SILENT_DENSITY,
  PULSE_SIXTEENTHS,
  PULSE_SKIN_ENTRY,
  SECOND_VOICE_SIXTEENTHS,
  SKIN_SIXTEENTHS,
  fillIsUniform,
  mergePulse,
  pulseCell,
  pulseFill,
  type PulseCellOptions,
  type PulseOnset,
} from "./pulse";
import { SCORE } from "./score";

const FULL: PulseCellOptions = Object.freeze({
  awakening: 1,
  density: 1,
  intensity: "full",
  secondVoice: false,
  fill: false,
});

const cell = (overrides: Partial<PulseCellOptions> = {}, slot = 0): readonly PulseOnset[] =>
  pulseCell(slot, { ...FULL, ...overrides });

type Shape = readonly [number, PulseOnset["body"], number];
const shape = (onsets: readonly PulseOnset[]): Shape[] =>
  onsets.map((onset) => [onset.sixteenth, onset.body, onset.weight] as const);

/** The spaces the director actually asks for. */
const ATTENTION_DENSITIES = [
  SCORE.attention.thinDensityScale,
  SCORE.attention.responseDensityScale,
] as const;
const ATTUNEMENT_DENSITY = SCORE.attunement.densityScale;

/** Every state the bed can be in, as far as the pulse can tell. */
function* everyState(): Generator<PulseCellOptions> {
  for (const awakening of [0, 0.1, 0.25, 0.3, 0.49, 0.5, 0.75, 1]) {
    for (const density of [0, 0.15, 0.2, 0.21, 0.25, 0.45, 0.72, 0.99, 1]) {
      for (const intensity of AUDIO_INTENSITIES) {
        for (const secondVoice of [false, true]) {
          for (const fill of [false, true]) {
            yield { awakening, density, intensity, secondVoice, fill };
          }
        }
      }
    }
  }
}

// ─── The cell ───────────────────────────────────────────────────────────────

describe("the cell", () => {
  it("is a loping three-three-two on the skin, with the brush between its second and third onsets", () => {
    expect(shape(cell())).toEqual([
      [0, "skin", 1],
      [6, "skin", 1],
      [10, "brush", 0.5],
      [12, "skin", 1],
    ]);
    // In eighths the skin falls on the first, fourth and seventh: three, three, two.
    const eighths = SKIN_SIXTEENTHS.map((sixteenth) => sixteenth / 2);
    expect(eighths).toEqual([0, 3, 6]);
    expect([eighths[1] - eighths[0], eighths[2] - eighths[1], 8 - eighths[2]]).toEqual([3, 3, 2]);
    expect(BRUSH_SIXTEENTH).toBeGreaterThan(SKIN_SIXTEENTHS[1]);
    expect(BRUSH_SIXTEENTH).toBeLessThan(SKIN_SIXTEENTHS[2]);
  });

  it("repeats every slot: the slot index changes nothing", () => {
    for (const options of everyState()) {
      const first = pulseCell(0, options);
      for (let slot = 1; slot < 48; slot += 1) {
        expect(pulseCell(slot, options)).toEqual(first);
      }
    }
  });

  it("has no cell for a slot the bed never wrote", () => {
    for (const slot of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(pulseCell(slot, FULL)).toEqual([]);
      expect(pulseFill(slot, FULL)).toEqual([]);
    }
  });

  it("is frozen, as every plan is", () => {
    const onsets = cell({ fill: true, secondVoice: true });
    expect(Object.isFrozen(onsets)).toBe(true);
    for (const onset of onsets) expect(Object.isFrozen(onset)).toBe(true);
  });
});

// ─── Entry and growth ───────────────────────────────────────────────────────

describe("entry and growth", () => {
  it("sounds nothing before the web has woken to a quarter", () => {
    for (const awakening of [0, 0.1, 0.2, PULSE_SKIN_ENTRY - 1e-9]) {
      expect(cell({ awakening })).toEqual([]);
      expect(cell({ awakening, fill: true, secondVoice: true })).toEqual([]);
      expect(pulseFill(0, { ...FULL, awakening })).toEqual([]);
    }
  });

  it("enters on the skin alone, at a weight that is the awakening", () => {
    expect(PULSE_SKIN_ENTRY).toBe(0.25);
    expect(shape(cell({ awakening: 0.25 }))).toEqual([
      [0, "skin", 0.25],
      [6, "skin", 0.25],
      [12, "skin", 0.25],
    ]);
    expect(shape(cell({ awakening: 0.4, secondVoice: true }))).toEqual([
      [0, "skin", 0.4],
      [6, "skin", 0.4],
      [12, "skin", 0.4],
    ]);
  });

  it("adds the brush from half-awakening, at half the skin's weight", () => {
    expect(PULSE_BRUSH_ENTRY).toBe(0.5);
    expect(shape(cell({ awakening: PULSE_BRUSH_ENTRY - 1e-9 })).map(([, body]) => body)).not.toContain(
      "brush"
    );
    expect(shape(cell({ awakening: 0.5 }))).toEqual([
      [0, "skin", 0.5],
      [6, "skin", 0.5],
      [10, "brush", 0.25],
      [12, "skin", 0.5],
    ]);
  });

  it("grows in proportion to the awakening, and to nothing else", () => {
    for (const awakening of [0.3, 0.45, 0.6, 0.8, 0.95]) {
      for (const onset of cell({ awakening, fill: true, secondVoice: true })) {
        const expected = onset.body === "brush" ? awakening * BRUSH_WEIGHT : awakening;
        expect(onset.weight).toBeCloseTo(expected, 12);
      }
    }
    // Held to the unit: an awakening past one is a whole awakening.
    expect(cell({ awakening: 3 })).toEqual(cell({ awakening: 1 }));
    // One that cannot be read is none.
    expect(cell({ awakening: Number.NaN })).toEqual([]);
  });
});

// ─── The second voice ───────────────────────────────────────────────────────

describe("the second voice", () => {
  it("adds the brush on every other eighth, wherever nothing is struck already", () => {
    expect(SECOND_VOICE_SIXTEENTHS).toEqual([2, 6, 10, 14]);
    expect(shape(cell({ secondVoice: true }))).toEqual([
      [0, "skin", 1],
      [2, "brush", 0.5],
      [6, "skin", 1],
      [10, "brush", 0.5],
      [12, "skin", 1],
      [14, "brush", 0.5],
    ]);
  });

  it("has no brush to play it on before the brush has entered", () => {
    expect(cell({ awakening: 0.3, secondVoice: true })).toEqual(cell({ awakening: 0.3 }));
  });
});

// ─── The fill ───────────────────────────────────────────────────────────────

describe("the fill", () => {
  it("rolls brush sixteenths over the last half slot and lands one bell on the next boundary", () => {
    expect(shape(cell({ fill: true }))).toEqual([
      [0, "skin", 1],
      [6, "skin", 1],
      [8, "brush", 0.5],
      [9, "brush", 0.5],
      [10, "brush", 0.5],
      [11, "brush", 0.5],
      [12, "skin", 1],
      [13, "brush", 0.5],
      [14, "brush", 0.5],
      [15, "brush", 0.5],
      [16, "bell", 1],
    ]);
    expect(FILL_LANDING_SIXTEENTH).toBe(PULSE_DIVISION);
  });

  it("leaves the first half of the slot as it was", () => {
    for (const secondVoice of [false, true]) {
      const plain = cell({ secondVoice }).filter((onset) => onset.sixteenth < 8);
      const filled = cell({ secondVoice, fill: true }).filter((onset) => onset.sixteenth < 8);
      expect(filled).toEqual(plain);
    }
  });

  it("strikes every sixteenth of the last half, whichever body already had one", () => {
    for (const secondVoice of [false, true]) {
      const last = cell({ secondVoice, fill: true }).filter((onset) => onset.sixteenth >= 8);
      expect(last.map((onset) => onset.sixteenth)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16]);
    }
  });

  it("is at most half a slot of sixteenths, and adds only there", () => {
    for (const options of everyState()) {
      const without = pulseCell(0, { ...options, fill: false });
      const added = pulseCell(0, { ...options, fill: true }).filter(
        (onset) => !without.some((kept) => kept.sixteenth === onset.sixteenth)
      );
      for (const onset of added) {
        expect(onset.sixteenth).toBeGreaterThanOrEqual(PULSE_DIVISION / 2);
        expect(onset.sixteenth).toBeLessThanOrEqual(FILL_LANDING_SIXTEENTH);
      }
      expect(added.length).toBeLessThanOrEqual(FILL_SIXTEENTHS.length + 1);
    }
  });

  it("lands on its bell alone before the brush has entered", () => {
    expect(shape(cell({ awakening: 0.3, fill: true }))).toEqual([
      [0, "skin", 0.3],
      [6, "skin", 0.3],
      [12, "skin", 0.3],
      [16, "bell", 0.3],
    ]);
  });

  it("is the same brush roll and bell on its own, before a cell takes it in", () => {
    expect(shape(pulseFill(7, FULL))).toEqual([
      ...FILL_SIXTEENTHS.map((sixteenth) => [sixteenth, "brush", 0.5] as const),
      [16, "bell", 1],
    ]);
    // Folding it into a written cell sounds exactly as the cell with the fill.
    for (const secondVoice of [false, true]) {
      expect(mergePulse(cell({ secondVoice }), pulseFill(0, FULL))).toEqual(
        cell({ secondVoice, fill: true })
      );
    }
  });

  it("merges by keeping whatever already struck a sixteenth, in sixteenth order", () => {
    const merged = mergePulse(
      [{ sixteenth: 12, body: "skin", weight: 1 }],
      [
        { sixteenth: 16, body: "bell", weight: 1 },
        { sixteenth: 12, body: "brush", weight: 0.5 },
        { sixteenth: 8, body: "brush", weight: 0.5 },
      ]
    );
    expect(shape(merged)).toEqual([
      [8, "brush", 0.5],
      [12, "skin", 1],
      [16, "bell", 1],
    ]);
  });
});

// ─── Space ──────────────────────────────────────────────────────────────────

describe("space", () => {
  it("keeps only the downbeat under attention, whatever else was asked for", () => {
    for (const density of [...ATTENTION_DENSITIES, 0.21, 0.72, 0.99]) {
      for (const awakening of [0.3, 0.8]) {
        expect(
          shape(cell({ density, awakening, secondVoice: true, fill: true }))
        ).toEqual([[0, "skin", awakening]]);
        expect(pulseFill(0, { ...FULL, density, awakening })).toEqual([]);
      }
    }
  });

  it("is silent under Attunement's space, leaving the slot to the heartbeat", () => {
    expect(ATTUNEMENT_DENSITY).toBeLessThanOrEqual(PULSE_SILENT_DENSITY);
    for (const attention of ATTENTION_DENSITIES) {
      expect(attention).toBeGreaterThan(PULSE_SILENT_DENSITY);
    }
    for (const density of [ATTUNEMENT_DENSITY, PULSE_SILENT_DENSITY, 0.1, 0]) {
      expect(cell({ density, secondVoice: true, fill: true })).toEqual([]);
    }
  });

  it("does not play into a space it cannot read", () => {
    expect(cell({ density: Number.NaN })).toEqual([]);
  });

  it("plays the whole cell once attention is released", () => {
    expect(cell({ density: ATTENTION_RELEASED.densityScale })).toEqual(cell());
  });
});

// ─── Profiles ───────────────────────────────────────────────────────────────

describe("profiles", () => {
  it("keeps the skin on the downbeats alone under reduced intensity, and never a fill", () => {
    for (const awakening of [0.25, 0.6, 1]) {
      expect(
        shape(cell({ intensity: "reduced", awakening, secondVoice: true, fill: true }))
      ).toEqual([[0, "skin", awakening]]);
      expect(pulseFill(0, { ...FULL, intensity: "reduced", awakening })).toEqual([]);
    }
  });

  it("keeps nothing when silent", () => {
    for (const options of everyState()) {
      if (options.intensity !== "silent") continue;
      expect(pulseCell(0, options)).toEqual([]);
      expect(pulseFill(0, options)).toEqual([]);
    }
  });

  it("treats a profile it does not know as silence", () => {
    expect(cell({ intensity: "loud" as unknown as AudioIntensity })).toEqual([]);
  });
});

// ─── The grid ───────────────────────────────────────────────────────────────

describe("the grid (ADR-016, CAV-007)", () => {
  /** The eighths, and the brush's one sixteenth between them. */
  const FILL_FREE = new Set([0, 2, 4, 6, 8, 9, 10, 12, 14]);

  it("divides the slot as the conductor does, into sixteenths", () => {
    expect(PULSE_DIVISION).toBe(16);
    expect(PULSE_DIVISION).toBe(HAND_DIVISION);
    expect(PULSE_SIXTEENTHS).toEqual([0, 2, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("puts every onset on a sixteenth of the slot, and never two on one", () => {
    for (const options of everyState()) {
      const onsets = pulseCell(0, options);
      const sixteenths = onsets.map((onset) => onset.sixteenth);
      for (const sixteenth of sixteenths) {
        expect(Number.isInteger(sixteenth)).toBe(true);
        expect(PULSE_SIXTEENTHS).toContain(sixteenth);
        expect(sixteenth).toBeGreaterThanOrEqual(0);
        expect(sixteenth).toBeLessThanOrEqual(PULSE_DIVISION);
      }
      // One onset per sixteenth, in order: nothing is faster than the sixteenth.
      expect(new Set(sixteenths).size).toBe(sixteenths.length);
      expect([...sixteenths].sort((a, b) => a - b)).toEqual(sixteenths);
      for (const onset of onsets) {
        expect(onset.weight).toBeGreaterThan(0);
        expect(onset.weight).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps to the eighths, and the brush's sixteenth, everywhere but a fill", () => {
    for (const options of everyState()) {
      const onsets = pulseCell(0, { ...options, fill: false });
      for (const onset of onsets) expect(FILL_FREE.has(onset.sixteenth)).toBe(true);
    }
  });

  it("reaches the next boundary only with a fill's bell", () => {
    for (const options of everyState()) {
      for (const onset of pulseCell(0, options)) {
        if (onset.sixteenth !== FILL_LANDING_SIXTEENTH) continue;
        expect(options.fill).toBe(true);
        expect(onset.body).toBe("bell");
      }
      for (const onset of pulseCell(0, { ...options, fill: false })) {
        expect(onset.body).not.toBe("bell");
      }
    }
  });

  it("never runs faster than the eighth in the plain cell, across the bar line too", () => {
    for (const awakening of [0.25, 0.5, 1]) {
      const sixteenths = cell({ awakening }).map((onset) => onset.sixteenth);
      const gaps = sixteenths.map((sixteenth, index) =>
        index + 1 < sixteenths.length
          ? sixteenths[index + 1] - sixteenth
          : PULSE_DIVISION + sixteenths[0] - sixteenth
      );
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps no cycle against the slot: its only period divides the slot's eighths", () => {
    const slots = 12;
    for (const options of everyState()) {
      if (options.fill) continue;
      const line = new Set<number>();
      for (let slot = 0; slot < slots; slot += 1) {
        for (const onset of pulseCell(slot, options)) {
          line.add(slot * PULSE_DIVISION + onset.sixteenth);
        }
      }
      if (line.size === 0) continue;
      // The shortest shift that maps the line onto itself (away from its ends).
      const inside = (step: number) =>
        [...line].every(
          (at) => at + step >= slots * PULSE_DIVISION || line.has(at + step)
        );
      let period = 1;
      while (!inside(period)) period += 1;
      expect(PULSE_DIVISION % period).toBe(0);
    }
  });
});

// ─── CAV-006: one fill ──────────────────────────────────────────────────────

describe("CAV-006: the fill is one fill", () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  /** The module as the bundler sees it: comments carry no behaviour. */
  const code = readFileSync(join(HERE, "pulse.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("is held to it by the compiler: no input of the cell names an outcome", () => {
    expect(fillIsUniform).toBe(true);
    // A slot index and the bed's state, and nothing else.
    expect(pulseCell.length).toBe(2);
    expect(pulseFill.length).toBe(2);
  });

  it("reads no outcome, no outcome kind and no theme", () => {
    for (const forbidden of [
      /\.outcome\b/,
      /\bdocumented\b/,
      /open-thread/,
      /\bunresolved\b/,
      /OutcomeKind/,
      /OUTCOME/,
      /theme/i,
    ]) {
      expect(code).not.toMatch(forbidden);
    }
  });

  it("imports types alone, so nothing it could read arrives with it", () => {
    const imports = [...code.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)";/gm)];
    expect(imports.length).toBeGreaterThan(0);
    for (const [, typeOnly, from] of imports) {
      expect({ from, typeOnly: typeOnly !== undefined }).toEqual({ from, typeOnly: true });
    }
    expect(code).not.toMatch(/\bimport\(/);
  });
});
