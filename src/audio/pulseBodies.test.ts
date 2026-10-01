/**
 * THE PULSE'S THREE BODIES (ADR-017, M4-002).
 *
 * Each body is run against a recording AudioContext that keeps the graph, every
 * scheduled value and every source start, because the claims are about the
 * sounding surface: when a body starts, how loud it can ever be, what it is
 * heard through, and what it never touches.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COMFORT } from "./comfort";
import { conductor } from "./conductor";
import type { PulseBody } from "./pulse";
import {
  BELL_ENVELOPE,
  BRUSH_BAND_HZ,
  BRUSH_ENVELOPE,
  PULSE_GAIN,
  SKIN_ENVELOPE,
  SKIN_LOWPASS_HZ,
  playBell,
  playBrush,
  playPulseBody,
  playSkin,
  type PulseEnvelope,
} from "./pulseBodies";
import { SCORE } from "./score";
import { modeFreq } from "./theory";
import { noiseSource, voiceBudget } from "./voices";

// ─── A recording AudioContext ───────────────────────────────────────────────

interface Ramp {
  readonly kind: "set" | "linear" | "exponential" | "target";
  readonly value: number;
  readonly at: number;
}

class Param {
  readonly ramps: Ramp[] = [];
  constructor(public value: number) {}
  setValueAtTime(value: number, at: number): void {
    this.ramps.push({ kind: "set", value, at });
  }
  linearRampToValueAtTime(value: number, at: number): void {
    this.ramps.push({ kind: "linear", value, at });
  }
  exponentialRampToValueAtTime(value: number, at: number): void {
    this.ramps.push({ kind: "exponential", value, at });
  }
  setTargetAtTime(value: number, at: number): void {
    this.ramps.push({ kind: "target", value, at });
  }
  cancelScheduledValues(): void {}
}

type Kind = "gain" | "oscillator" | "noise" | "filter" | "panner" | "bus";

class FakeNode {
  readonly outputs: FakeNode[] = [];
  type = "";
  startedAt: number | null = null;
  startOffset = 0;
  stoppedAt: number | null = null;
  buffer: unknown = null;
  loop = false;
  readonly gain = new Param(1);
  readonly frequency = new Param(0);
  readonly Q = new Param(1);
  readonly detune = new Param(0);
  readonly pan = new Param(0);
  constructor(readonly kind: Kind) {}
  connect(target: FakeNode | Param): void {
    if (target instanceof FakeNode) this.outputs.push(target);
  }
  disconnect(): void {}
  setPeriodicWave(): void {}
  addEventListener(): void {}
  start(at?: number, offset?: number): void {
    this.startedAt = at ?? 0;
    this.startOffset = offset ?? 0;
  }
  stop(at?: number): void {
    this.stoppedAt = at ?? 0;
  }
}

function recordingContext(currentTime = 0) {
  const nodes: FakeNode[] = [];
  const make = (kind: Kind): FakeNode => {
    const node = new FakeNode(kind);
    nodes.push(node);
    return node;
  };
  const ctx = {
    currentTime,
    sampleRate: 8000,
    createGain: () => make("gain"),
    createOscillator: () => {
      const node = make("oscillator");
      node.type = "sine";
      return node;
    },
    createPeriodicWave: () => ({}),
    createBiquadFilter: () => {
      const node = make("filter");
      node.type = "lowpass";
      return node;
    },
    createBufferSource: () => make("noise"),
    createBuffer: (_channels: number, length: number, rate: number) => ({
      sampleRate: rate,
      length,
      getChannelData: () => new Float32Array(length),
    }),
    createStereoPanner: () => make("panner"),
  };
  const bus = new FakeNode("bus");
  return {
    ctx: ctx as unknown as AudioContext,
    bus,
    busNode: bus as unknown as AudioNode,
    nodes,
    sources: () => nodes.filter((node) => node.kind === "oscillator" || node.kind === "noise"),
  };
}

/** Everything reachable downstream of `start`. */
function downstream(start: FakeNode): FakeNode[] {
  const seen = new Set<FakeNode>();
  const stack = [start];
  while (stack.length > 0) {
    const node = stack.pop() as FakeNode;
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...node.outputs);
  }
  return [...seen];
}

/** Where a node's sound ends up: the nodes it reaches that lead nowhere further. */
const terminals = (start: FakeNode): FakeNode[] =>
  downstream(start).filter((node) => node.outputs.length === 0);

