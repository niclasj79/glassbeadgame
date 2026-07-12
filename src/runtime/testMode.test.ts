import { describe, expect, it } from "vitest";
import { hashString } from "@/lib/utils";
import { parseTestMode, summarizeFrameSamples } from "./testMode";

describe("test-mode boundary", () => {
  it("accepts an explicit development-only stable seed", () => {
    expect(parseTestMode("?testMode=1&seed=castalia-golden-001", true)).toEqual({
      enabled: true,
      seedText: "castalia-golden-001",
      seed: hashString("castalia-golden-001"),
      qualityTier: "base",
      reducedMotion: false,
    });
    expect(parseTestMode("?testMode=1&seed=x&quality=potato&reducedMotion=1", true)).toMatchObject({
      qualityTier: "potato",
      reducedMotion: true,
    });
  });

  it("fails closed outside development or without a nonempty seed", () => {
    expect(parseTestMode("?testMode=1&seed=castalia-golden-001", false).enabled).toBe(false);
    expect(parseTestMode("?testMode=1", true).enabled).toBe(false);
    expect(parseTestMode("?seed=castalia-golden-001", true).enabled).toBe(false);
  });

  it("summarizes frame distributions with nearest-rank percentiles", () => {
    expect(summarizeFrameSamples([10, 20, 30, 60])).toEqual({
      sampleCount: 4,
      medianMs: 20,
      p95Ms: 60,
      p99Ms: 60,
      longFrames: 1,
      effectiveFps: 1000 / 30,
    });
    expect(() => summarizeFrameSamples([])).toThrow(/positive finite/);
  });
});
