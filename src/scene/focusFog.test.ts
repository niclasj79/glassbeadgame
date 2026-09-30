import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { QualityTier } from "@/lib/device";
import { RESONANCE_BANDS, type ResonanceBand } from "@/domain/relations/resonance";
import { deriveFocusView } from "@/runtime/interactionDraft";
import { toConceptId } from "@/domain/ids";
import {
  CLARITY_EPSILON,
  FOG_BEAD_STRIDE,
  FOG_EASE_SECONDS,
  FOG_FLOOR,
  FOG_LEVELS,
  FOG_MAX_CIRCLES,
  FOG_MAX_LUMINANCE_RATE,
  LENS_DAMPING_SECONDS,
  LENS_DIAMETER,
  NAME_CLEAR_FROM,
  approach,
  buildFogCircles,
  clarityForLevel,
  createFogEase,
  fogClarityTarget,
  fogLevelForBand,
  fogPixel,
  fogTreatment,
  lensShape,
  nameClarity,
  stepClarity,
  stepFogEase,
  stepLens,
} from "./focusFog";
import { sceneBudget } from "./quality";
import { COMFORT } from "./threadGrammar";

/**
 * I-017 — THE FOCUS FOG
 *
 * "The world dims and softens into fog; the attended bead stays sharp. Other
 * beads glow through the fog by their relation-neutral band — high brightest,
 * weak never below a visible floor — so nothing hides and nothing is
 * nominated. Under reduced motion ... fog is dim-only. On the low quality tier
 * fog is dim-only with no blur. Nothing flickers."
 */

const TIERS: readonly QualityTier[] = ["high", "base", "potato"];

/** How bright a bead of `band` is drawn once the fog has settled: dim-only, full fog, on black. */
const settledBrightness = (sharp: boolean, band: ResonanceBand | null): number =>
  fogPixel(1, 1, 0, 1, fogClarityTarget(sharp, band), 0);

/** The pass's disc, restated: fully clear inside the core, fog at the rim. */
const clearDisc = (distance: number, outer: number, core: number, strength: number) => {
  const d = distance / outer;
  const t = Math.min(1, Math.max(0, (d - core) / (1 - core)));
  return strength * (1 - t * t * (3 - 2 * t));
};

describe("how bright a bead is drawn in the fog", () => {
  it("is a function of the band alone", () => {
    // One argument, and it is the band: no documented flag, no source count,
    // no fit can reach it (CAV-003, CAV-004).
    expect(fogLevelForBand.length).toBe(1);
    for (const band of RESONANCE_BANDS) {
      expect(fogLevelForBand(band)).toBe(FOG_LEVELS[band]);
      expect(fogClarityTarget(false, band)).toBe(clarityForLevel(FOG_LEVELS[band]));
    }
    expect(FOG_LEVELS).toEqual({ high: 0.7, medium: 0.45, weak: 0.25 });
  });

  it("draws each band at its level of roaming brightness, high brightest", () => {
    for (const band of RESONANCE_BANDS) {
      expect(settledBrightness(false, band)).toBeCloseTo(FOG_LEVELS[band], 9);
    }
    expect(settledBrightness(false, "high")).toBeGreaterThan(settledBrightness(false, "medium"));
    expect(settledBrightness(false, "medium")).toBeGreaterThan(settledBrightness(false, "weak"));
  });

  it("never lets a bead fall below a visible floor", () => {
    // The floor is never lower than 0.2 (M2-012), and it is the fog itself:
    // a bead with no band at all stands in the fog at the floor, visible.
    expect(FOG_FLOOR).toBeGreaterThanOrEqual(0.2);
    expect(settledBrightness(false, null)).toBeCloseTo(FOG_FLOOR, 9);
    for (const band of [...RESONANCE_BANDS, null]) {
      expect(fogLevelForBand(band)).toBeGreaterThanOrEqual(FOG_FLOOR);
      expect(settledBrightness(false, band)).toBeGreaterThanOrEqual(FOG_FLOOR - 1e-9);
    }
    // Even a weak band glows above the fog it stands in.
    expect(settledBrightness(false, "weak")).toBeGreaterThan(settledBrightness(false, null));
  });

  it("keeps a sharp bead exactly as it is in clear air", () => {
    for (const band of [...RESONANCE_BANDS, null]) {
      expect(fogClarityTarget(true, band)).toBe(1);
      expect(settledBrightness(true, band)).toBe(1);
    }
    // …and so does anything at all while the fog is not there.
    expect(fogPixel(0.6, 0.1, 0.02, 0, 0, 1)).toBe(0.6);
  });

  it("dims toward the page's own ground, never toward black", () => {
    // A pixel that is already the ground stays the ground: the page is not
    // dyed darker than its deepest ink.
    const ground = 0.013;
    expect(fogPixel(ground, ground, ground, 1, 0, 1)).toBeCloseTo(ground, 12);
    expect(fogPixel(0.8, 0.8, ground, 1, 0, 0)).toBeCloseTo(
      ground + (0.8 - ground) * FOG_FLOOR,
      12
    );
  });
});

