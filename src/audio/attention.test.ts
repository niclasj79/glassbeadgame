import { describe, expect, it } from "vitest";

import { castaliaConceptById } from "@/content/castalia/concepts";
import {
  ATTENTION_RELEASED,
  planAttentionSpace,
  type AttentionSpaceInput,
} from "./attention";
import { CASTALIA_MODE } from "./mode";
import type { MotifSource } from "./motif";
import { SCORE } from "./score";

const source = (id: string): MotifSource => {
  const concept = castaliaConceptById.get(id);
  if (!concept) throw new Error(`missing fixture concept ${id}`);
  return { conceptId: concept.id, motif: concept.motif };
};

const FIBONACCI = source("measure.fibonacci-sequence");
const BED = SCORE.grammar.bedGain;

const input = (
  overrides: Partial<AttentionSpaceInput> = {}
): AttentionSpaceInput => ({
  planId: "attention",
  mode: CASTALIA_MODE,
  attended: FIBONACCI,
  unitSeconds: 0.125,
  ambientGain: BED,
  activeThreadCount: 0,
  ...overrides,
});

describe("attention sound-space", () => {
  it("always leaves space — the score never gets busier under attention", () => {
    for (const threads of [0, 1, 2, 3, 8]) {
      const plan = planAttentionSpace(input({ activeThreadCount: threads }));
      expect(plan.densityScale).toBeLessThan(1);
      expect(plan.bedGainScale).toBeLessThan(1);
    }
  });

  it("thins out while the web is sparse", () => {
    const plan = planAttentionSpace(input({ activeThreadCount: 1 }));
    expect(plan.spaceMode).toBe("reduced-density");
    expect(plan.responseGapSeconds).toBe(0);
    expect(plan.densityScale).toBe(SCORE.attention.thinDensityScale);
  });

  it("switches to call-and-response once the texture is continuous", () => {
    const plan = planAttentionSpace(
      input({ activeThreadCount: SCORE.attention.callAndResponseThreads })
    );
    expect(plan.spaceMode).toBe("call-and-response");
    // Real silence, held open, for candidates to answer into.
    expect(plan.responseGapSeconds).toBeGreaterThan(0);
    expect(plan.densityScale).toBeLessThan(SCORE.attention.thinDensityScale);
  });

  it("foregrounds the attended concept's own figure, unaltered", () => {
    const plan = planAttentionSpace(input());
    const degrees = plan.foreground.notes
      .slice(0, FIBONACCI.motif.degrees.length)
      .map((note) => note.degree);
    expect(degrees).toEqual([...FIBONACCI.motif.degrees]);
    expect(
      plan.foreground.notes.every((note) => note.timbre === FIBONACCI.motif.timbre)
    ).toBe(true);
    expect(plan.foreground.meta.conceptIds).toEqual([FIBONACCI.conceptId]);
  });

  it("makes the foregrounded figure louder than the bed it is heard against", () => {
    const plan = planAttentionSpace(input());
    const bedUnderAttention = BED * plan.bedGainScale;
    for (const note of plan.foreground.notes) {
      expect(note.gain).toBeGreaterThan(bedUnderAttention);
    }
  });

  it("states the figure more than once, so it can be learned", () => {
    const plan = planAttentionSpace(input());
    expect(plan.foreground.notes).toHaveLength(
      FIBONACCI.motif.degrees.length * SCORE.attention.repeats
    );
    expect(plan.cycleSeconds).toBeGreaterThan(0);
  });

  it("asserts nothing — attention is not an outcome", () => {
    const plan = planAttentionSpace(input());
    expect(plan.foreground.meta.resolves).toBe(false);
    expect(plan.foreground.intention).toBeNull();
  });

  it("restores ordinary density when attention is released", () => {
    expect(ATTENTION_RELEASED.densityScale).toBe(1);
    expect(ATTENTION_RELEASED.bedGainScale).toBe(1);
  });

  it("refuses a nonsensical grid", () => {
    expect(() => planAttentionSpace(input({ unitSeconds: 0 }))).toThrow(RangeError);
  });
});
