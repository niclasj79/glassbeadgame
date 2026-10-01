/**
 * THE DITHER IN THE FINAL PASS (M4-003)
 *
 * The void is a gradient a few 8-bit steps tall across the whole vault
 * (Castalia's ground `#070912` to its depth `#0d1226`), so quantised straight
 * to the screen it bands: a dark frame that reads as steps instead of depth.
 * The frame is composed in half-float buffers and only quantised once, by the
 * composer's last pass — bloom's `EffectPass`, whose material already carries
 * three's dithering include, switched off. Switching it on adds three's hash of
 * the fragment coordinate, ±0.5 of an 8-bit step, after the output encoding:
 * static per pixel, no time term, so nothing flickers (CAV-007, §6).
 *
 * The composer rebuilds its passes whenever its children change (a tier change
 * reconstructs bloom), and a rebuilt `EffectPass` starts with dithering off, so
 * the flag is re-applied after every rebuild — see `Effects.tsx`.
 */

/** A pass that can dither its output: postprocessing's `EffectPass`. */
export interface DitherablePass {
  dithering: boolean;
}

function isDitherable(pass: object): pass is DitherablePass {
  return (
    "dithering" in pass &&
    typeof (pass as { readonly dithering: unknown }).dithering === "boolean"
  );
}

/**
 * Switch dithering on for the last pass in `passes` that has the property,
 * and say whether one does now. Written only when it is off: the setter marks
 * the pass's material for recompilation, so a flag rewritten every frame would
 * relink its program every frame, and a flag already on costs one read.
 */
export function ditherLastPass(passes: readonly object[]): boolean {
  for (let i = passes.length - 1; i >= 0; i--) {
    const pass = passes[i];
    if (!isDitherable(pass)) continue;
    if (!pass.dithering) pass.dithering = true;
    return true;
  }
  return false;
}
