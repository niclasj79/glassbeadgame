import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createConductor } from "@/audio/conductor";
import { THEMES } from "@/themes";
import {
  FREE_BREATH_HZ,
  breathPhaseAfter,
  frameState,
  initFramePositions,
} from "./frameState";
import { COMFORT } from "./threadGrammar";

/**
 * ADR-016 — THE SCENE KEEPS THE CONDUCTOR'S TIME.
 *
 * The conductor is the scene's one read model of musical time. Four things
 * read it here: each bead's light on its own notes, the breath the bloom, the
 * bed, the sky and the lens all follow, the lens's breath itself, and the
 * camera's beat. What can be proved without a renderer is proved on pure
 * helpers against a real conductor on a fake clock; where the rule is *where*
 * a read happens — in the frame loop, once, and nowhere else — it is stated
 * against the source, as `stations.test.ts` and `cameraHold.test.ts` do,
 * because importing a component pulls a renderer into a node suite.
 */

const source = (file: string): string =>
  readFileSync(new URL(`./${file}`, import.meta.url), "utf8");

/** Source with comments removed — prose describing a read is not the read. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** Source with its import declarations removed, so a name counts only its uses. */
const withoutImports = (text: string): string =>
  text.replace(/^import[\s\S]*?;$/gm, "");

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

/** The frame loop(s) of a component, as one text. */
const frameLoop = (text: string): string => calls(text, "useFrame").join("\n");

const count = (text: string, pattern: RegExp): number =>
  (text.match(pattern) ?? []).length;

/** How many braces are open at `index` — 1 is the frame callback's own body. */
function braceDepth(text: string, index: number): number {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") depth--;
  }
  return depth;
}

/** A clock the test moves by hand, in seconds. */
function clockAt(start: number): { now: () => number; set: (t: number) => void } {
  let t = start;
  return {
    now: () => t,
    set: (next) => {
      t = next;
    },
  };
}

describe("the beads sing what they sound", () => {
  const beads = (): string => code(source("Beads.tsx"));

  it("reads the conductor only in the frame loop, and its clock once a frame", () => {
    const text = withoutImports(beads());
    const loop = frameLoop(text);
    // Every read of the conductor is a per-frame read.
    expect(count(text, /\bconductor\./g)).toBeGreaterThan(0);
    expect(count(loop, /\bconductor\./g)).toBe(count(text, /\bconductor\./g));
    // One instant per frame: the clock is read once, at the frame callback's
    // own level — never inside the per-bead loop — and every light is taken at
    // that instant rather than on a clock read of its own.
    expect(count(loop, /conductor\.now\(\)/g)).toBe(1);
    const at = loop.indexOf("const conductedAt = conductor.now();");
    expect(at).toBeGreaterThan(-1);
    expect(braceDepth(loop, at)).toBe(1);
    const lights = calls(loop, "conductor.light");
    expect(lights).toEqual(["conductor.light(id, conductedAt)"]);
  });

  it("folds the light into the kindling lane by max, beside the idle light and the gather", () => {
    const loop = frameLoop(beads());
    expect(loop).toMatch(
      /const lane = Math\.max\(\s*focal\.kindled\[i\],\s*focal\.gather\[i\],\s*conductor\.light\(id, conductedAt\)\s*\);/
    );
    // The lane has one writer, and it is that fold.
    expect(count(loop, /focal\.attribute\[i \* 2 \+ 1\] =/g)).toBe(1);
    expect(loop).toContain("focal.attribute[i * 2 + 1] = lane;");
  });

  it("keeps the light under reduced motion and on every tier", () => {
    // Light, not travel: nothing on the way from the conductor to the lane
    // asks about motion, the tier or its budget.
    const loop = frameLoop(beads());
    const fold = /const lane = Math\.max\([\s\S]*?\);/.exec(loop);
    expect(fold).not.toBeNull();
    expect(fold![0]).not.toMatch(/reducedMotion|profile|budget|tier|engraved/);
  });

  it("widens no attribute: the glass is handed the same two lanes", () => {
    const text = beads();
    expect(text).toContain("new THREE.InstancedBufferAttribute(focal.attribute, 2)");
    expect(code(source("glass.ts"))).toContain("attribute vec2 aTier;");
    expect(code(source("glass.ts"))).not.toMatch(/conductor/);
  });

  it("mirrors what the glass was handed into the frame state, by the armillary's index", () => {
    const loop = frameLoop(beads());
    expect(loop).toContain(
      "if (index < frameState.kindling.length) frameState.kindling[index] = lane;"
    );
    // The index is the armillary's (`frameState.beadIndex`), not this
    // component's own order.
    expect(loop).toContain("const index = frameState.beadIndex.get(id) ?? i;");
  });

  it("sizes the kindling lane with the draw, and a new draw starts dark", () => {
    const ids = ["a", "b", "c"];
    initFramePositions(ids, new Float32Array(ids.length * 3));
    expect(frameState.kindling).toHaveLength(ids.length);
    expect([...frameState.kindling].every((value) => value === 0)).toBe(true);
    for (const id of ids) {
      expect(frameState.beadIndex.get(id)).toBeLessThan(frameState.kindling.length);
    }
    frameState.kindling[2] = 0.8;
    initFramePositions(["d", "e"], new Float32Array(6));
    expect(frameState.kindling).toHaveLength(2);
    expect([...frameState.kindling]).toEqual([0, 0]);
  });
});

