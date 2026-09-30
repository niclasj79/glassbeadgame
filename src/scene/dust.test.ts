import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARENA_RADIUS, fibonacciSpherePositions } from "@/game/layout";
import {
  DUST_ALPHA,
  DUST_DRIFT_AMPLITUDE,
  DUST_DRIFT_PERIOD_S,
  DUST_DRIFT_RATE,
  DUST_FRAGMENT,
  DUST_MAX_BEADS,
  DUST_RING_BAND,
  DUST_RING_LIFE,
  DUST_RING_PUSH,
  DUST_RING_RISE,
  DUST_RING_SPEED,
  DUST_RING_THRESHOLD,
  DUST_SEED,
  DUST_SHELL,
  DUST_SIZE,
  DUST_VERTEX,
  buildDust,
  createRingClock,
  dustAlpha,
  dustPosition,
  resetRingClock,
  ringClock,
  ringStrength,
} from "./dust";
import { MAX_BEAD_EXTENT, PRIME_SHELL } from "./rings";
import { sceneBudget } from "./quality";
import { COMFORT } from "./threadGrammar";

/**
 * M4-003 — THE DUST FIELD.
 *
 * What can be proved without a renderer is proved on the pure module: where
 * the dust hangs, when a ring leaves a bead, how a ring lights and moves a
 * particle, and that reduced motion keeps the light and removes the travel.
 * Where the rule is *where* a read happens — every frame-state read in the
 * frame loop, and nothing allocated there — it is stated against the source,
 * as `stations.test.ts` does, because importing a component pulls a renderer
 * into a node suite.
 */

const source = (file: string): string =>
  readFileSync(new URL(`./${file}`, import.meta.url), "utf8");

/** Source with comments removed — prose describing a read is not the read. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** Every call to `callee`, argument list included, matched by parentheses. */
function calls(text: string, callee: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf(`${callee}(`, from);
    if (start < 0) return out;
    let depth = 0;
    let i = start + callee.length;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push(text.slice(start, i + 1));
    from = i + 1;
  }
}

const count = (text: string, pattern: RegExp): number =>
  (text.match(pattern) ?? []).length;

/** A shader array with one bead at `at` whose ring is `age` seconds old. */
function oneBead(at: readonly [number, number, number], age: number): Float32Array {
  const beads = new Float32Array(DUST_MAX_BEADS * 4);
  beads[0] = at[0];
  beads[1] = at[1];
  beads[2] = at[2];
  beads[3] = age;
  return beads;
}