describe("when the fog is dim-only", () => {
  it("withholds the softening under reduced motion and on the engraved tier", () => {
    for (const tier of TIERS) {
      for (const reducedMotion of [false, true]) {
        const taps = fogTreatment(sceneBudget(tier), reducedMotion).blurTaps;
        const dimOnly = reducedMotion || tier === "potato";
        expect(`${tier}/${reducedMotion} ${taps === 0}`).toBe(`${tier}/${reducedMotion} ${dimOnly}`);
        if (!dimOnly) expect([9, 13]).toContain(taps);
      }
    }
  });

  it("says what the focus view says, for every tier and preference", () => {
    // The pass compiles a softening exactly when `deriveFocusView` says the fog
    // is softened: the two can never disagree.
    const attended = toConceptId("measure.fibonacci-sequence");
    for (const tier of TIERS) {
      for (const reducedMotion of [false, true]) {
        const view = deriveFocusView({
          draft: { stage: "attending", attendedConceptId: attended },
          sightedConceptId: null,
          dwellConceptId: null,
          previewIntention: null,
          reopened: null,
          holding: false,
          profile: { reducedMotion, qualityTier: tier },
        });
        expect(view.fog.active).toBe(true);
        expect(fogTreatment(sceneBudget(tier), reducedMotion).blurTaps > 0).toBe(
          view.fog.blur
        );
      }
    }
  });

  it("dims without softening when there is no softening to draw", () => {
    // With the softening at 0 the frame's neighbours cannot reach the pixel.
    expect(fogPixel(0.7, 0, 0.01, 1, 0.3, 0)).toBe(fogPixel(0.7, 1, 0.01, 1, 0.3, 0));
  });
});

