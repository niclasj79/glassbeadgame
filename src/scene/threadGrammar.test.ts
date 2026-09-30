import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RELATION_INTENTIONS } from "@/domain/events";
import {
  COMFORT,
  THREAD_FORMS,
  luminanceHz,
  threadForm,
  unrestAmplitude,
} from "./threadGrammar";

describe("the four thread materials", () => {
  it("covers every intention exactly once", () => {
    expect(THREAD_FORMS).toHaveLength(RELATION_INTENTIONS.length);
    expect(THREAD_FORMS.map((f) => f.intention)).toEqual([...RELATION_INTENTIONS]);
  });

  it("distinguishes them by construction, motion and mark — not by hue", () => {
    for (const channel of ["construction", "motion", "mark"] as const) {
      const values = THREAD_FORMS.map((f) => f[channel]);
      expect(new Set(values).size).toBe(THREAD_FORMS.length);
    }
  });

  it("gives each a distinct shader branch and a stable ABI order", () => {
    expect(THREAD_FORMS.map((f) => f.code)).toEqual([0, 1, 2, 3]);
  });

  it("carries a text equivalent for every relation", () => {
    for (const form of THREAD_FORMS) {
      expect(form.phrase.length).toBeGreaterThan(10);
      expect(form.phrase.endsWith(".")).toBe(true);
    }
  });

  it("sends only Ground beneath the armillary's surface", () => {
    expect(threadForm("ground").arcLift).toBeLessThan(1);
    for (const intention of ["echo", "passage", "tension"] as const) {
      expect(threadForm(intention).arcLift).toBeGreaterThan(1);
    }
  });

  it("makes Echo and Tension paired and Passage and Ground single", () => {
    expect(threadForm("echo").strands).toBe(2);
    expect(threadForm("tension").strands).toBe(2);
    expect(threadForm("passage").strands).toBe(1);
    expect(threadForm("ground").strands).toBe(1);
  });

  it("gives only Tension a beat and a torsion", () => {
    expect(threadForm("tension").beatHz).toBeGreaterThan(0);
    expect(threadForm("tension").torsion).toBeGreaterThan(0);
    for (const intention of ["echo", "passage", "ground"] as const) {
      expect(threadForm(intention).beatHz).toBe(0);
      expect(threadForm(intention).torsion).toBe(0);
    }
  });
});

describe("CAV-007 comfort envelope", () => {
  it("bounds torsion to fourteen degrees, as the shader actually renders it", () => {
    // This assertion used to read the value on its way *into* a uniform that
    // the shader then multiplied by four — so it passed at +/-14 degrees while
    // the render ran at +/-56 per strand, and ~112 of visible counter-rotation
    // between the two. The bound is only real if the amplitude reaching
    // `angle` is the bound, so the multiplier is gone and this test now names
    // the shader expression it is protecting.
    for (const intention of RELATION_INTENTIONS) {
      const form = threadForm(intention);
      expect(form.torsion).toBeLessThanOrEqual(COMFORT.maxTorsionRadians + 1e-9);
    }
    const source = readFileSync(
      new URL("./ribbon.ts", import.meta.url),
      "utf8"
    );
    // uUnrest and aStrand are both bounded to 1, so `sway` cannot exceed
    // uTorsion. Any scalar reintroduced here would silently break the envelope.
    expect(source).toContain("float angle = wind + sway;");
    expect(source).not.toMatch(/sway\s*\*\s*[0-9]/);
  });

  it("keeps every beat inside 0.8–6.5 Hz and never above 7", () => {
    for (const form of THREAD_FORMS) {
      if (form.beatHz === 0) continue;
      expect(form.beatHz).toBeGreaterThanOrEqual(COMFORT.minBeatHz);
      expect(form.beatHz).toBeLessThanOrEqual(COMFORT.maxBeatHz);
      expect(form.beatHz).toBeLessThan(7);
    }
  });

  it("caps luminance modulation at 3 Hz whatever is requested", () => {
    expect(luminanceHz(0.1)).toBeCloseTo(0.1, 10);
    expect(luminanceHz(6.5)).toBe(COMFORT.maxLuminanceHz);
    expect(luminanceHz(120)).toBe(3);
    expect(luminanceHz(-4)).toBe(0);
  });

  it("bounds the camera's breath in the same table (ADR-016)", () => {
    // The largest share of the field of view the world's breath may move: a
    // constant here, beside the 3 Hz bound, so no scene path can exceed it
    // locally. `framing.cameraBreath` is the one reader.
    expect(COMFORT.cameraBreath).toBe(0.006);
    expect(COMFORT.cameraBreath).toBeGreaterThan(0);
    expect(COMFORT.cameraBreath).toBeLessThan(0.01);
    expect(Object.isFrozen(COMFORT)).toBe(true);
  });

  it("decays unrest to a legible floor by about twelve seconds", () => {
    expect(unrestAmplitude(0)).toBe(1);
    expect(unrestAmplitude(-1)).toBe(1);
    expect(unrestAmplitude(2)).toBeLessThan(unrestAmplitude(1));
    const settled = unrestAmplitude(COMFORT.unrestSettleSeconds);
    expect(settled).toBeLessThan(0.3);
    // Never resolves to nothing: the instability stays a visible fact.
    expect(settled).toBeGreaterThan(COMFORT.unrestFloor);
    expect(unrestAmplitude(600)).toBeGreaterThanOrEqual(COMFORT.unrestFloor);
  });

  it("never lets unrest leave the 0–1 range", () => {
    for (let t = 0; t <= 60; t += 0.5) {
      const value = unrestAmplitude(t);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