describe("where the dust hangs", () => {
  it("stands between the instrument and the vault", () => {
    // Outside every bead and the armillary's outer ring; inside the drawn sky.
    expect(DUST_SHELL.inner).toBeGreaterThan(MAX_BEAD_EXTENT);
    expect(DUST_SHELL.inner).toBeGreaterThan(PRIME_SHELL);
    expect(DUST_SHELL.inner).toBeGreaterThan(ARENA_RADIUS);
    expect(DUST_SHELL.outer).toBeGreaterThan(DUST_SHELL.inner);
    expect(DUST_SHELL.outer).toBeLessThan(41);
  });

  it("places every particle inside the shell", () => {
    const field = buildDust(600);
    expect(field.positions).toHaveLength(600 * 3);
    for (let i = 0; i < 600; i++) {
      const r = Math.hypot(
        field.positions[i * 3],
        field.positions[i * 3 + 1],
        field.positions[i * 3 + 2]
      );
      expect(r).toBeGreaterThanOrEqual(DUST_SHELL.inner - 1e-4);
      expect(r).toBeLessThanOrEqual(DUST_SHELL.outer + 1e-4);
      expect(field.seeds[i]).toBeGreaterThanOrEqual(0);
      expect(field.seeds[i]).toBeLessThan(1);
      expect(field.sizes[i]).toBeGreaterThanOrEqual(DUST_SIZE.min - 1e-6);
      expect(field.sizes[i]).toBeLessThanOrEqual(DUST_SIZE.max + 1e-6);
    }
  });

  it("surrounds the instrument evenly rather than crowding one side", () => {
    const field = buildDust(600);
    let x = 0;
    let y = 0;
    let z = 0;
    for (let i = 0; i < 600; i++) {
      x += field.positions[i * 3];
      y += field.positions[i * 3 + 1];
      z += field.positions[i * 3 + 2];
    }
    // The centroid of an even shell is its centre; a lopsided one is not.
    expect(Math.hypot(x, y, z) / 600).toBeLessThan(1);
  });

  it("is thickest about the instrument and thins toward the vault", () => {
    const field = buildDust(600);
    const third = DUST_SHELL.inner + (DUST_SHELL.outer - DUST_SHELL.inner) / 3;
    let inner = 0;
    for (let i = 0; i < 600; i++) {
      const r = Math.hypot(
        field.positions[i * 3],
        field.positions[i * 3 + 1],
        field.positions[i * 3 + 2]
      );
      if (r < third) inner += 1;
    }
    // Uniform in radius: a third of the dust in the inner third of the shell,
    // against a tenth if it were even through the volume.
    expect(inner / 600).toBeGreaterThan(0.25);
    expect(inner / 600).toBeLessThan(0.42);
  });

  it("gives a bead's ring motes enough to be seen", () => {
    // Every bead of a sixteen-bead draw, at rest on the arena: how many motes
    // does its ring light past 0.15 of its strength on the base tier?
    const peak = (d: number): number => {
      let best = 0;
      for (let age = 0; age < DUST_RING_LIFE; age += 0.005) best = Math.max(best, ringStrength(d, age));
      return best;
    };
    const beads = fibonacciSpherePositions(16);
    const field = buildDust(sceneBudget("base").dust);
    let lit = 0;
    for (let b = 0; b < 16; b++) {
      for (let i = 0; i < field.seeds.length; i++) {
        const d = Math.hypot(
          field.positions[i * 3] - beads[b * 3],
          field.positions[i * 3 + 1] - beads[b * 3 + 1],
          field.positions[i * 3 + 2] - beads[b * 3 + 2]
        );
        if (peak(d) > 0.15) lit += 1;
      }
    }
    expect(lit / 16).toBeGreaterThan(5);
  });

  it("is the same air on every run, and the base tier is a thinning of the high one", () => {
    expect(buildDust(600)).toEqual(buildDust(600));
    expect(buildDust(600, DUST_SEED)).toEqual(buildDust(600));
    expect(buildDust(300, DUST_SEED + 1).positions).not.toEqual(buildDust(300).positions);
    const high = buildDust(600);
    const base = buildDust(300);
    expect(base.positions).toEqual(high.positions.slice(0, 300 * 3));
    expect(base.seeds).toEqual(high.seeds.slice(0, 300));
    expect(base.sizes).toEqual(high.sizes.slice(0, 300));
  });

  it("builds nothing for a tier with no dust", () => {
    const none = buildDust(0);
    expect(none.positions).toHaveLength(0);
    expect(none.seeds).toHaveLength(0);
    expect(none.sizes).toHaveLength(0);
  });
});

describe("a bead's ring", () => {
  it("leaves when the light rises through the threshold from below", () => {
    const clock = createRingClock();
    expect(ringClock(clock, 0.2, 10)).toBe(-1);
    expect(ringClock(clock, DUST_RING_THRESHOLD, 10.1)).toBe(-1);
    expect(ringClock(clock, 0.8, 10.2)).toBe(0);
    expect(ringClock(clock, 0.9, 10.5)).toBeCloseTo(0.3, 9);
  });

  it("does not leave for a light that is already up, or that never crosses", () => {
    const high = createRingClock();
    ringClock(high, 0.9, 0);
    // The first frame counted as the rise; let it end, with the light held.
    expect(ringClock(high, 0.9, DUST_RING_LIFE + 0.01)).toBe(-1);
    expect(ringClock(high, 0.95, DUST_RING_LIFE + 0.5)).toBe(-1);
    const low = createRingClock();
    for (let t = 0; t < 5; t += 0.1) expect(ringClock(low, 0.49, t)).toBe(-1);
  });

  it("is never restarted while it travels", () => {
    const clock = createRingClock();
    ringClock(clock, 0, 0);
    expect(ringClock(clock, 1, 1)).toBe(0);
    // The light falls and rises again mid-ring: the ring keeps its age.
    expect(ringClock(clock, 0.1, 1.4)).toBeCloseTo(0.4, 9);
    expect(ringClock(clock, 1, 1.6)).toBeCloseTo(0.6, 9);
    expect(ringClock(clock, 0.1, 2.0)).toBeCloseTo(1.0, 9);
    expect(ringClock(clock, 1, 2.2)).toBeCloseTo(1.2, 9);
  });

  it("ends after its life, and the next rise sends a new one", () => {
    const clock = createRingClock();
    ringClock(clock, 0, 0);
    expect(ringClock(clock, 1, 1)).toBe(0);
    expect(ringClock(clock, 0.2, 1 + DUST_RING_LIFE - 0.01)).toBeGreaterThan(0);
    expect(ringClock(clock, 0.2, 1 + DUST_RING_LIFE)).toBe(-1);
    expect(ringClock(clock, 0.9, 1 + DUST_RING_LIFE + 0.2)).toBe(0);
  });

  it("ends when the clock runs backwards, as a new draw resets it", () => {
    const clock = createRingClock();
    ringClock(clock, 0, 30);
    expect(ringClock(clock, 1, 30.1)).toBe(0);
    expect(ringClock(clock, 1, 0)).toBe(-1);
    resetRingClock(clock);
    expect(clock).toEqual(createRingClock());
  });

  it("takes no reduced-motion argument: the ring is light, and light is kept", () => {
    expect(ringClock.length).toBe(3);
  });
});

