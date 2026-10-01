import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ATTUNED,
  advanceAttuned,
  attunedAnswers,
  driftAngle,
  driftGateAfter,
  restingAnswers,
  restingAttuned,
  soundedShare,
  type AttunedState,
  type AttunedStep,
} from "./attuned";

/**
 * ADR-018 — ATTUNEMENT IS THE HELD STATE THE WORLD ANSWERS.
 *
 * One scalar, stepped once a frame on musical seconds, and the answers it
 * drives: the glass, the void, the drawn sky and the drift. Everything that
 * can be proved without a renderer is proved here on the pure module; where
 * the rule is about *where* the state lives — once, and read everywhere else
 * — it is stated against the source, as `musicalTime.test.ts` does.
 */

const SLOT = 2;

function step(overrides: Partial<AttunedStep> = {}): AttunedStep {
  return { held: true, dt: 1 / 60, slotSeconds: SLOT, untilCadence: 0, sounded: 0, ...overrides };
}

/** Run `seconds` of frames at `dt`, recording the value after each. */
function run(
  state: AttunedState,
  seconds: number,
  overrides: Partial<AttunedStep> = {},
  dt = 1 / 120
): number[] {
  const values: number[] = [];
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i++) {
    advanceAttuned(state, step({ dt, ...overrides }));
    values.push(state.value);
  }
  return values;
}

function attunedAt(value = 1, voices = 0): AttunedState {
  const state = restingAttuned();
  state.phase = "entering";
  state.value = value;
  state.voices = voices;
  return state;
}

describe("the bounds", () => {
  it("are one table, at the values ADR-018 and the packet set", () => {
    expect(ATTUNED.enterSeconds).toBe(0.9);
    expect(ATTUNED.iorRise).toBe(0.06);
    expect(ATTUNED.dispersionRise).toBeCloseTo(1 / 3, 12);
    expect(ATTUNED.depthFall).toBe(0.2);
    expect(ATTUNED.figureGainMax).toBe(1.5);
    expect(ATTUNED.driftDegreesPerBreath).toBe(4);
    expect(ATTUNED.maxLuminanceHz).toBe(3);
    expect(Object.isFrozen(ATTUNED)).toBe(true);
  });
});

describe("the held state, entering", () => {
  it("eases in on the room's 0.9 s ease, from wherever it stands", () => {
    const state = restingAttuned();
    run(state, ATTUNED.enterSeconds);
    // An exponential ease reaches 1 − 1/e of the way in one time constant.
    expect(state.value).toBeGreaterThan(0.6);
    expect(state.value).toBeLessThan(0.66);
    run(state, 8);
    expect(state.value).toBeGreaterThan(0.999);
    expect(state.phase).toBe("entering");
  });

  it("never steps: a single long frame lands on the target, never past it", () => {
    const state = restingAttuned();
    advanceAttuned(state, step({ dt: 30 }));
    expect(state.value).toBe(1);
  });

  it("eases the voices heard toward the share sounded, and only while held", () => {
    const state = restingAttuned();
    run(state, 0.3, { sounded: 0.5 });
    expect(state.voices).toBeGreaterThan(0);
    expect(state.voices).toBeLessThan(0.5);
    run(state, 10, { sounded: 0.5 });
    expect(state.voices).toBeCloseTo(0.5, 4);
  });
});