describe("the breath is on the bar", () => {
  it("is the conductor's own phase while the world keeps time", () => {
    const clock = clockAt(10);
    const grid = createConductor(clock);
    grid.arm({ slotSeconds: 2, origin: 10 });
    for (const t of [10, 10.5, 12, 17.3, 18, 40.25]) {
      clock.set(t);
      expect(breathPhaseAfter(3.1, 1 / 60, 1, grid)).toBe(grid.breathPhase());
      // Music's time does not dilate: neither the frame's length nor a
      // reveal's slow motion moves it.
      expect(breathPhaseAfter(-7, 1 / 20, 0.15, grid)).toBe(grid.breathPhase());
    }
  });

  it("crests on the slot boundary that begins each group of four", () => {
    const clock = clockAt(10);
    const grid = createConductor(clock);
    for (const world of THEMES) {
      const slot = world.music.slotSeconds;
      grid.arm({ slotSeconds: slot, origin: 10 });
      for (let group = 0; group < 3; group++) {
        clock.set(10 + group * 4 * slot);
        expect(Math.sin(breathPhaseAfter(0, 1 / 60, 1, grid))).toBeCloseTo(1, 9);
        // …and is at its lowest two slots on, on a slot boundary too.
        clock.set(10 + group * 4 * slot + 2 * slot);
        expect(Math.sin(breathPhaseAfter(0, 1 / 60, 1, grid))).toBeCloseTo(-1, 9);
      }
    }
  });

  it("stays far under CAV-007's luminance bound in every world", () => {
    // One breath every four slots: 0.10–0.14 Hz across the worlds, against
    // the 3 Hz ceiling the bloom and the sky's lines answer to.
    const clock = clockAt(0);
    const grid = createConductor(clock);
    for (const world of THEMES) {
      grid.arm({ slotSeconds: world.music.slotSeconds, origin: 0 });
      clock.set(0);
      const before = breathPhaseAfter(0, 0, 1, grid);
      clock.set(1);
      const hz = (breathPhaseAfter(0, 0, 1, grid) - before) / (2 * Math.PI);
      expect(hz).toBeCloseTo(1 / (4 * world.music.slotSeconds), 12);
      expect(hz).toBeLessThan(0.15);
      expect(hz).toBeLessThan(COMFORT.maxLuminanceHz / 20);
    }
  });

  it("runs free at 0.1 Hz of dilated time when no grid is kept", () => {
    const grid = createConductor(clockAt(5));
    expect(grid.armed()).toBe(false);
    expect(FREE_BREATH_HZ).toBe(0.1);
    expect(breathPhaseAfter(1, 0.5, 1, grid)).toBeCloseTo(1 + 0.5 * 2 * Math.PI * 0.1, 12);
    // A reveal's slow motion slows it, as it always has.
    expect(breathPhaseAfter(1, 0.5, 0.15, grid)).toBeCloseTo(
      1 + 0.5 * 0.15 * 2 * Math.PI * 0.1,
      12
    );
  });

  it("takes up from the conductor's last phase when the grid lets go", () => {
    const clock = clockAt(30);
    const grid = createConductor(clock);
    grid.arm({ slotSeconds: 2.4, origin: 29.85 });
    const held = breathPhaseAfter(0, 1 / 60, 1, grid);
    grid.disarm();
    const dt = 1 / 60;
    const next = breathPhaseAfter(held, dt, 1, grid);
    // No jump where the grid is left: one ordinary frame's step.
    expect(next - held).toBeCloseTo(dt * 2 * Math.PI * FREE_BREATH_HZ, 12);
  });

  it("is what the frame loop writes, every frame", () => {
    const text = withoutImports(code(source("Cosmos.tsx")));
    const loop = frameLoop(text);
    expect(loop).toMatch(
      /frameState\.breathPhase = breathPhaseAfter\(\s*frameState\.breathPhase,\s*dt,\s*frameState\.timeScale,\s*conductor\s*\);/
    );
    // The conductor is handed over in the frame loop and nowhere else.
    expect(count(text, /\bconductor\b/g)).toBeGreaterThan(0);
    expect(count(loop, /\bconductor\b/g)).toBe(count(text, /\bconductor\b/g));
    // …and the frame state has one writer of the breath.
    const writers = readdirSync(new URL("./", import.meta.url))
      .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".test.ts"))
      .filter((file) => /frameState\.breathPhase\s*[+\-*/]?=[^=]/.test(code(source(file))));
    expect(writers).toEqual(["Cosmos.tsx"]);
  });
});