describe("how a ring lights the air", () => {
  const distances = Array.from({ length: 121 }, (_, i) => i * 0.1);
  const step = 1 / 1000;

  it("starts from nothing and ends in nothing: no particle steps", () => {
    for (const d of distances) {
      expect(ringStrength(d, 0)).toBe(0);
      expect(ringStrength(d, DUST_RING_LIFE)).toBe(0);
      expect(ringStrength(d, -1)).toBe(0);
    }
  });

  it("brightens a particle once per ring: one rise and one fall", () => {
    for (const d of distances) {
      let turns = 0;
      let rising = true;
      let previous = 0;
      let peak = 0;
      for (let t = step; t <= DUST_RING_LIFE; t += step) {
        const value = ringStrength(d, t);
        peak = Math.max(peak, value);
        // Relative, so a pulse far below anything visible is still judged.
        const tolerance = 1e-9 * Math.max(value, previous);
        if (rising && value < previous - tolerance) {
          rising = false;
          turns += 1;
        } else if (!rising && value > previous + tolerance) {
          rising = true;
          turns += 1;
        }
        previous = value;
      }
      // Beyond the ring's reach the strength underflows to nothing: no turn.
      expect(`${d.toFixed(1)}: ${turns}`).toBe(`${d.toFixed(1)}: ${peak > 0 ? 1 : 0}`);
      if (d <= DUST_RING_SPEED * DUST_RING_LIFE) expect(peak).toBeGreaterThan(0);
    }
  });

  it("stays under the comfort bound (CAV-007)", () => {
    // The packet's derivation: one rise and one fall per ring, and a ring is
    // never restarted while it travels, so a particle sees at most one cycle
    // per ring's life.
    expect(1 / DUST_RING_LIFE).toBeLessThan(COMFORT.maxLuminanceHz);
    // The band's own passage: the time it takes to cross a particle, rise and
    // fall, is a cycle slower than the bound.
    expect(DUST_RING_SPEED / (2 * DUST_RING_BAND)).toBeLessThan(COMFORT.maxLuminanceHz);
    // And sample by sample, at any amplitude the frame can show: no particle's
    // light changes faster than the steepest a 3 Hz swell of the same height
    // could, pi * f * height. A pulse that cannot move a pixel by one 8-bit
    // step — the darkest step there is, 1 / (255 x 12.92) in linear light,
    // with the whole ring's alpha on a white vellum — is not shown at all.
    const visible = 1 / (255 * 12.92) / DUST_ALPHA.ring;
    let judged = 0;
    for (let d = 0; d <= 12; d += 0.05) {
      let peak = 0;
      let steepest = 0;
      for (let t = 0; t <= DUST_RING_LIFE; t += step) {
        const value = ringStrength(d, t);
        peak = Math.max(peak, value);
        steepest = Math.max(steepest, Math.abs(ringStrength(d, t + step) - value) / step);
      }
      if (peak < visible) continue;
      judged += 1;
      expect(`${d.toFixed(2)}: ${steepest <= Math.PI * COMFORT.maxLuminanceHz * peak}`).toBe(
        `${d.toFixed(2)}: true`
      );
    }
    // The ring reaches well into the shell: this judged the dust it lights.
    expect(judged * 0.05).toBeGreaterThan(DUST_SHELL.inner - ARENA_RADIUS + 3);
  });

  it("travels outward at its speed", () => {
    const age = 0.8;
    const at = DUST_RING_SPEED * age;
    expect(ringStrength(at, age)).toBeGreaterThan(ringStrength(at - 1.5, age));
    expect(ringStrength(at, age)).toBeGreaterThan(ringStrength(at + 1.5, age));
  });

  it("is a whisper at rest, and never brighter than the stars", () => {
    // The faintest unaffiliated star peaks at (0.25 + 0.75 x 0.1) x 0.75, the
    // brightest at (0.25 + 0.75 x 0.32) x 0.75 (`Firmament.tsx`).
    const faintestStar = (0.25 + 0.75 * 0.1) * 0.75;
    const brightestFieldStar = (0.25 + 0.75 * 0.32) * 0.75;
    expect(dustAlpha(0, 0)).toBe(DUST_ALPHA.rest);
    expect(dustAlpha(0, 0)).toBeLessThanOrEqual(faintestStar / 4);
    expect(dustAlpha(1, 0)).toBeCloseTo(DUST_ALPHA.rest + DUST_ALPHA.ring, 12);
    expect(dustAlpha(4, 1)).toBe(DUST_ALPHA.ceiling);
    expect(DUST_ALPHA.ceiling).toBeLessThan(brightestFieldStar);
    // Attunement raises the rest level, as the sky's drawing comes forward.
    expect(dustAlpha(0, 1)).toBeGreaterThan(dustAlpha(0, 0));
  });
});

