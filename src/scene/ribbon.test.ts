import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { RELATION_INTENTIONS } from "@/domain/events";
import { castalia } from "@/themes/worlds";
import { createRibbonMaterial } from "./ribbon";
import { COMFORT, threadForm } from "./threadGrammar";

const source = (file: string): string =>
  readFileSync(new URL(`./${file}`, import.meta.url), "utf8");

/** Source with comments removed — prose about a uniform is not a use of it. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const material = (intention: (typeof RELATION_INTENTIONS)[number], still: boolean) =>
  createRibbonMaterial({
    theme: castalia,
    form: threadForm(intention),
    ink: new THREE.Color("#ffffff"),
    width: 0.022,
    opacity: 0.9,
    reducedMotion: still,
  });

/**
 * VERTICAL-SLICE-SPEC §22 makes reduced motion a required, first-class path,
 * and CAV-007 says what it may and may not do: the reduced-motion route
 * expresses Tension "through pattern, phase text, and stereo width instead of
 * movement and glare — never by removing the Tension."
 *
 * Every shader written for the thread grammar ignored the preference
 * completely: the ribbon's sway, its travelling ticks, its chevrons and its
 * hatch all ran off `uTime` whatever the player had asked for. Reduced motion
 * has to reach the GPU, and it has to stop at travel and oscillation.
 */
describe("the thread ribbon honours reduced motion", () => {
  it("carries a motion uniform that the preference actually sets", () => {
    const still = material("tension", true);
    const moving = material("tension", false);
    expect(still.uniforms.uMotion.value).toBe(0);
    expect(moving.uniforms.uMotion.value).toBe(1);
    still.dispose();
    moving.dispose();
  });

  it("takes away the travel and nothing else", () => {
    for (const intention of RELATION_INTENTIONS) {
      const still = material(intention, true);
      const moving = material(intention, false);
      for (const key of Object.keys(moving.uniforms)) {
        if (key === "uMotion") continue;
        expect(JSON.stringify(still.uniforms[key].value)).toBe(
          JSON.stringify(moving.uniforms[key].value)
        );
      }
      still.dispose();
      moving.dispose();
    }
  });

  it("keeps the Tension a Tension when it is standing still", () => {
    // Construction, bound and beat are untouched: with uMotion at 0 the sway
    // term becomes sin(t * 2.1) — a *static* counter-rotation that still
    // varies along the arc and still opposes between the two strands, at
    // CAV-007's amplitude. The relation is held, not removed.
    const still = material("tension", true);
    expect(still.uniforms.uStrands.value).toBe(2);
    expect(still.uniforms.uTorsion.value).toBeCloseTo(
      COMFORT.maxTorsionRadians,
      12
    );
    expect(still.uniforms.uBeat.value).toBeGreaterThan(0);
    expect(still.uniforms.uOpacity.value).toBe(0.9);
    still.dispose();

    const shader = code(source("ribbon.ts"));
    expect(shader).toContain(
      "float sway = uTorsion * uUnrest * sin(GBG_TAU * uBeat * aTime + t * 2.1) * aStrand;"
    );
    expect(shader).toContain("float angle = wind + sway;");
  });

  it("routes every animated expression in both shaders through the uniform", () => {
    const shader = code(source("ribbon.ts"));
    // Two shader stages, each aliasing the clock once…
    expect(shader.match(/float aTime = uTime \* uMotion;/g)).toHaveLength(2);
    // …and uTime appearing nowhere else: two `uniform` declarations, the two
    // aliases themselves, and the uniform's seed. Five, and no sixth.
    expect(shader.match(/uTime/g)).toHaveLength(5);
    // The marks are still drawn — they simply stop travelling.
    expect(shader).toMatch(/fract\(closure \* 5\.0 - aTime \* uTravel\)/);
    expect(shader).toMatch(/aTime \* uTravel \* 3\.0/);
    expect(shader).toMatch(/aTime \* 0\.16 \* slope/);
  });

  it("is wired from the player's preference, not from a constant", () => {
    expect(source("Threads.tsx")).toContain(
      "reducedMotion: profile.reducedMotion"
    );
  });
});
