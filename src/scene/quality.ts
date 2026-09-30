import type { QualityTier } from "@/lib/device";

/**
 * ONE BUDGET TABLE FOR THE WHOLE ARENA
 *
 * Every tier is an *art direction*, not a damage report. `potato` deliberately
 * abandons the refraction march and renders the beads as engraved plates —
 * a woodcut of the same world rather than a broken photograph of it. Nothing
 * in a lower tier may remove a semantic channel; it may only change the
 * material the channel is made of.
 *
 * Reduced motion and reduced bloom are separate, first-class axes: a player
 * may want a still world at high fidelity, or a moving world without glare.
 */
export interface SceneBudget {
  /** Steps marched along the refracted chord inside a bead. 0 = engraved. */
  readonly glassSteps: number;
  /** Split the rim into R/G/B at slightly different indices. */
  readonly dispersion: boolean;
  /** Engraved-plate beads: no interior parallax, harder line, no glare. */
  readonly engravedGlass: boolean;
  /** Secondary tracery arcs in the vault, above the primary ribs. */
  readonly vaultTracery: boolean;
  /** How many authored constellation figures are drawn. */
  readonly constellationFigures: number;
  /** Unaffiliated field stars between the figures. */
  readonly fieldStars: number;
  /** Lengthwise segments in a thread ribbon. */
  readonly threadSegments: number;
  /** Graduation marks per armillary ring. */
  readonly graduations: number;
  /** Manuscript margin rule and corner ornament at the edge of vision. */
  readonly marginRule: boolean;
  /** Vellum grain amplitude across the frame, 0 = none. */
  readonly grain: number;
  /**
   * Taps the focus fog's softening takes from the frame (I-017). 0 is the
   * dim-only fog: the pass is compiled without a single blur tap, so the
   * engraved tier never pays for a softening it does not draw. The fog itself
   * — the dim, the clear discs round the attended bead and the lens — is on
   * every tier, because it is the channel that says what is attended.
   */
  readonly fogBlurTaps: number;
}

const HIGH: SceneBudget = Object.freeze({
  glassSteps: 14,
  dispersion: true,
  engravedGlass: false,
  vaultTracery: true,
  constellationFigures: 6,
  fieldStars: 260,
  threadSegments: 96,
  graduations: 72,
  marginRule: true,
  grain: 0.035,
  fogBlurTaps: 13,
});

const BASE: SceneBudget = Object.freeze({
  glassSteps: 9,
  dispersion: false,
  engravedGlass: false,
  vaultTracery: true,
  constellationFigures: 6,
  fieldStars: 150,
  threadSegments: 64,
  graduations: 36,
  marginRule: true,
  grain: 0.022,
  fogBlurTaps: 9,
});

/**
 * Not a degraded high tier: an engraving. The figure is cut directly into the
 * plate, the rim is a drawn line rather than a caustic, and the vault keeps
 * its ribs but loses its tracery. It should look like a decision.
 */
const POTATO: SceneBudget = Object.freeze({
  glassSteps: 0,
  dispersion: false,
  engravedGlass: true,
  vaultTracery: false,
  constellationFigures: 4,
  fieldStars: 70,
  threadSegments: 28,
  graduations: 24,
  marginRule: true,
  grain: 0,
  fogBlurTaps: 0,
});

const BUDGETS: Readonly<Record<QualityTier, SceneBudget>> = Object.freeze({
  high: HIGH,
  base: BASE,
  potato: POTATO,
});

/**
 * How the scene should present itself right now. `reducedMotion` never removes
 * a state, only the travel used to announce it; `reducedBloom` never removes
 * the glass, only its glare.
 */
export interface PresentationProfile {
  readonly tier: QualityTier;
  readonly reducedMotion: boolean;
  readonly reducedBloom: boolean;
  readonly budget: SceneBudget;
}

/**
 * There is no separate reduced-bloom preference in the settings model yet, so
 * it is derived: a player who has asked for reduced motion, or a device that
 * has fallen to the engraved tier, gets the low-glare path. When a preference
 * lands this is the one place that changes.
 */
export function presentationProfile(
  tier: QualityTier,
  reducedMotion: boolean
): PresentationProfile {
  const budget = BUDGETS[tier];
  return {
    tier,
    reducedMotion,
    reducedBloom: reducedMotion || budget.engravedGlass,
    budget,
  };
}

export function sceneBudget(tier: QualityTier): SceneBudget {
  return BUDGETS[tier];
}

/**
 * Whether this tier may soften the focus fog at all. The engraved tier's fog
 * is dim-only (I-017): the plate does not transmit, and it does not blur.
 */
export function fogBlurAllowed(tier: QualityTier): boolean {
  return BUDGETS[tier].fogBlurTaps > 0;
}
