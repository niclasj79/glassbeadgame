import { smoothstep } from "@/lib/utils";

/**
 * CAV-006 — RESOLUTION, NOT REWARD
 *
 * A documented relation and an Open Thread are the same discovery at two
 * different epistemic stations, and the director's accepted answer names the
 * axis they may differ on: *resolution*, never reward. "An Open Thread is
 * rendered at the same brightness and the same musical weight but stays
 * unclosed… No outcome type may be given more bloom, more gain, or more camera
 * than another; the player must never learn to prefer one kind of truth because
 * it pays better."
 *
 * The shader used to implement the opposite: an unresolved thread's alpha was
 * multiplied by `0.82 + 0.18 * sin(t)` over its whole length — an Open Thread
 * was, on average, 18% dimmer than a documented one everywhere, plus a fade at
 * the terminal. That is a reward gradient wearing the costume of an epistemic
 * one, and a player would learn it in ten minutes.
 *
 * This module owns the replacement, as data and pure functions, so that the
 * claim "the two are equally luminous" is something a test can *measure*
 * rather than something a comment can assert:
 *
 *   documented   dry ink. A crisp contour that runs to its closing point.
 *   open         wet ink. The stroke has not dried, so it has spread across
 *                the full width of the nib, and it stops short of closing.
 *
 * The spread is not decorative: `WET_INNER` is *solved* so that the extra
 * coverage the spread gains is exactly the coverage the unclosed terminal
 * gives up. The two outcomes therefore lay down the same quantity of ink at
 * the same peak strength, and differ only in whether the figure closes.
 *
 * The GLSL below is emitted from these same numbers, so the shader cannot
 * drift from the model this module's tests measure.
 */

/** Ribbon edge in cross-section coordinates: `across` is |vV|, 0 at the spine. */
const EDGE = 1;

/** Where a dry contour begins to fall off — the crisp edge of a drawn stroke. */
const DRY_INNER = 0.55;

/**
 * Where the closing of the figure begins, in the thread's own growth
 * coordinate (0 at the ends the growth started from, 1 where it closes). A
 * documented thread closes here; an open one is still on its way.
 */
const HOLD_START = 0.86;

/**
 * Mean coverage of a `1 - smoothstep(inner, EDGE, x)` profile over 0–1.
 * Smoothstep's cubic is symmetric about its midpoint, so its mean across the
 * transition is exactly one half — this is an identity, not an approximation.
 */
const profileArea = (inner: number): number => inner + (EDGE - inner) / 2;

/** The fraction of its length an unclosed thread actually draws. */
const HOLD_AREA = profileArea(HOLD_START);

/** GLSL literal: a shader rejects an integer where a float belongs. */
const glslFloat = (value: number): string => value.toFixed(6);

/**
 * Solve the spread that conserves ink:
 *   area(WET_INNER) * HOLD_AREA === area(DRY_INNER)
 * Rounded to the precision the emitted GLSL carries, so the tested model and
 * the shader agree to the last digit either of them can represent.
 */
const WET_INNER = Number(
  ((2 * profileArea(DRY_INNER)) / HOLD_AREA - EDGE).toFixed(6)
);

/** The accepted CAV-006 rendering model, as shared data. */
export const RESOLUTION = Object.freeze({
  /** Crisp contour edge of dry (documented) ink. */
  dryInner: DRY_INNER,
  /** Spread contour edge of wet (open) ink. Solved, never hand-tuned. */
  wetInner: WET_INNER,
  /** Where a documented figure closes and an open one stops. */
  holdStart: HOLD_START,
  /** Ribbon half-width in cross-section coordinates. */
  edge: EDGE,
});

/**
 * Ink coverage at one point of a thread.
 *
 * `across`  distance from the spine, 0–1 (|vV|).
 * `closure` the thread's own growth coordinate, 0 at the ends it grew from and
 *           1 where the figure closes. Echo and Tension grow inward from both
 *           beads, so their closure is the midpoint; Passage and Ground close
 *           at the destination. The map from arc position to closure is
 *           measure-preserving in both cases, which is why one conservation
 *           constant serves all four forms.
 * `resolved` 1 for a documented relation, 0 for an Open Thread.
 */
export function threadInkCoverage(
  across: number,
  closure: number,
  resolved: number
): number {
  const dry = 1 - smoothstep(DRY_INNER, EDGE, Math.abs(across));
  const wet = 1 - smoothstep(WET_INNER, EDGE, Math.abs(across));
  const hold = 1 - smoothstep(HOLD_START, EDGE, closure);
  const open = wet * hold;
  return open + (dry - open) * resolved;
}

/**
 * Total ink a thread lays down, integrated over its length and its width.
 * Documented and open must agree: that equality is the whole point, and the
 * test measures it here rather than trusting the comment above.
 */
export function totalThreadInk(resolved: number, steps = 2048): number {
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const closure = (i + 0.5) / steps;
    for (let j = 0; j < steps; j++) {
      const across = (j + 0.5) / steps;
      sum += threadInkCoverage(across, closure, resolved);
    }
  }
  return sum / (steps * steps);
}

/**
 * The same model, as GLSL, generated from the same constants. The ribbon
 * fragment shader calls this and nothing else on `uResolved`, so no shader can
 * quietly reintroduce a luminance difference between the two outcomes.
 */
export const GLSL_RESOLUTION = /* glsl */ `
float gbgThreadInk(float across, float closure, float resolved) {
  float dry = 1.0 - smoothstep(${glslFloat(DRY_INNER)}, ${glslFloat(EDGE)}, across);
  float wet = 1.0 - smoothstep(${glslFloat(WET_INNER)}, ${glslFloat(EDGE)}, across);
  float hold = 1.0 - smoothstep(${glslFloat(HOLD_START)}, ${glslFloat(EDGE)}, closure);
  return mix(wet * hold, dry, resolved);
}
`;