describe("the held state, released: the cadence", () => {
  it("holds until the cadence's slot boundary, then falls to rest over exactly one slot", () => {
    const state = attunedAt(1, 0.5);
    const wait = 0.7;
    advanceAttuned(state, step({ held: false, dt: 0, untilCadence: wait }));
    expect(state.phase).toBe("awaiting");
    run(state, wait - 0.02, { held: false });
    expect(state.value).toBe(1);
    // Past the boundary: half a slot in, a smoothstep is exactly halfway down.
    run(state, 0.02 + SLOT / 2, { held: false }, 0.005);
    expect(state.phase).toBe("releasing");
    expect(state.value).toBeCloseTo(0.5, 2);
    run(state, SLOT / 2 + 0.01, { held: false }, 0.005);
    expect(state.phase).toBe("rest");
    expect(state.value).toBe(0);
    expect(state.voices).toBe(0);
  });

  it("measures the fall from the boundary, so a frame that crosses it carries the overshoot", () => {
    const state = attunedAt(1);
    advanceAttuned(state, step({ held: false, dt: 0, untilCadence: 0.2 }));
    advanceAttuned(state, step({ held: false, dt: 0.2 + SLOT / 2 }));
    expect(state.value).toBeCloseTo(0.5, 9);
  });

  it("begins at once without a grid, over the world's slot", () => {
    const state = attunedAt(1);
    advanceAttuned(state, step({ held: false, dt: SLOT / 2, untilCadence: 0 }));
    expect(state.value).toBeCloseTo(0.5, 9);
  });

  it("falls from where the ease had reached when released early", () => {
    const state = restingAttuned();
    run(state, 0.3);
    const reached = state.value;
    advanceAttuned(state, step({ held: false, dt: 0, untilCadence: 0 }));
    advanceAttuned(state, step({ held: false, dt: SLOT / 2 }));
    expect(state.value).toBeCloseTo(reached / 2, 9);
  });

  it("eases on from where it stands when held again during the release", () => {
    const state = attunedAt(1);
    advanceAttuned(state, step({ held: false, dt: 0, untilCadence: 0 }));
    advanceAttuned(state, step({ held: false, dt: SLOT * 0.75 }));
    const fallen = state.value;
    advanceAttuned(state, step({ held: true, dt: 1 / 60 }));
    expect(state.phase).toBe("entering");
    expect(state.value).toBeGreaterThan(fallen);
    expect(state.value - fallen).toBeLessThan(0.05);
  });

  it("stays at rest when nothing is held", () => {
    const state = restingAttuned();
    run(state, 3, { held: false, untilCadence: 1 });
    expect(state).toEqual(restingAttuned());
  });
});

describe("comfort (CAV-007)", () => {
  /** Count the reversals of direction in a run of values. */
  function reversals(values: readonly number[]): number {
    let count = 0;
    let last = 0;
    for (let i = 1; i < values.length; i++) {
      const d = Math.sign(values[i] - values[i - 1]);
      if (d !== 0 && last !== 0 && d !== last) count += 1;
      if (d !== 0) last = d;
    }
    return count;
  }

  it("never oscillates: entering only rises and the release only falls", () => {
    const state = restingAttuned();
    expect(reversals(run(state, 5))).toBe(0);
    advanceAttuned(state, step({ held: false, dt: 0, untilCadence: 0.4 }));
    expect(reversals(run(state, 4, { held: false }))).toBe(0);
  });

  it("takes far longer than half a 3 Hz cycle to swing between rest and full", () => {
    const halfCycle = 1 / (2 * ATTUNED.maxLuminanceHz);
    const state = restingAttuned();
    const rising = run(state, 4, {}, 0.001);
    const from = rising.findIndex((v) => v >= 0.1);
    const to = rising.findIndex((v) => v >= 0.9);
    expect((to - from) * 0.001).toBeGreaterThan(halfCycle * 5);
    advanceAttuned(state, step({ held: false, dt: 0, untilCadence: 0 }));
    const falling = run(state, SLOT, { held: false }, 0.001);
    const down = falling.findIndex((v) => v <= 0.9);
    const out = falling.findIndex((v) => v <= 0.1);
    expect((out - down) * 0.001).toBeGreaterThan(halfCycle * 5);
  });
});

describe("the voices heard in this hold", () => {
  const voice = (threadId: string, atAudioTime: number) => ({ threadId, atAudioTime });

  it("counts each thread once, from the hold's start up to now", () => {
    const heard = [voice("a", 10.5), voice("a", 11), voice("b", 11.2), voice("c", 13)];
    expect(soundedShare(heard, 10, 12, 4, 6)).toBe(2 / 4);
  });

  it("ignores a voice from before the hold and one not yet begun", () => {
    const heard = [voice("old", 9.9), voice("ahead", 12.5)];
    expect(soundedShare(heard, 10, 12, 6, 6)).toBe(0);
  });

  it("is out of the channels one cycle plays, never more than all of them", () => {
    const heard = ["a", "b", "c", "d", "e", "f", "g"].map((id, i) => voice(id, 10 + i * 0.1));
    expect(soundedShare(heard, 10, 11, 12, 6)).toBe(1);
    expect(soundedShare(heard.slice(0, 3), 10, 11, 12, 6)).toBe(0.5);
  });

  it("is nothing when nothing is woven or nothing is heard", () => {
    expect(soundedShare([voice("a", 10.5)], 10, 11, 0, 6)).toBe(0);
    expect(soundedShare([], 10, 11, 6, 6)).toBe(0);
  });
});

