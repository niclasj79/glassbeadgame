import { describe, expect, it } from "vitest";
import type { QualityTier } from "@/lib/device";
import { fogBlurAllowed, presentationProfile, sceneBudget } from "./quality";

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

  it("softens the focus fog on every tier but the engraved one (I-017)", () => {
    // The low tier's fog is dim-only: not a blur turned down, a blur that is
    // never compiled, so it costs the engraved tier nothing at all.
    expect(sceneBudget("potato").fogBlurTaps).toBe(0);
    expect(fogBlurAllowed("potato")).toBe(false);
    for (const tier of ["high", "base"] as const) {
      expect(sceneBudget(tier).fogBlurTaps).toBeGreaterThanOrEqual(9);
      expect(sceneBudget(tier).fogBlurTaps).toBeLessThanOrEqual(13);
      expect(fogBlurAllowed(tier)).toBe(true);
    }
    // Never more work lower down.
    expect(sceneBudget("high").fogBlurTaps).toBeGreaterThanOrEqual(
      sceneBudget("base").fogBlurTaps
    );
  });

  it("lets the lens breathe with the world on every tier but the engraved one (ADR-016)", () => {
    // The camera breath is the one breath the budget may withhold: the bloom,
    // the sky and the bed keep theirs on every tier, and so does a bead's light
    // on its own notes, which is not a budget question at all.
    expect(sceneBudget("high").cameraBreath).toBe(true);
    expect(sceneBudget("base").cameraBreath).toBe(true);
    expect(sceneBudget("potato").cameraBreath).toBe(false);
    // A budget flag, not a motion preference: reduced motion leaves it alone
    // and stills the lens by its own path.
    for (const tier of TIERS) {
      expect(presentationProfile(tier, true).budget.cameraBreath).toBe(
        sceneBudget(tier).cameraBreath
      );
    }
  });
});

describe("the dust in the air (M4-003)", () => {
  it("fills the air on the high and base tiers, thinner on base", () => {
    expect(sceneBudget("high").dust).toBe(600);
    expect(sceneBudget("base").dust).toBe(300);
    expect(sceneBudget("high").dust).toBeGreaterThan(sceneBudget("base").dust);
    expect(sceneBudget("base").dust).toBeGreaterThan(0);
  });

  it("has none on the engraved tier: a plate has no air", () => {
    expect(sceneBudget("potato").dust).toBe(0);
  });

  it("is a budget, not a motion preference: reduced motion keeps the field", () => {
    // Under reduced motion the field holds still and still answers a ring's
    // light; the count is the tier's alone.
    for (const tier of TIERS) {
      expect(presentationProfile(tier, true).budget.dust).toBe(sceneBudget(tier).dust);
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