describe("nothing in the fog flickers (CAV-007)", () => {
  const FRAME_RATES = [60, 20] as const;

  it("bounds every change below the steepest slope of a flicker at the ceiling", () => {
    expect(COMFORT.maxLuminanceHz).toBe(3);
    expect(FOG_MAX_LUMINANCE_RATE).toBeCloseTo(Math.PI * 3, 12);
  });

  it("eases the fog in and out without a single frame exceeding the bound", () => {
    for (const hz of FRAME_RATES) {
      const dt = 1 / hz;
      const bound = FOG_MAX_LUMINANCE_RATE * dt;
      const ease = createFogEase();
      for (const target of [1, 0, 1]) {
        let previous = fogPixel(1, 1, 0, ease.amount, 0, 0);
        for (let frame = 0; frame < hz * 2; frame++) {
          stepFogEase(ease, target, dt);
          const now = fogPixel(1, 1, 0, ease.amount, 0, 0);
          expect(Math.abs(now - previous)).toBeLessThanOrEqual(bound + 1e-12);
          previous = now;
        }
        expect(ease.amount).toBe(target);
      }
    }
  });

  it("takes about half a second, and never less however it is asked", () => {
    const ease = createFogEase();
    let frames = 0;
    while (ease.amount < 1 && frames < 1000) {
      stepFogEase(ease, 1, 1 / 60, 0.05);
      frames++;
    }
    expect(frames / 60).toBeGreaterThanOrEqual(FOG_EASE_SECONDS - 1e-9);
    expect(frames / 60).toBeLessThan(FOG_EASE_SECONDS + 0.05);
  });

  it("lifts over the commit's own performance when asked to", () => {
    const ease = createFogEase();
    for (let i = 0; i < 60; i++) stepFogEase(ease, 1, 1 / 60);
    let frames = 0;
    while (ease.amount > 0 && frames < 1000) {
      stepFogEase(ease, 0, 1 / 60, 3);
      frames++;
    }
    expect(frames / 60).toBeGreaterThan(2.9);
  });

  it("keeps the worst combined change inside the bound: fog, a disc and the softening at once", () => {
    for (const hz of FRAME_RATES) {
      const dt = 1 / hz;
      const bound = FOG_MAX_LUMINANCE_RATE * dt;
      const ease = createFogEase();
      let clarity = 1;
      let blur = 0;
      // The harshest pixel there is: full white over black, on a black ground,
      // with the fog arriving while its disc leaves and its softening arrives.
      let previous = fogPixel(1, 0, 0, ease.amount, clarity, blur);
      for (let frame = 0; frame < hz; frame++) {
        stepFogEase(ease, 1, dt);
        clarity = stepClarity(clarity, 0, dt);
        blur = stepClarity(blur, 1, dt);
        const now = fogPixel(1, 0, 0, ease.amount, clarity, blur);
        expect(Math.abs(now - previous)).toBeLessThanOrEqual(bound + 1e-12);
        previous = now;
      }
    }
  });

  it("filters the hand below the ceiling, and follows it exactly under reduced motion", () => {
    // A hand shaking the lens at twice the ceiling moves the disc much less
    // than a hand drifting it slowly; under reduced motion there is no lens
    // animation at all, so the disc is exactly where the hand is.
    const swing = (hz: number): number => {
      let at = 0;
      let peak = 0;
      const dt = 1 / 240;
      for (let frame = 0; frame < 240 * 4; frame++) {
        const t = frame * dt;
        at = stepLens(at, Math.sin(2 * Math.PI * hz * t), dt, false);
        if (t > 2) peak = Math.max(peak, Math.abs(at));
      }
      return peak;
    };
    expect(swing(6)).toBeLessThan(0.5);
    expect(swing(0.5)).toBeGreaterThan(0.9);
    expect(1 / (2 * Math.PI * LENS_DAMPING_SECONDS)).toBeCloseTo(COMFORT.maxLuminanceHz, 9);
    expect(stepLens(0.1, 0.9, 1 / 60, true)).toBe(0.9);
  });

  it("never overshoots a target", () => {
    expect(approach(0.9, 1, 0.5)).toBe(1);
    expect(approach(0.1, 0, 0.5)).toBe(0);
    expect(approach(0.5, 0.5, 0.5)).toBe(0.5);
    expect(approach(0.2, 1, -3)).toBe(0.2);
  });
});

