import { describe, expect, it } from "vitest";

import { castaliaConceptById } from "@/content/castalia/concepts";
import { RELATION_INTENTIONS } from "@/domain/events";
import { COMFORT } from "./comfort";
import { describeVoicePlan } from "./describe";
import { planRelationVoices } from "./grammar";
import { AUDIO_INTENSITIES, applyIntensity } from "./intensity";
import { CASTALIA_MODE, beatingHzBetween, transposeCents } from "./mode";
import { NEUTRAL_PHRASING, type MotifSource } from "./motif";
import { auditComfort, peakSummedGain } from "./plan";
import { SCORE } from "./score";

const source = (id: string): MotifSource => {
  const concept = castaliaConceptById.get(id);
  if (!concept) throw new Error(`missing fixture concept ${id}`);
  return { conceptId: concept.id, motif: concept.motif };
};

const JUST = source("sound.just-intonation");
const EQUAL = source("sound.equal-temperament");
const BED = SCORE.grammar.bedGain;

const tension = planRelationVoices({
  planId: "tension",
  mode: CASTALIA_MODE,
  intention: "tension",
  a: JUST,
  b: EQUAL,
  unitSeconds: 0.125,
  ambientGain: BED,
  bedGain: BED,
  resolves: false,
  phrasing: { ...NEUTRAL_PHRASING, rubato: 0 },
});

const names = { conceptName: (id: string) => id };

describe("reduced intensity", () => {
  const reduced = applyIntensity(tension, "reduced");

  it("keeps the Tension — it never becomes a softer consonance", () => {
    expect(reduced.beatings).toHaveLength(1);
    expect(reduced.beatings[0].beatingHz).toBeGreaterThanOrEqual(
      COMFORT.beating.minHz
    );
    expect(reduced.meta.resolves).toBe(false);
    expect(reduced.notes.every((note) => note.openEnded)).toBe(true);
  });

  it("beats more slowly, and still inside the band", () => {
    expect(reduced.beatings[0].beatingHz).toBeLessThan(tension.beatings[0].beatingHz);
    expect(reduced.beatings[0].beatingHz).toBeLessThanOrEqual(COMFORT.beating.maxHz);
  });

  it("re-tunes the beating twin so the rate it reports is the rate it produces", () => {
    const shadow = reduced.notes.find((note) => note.role === "shadow")!;
    const rate = beatingHzBetween(
      shadow.frequency,
      transposeCents(shadow.frequency, shadow.detuneCents)
    );
    expect(rate).toBeCloseTo(reduced.beatings[0].beatingHz, 4);
  });

  it("is quieter and gentler in onset", () => {
    expect(peakSummedGain(reduced)).toBeLessThan(peakSummedGain(tension));
    expect(reduced.notes[0].envelope.attack).toBeGreaterThan(
      tension.notes[0].envelope.attack
    );
  });

  it("thins by dropping the least load-bearing voices first", () => {
    const echo = planRelationVoices({
      planId: "echo",
      mode: CASTALIA_MODE,
      intention: "echo",
      a: JUST,
      b: EQUAL,
      unitSeconds: 0.125,
      ambientGain: BED,
  bedGain: BED,
      resolves: true,
    });
    const thin = applyIntensity(echo, "reduced");
    expect(thin.notes.length).toBeLessThanOrEqual(echo.notes.length);
    // Subject and answer survive; the cadence is the first thing to go.
    expect(thin.notes.some((note) => note.role === "subject")).toBe(true);
    expect(thin.notes.some((note) => note.role === "answer")).toBe(true);
  });

  it("stays inside the comfort envelope", () => {
    for (const intention of RELATION_INTENTIONS) {
      const plan = planRelationVoices({
        planId: `p:${intention}`,
        mode: CASTALIA_MODE,
        intention,
        a: JUST,
        b: EQUAL,
        unitSeconds: 0.125,
        ambientGain: BED,
  bedGain: BED,
        resolves: true,
      });
      expect(
        auditComfort(applyIntensity(plan, "reduced"), { bedGain: BED })
      ).toEqual([]);
    }
  });
});

describe("the muted, captioned path", () => {
  const silent = applyIntensity(tension, "silent");

  it("makes no sound at all", () => {
    expect(silent.notes).toEqual([]);
    expect(silent.beatings).toEqual([]);
  });

  it("says exactly what a hearing player is told", () => {
    expect(describeVoicePlan(silent, names)).toBe(describeVoicePlan(tension, names));
  });

  it("keeps the plan's whole meaning, including that it does not resolve", () => {
    expect(silent.meta).toEqual(tension.meta);
    expect(silent.intention).toBe("tension");
  });
});

describe("intensity as a whole", () => {
  it("leaves full intensity untouched", () => {
    expect(applyIntensity(tension, "full")).toBe(tension);
  });

  it("never gets louder than full at any level", () => {
    for (const level of AUDIO_INTENSITIES) {
      expect(peakSummedGain(applyIntensity(tension, level))).toBeLessThanOrEqual(
        peakSummedGain(tension) + 1e-9
      );
    }
  });
});