describe("the lens breathes with it", () => {
  const rig = (): string => code(source("CameraRig.tsx"));

  it("reads the breath only in the frame loop", () => {
    const text = rig();
    const loop = frameLoop(text);
    for (const read of [/frameState\.breathPhase/g, /frameState\.breathDepth/g]) {
      expect(count(loop, read)).toBeGreaterThan(0);
      expect(count(loop, read)).toBe(count(text, read));
    }
  });

  it("puts the breath on the same lens as the kick, which is unchanged", () => {
    const loop = frameLoop(rig());
    expect(loop).toContain("const kicking = frameState.kick > 0.001;");
    expect(loop).toContain("if (kicking) frameState.kick *= Math.exp(-dt * 5);");
    expect(loop).toMatch(
      /arenaFov\(\s*frameState\.kick,\s*cameraBreath\(breathes, frameState\.breathDepth, frameState\.breathPhase\)\s*\)/
    );
    // Written every frame the kick decays, as it always was; otherwise only
    // when the breath has moved it.
    expect(loop).toContain(
      "if (kicking || Math.abs(lens.fov - fov) > FOV_STILL_DEGREES) {"
    );
  });

  it("is withheld on the engraved tier and under reduced motion", () => {
    expect(rig()).toContain(
      "const breathes = sceneBudget(tier).cameraBreath && !reducedMotion;"
    );
  });

  it("is the only thing in the scene that moves the field of view", () => {
    const writers = readdirSync(new URL("./", import.meta.url))
      .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".test.ts"))
      .filter((file) => /\.fov\s*=[^=]/.test(code(source(file))));
    expect(writers).toEqual(["CameraRig.tsx"]);
    const text = rig();
    expect(count(text, /\.fov\s*=[^=]/g)).toBe(1);
    expect(count(frameLoop(text), /\.fov\s*=[^=]/g)).toBe(1);
  });
});

describe("the camera counts the world's slot", () => {
  it("takes the beat from the world's theme, never from a constant", () => {
    const text = code(source("CameraRig.tsx"));
    expect(text).toContain("const slotSeconds = useCurrentTheme().music.slotSeconds;");
    const phrased = calls(text, "phraseSmoothTime");
    expect(phrased.length).toBeGreaterThanOrEqual(3);
    for (const call of phrased) expect(call).toMatch(/,\s*slotSeconds\s*\)$/);
  });

  it("leaves no fixed beat anywhere in the scene", () => {
    const fixed = readdirSync(new URL("./", import.meta.url))
      .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".test.ts"))
      .filter((file) => source(file).includes("CAMERA_BEAT_SECONDS"));
    expect(fixed).toEqual([]);
  });
});