describe("the discs of clear air", () => {
  /** A draw of `n` beads, every one on screen, with the clarities given. */
  const draw = (clarities: readonly number[], named: readonly boolean[] = []) => {
    const beads = new Float32Array(clarities.length * FOG_BEAD_STRIDE);
    clarities.forEach((clarity, i) => {
      const at = i * FOG_BEAD_STRIDE;
      beads[at] = 0.1 + i * 0.05;
      beads[at + 1] = 0.5;
      beads[at + 2] = 0.02;
      beads[at + 3] = clarity;
      if (named[i]) {
        beads[at + 5] = -0.04;
        beads[at + 6] = 0.05;
        beads[at + 7] = 0.012;
      }
    });
    return beads;
  };
  const solve = (beads: Float32Array, count: number, max = FOG_MAX_CIRCLES) => {
    const shape = new Float32Array(FOG_MAX_CIRCLES * 4);
    const weight = new Float32Array(FOG_MAX_CIRCLES * 2);
    const written = buildFogCircles(beads, count, new Int32Array(count), shape, weight, max);
    return { written, shape: [...shape], weight: [...weight] };
  };

  it("clears the sharpest first, each sharp name straight after its bead", () => {
    const beads = draw([0.3, 1, 0.0625, 1], [true, true, false, true]);
    const solved = solve(beads, 4);
    // Beads 1 and 3 are sharp and named, 0 is a high band (its name is not
    // cleared), 2 is weak: 1, name, 3, name, 0, 2.
    expect(solved.written).toBe(6);
    const strengths = [0, 1, 2, 3, 4, 5].map((k) => solved.weight[k * 2]);
    expect(strengths).toEqual([1, 1, 1, 1, 0.3, 0.0625].map((v) => Math.fround(v)));
    expect(solved.shape[0]).toBeCloseTo(0.15, 6);
    expect(solved.shape[4 * 2]).toBeCloseTo(0.25, 6);
  });

  it("gives a bead with nothing to clear no disc at all, and skips a bead not drawn", () => {
    const beads = draw([0, 0.5, 0]);
    expect(solve(beads, 3).written).toBe(1);
    beads[1 * FOG_BEAD_STRIDE + 2] = 0;
    expect(solve(beads, 3).written).toBe(0);
    expect(CLARITY_EPSILON).toBeGreaterThan(0);
  });

  it("is capped, whatever the draw", () => {
    const many = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? 1 : 0.4));
    const beads = draw(many, many.map(() => true));
    expect(solve(beads, 40).written).toBe(FOG_MAX_CIRCLES);
    expect(solve(beads, 40, 5).written).toBe(5);
    // …and it never writes past the arrays it was given.
    const shape = new Float32Array(3 * 4);
    const weight = new Float32Array(3 * 2);
    expect(buildFogCircles(beads, 40, new Int32Array(40), shape, weight)).toBe(3);
  });

  it("is the same list on every frame the same world is drawn", () => {
    const clarities = [0.3, 1, 0.3, 0.0625, 1, 0.3, 0.625];
    const named = clarities.map((c) => c === 1);
    const first = solve(draw(clarities, named), clarities.length);
    const second = solve(draw(clarities, named), clarities.length);
    expect(second).toEqual(first);
    // Ties keep the draw's own order: the three 0.3 beads in index order.
    const xs = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => first.shape[k * 4]);
    const tied = xs.filter((_, k) => first.weight[k * 2] === Math.fround(0.3));
    expect(tied).toEqual([...tied].sort((a, b) => a - b));
  });

  it("clears a name only once its bead is sharp, and smoothly", () => {
    expect(nameClarity(NAME_CLEAR_FROM)).toBe(0);
    expect(nameClarity(clarityForLevel(FOG_LEVELS.high))).toBe(0);
    expect(nameClarity(1)).toBe(1);
    let previous = 0;
    for (let c = NAME_CLEAR_FROM; c <= 1; c += 0.01) {
      const now = nameClarity(c);
      expect(now).toBeGreaterThanOrEqual(previous);
      expect(now - previous).toBeLessThan(0.05);
      previous = now;
    }
  });

  it("holds a sharp name's whole box inside the clear core", () => {
    const beads = draw([1], [true]);
    const solved = solve(beads, 1);
    const [cx, cy, ix, iy] = solved.shape.slice(4, 8);
    const core = solved.weight[3];
    // The box's corner, relative to the ellipse's centre.
    const hx = 0.05;
    const hy = 0.012;
    const corner = Math.hypot(hx * ix, hy * iy);
    expect(corner).toBeLessThanOrEqual(core + 1e-6);
    expect(cx).toBeCloseTo(0.1, 6);
    expect(cy).toBeCloseTo(0.46, 6);
  });

  it("makes the lens a disc a sixth of the page wide, half clear at its edge", () => {
    for (const aspect of [16 / 9, 1, 414 / 896]) {
      const shape = lensShape(aspect);
      // In the pass's space one unit is the page's height, so a twelfth of
      // the width is aspect / 12.
      const half = (LENS_DIAMETER * aspect) / 2;
      expect(half).toBeCloseTo(aspect / 12, 12);
      expect(clearDisc(half, shape.radius, shape.core, 1)).toBeCloseTo(0.5, 9);
      expect(clearDisc(0, shape.radius, shape.core, 1)).toBe(1);
      expect(clearDisc(shape.radius, shape.radius, shape.core, 1)).toBe(0);
    }
    // The beads the lens *names* are the beads inside that same half-clear
    // edge, measured by the pass itself, so the names and the clear air agree.
    const pass = readFileSync(new URL("./focusFogPass.ts", import.meta.url), "utf8");
    expect(pass).toContain("const lensReach = (LENS_DIAMETER * ratio) / 2;");
    expect(pass).toMatch(/this\.lensOn && Math\.hypot\(x - lensX, y - lensY\) < lensReach/);
  });
});