/** An envelope gain: `voices.ts` and the brush both open one at 0.0001. */
const isEnvelope = (node: FakeNode): boolean =>
  node.kind === "gain" &&
  node.gain.ramps.length > 0 &&
  node.gain.ramps[0].kind === "set" &&
  Math.abs(node.gain.ramps[0].value - 0.0001) < 1e-12;

const peakOf = (node: FakeNode): number =>
  Math.max(...node.gain.ramps.filter((ramp) => ramp.kind === "linear").map((ramp) => ramp.value));

/** Attack, hold and release as the envelope scheduled them. */
function shapeOf(node: FakeNode): PulseEnvelope {
  const [open, rise, held, fall] = node.gain.ramps;
  expect(open.kind).toBe("set");
  expect(rise.kind).toBe("linear");
  expect(held.kind).toBe("set");
  expect(fall.kind).toBe("exponential");
  expect(fall.value).toBeCloseTo(0.0001, 12);
  return {
    attack: rise.at - open.at,
    hold: held.at - rise.at,
    release: fall.at - held.at,
  };
}

const expectShape = (actual: PulseEnvelope, expected: PulseEnvelope): void => {
  expect(actual.attack).toBeCloseTo(expected.attack, 9);
  expect(actual.hold).toBeCloseTo(expected.hold, 9);
  expect(actual.release).toBeCloseTo(expected.release, 9);
};

/** The envelope a source plays through: the first envelope gain downstream of it. */
const envelopeOf = (source: FakeNode): FakeNode => {
  const envelope = downstream(source).find(isEnvelope);
  if (envelope === undefined) throw new Error("a source with no envelope");
  return envelope;
};

const BODIES: readonly PulseBody[] = ["skin", "brush", "bell"];
const PLAY = { skin: playSkin, brush: playBrush, bell: playBell } as const;
const AT = 3.25;

