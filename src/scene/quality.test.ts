import { describe, expect, it } from "vitest";
import type { QualityTier } from "@/lib/device";
import { presentationProfile, sceneBudget } from "./quality";

const TIERS: readonly QualityTier[] = ["high", "base", "potato"];

describe("scene budgets", () => {
  it("gives every tier a complete, positive budget", () => {
    for (const tier of TIERS) {
      const budget = sceneBudget(tier);
      expect(budget.threadSegments).toBeGreaterThan(8);
      expect(budget.graduations).toBeGreaterThan(0);
      expect(budget.constellationFigures).toBeGreaterThan(0);
      expect(budget.fieldStars).toBeGreaterThan(0);
    }
  });

  it("spends strictly less work at each lower tier", () => {
    const [high, base, potato] = TIERS.map(sceneBudget);
    expect(high.threadSegments).toBeGreaterThan(base.threadSegments);
    expect(base.threadSegments).toBeGreaterThan(potato.threadSegments);
    expect(high.fieldStars).toBeGreaterThan(base.fieldStars);
    expect(base.fieldStars).toBeGreaterThan(potato.fieldStars);
    expect(high.graduations).toBeGreaterThan(base.graduations);
    expect(base.graduations).toBeGreaterThan(potato.graduations);
  });

  it("keeps the potato tier an art direction rather than a failure", () => {
    const potato = sceneBudget("potato");
    // It abandons the refraction march *and declares* an engraved treatment;
    // a tier with neither would be a bead with no interior at all.
    expect(potato.glassSteps).toBe(0);
    expect(potato.engravedGlass).toBe(true);
    // It keeps every semantic channel: authored figures, the margin, threads.
    expect(potato.constellationFigures).toBeGreaterThan(0);
    expect(potato.marginRule).toBe(true);
  });

  it("never turns off the manuscript margin", () => {
    for (const tier of TIERS) expect(sceneBudget(tier).marginRule).toBe(true);
  });

  it("marches the chord whenever the glass is not engraved", () => {
    for (const tier of TIERS) {
      const budget = sceneBudget(tier);
      if (budget.engravedGlass) continue;
      expect(budget.glassSteps).toBeGreaterThan(0);
    }
  });
});

describe("presentation profile", () => {
  it("treats reduced motion as an independent axis from the tier", () => {
    const still = presentationProfile("high", true);
    expect(still.tier).toBe("high");
    expect(still.budget.glassSteps).toBe(sceneBudget("high").glassSteps);
    expect(still.reducedMotion).toBe(true);
  });

  it("derives reduced bloom from reduced motion or the engraved tier", () => {
    expect(presentationProfile("high", false).reducedBloom).toBe(false);
    expect(presentationProfile("high", true).reducedBloom).toBe(true);
    expect(presentationProfile("potato", false).reducedBloom).toBe(true);
  });
});
