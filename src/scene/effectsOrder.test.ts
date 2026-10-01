import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  BloomEffect,
  BrightnessContrastEffect,
  ChromaticAberrationEffect,
  Effect,
  EffectAttribute,
  EffectPass,
  HueSaturationEffect,
  NoiseEffect,
  Pass,
  SMAAEffect,
  VignetteEffect,
} from "postprocessing";

/**
 * M4-003 — ONE PASS FOR ALL SCREEN EFFECTS.
 *
 * The composer's children are the fog slot, then the bloom, then only
 * non-convolution effects: no `Pass` child after the fog slot, nothing
 * convolution after the bloom. The order is a fact about the source, so it is
 * stated against the source; why it costs no pass is a fact about the r3f
 * composer, so its grouping is restated here over postprocessing's own classes.
 */

const effectsSource = (): string =>
  readFileSync(new URL("./Effects.tsx", import.meta.url), "utf8");

/** Source with comments removed — prose describing a child is not a child. */
const code = (text: string): string =>
  text
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

/** The element names mounted inside the composer, in order, at any depth. */
function composerChildren(source: string): string[] {
  const text = code(source);
  const open = text.indexOf("<EffectComposer");
  const close = text.indexOf("</EffectComposer>");
  expect(open).toBeGreaterThan(-1);
  expect(close).toBeGreaterThan(open);
  const inner = text.slice(text.indexOf(">", open) + 1, close);
  return [...inner.matchAll(/<([A-Za-z][A-Za-z0-9.]*)/g)].map((match) => match[1]);
}

/**
 * The non-convolution effects the rule admits after the bloom, by the name the
 * composer's child would carry. Each is proven non-convolution below against
 * postprocessing's own class, so the list cannot quietly admit a pass-maker.
 * An effect not listed here fails the scan until someone has looked at it.
 */
const MERGEABLE: Readonly<Record<string, () => Effect>> = {
  Vignette: () => new VignetteEffect(),
  Noise: () => new NoiseEffect(),
  BrightnessContrast: () => new BrightnessContrastEffect(),
  HueSaturation: () => new HueSaturationEffect(),
};

const isConvolution = (effect: Effect): boolean =>
  (effect.getAttributes() & EffectAttribute.CONVOLUTION) === EffectAttribute.CONVOLUTION;

/**
 * The r3f composer's grouping, restated from `@react-three/postprocessing`'s
 * `EffectComposer`: an `Effect` child opens a pass and, unless it is
 * convolution, takes every following non-convolution effect into it; a `Pass`
 * child is added as it is.
 */
function composedPasses(children: readonly (Effect | Pass)[], camera: THREE.Camera): Pass[] {
  const passes: Pass[] = [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child instanceof Effect) {
      const effects: Effect[] = [child];
      if (!isConvolution(child)) {
        let next: Effect | Pass | undefined;
        while ((next = children[i + 1]) instanceof Effect) {
          if (isConvolution(next)) break;
          effects.push(next);
          i++;
        }
      }
      passes.push(new EffectPass(camera, ...effects));
    } else {
      passes.push(child);
    }
  }
  return passes;
}

class SlotPass extends Pass {
  constructor() {
    super("FocusFogSlot");
  }
}

describe("the composer's children", () => {
  it("are the fog slot, then the bloom, then only mergeable effects", () => {
    const children = composerChildren(effectsSource());
    expect(children[0]).toBe("FocusFogPass");
    expect(children[1]).toBe("Bloom");
    for (const child of children.slice(2)) {
      // No pass after the fog slot: neither a pass component nor a primitive,
      // which is how an arbitrary pass object is mounted.
      expect(child).not.toMatch(/Pass$/);
      expect(child).not.toBe("primitive");
      // Nothing convolution after the bloom.
      expect(Object.keys(MERGEABLE)).toContain(child);
    }
    // One fog slot and one bloom: a second of either is a second pass.
    expect(children.filter((child) => child === "FocusFogPass")).toHaveLength(1);
    expect(children.filter((child) => child === "Bloom")).toHaveLength(1);
  });

  it("admits after the bloom only effects that are not convolution", () => {
    for (const [name, make] of Object.entries(MERGEABLE)) {
      expect(`${name} ${isConvolution(make()) ? "convolution" : "mergeable"}`).toBe(
        `${name} mergeable`
      );
    }
    // The bloom itself is not convolution — its blur is its own mip passes —
    // which is what lets effects after it share its pass.
    expect(isConvolution(new BloomEffect({ mipmapBlur: true }))).toBe(false);
    // And these would not merge: each would cost the frame another pass.
    expect(isConvolution(new ChromaticAberrationEffect())).toBe(true);
    expect(isConvolution(new SMAAEffect())).toBe(true);
  });

  it("states the rule in the composer's header", () => {
    const source = effectsSource();
    expect(source).toContain("ONE PASS FOR ALL SCREEN EFFECTS");
    expect(source).toContain("no `Pass` child after the fog slot");
    expect(source).toContain("nothing convolution after the bloom");
  });
});

describe("why the rule costs no pass", () => {
  const camera = new THREE.PerspectiveCamera();

  it("merges the bloom and every non-convolution effect after it into one pass", () => {
    const passes = composedPasses(
      [new SlotPass(), new BloomEffect(), new VignetteEffect(), new NoiseEffect()],
      camera
    );
    expect(passes).toHaveLength(2);
    expect(passes[0]).toBeInstanceOf(SlotPass);
    expect(passes[1]).toBeInstanceOf(EffectPass);
  });

  it("pays a pass for anything convolution, and for a pass child", () => {
    expect(
      composedPasses([new SlotPass(), new BloomEffect(), new ChromaticAberrationEffect()], camera)
    ).toHaveLength(3);
    expect(
      composedPasses([new SlotPass(), new BloomEffect(), new SlotPass()], camera)
    ).toHaveLength(3);
  });
});

describe("the dither", () => {
  it("is applied to the composer's passes from the frame loop, through its ref", () => {
    const text = code(effectsSource());
    expect(text).toContain("<EffectComposer ref={composerRef}");
    expect(text).toMatch(
      /useFrame\(\(\) => \{\s*const composer = composerRef\.current;\s*if \(composer\) ditherLastPass\(composer\.passes\);\s*\}\);/
    );
    // The driver is mounted with the composer, not inside it: it is not a pass.
    const children = composerChildren(effectsSource());
    expect(children).not.toContain("DitherDriver");
    expect(text).toContain("<DitherDriver composerRef={composerRef} />");
  });
});
