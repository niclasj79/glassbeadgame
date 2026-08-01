/**
 * THE LOOP ENDS.
 *
 * Regression (BLOCK-2). `useAudio.ts` carried the comment "conclusion: ambient
 * and bed continue under the mandala" and meant it: the generative loop was
 * never stopped, so the performance's last authored sound arrived over a texture
 * that carried on afterwards. A loop has no ending, and a game whose soundtrack
 * has no ending stops rather than ends.
 *
 * These run the real `AmbientEngine` and the real `AudioEngine` against a
 * recording AudioContext, because the claim is about the *sounding* surface —
 * which slots get scheduled, and where the bed's gain goes — and no test of a
 * pure planner could make it.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ambient } from "./ambient";
import { audio } from "./engine";
import { voiceBudget } from "./voices";

interface Ramp {
  readonly kind: "set" | "linear" | "exponential" | "target";
  readonly value: number;
  readonly at: number;
}

interface FakeParam {
  value: number;
  readonly ramps: Ramp[];
  setValueAtTime: (v: number, t: number) => void;
  linearRampToValueAtTime: (v: number, t: number) => void;
  exponentialRampToValueAtTime: (v: number, t: number) => void;
  cancelScheduledValues: (t: number) => void;
  setTargetAtTime: (v: number, t: number, c: number) => void;
}

const params: FakeParam[] = [];
const ticks: (() => void)[] = [];
const counted = { oscillators: 0 };

const fakeParam = (initial: number): FakeParam => {
  const ramps: Ramp[] = [];
  const p: FakeParam = {
    value: initial,
    ramps,
    setValueAtTime: (value, at) => ramps.push({ kind: "set", value, at }),
    linearRampToValueAtTime: (value, at) =>
      ramps.push({ kind: "linear", value, at }),
    exponentialRampToValueAtTime: (value, at) =>
      ramps.push({ kind: "exponential", value, at }),
    cancelScheduledValues: () => {},
    setTargetAtTime: (value, at) => ramps.push({ kind: "target", value, at }),
  };
  params.push(p);
  return p;
};

const node = () => ({ connect: () => {}, disconnect: () => {} });

/**
 * One context for the whole file, because `AudioEngine` caches the one it
 * creates. Rebuilding it per test would leave the engine talking to the first
 * one while the test watched the second.
 */
const ctx = {
  currentTime: 0,
  sampleRate: 8000,
  state: "running",
  destination: node(),
  resume: () => Promise.resolve(),
  createGain: () => ({ ...node(), gain: fakeParam(1) }),
  createOscillator: () => {
    counted.oscillators += 1;
    return {
      ...node(),
      type: "sine",
      frequency: fakeParam(0),
      detune: fakeParam(0),
      setPeriodicWave: () => {},
      start: () => {},
      stop: () => {},
      addEventListener: () => {},
    };
  },
  createPeriodicWave: () => ({}),
  createBiquadFilter: () => ({
    ...node(),
    type: "lowpass",
    frequency: fakeParam(0),
    Q: fakeParam(1),
    detune: fakeParam(0),
    gain: fakeParam(0),
  }),
  createBufferSource: () => ({
    ...node(),
    buffer: null,
    loop: false,
    playbackRate: fakeParam(1),
    start: () => {},
    stop: () => {},
  }),
  createBuffer: (_channels: number, length: number, rate: number) => ({
    sampleRate: rate,
    getChannelData: () => new Float32Array(length),
  }),
  createStereoPanner: () => ({ ...node(), pan: fakeParam(0) }),
  createDynamicsCompressor: () => ({
    ...node(),
    threshold: fakeParam(0),
    knee: fakeParam(0),
    ratio: fakeParam(1),
    attack: fakeParam(0),
    release: fakeParam(0),
  }),
  createConvolver: () => ({ ...node(), buffer: null }),
};

beforeAll(() => {
  // `src/test/setup.ts` installs `window` as a non-writable property, so these
  // are redefined rather than assigned.
  const previous = (globalThis as unknown as { window?: object }).window ?? {};
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      ...previous,
      AudioContext: function AudioContextStub() {
        return ctx;
      },
      setInterval: (fn: () => void) => {
        ticks.push(fn);
        return ticks.length;
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { addEventListener: () => {}, visibilityState: "visible" },
  });
});

/** Only the newest interval callback: every `start()` installs one. */
const tick = (): void => ticks.at(-1)?.();

/** Every ramp that takes a level to silence at a scheduled moment. */
const fadesToSilence = (): readonly Ramp[] =>
  params
    .flatMap((p) => p.ramps)
    .filter((ramp) => ramp.kind === "linear" && ramp.value < 0.001);

let fadesBefore = 0;

beforeEach(() => {
  voiceBudget.reset();
  ambient.stop();
  ctx.currentTime = 0;
  counted.oscillators = 0;
  ambient.start();
  fadesBefore = fadesToSilence().length;
});

/** Fades scheduled by this test alone. */
const newFades = (): readonly Ramp[] => fadesToSilence().slice(fadesBefore);

describe("the generative loop ends with the performance", () => {
  it("composes while the session is open", () => {
    // Every negative assertion below would be worth nothing if the loop never
    // scheduled anything to begin with.
    tick();
    expect(counted.oscillators).toBeGreaterThan(0);
    expect(ambient.isRunning()).toBe(true);
  });

  it("stops composing once the ending has been asked for", () => {
    tick();
    counted.oscillators = 0;
    // The coda is imminent, so the fade has already begun: nothing new may enter.
    ambient.concludeAt(0.5, 4);
    ctx.currentTime = 0.05;
    tick();
    expect(counted.oscillators).toBe(0);
  });

  it("ramps the bed to silence, finishing at the moment the coda speaks", () => {
    ambient.concludeAt(30, 4);
    expect(newFades().map((ramp) => ramp.at)).toEqual([30]);
  });

  it("shuts the loop down once the ending has passed", () => {
    ambient.concludeAt(10, 4);
    ctx.currentTime = 11;
    tick();
    expect(ambient.isRunning()).toBe(false);
    // And it stays down: a further tick must not resurrect the scheduler.
    counted.oscillators = 0;
    tick();
    expect(counted.oscillators).toBe(0);
  });

  it("may bring an ending forward but never push it back", () => {
    ambient.concludeAt(20, 4);
    ambient.concludeAt(40, 4);
    expect(newFades().map((ramp) => ramp.at)).toEqual([20]);
    ambient.concludeAt(12, 4);
    expect(newFades().map((ramp) => ramp.at)).toEqual([20, 12]);
  });

  it("releases the ending when the next session opens", () => {
    ambient.concludeAt(0.5, 4);
    ctx.currentTime = 1;
    tick();
    expect(ambient.isRunning()).toBe(false);

    // A new session must not open into the end of the last one.
    ctx.currentTime = 2;
    ambient.start();
    counted.oscillators = 0;
    tick();
    expect(counted.oscillators).toBeGreaterThan(0);
    expect(ambient.isRunning()).toBe(true);
  });

  it("leaves the loop alone when nothing has asked it to end", () => {
    ctx.currentTime = 60;
    tick();
    counted.oscillators = 0;
    ctx.currentTime = 120;
    tick();
    expect(counted.oscillators).toBeGreaterThan(0);
    expect(newFades()).toEqual([]);
    expect(audio.now()).toBe(120);
  });
});