describe("reduced motion", () => {
  const rest: [number, number, number] = [5, 1, -3];
  const out: [number, number, number] = [0, 0, 0];

  it("holds the field still: no drift and no push", () => {
    const bead: [number, number, number] = [2.1, 0.9, -1.2];
    const d = Math.hypot(rest[0] - bead[0], rest[1] - bead[1], rest[2] - bead[2]);
    for (const time of [0, 3.7, 19, 1234.5]) {
      for (const age of [-1, 0.1, d / DUST_RING_SPEED, 1.5]) {
        dustPosition(rest, 0.37, time, 1, 0, oneBead(bead, age), 1, out);
        expect(out).toEqual(rest);
      }
    }
  });

  it("still brightens where a ring passes", () => {
    const bead: [number, number, number] = [4, 0.8, -2.4];
    const d = Math.hypot(rest[0] - bead[0], rest[1] - bead[1], rest[2] - bead[2]);
    const age = d / DUST_RING_SPEED;
    const still = dustPosition(rest, 0.37, 10, 1, 0, oneBead(bead, age), 1, out);
    expect(still).toBeCloseTo(ringStrength(d, age), 6);
    expect(still).toBeGreaterThan(0.3);
  });

  it("with motion, drifts within its amplitude and is pushed outward within its reach", () => {
    const none = oneBead([0, 0, 0], -1);
    for (let t = 0; t < DUST_DRIFT_PERIOD_S; t += 0.5) {
      dustPosition(rest, 0.61, t, 1, 1, none, 1, out);
      const moved = Math.hypot(out[0] - rest[0], out[1] - rest[1], out[2] - rest[2]);
      expect(moved).toBeLessThanOrEqual(DUST_DRIFT_AMPLITUDE * Math.sqrt(3) + 1e-9);
    }
    // At the ring's crest the particle is pushed away from the bead (with the
    // drift held by a stopped clock, so only the push moves it).
    const bead: [number, number, number] = [4, 0.8, -2.4];
    const from = (p: readonly number[]) =>
      Math.hypot(p[0] - bead[0], p[1] - bead[1], p[2] - bead[2]);
    const d = from(rest);
    const age = d / DUST_RING_SPEED;
    dustPosition(rest, 0.61, 0, 0, 1, oneBead(bead, age), 1, out);
    const outward = from(out) - d;
    expect(outward).toBeGreaterThan(0.5 * DUST_RING_PUSH * ringStrength(d, age));
    expect(outward).toBeLessThanOrEqual(DUST_RING_PUSH + 1e-9);
  });

  it("drifts at a rate far below anything watched", () => {
    expect(DUST_DRIFT_RATE / (2 * Math.PI)).toBeCloseTo(1 / DUST_DRIFT_PERIOD_S, 12);
    expect(1 / DUST_DRIFT_PERIOD_S).toBeLessThan(COMFORT.maxLuminanceHz / 50);
    // A few percent of the spacing between particles at the base tier.
    const volume = (4 / 3) * Math.PI * (DUST_SHELL.outer ** 3 - DUST_SHELL.inner ** 3);
    const spacing = Math.cbrt(volume / 300);
    expect(DUST_DRIFT_AMPLITUDE).toBeLessThan(spacing * 0.05);
  });
});