beforeEach(() => {
  voiceBudget.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── The ceilings ───────────────────────────────────────────────────────────

describe("the ceilings", () => {
  it("are one table: skin 0.06, brush 0.02, bell 0.015", () => {
    expect(PULSE_GAIN).toEqual({ skin: 0.06, brush: 0.02, bell: 0.015 });
    expect(Object.isFrozen(PULSE_GAIN)).toBe(true);
  });

  it("sit under the bed, alone and together", () => {
    const total = BODIES.reduce((sum, body) => sum + PULSE_GAIN[body], 0);
    expect(total).toBeLessThan(SCORE.grammar.bedGain);
  });
});

// ─── The skin ───────────────────────────────────────────────────────────────

describe("the skin", () => {
  it("is a wood strike on the tonic in the sub register, exactly in tune, starting at its onset", () => {
    const { ctx, busNode, sources } = recordingContext();
    expect(playSkin(ctx, busNode, AT, 0.05, "pulse:0:0")).toBe(true);
    const tone = sources().filter((node) => node.kind === "oscillator");
    expect(tone).toHaveLength(1);
    expect(tone[0].type).toBe("triangle");
    // The wood's strike glides down onto the pitch; the pitch is the tonic, untouched.
    const [glide, settle] = tone[0].frequency.ramps;
    expect(settle).toEqual({ kind: "exponential", value: modeFreq(0, "sub"), at: expect.any(Number) });
    expect(glide.at).toBe(AT);
    for (const source of sources()) expect(source.startedAt).toBe(AT);
  });

  it("strikes in about 4 ms, holds 30 ms and dies over 260 ms", () => {
    const { ctx, busNode, sources } = recordingContext();
    playSkin(ctx, busNode, AT, 0.05, "pulse:0:0");
    const tone = sources().find((node) => node.kind === "oscillator") as FakeNode;
    expectShape(shapeOf(envelopeOf(tone)), SKIN_ENVELOPE);
    expectShape(SKIN_ENVELOPE, { attack: 0.004, hold: 0.03, release: 0.26 });
  });

  it("is heard through a low-pass, so it reads as a soft drum", () => {
    const { ctx, bus, busNode, sources } = recordingContext();
    playSkin(ctx, busNode, AT, 0.05, "pulse:0:0");
    for (const source of sources()) {
      const filters = downstream(source).filter((node) => node.kind === "filter");
      const soft = filters.find((node) => node.frequency.value === SKIN_LOWPASS_HZ);
      expect(soft?.type).toBe("lowpass");
      expect(soft?.outputs).toEqual([bus]);
    }
  });
});

// ─── The brush ──────────────────────────────────────────────────────────────

describe("the brush", () => {
  it("is an unpitched tap of noise, starting at its onset", () => {
    const { ctx, busNode, sources } = recordingContext();
    expect(playBrush(ctx, busNode, AT, 0.01, "pulse:0:9")).toBe(true);
    const played = sources();
    expect(played.map((node) => node.kind)).toEqual(["noise"]);
    expect(played[0].startedAt).toBe(AT);
    // Somewhere in the shared noise, so a roll is not one sample repeated.
    expect(played[0].startOffset).toBeGreaterThanOrEqual(0);
    expect(played[0].startOffset).toBeLessThan(2);
    const { attack, hold, release } = BRUSH_ENVELOPE;
    expect(played[0].stoppedAt).toBeCloseTo(AT + attack + hold + release + 0.02, 9);
  });

  it("is bandpassed to 1.6–3.8 kHz", () => {
    const { ctx, bus, busNode, sources } = recordingContext();
    playBrush(ctx, busNode, AT, 0.01, "pulse:0:9");
    const band = downstream(sources()[0]).filter((node) => node.kind === "filter");
    expect(band).toHaveLength(1);
    expect(band[0].type).toBe("bandpass");
    expect(band[0].outputs).toEqual([bus]);
    // A resonator whose −3 dB edges are the band's: the edges' geometric mean,
    // and their distance as its bandwidth.
    const centre = band[0].frequency.value;
    const bandwidth = centre / band[0].Q.value;
    expect(BRUSH_BAND_HZ).toEqual({ low: 1600, high: 3800 });
    expect(centre * centre).toBeCloseTo(1600 * 3800, 6);
    expect(bandwidth).toBeCloseTo(3800 - 1600, 6);
  });

  it("taps in about 6 ms, holds 20 ms and dies over 120 ms", () => {
    const { ctx, busNode, sources } = recordingContext();
    playBrush(ctx, busNode, AT, 0.01, "pulse:0:9");
    expectShape(shapeOf(envelopeOf(sources()[0])), BRUSH_ENVELOPE);
    expectShape(BRUSH_ENVELOPE, { attack: 0.006, hold: 0.02, release: 0.12 });
  });
});

// ─── The bell ───────────────────────────────────────────────────────────────

describe("the bell", () => {
  it("is a glass tick on the tonic in the air register, exactly in tune, starting at its onset", () => {
    const { ctx, busNode, sources } = recordingContext();
    expect(playBell(ctx, busNode, AT, 0.01, "pulse:0:16")).toBe(true);
    const played = sources();
    expect(played.map((node) => node.kind)).toEqual(["oscillator"]);
    expect(played[0].frequency.value).toBe(modeFreq(0, "air"));
    expect(played[0].startedAt).toBe(AT);
  });

  it("ticks in about 2 ms, holds 40 ms and rings over 700 ms", () => {
    const { ctx, busNode, sources } = recordingContext();
    playBell(ctx, busNode, AT, 0.01, "pulse:0:16");
    expectShape(shapeOf(envelopeOf(sources()[0])), BELL_ENVELOPE);
    expectShape(BELL_ENVELOPE, { attack: 0.002, hold: 0.04, release: 0.7 });
  });
});

// ─── Every body ─────────────────────────────────────────────────────────────

describe("every body", () => {
  it("is never louder than its ceiling times the bed it is asked under", () => {
    for (const body of BODIES) {
      for (const weight of [0.125, 0.25, 0.5, 1]) {
        for (const bed of [0.1, 0.55, 0.72, 1]) {
          voiceBudget.reset();
          const { ctx, busNode, nodes } = recordingContext();
          const gain = weight * PULSE_GAIN[body] * bed;
          expect(PLAY[body](ctx, busNode, AT, gain, `pulse:${weight}:${bed}`)).toBe(true);
          const envelopes = nodes.filter(isEnvelope);
          expect(envelopes.length).toBeGreaterThan(0);
          for (const envelope of envelopes) {
            expect(peakOf(envelope)).toBeLessThanOrEqual(gain + 1e-12);
            expect(peakOf(envelope)).toBeLessThanOrEqual(PULSE_GAIN[body] * bed + 1e-12);
          }
        }
      }
    }
  });

  it("holds a request above its ceiling to the ceiling", () => {
    for (const body of BODIES) {
      const { ctx, busNode, nodes } = recordingContext();
      PLAY[body](ctx, busNode, AT, 1, "pulse:loud");
      for (const envelope of nodes.filter(isEnvelope)) {
        expect(peakOf(envelope)).toBeLessThanOrEqual(PULSE_GAIN[body] + 1e-12);
      }
    }
  });

  it("plays nothing for a level that is not one", () => {
    for (const body of BODIES) {
      for (const gain of [0, -0.01, Number.NaN, Number.NEGATIVE_INFINITY]) {
        const { ctx, busNode, sources } = recordingContext();
        expect(PLAY[body](ctx, busNode, AT, gain)).toBe(false);
        expect(sources()).toEqual([]);
      }
    }
  });

  it("takes one voice of the budget, and none when the budget is full", () => {
    for (const body of BODIES) {
      voiceBudget.reset();
      const { ctx, busNode } = recordingContext();
      expect(PLAY[body](ctx, busNode, AT, PULSE_GAIN[body])).toBe(true);
      expect(voiceBudget.active(ctx.currentTime)).toBe(1);

      voiceBudget.reset();
      for (let i = 0; i < COMFORT.voice.maxConcurrent; i += 1) voiceBudget.claim(0, 1e9);
      const full = recordingContext();
      expect(PLAY[body](full.ctx, full.busNode, AT, PULSE_GAIN[body])).toBe(false);
      expect(full.sources()).toEqual([]);
    }
  });

  it("is heard through the bus it is handed, and nowhere else", () => {
    for (const body of BODIES) {
      const { ctx, bus, busNode, sources } = recordingContext();
      PLAY[body](ctx, busNode, AT, PULSE_GAIN[body]);
      expect(sources().length).toBeGreaterThan(0);
      for (const source of sources()) expect(terminals(source)).toEqual([bus]);
    }
  });

  it("shares its colour filter per bus, as the bodies' strips are shared", () => {
    for (const body of ["skin", "brush"] as const) {
      const { ctx, bus, busNode, nodes } = recordingContext();
      PLAY[body](ctx, busNode, AT, PULSE_GAIN[body]);
      PLAY[body](ctx, busNode, AT + 0.125, PULSE_GAIN[body]);
      const intoBus = nodes.filter((node) => node.outputs.includes(bus));
      expect(intoBus).toHaveLength(1);
      expect(intoBus[0].kind).toBe("filter");
    }
  });

  it("lights nothing: no body puts a note on the conductor", () => {
    const sound = vi.spyOn(conductor, "sound");
    for (const body of BODIES) {
      const { ctx, busNode } = recordingContext();
      PLAY[body](ctx, busNode, AT, PULSE_GAIN[body], "pulse:1:0");
    }
    expect(sound).not.toHaveBeenCalled();
  });

  it("is humanised by its onset's name alone, never by the shared random stream", () => {
    // The shared noise exists before anything is measured.
    const first = recordingContext();
    noiseSource(first.ctx, 2.5);
    const random = vi.spyOn(Math, "random");
    const peaks = (seed: string): number[] =>
      BODIES.map((body) => {
        voiceBudget.reset();
        const { ctx, busNode, nodes } = recordingContext();
        PLAY[body](ctx, busNode, AT, PULSE_GAIN[body], seed);
        return Math.max(...nodes.filter(isEnvelope).map(peakOf));
      });
    expect(peaks("pulse:4:6")).toEqual(peaks("pulse:4:6"));
    expect(random).not.toHaveBeenCalled();
  });

  it("is chosen by name", () => {
    const kinds = (body: PulseBody): string[] => {
      voiceBudget.reset();
      const { ctx, busNode, sources } = recordingContext();
      expect(playPulseBody(ctx, busNode, body, AT, PULSE_GAIN[body], "pulse:2:0")).toBe(true);
      return sources().map((node) => `${node.kind}:${node.type}`);
    };
    // The skin is the wood's pitched strike and its contact noise; the brush,
    // noise alone; the bell, one glass partial.
    expect(kinds("skin")).toEqual(["oscillator:triangle", "noise:"]);
    expect(kinds("brush")).toEqual(["noise:"]);
    expect(kinds("bell")).toEqual(["oscillator:sine"]);
  });
});

// ─── The source ─────────────────────────────────────────────────────────────

describe("the bodies' source", () => {
  const code = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "pulseBodies.ts"),
    "utf8"
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("names no concept, no conductor and no bus but the one it is handed", () => {
    for (const forbidden of [
      /conceptId/,
      /conductor/,
      /\.sound\(/,
      /tensionBus/,
      /motifBus/,
      /sfxBus/,
      /ambientBus/,
    ]) {
      expect(code).not.toMatch(forbidden);
    }
  });
});