describe("the answers", () => {
  const full = { reducedMotion: false, reducedBloom: false };
  const breath = { phase: 0, depth: 1, seconds: 4 * SLOT };

  it("are at rest at rest", () => {
    const out = attunedAnswers(restingAnswers(), 0, 1, full, breath);
    expect(out).toEqual(restingAnswers());
  });

  it("reach exactly their bounds at full attunement with every voice heard", () => {
    const out = attunedAnswers(restingAnswers(), 1, 1, full, breath);
    expect(out.ior).toBeCloseTo(0.06, 12);
    expect(out.dispersionScale).toBeCloseTo(4 / 3, 12);
    expect(out.depthScale).toBeCloseTo(0.8, 12);
    expect(out.figureGain).toBeCloseTo(1.5, 12);
  });

  it("brighten the figures only as the voices enter", () => {
    expect(attunedAnswers(restingAnswers(), 1, 0, full, breath).figureGain).toBe(1);
    expect(attunedAnswers(restingAnswers(), 1, 0.5, full, breath).figureGain).toBeCloseTo(1.25, 12);
  });

  it("never exceed their bounds, whatever they are handed", () => {
    const out = attunedAnswers(restingAnswers(), 7, 9, full, { ...breath, depth: 4 });
    expect(out.ior).toBeLessThanOrEqual(ATTUNED.iorRise);
    expect(out.dispersionScale).toBeLessThanOrEqual(1 + ATTUNED.dispersionRise);
    expect(out.depthScale).toBeGreaterThanOrEqual(1 - ATTUNED.depthFall);
    expect(out.figureGain).toBeLessThanOrEqual(ATTUNED.figureGainMax);
  });

  it("keep the depth and drop the brightening under reduced bloom", () => {
    const out = attunedAnswers(restingAnswers(), 1, 1, { reducedMotion: false, reducedBloom: true }, breath);
    expect(out.figureGain).toBe(1);
    expect(out.depthScale).toBeCloseTo(0.8, 12);
    expect(out.ior).toBeCloseTo(0.06, 12);
  });

  it("keep the material and drop the drift under reduced motion", () => {
    const out = attunedAnswers(restingAnswers(), 1, 1, { reducedMotion: true, reducedBloom: true }, breath);
    expect(out.driftRate).toBe(0);
    expect(out.ior).toBeCloseTo(0.06, 12);
    expect(out.depthScale).toBeCloseTo(0.8, 12);
  });

  it("drift four degrees a breath at full attunement, swelling on the crest", () => {
    const seconds = 4 * SLOT;
    const steps = 4000;
    let turned = 0;
    let fastest = 0;
    let fastestAt = 0;
    for (let i = 0; i < steps; i++) {
      const phase = (2 * Math.PI * (i + 0.5)) / steps;
      const out = attunedAnswers(restingAnswers(), 1, 0, full, { phase, depth: 1, seconds });
      turned += out.driftRate * (seconds / steps);
      if (out.driftRate > fastest) {
        fastest = out.driftRate;
        fastestAt = phase;
      }
    }
    expect((turned * 180) / Math.PI).toBeCloseTo(ATTUNED.driftDegreesPerBreath, 6);
    // The crest of the breath is where `sin(phase)` is one.
    expect(fastestAt).toBeCloseTo(Math.PI / 2, 2);
  });

  it("scale the drift with the scalar, so it falls with the world", () => {
    const half = attunedAnswers(restingAnswers(), 0.5, 0, full, breath).driftRate;
    const whole = attunedAnswers(restingAnswers(), 1, 0, full, breath).driftRate;
    expect(half).toBeCloseTo(whole / 2, 12);
  });
});