describe("the shader draws exactly that arithmetic", () => {
  it("declares the frame's inputs", () => {
    for (const uniform of [
      "uniform float uTime;",
      "uniform float uTimeScale;",
      "uniform float uAttuned;",
      "uniform float uMotion;",
      `uniform vec4 uBeads[${DUST_MAX_BEADS}];`,
      `uniform float uLights[${DUST_MAX_BEADS}];`,
      "uniform int uCount;",
    ]) {
      expect(DUST_VERTEX).toContain(uniform);
    }
    expect(DUST_FRAGMENT).toContain("uniform vec3 uVellum;");
  });

  it("has one time term, at the drift's rate", () => {
    expect(count(DUST_VERTEX, /uTime\b/g)).toBe(2); // the declaration and one use
    expect(DUST_VERTEX).toContain(`float theta = uTime * ${DUST_DRIFT_RATE};`);
    expect(count(DUST_FRAGMENT, /uTime/g)).toBe(0);
  });

  it("scales the drift and the push by motion, and nothing else", () => {
    expect(DUST_VERTEX).toMatch(/float reach = 0\.08 \* uMotion \* uTimeScale;/);
    expect(DUST_VERTEX).toContain("pos += push * (0.12 * uMotion);");
    expect(count(DUST_VERTEX, /uMotion/g)).toBe(3);
  });

  it("lights the ring as `ringStrength` does", () => {
    expect(DUST_VERTEX).toContain(`float x = (d - 3.0 * bead.w) / ${DUST_RING_BAND};`);
    expect(DUST_VERTEX).toContain(`smoothstep(0.0, ${DUST_RING_RISE}, bead.w)`);
    expect(DUST_VERTEX).toContain(`float left = max(0.0, 1.0 - bead.w / ${DUST_RING_LIFE});`);
    expect(DUST_VERTEX).toContain("* left * left;");
    expect(DUST_VERTEX).toContain("if (i >= uCount) break;");
    expect(DUST_VERTEX).toContain("if (bead.w < 0.0) continue;");
    expect(DUST_VERTEX).toContain(`${DUST_ALPHA.ceiling},`);
    expect(DUST_VERTEX).toContain(`${DUST_ALPHA.rest} + ${DUST_ALPHA.attuned} * uAttuned`);
    expect(DUST_VERTEX).toContain(`+ ${DUST_ALPHA.ring} * min(ring, 1.0)`);
  });

  it("carries no hue of its own and no time in the fragment", () => {
    expect(DUST_FRAGMENT).toContain("gl_FragColor = vec4(uVellum, alpha);");
  });
});

describe("the component", () => {
  const dust = (): string => code(source("Dust.tsx"));

  it("reads the frame state only inside the frame loop", () => {
    const text = dust();
    const loop = calls(text, "useFrame").join("\n");
    const total = count(text, /frameState\./g);
    expect(total).toBeGreaterThan(0);
    expect(count(loop, /frameState\./g)).toBe(total);
    for (const read of ["frameState.rendered", "frameState.kindling", "frameState.beadIndex", "frameState.clock", "frameState.timeScale"]) {
      expect(loop).toContain(read);
    }
  });

  it("allocates nothing in the frame loop", () => {
    const loop = calls(dust(), "useFrame").join("\n");
    expect(loop).not.toMatch(/\bnew\s/);
    expect(loop).not.toMatch(/\.(slice|map|filter|concat)\(|Array\.from|\[\.\.\.|\{\s*\.\.\./);
    // The bead arrays are the material's own, made once.
    expect(dust()).toContain("uBeads: { value: new Float32Array(DUST_MAX_BEADS * 4) }");
    expect(dust()).toContain("uLights: { value: new Float32Array(DUST_MAX_BEADS) }");
    expect(loop).toContain("uniforms.uBeads");
    expect(loop).toContain("uniforms.uLights");
    expect(loop).toContain("ringClock(clocks[i], light, now)");
  });

  it("is one points draw, transparent, writing no depth, off the tone map", () => {
    const text = dust();
    expect(count(text, /<points\b/g)).toBe(1);
    expect(text).not.toMatch(/<mesh\b|<lineSegments\b|<instancedMesh\b/);
    expect(count(text, /new THREE\.ShaderMaterial\(/g)).toBe(1);
    expect(text).toMatch(/transparent: true,\s*depthWrite: false,\s*toneMapped: false,/);
  });

  it("mounts nothing on a tier without dust", () => {
    const text = dust();
    expect(text).toContain("const count = sceneBudget(tier).dust;");
    expect(text).toContain("if (count <= 0) return null;");
  });

  it("stands beside the sky in the scene", () => {
    const cosmos = code(source("Cosmos.tsx"));
    const sky = cosmos.indexOf("<Firmament />");
    const air = cosmos.indexOf("<Dust />");
    expect(sky).toBeGreaterThan(-1);
    expect(air).toBeGreaterThan(sky);
    // Nothing but a comment stands between them.
    expect(cosmos.slice(sky + "<Firmament />".length, air).replace(/[\s{}]/g, "")).toBe("");
  });
});