describe("the pass that draws it", () => {
  const passSource = (): string =>
    readFileSync(new URL("./focusFogPass.ts", import.meta.url), "utf8");
  const slotSource = (): string =>
    readFileSync(new URL("./FocusFogEffect.tsx", import.meta.url), "utf8");
  const effectsSource = (): string =>
    readFileSync(new URL("./Effects.tsx", import.meta.url), "utf8");

  it("draws exactly the arithmetic above", () => {
    const source = passSource();
    expect(source).toContain("mix(fogged, softened(uv, inputColor.rgb), uBlur)");
    expect(source).toContain("vec3 dimmed = uGround + (fogged - uGround) * uFloor;");
    expect(source).toContain("vec3 veiled = mix(dimmed, inputColor.rgb, clear);");
    expect(source).toContain("mix(inputColor.rgb, veiled, uAmount)");
    // The softening is compiled only when there is one to draw.
    expect(source).toContain("#if FOG_TAPS > 0");
  });

  it("costs nothing in clear air, and is never the composer's last pass", () => {
    // The composer holds a slot that is switched off whenever the air is
    // clear — and, until the fog has been fetched, always.
    expect(passSource()).toContain("this.host.enabled = active || amount > 0;");
    expect(slotSource()).toMatch(/super\("FocusFogSlot"\);\s*this\.enabled = false;/);
    const effects = effectsSource();
    const fog = effects.indexOf("<FocusFogPass />");
    const bloom = effects.search(/<Bloom\s/);
    expect(fog).toBeGreaterThan(-1);
    expect(bloom).toBeGreaterThan(fog);
  });

  it("is fetched after the first paint, into a place held from the first frame", () => {
    const slot = slotSource();
    expect(slot).toContain('import("./focusFogPass")');
    // Only a type crosses into the first download.
    expect(slot).toContain('import type { FocusFog } from "./focusFogPass";');
    expect(slot).not.toMatch(/from "\.\/focusFog"/);
    expect(slot).toContain("const [slot] = useState(() => new FocusFogSlot());");
  });

  it("reads its levels from the bands and nothing else", () => {
    const source = passSource();
    expect(source).toContain(
      "fogClarityTarget(isSharp(view, table.ids[i]), table.bands[i] ?? null)"
    );
    expect(source).not.toMatch(/documented|evidence|sourceCount/i);
  });
});
