import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { castalia } from "@/themes/worlds";
import { GLASS_ATTRIBUTES, createBeadGlassMaterial, wovenLight } from "./glass";
import { sceneBudget } from "./quality";

const glassSource = (): string =>
  readFileSync(new URL("./glass.ts", import.meta.url), "utf8");

const beadsSource = (): string =>
  readFileSync(new URL("./Beads.tsx", import.meta.url), "utf8");

/** Source with comments removed — a note recording what was removed is not it. */
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/**
 * A per-bead visible count of how many threads meet at it is a score readout in
 * the middle of the world. VERTICAL-SLICE-SPEC §19 excludes persistent counters
 * from core play and product law 7 forbids conventional gamification the spec
 * has not asked for. The bead used to wear up to four gold pips, one per
 * committed thread, arranged so they could be counted at a glance.
 *
 * Being woven is now a property of the material.
 */
describe("no countable degree marks on a bead", () => {
  it("draws no per-thread pips", () => {
    const source = code(glassSource());
    expect(source).not.toMatch(/pips?/i);
    // The tell of a countable mark: a fixed loop drawing one glyph per thread.
    expect(source).not.toMatch(/for \(int i = 0; i < 4; i\+\+\)/);
    expect(source).not.toMatch(/float degree/);
  });

  it("spends the third state channel on the material, not on a count", () => {
    expect(GLASS_ATTRIBUTES.state).toBe("aState");
    const source = glassSource();
    expect(source).toContain("float woven = clamp(vState.z, 0.0, 1.0);");
    // What the channel is allowed to change: how much light the glass carries
    // and how strongly it holds its figure. Never a drawn mark.
    expect(source).toMatch(/col = body \* \(0\.85 \+ [\d.]+ \* woven\)/);
    expect(source).toMatch(/ink \* \([\d.]+ \+ [\d.]+ \* woven\)/);
  });

  it("computes being-woven as a saturating quantity with no countable rungs", () => {
    expect(wovenLight(0)).toBe(0);
    expect(wovenLight(-3)).toBe(0);
    for (let degree = 1; degree < 24; degree++) {
      expect(wovenLight(degree)).toBeGreaterThan(wovenLight(degree - 1));
      expect(wovenLight(degree)).toBeLessThan(1);
    }
    // Diminishing returns: every additional thread changes the glass less than
    // the one before it, so the brightness never forms an evenly spaced ladder
    // a player could read a number off.
    for (let degree = 1; degree < 12; degree++) {
      const step = wovenLight(degree) - wovenLight(degree - 1);
      const next = wovenLight(degree + 1) - wovenLight(degree);
      expect(next).toBeLessThan(step);
    }
    // Continuous: the frame loop eases through the values between two degrees.
    expect(wovenLight(1.5)).toBeGreaterThan(wovenLight(1));
    expect(wovenLight(1.5)).toBeLessThan(wovenLight(2));
  });

  it("never lets the raw thread count reach the shader", () => {
    const source = beadsSource();
    // The count is a working number on its way to a material target; the
    // buffer the instanced draw reads gets `wovenLight`, eased over time.
    expect(source).toContain("woven.set(id, wovenLight(count))");
    expect(source).not.toMatch(/state\[i \* 4 \+ 2\] = /);
    expect(source).toMatch(/state\[i \* 4 \+ 2\] \+=/);
  });
});

describe("the bead glass honours reduced motion", () => {
  const budget = sceneBudget("high");

  it("carries a motion uniform that a preference actually sets", () => {
    const still = createBeadGlassMaterial({
      theme: castalia,
      budget,
      reducedMotion: true,
    });
    const moving = createBeadGlassMaterial({
      theme: castalia,
      budget,
      reducedMotion: false,
    });
    expect(still.uniforms.uMotion.value).toBe(0);
    expect(moving.uniforms.uMotion.value).toBe(1);
    still.dispose();
    moving.dispose();
  });

  it("changes nothing else — a still figure is the same figure", () => {
    const still = createBeadGlassMaterial({
      theme: castalia,
      budget,
      reducedMotion: true,
    });
    const moving = createBeadGlassMaterial({
      theme: castalia,
      budget,
      reducedMotion: false,
    });
    for (const key of Object.keys(moving.uniforms)) {
      if (key === "uMotion") continue;
      expect(JSON.stringify(still.uniforms[key].value)).toBe(
        JSON.stringify(moving.uniforms[key].value)
      );
    }
    expect(still.defines).toEqual(moving.defines);
    still.dispose();
    moving.dispose();
  });

  it("routes the figure's whole clock through that uniform", () => {
    const source = glassSource();
    expect(source).toContain("float aTime = uTime * uMotion;");
    // Every remaining mention of uTime is the declaration, the alias, and the
    // uniform seed: no branch may quietly keep its own animation running.
    const uses =
      source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "")
        .match(/uTime/g) ?? [];
    expect(uses).toHaveLength(3);
    expect(source).toMatch(/gbgFigure\(q, vSigil, aTime,/);
  });

  it("is wired from the player's preference, not from a constant", () => {
    expect(beadsSource()).toContain("reducedMotion: profile.reducedMotion");
  });
});