describe("the drift's gate", () => {
  it("opens at the room's pace, so a drift that resumes gathers rather than jerks", () => {
    let gate = 0;
    gate = driftGateAfter(gate, true, 1 / 60);
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(0.05);
    for (let i = 0; i < 600; i++) gate = driftGateAfter(gate, true, 1 / 60);
    expect(gate).toBeGreaterThan(0.999);
  });

  it("lets go within a quarter second once the player has taken the camera", () => {
    let gate = 1;
    for (let t = 0; t < ATTUNED.driftLetGoSeconds; t += 1 / 120) gate = driftGateAfter(gate, false, 1 / 120);
    expect(gate).toBeLessThan(0.06);
    for (let i = 0; i < 120; i++) gate = driftGateAfter(gate, false, 1 / 120);
    expect(gate).toBe(0);
  });

  it("turns nothing when shut, at rest or between frames", () => {
    expect(driftAngle(0.01, 0, 1 / 60)).toBe(0);
    expect(driftAngle(0, 1, 1 / 60)).toBe(0);
    expect(driftAngle(0.01, 1, 0)).toBe(0);
    expect(driftAngle(0.01, 0.5, 0.5)).toBeCloseTo(0.0025, 12);
  });
});

/**
 * ONE ATTUNED STATE IN THE SCENE.
 *
 * Stated against the source, because importing a component pulls a renderer
 * into a node suite. Prose describing a read is not the read, so comments are
 * stripped first.
 */
describe("one scalar drives the room (acceptance criterion 1)", () => {
  const dir = new URL("./", import.meta.url);
  const files = readdirSync(dir).filter(
    (name) => /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
  );
  const code = (name: string): string =>
    readFileSync(new URL(`./${name}`, dir), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

  it("keeps no ease of its own anywhere: the shared room ease is gone", () => {
    expect(files).not.toContain("skyAttunement.ts");
    for (const name of files) {
      const text = code(name);
      expect(text, name).not.toMatch(/\buseAttuned\s*\(/);
      expect(text, name).not.toMatch(/\beaseToward\s*\(/);
    }
  });

  it("writes every attuned uniform from the one scalar", () => {
    let writes = 0;
    for (const name of files) {
      for (const line of code(name).split("\n")) {
        if (!/uAttuned[\s\S]*\.value\s*=/.test(line)) continue;
        writes += 1;
        expect(line, name).toMatch(/=\s*frameState\.attuned\.value\s*;/);
      }
    }
    // The vault, the drawn sky's stars and the dust.
    expect(writes).toBe(3);
  });

  it("reads the session's held flag only where it is stepped, and where it is not an answer", () => {
    const readers = files.filter((name) => /\battunementActive\b/.test(code(name))).sort();
    // Cosmos steps the scalar from it. The ribbons' presence is which single
    // thread is speaking (Attunement.ts), and the interface offers the
    // invitation and reports to the test adapter: neither is an answer.
    expect(readers).toEqual(["Cosmos.tsx", "ThreadingDriver.tsx", "Threads.tsx"]);
  });

  it("steps the scalar once a frame, in Cosmos, and nowhere else", () => {
    const callers = files.filter((name) => name !== "attuned.ts");
    const steppers = callers.filter((name) => /\badvanceAttuned\s*\(/.test(code(name)));
    expect(steppers).toEqual(["Cosmos.tsx"]);
    const answerers = callers.filter((name) => /\battunedAnswers\s*\(/.test(code(name)));
    expect(answerers).toEqual(["Cosmos.tsx"]);
  });

  it("hands the glass, the depth, the sky and the drift the answers as written", () => {
    expect(code("Beads.tsx")).toMatch(/theme\.refraction \+ attuned\.ior/);
    expect(code("Beads.tsx")).toMatch(/DISPERSION_SPLIT \* attuned\.dispersionScale/);
    expect(code("Beads.tsx")).toMatch(/multiplyScalar\(attuned\.depthScale\)/);
    expect(code("Firmament.tsx")).toMatch(/multiplyScalar\(frameState\.attunedAnswers\.depthScale\)/);
    expect(code("Firmament.tsx")).toMatch(/frameState\.attunedAnswers\.figureGain/);
    expect(code("CameraRig.tsx")).toMatch(/frameState\.attunedAnswers\.driftRate/);
  });
});
