import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BloomEffect, EffectPass, Pass, RenderPass } from "postprocessing";
import { ditherLastPass } from "./dither";

/**
 * M4-003 — THE FINAL PASS DITHERS, THROUGH EVERY REBUILD.
 *
 * The passes here are postprocessing's own classes, constructed without a
 * renderer, so the property this relies on (`EffectPass.dithering`, a setter
 * over its material) is the real one. The composer is a fake that rebuilds the
 * way the r3f composer does: in its layout effect, on every change of its
 * children, removing the old passes and adding new ones — so a tier change
 * hands the frame a bloom pass that has never dithered.
 */

/** The fog's place-holder: a plain pass, which cannot dither. */
class SlotPass extends Pass {
  constructor() {
    super("FocusFogSlot");
    this.enabled = false;
  }
}

const TIER_LEVELS = { high: 6, base: 4, potato: 3 } as const;
type Tier = keyof typeof TIER_LEVELS;

/** An `EffectPass` that counts how often its dithering flag is written. */
function countedPass(camera: THREE.Camera, tier: Tier): { pass: EffectPass; writes: () => number } {
  const pass = new EffectPass(camera, new BloomEffect({ mipmapBlur: true, levels: TIER_LEVELS[tier] }));
  const descriptor = Object.getOwnPropertyDescriptor(EffectPass.prototype, "dithering");
  if (!descriptor?.get || !descriptor.set) throw new Error("EffectPass.dithering is not an accessor");
  const { get, set } = descriptor;
  let writes = 0;
  Object.defineProperty(pass, "dithering", {
    configurable: true,
    get(this: EffectPass) {
      return get.call(this) as boolean;
    },
    set(this: EffectPass, value: boolean) {
      writes += 1;
      set.call(this, value);
    },
  });
  return { pass, writes: () => writes };
}

/** The r3f composer, as far as its passes go. */
function fakeComposer() {
  const camera = new THREE.PerspectiveCamera();
  const scene = new THREE.Scene();
  const render = new RenderPass(scene, camera);
  const slot = new SlotPass();
  const composer = { passes: [render] as Pass[] };
  let built: Pass[] = [];
  let current: ReturnType<typeof countedPass> | null = null;
  /** The layout effect: tear the old passes down, add the new children's. */
  const build = (tier: Tier) => {
    composer.passes = composer.passes.filter((pass) => !built.includes(pass));
    current = countedPass(camera, tier);
    built = [slot, current.pass];
    composer.passes.push(...built);
  };
  /** One frame: the driver at priority 0, then the composer renders. */
  const frame = (): boolean => {
    ditherLastPass(composer.passes);
    const last = composer.passes[composer.passes.length - 1] as EffectPass;
    return last.dithering && (last.fullscreenMaterial as THREE.ShaderMaterial).dithering;
  };
  return {
    composer,
    build,
    frame,
    writes: () => current?.writes() ?? 0,
    bloomPass: () => current?.pass ?? null,
  };
}

describe("dithering the last pass", () => {
  it("switches on the last pass that can dither, and says so", () => {
    const camera = new THREE.PerspectiveCamera();
    const bloom = new EffectPass(camera, new BloomEffect());
    const passes = [new RenderPass(new THREE.Scene(), camera), new SlotPass(), bloom];
    expect(bloom.dithering).toBe(false);
    expect(ditherLastPass(passes)).toBe(true);
    expect(bloom.dithering).toBe(true);
    // The flag is the material's: three compiles the dithering include in.
    expect((bloom.fullscreenMaterial as THREE.ShaderMaterial).dithering).toBe(true);
  });

  it("dithers only the last one, and passes over what cannot dither", () => {
    const camera = new THREE.PerspectiveCamera();
    const earlier = new EffectPass(camera, new BloomEffect());
    const last = new EffectPass(camera, new BloomEffect());
    expect(ditherLastPass([earlier, last, new SlotPass()])).toBe(true);
    expect(last.dithering).toBe(true);
    expect(earlier.dithering).toBe(false);
  });

  it("reports false when nothing can dither", () => {
    const camera = new THREE.PerspectiveCamera();
    expect(ditherLastPass([])).toBe(false);
    expect(ditherLastPass([new RenderPass(new THREE.Scene(), camera), new SlotPass()])).toBe(false);
  });

  it("never rewrites a flag that is already on: the setter recompiles the pass", () => {
    const { pass, writes } = countedPass(new THREE.PerspectiveCamera(), "base");
    for (let i = 0; i < 120; i++) ditherLastPass([pass]);
    expect(pass.dithering).toBe(true);
    expect(writes()).toBe(1);
  });
});

describe("through the composer's rebuilds", () => {
  it("renders the first frame after the passes are built dithered", () => {
    const world = fakeComposer();
    world.build("base");
    expect(world.bloomPass()?.dithering).toBe(false);
    expect(world.frame()).toBe(true);
  });

  it("re-applies it after a tier change reconstructs the bloom", () => {
    const world = fakeComposer();
    world.build("high");
    expect(world.frame()).toBe(true);
    const before = world.bloomPass();
    for (const tier of ["base", "potato", "high"] as const) {
      world.build(tier);
      // A new pass, which has never dithered…
      expect(world.bloomPass()).not.toBe(before);
      expect(world.bloomPass()?.dithering).toBe(false);
      // …and the frame after the rebuild is dithered.
      expect(world.frame()).toBe(true);
      // Held for many frames with one write per rebuild, never one per frame.
      for (let i = 0; i < 60; i++) expect(world.frame()).toBe(true);
      expect(world.writes()).toBe(1);
    }
    // The fog slot is still before the bloom, and the bloom is still last.
    const passes = world.composer.passes;
    expect(passes[passes.length - 1]).toBe(world.bloomPass());
    expect(passes[passes.length - 2]).toBeInstanceOf(SlotPass);
  });
});
