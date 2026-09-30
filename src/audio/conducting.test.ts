/**
 * THE BED AND THE HAND, KEEPING ONE TIME (ADR-016, M4-001).
 *
 * These run the real `AmbientEngine`, the real hand's sounds and the real
 * conductor against a recording AudioContext, because the claims are about the
 * sounding surface: where the bed puts the grid, which of the choir's notes
 * reach the score, and when the hand's sounds actually start.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CASTALIA_LOOKUP } from "@/content/castalia";
import { CASTALIA_RELATIONS } from "@/content/castalia/relations";
import { toConceptId, toThreadId } from "@/domain/ids";
import type { PresentationCue } from "@/runtime/cues";
import { frameState } from "@/scene/frameState";
import { ambient } from "./ambient";
import {
  ANSWER_DIVISION,
  CHOIR_LIGHT_WEIGHT,
  FIRST_SLOT_LEAD_SECONDS,
  HAND_DIVISION,
  HAND_LIGHT_WEIGHT,
  LIGHT_RISE_SECONDS,
  UNARMED_LEAD_SECONDS,
  conductor,
  type ScheduledOnset,
} from "./conductor";
import { COMFORT } from "./comfort";
import { createAudioDirector, type AudioSink } from "./director";
import { audio } from "./engine";
import { makeVoicePlan, type VoicePlan } from "./plan";
import { SCORE_HORIZON_SECONDS, publishPlanLights } from "./planLights";
import { audioDirector, productionSink, stopSemanticAudio } from "./productionAudio";
import { beadClink, cancelGliss, hoverPing, latchTick, selectTick } from "./sfx";
import { voiceBudget } from "./voices";

const FIBONACCI = "measure.fibonacci-sequence";
const COUNTERPOINT = "sound.counterpoint";
const PRIMES = "measure.prime-numbers";

// ─── A recording AudioContext ───────────────────────────────────────────────

/** Every source started, and every value set at a moment, since the last clear. */
const started: { readonly kind: "oscillator" | "noise"; readonly at: number }[] = [];
const setAt: number[] = [];
const ticks: (() => void)[] = [];

const fakeParam = (initial: number) => ({
  value: initial,
  setValueAtTime: (_value: number, at: number) => {
    setAt.push(at);
  },
  linearRampToValueAtTime: () => {},
  exponentialRampToValueAtTime: () => {},
  cancelScheduledValues: () => {},
  setTargetAtTime: () => {},
});

const node = () => ({ connect: () => {}, disconnect: () => {} });

const ctx = {
  currentTime: 0,
  sampleRate: 8000,
  state: "running",
  destination: node(),
  resume: () => Promise.resolve(),
  createGain: () => ({ ...node(), gain: fakeParam(1) }),
  createOscillator: () => ({
    ...node(),
    type: "sine",
    frequency: fakeParam(0),
    detune: fakeParam(0),
    setPeriodicWave: () => {},
    start: (at?: number) => {
      started.push({ kind: "oscillator", at: at ?? ctx.currentTime });
    },
    stop: () => {},
    addEventListener: () => {},
  }),
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
    start: (at?: number) => {
      started.push({ kind: "noise", at: at ?? ctx.currentTime });
    },
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

/** The presentation clock the hover ping's throttle reads, in milliseconds. */
let presentationMs = 10_000;

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
      clearInterval: () => {},
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { addEventListener: () => {}, visibilityState: "visible" },
  });
  vi.spyOn(performance, "now").mockImplementation(() => presentationMs);
  audio.ensure();
});

afterAll(() => {
  vi.restoreAllMocks();
});

/** Only the newest interval callback: every `start()` installs one. */
const tick = (): void => ticks.at(-1)?.();

const clear = (): void => {
  started.length = 0;
  setAt.length = 0;
};

beforeEach(() => {
  ambient.stop();
  conductor.disarm();
  voiceBudget.reset();
  frameState.pulses.length = 0;
  ctx.currentTime = 10;
  presentationMs += 1_000;
  clear();
});

/** How far `at` is from the nearest point on the grid of `step` seconds from `origin`. */
const offGrid = (at: number, origin: number, step: number): number => {
  const steps = (at - origin) / step;
  return Math.abs(steps - Math.round(steps));
};

// ─── The bed ────────────────────────────────────────────────────────────────

describe("the bed arms the grid", () => {
  it("arms the conductor with the world's slot, from its first slot", () => {
    expect(conductor.armed()).toBe(false);
    ambient.start();
    expect(conductor.armed()).toBe(true);
    // No session in the room: Castalia's slot.
    expect(conductor.slotSeconds()).toBe(2);
    // The first slot boundary is the grid's origin.
    expect(conductor.next(1, 0)).toBeCloseTo(10 + FIRST_SLOT_LEAD_SECONDS, 9);
  });

  it("keeps one answer grid: the bed's quantize and the conductor's eighth agree", () => {
    ambient.start();
    for (const now of [10, 10.2, 11.37, 13.9, 17.05]) {
      ctx.currentTime = now;
      tick();
      expect(ambient.quantize()).toBeCloseTo(conductor.next(ANSWER_DIVISION), 9);
    }
  });

  it("disarms the grid, and forgets every light, when it leaves the room", () => {
    ambient.start();
    conductor.sound({ conceptId: FIBONACCI, at: 10.5, duration: 0.5, weight: 1 });
    ambient.stop();
    expect(conductor.armed()).toBe(false);
    expect(conductor.light(FIBONACCI, 10.5 + LIGHT_RISE_SECONDS)).toBe(0);
    expect(conductor.next(HAND_DIVISION)).toBeCloseTo(10 + UNARMED_LEAD_SECONDS, 9);
  });

  it("keeps the grid, and the coda's light, through the loop's own ending", () => {
    ambient.start();
    ambient.concludeAt(20, 4);
    // The coda was written ahead, on the same grid.
    conductor.sound({ conceptId: FIBONACCI, at: 20, duration: 1.2, weight: 1 });
    ctx.currentTime = 20.01;
    tick();
    expect(ambient.isRunning()).toBe(false);
    expect(conductor.armed()).toBe(true);
    expect(conductor.light(FIBONACCI, 20 + LIGHT_RISE_SECONDS)).toBeCloseTo(1, 9);
    // The room changing is what takes them away.
    ambient.stop();
    expect(conductor.armed()).toBe(false);
    expect(conductor.light(FIBONACCI, 20 + LIGHT_RISE_SECONDS)).toBe(0);
  });

  it("arms afresh when the next session opens", () => {
    ambient.start();
    ambient.stop();
    ctx.currentTime = 30;
    ambient.start();
    expect(conductor.armed()).toBe(true);
    expect(conductor.next(1, 0)).toBeCloseTo(30 + FIRST_SLOT_LEAD_SECONDS, 9);
  });
});

describe("the choir puts its notes on the score", () => {
  type Pulse = (typeof frameState.pulses)[number];

  /**
   * Run the loop a second at a time until the thread has spoken a few times,
   * checking each new pulse the moment it is written — the conductor forgets an
   * onset once it is well past, as it should, so a pulse is read while it is
   * still ahead.
   */
  const listen = (check: (pulse: Pulse) => void): number => {
    let heard = 0;
    for (let second = 0; second < 60 && heard < 4; second += 1) {
      ctx.currentTime = 10 + second;
      const before = frameState.pulses.length;
      tick();
      for (const pulse of frameState.pulses.slice(before)) {
        check(pulse);
        heard += 1;
      }
    }
    return heard;
  };

  it("lights each concept of a speaking thread at its own identity note", () => {
    ambient.start();
    ambient.addThreadVoice("t1", FIBONACCI, COUNTERPOINT);
    const heard = listen((pulse) => {
      // The pulse is exactly what it was: the scene's strand light is untouched.
      expect(pulse).toEqual({
        threadId: "t1",
        atAudioTime: pulse.atAudioTime,
        duration: 1.4,
        flip: pulse.flip,
      });
      const [first, second] = pulse.flip
        ? [COUNTERPOINT, FIBONACCI]
        : [FIBONACCI, COUNTERPOINT];
      // The first note begins with the pulse and lights its concept at the
      // choir's weight.
      expect(conductor.light(first, pulse.atAudioTime - 0.001)).toBeLessThan(
        CHOIR_LIGHT_WEIGHT
      );
      expect(conductor.light(first, pulse.atAudioTime + LIGHT_RISE_SECONDS)).toBeCloseTo(
        CHOIR_LIGHT_WEIGHT,
        9
      );
      // The answer follows 0.55–0.85 s later, and lights the other concept.
      let peak = 0;
      for (let t = pulse.atAudioTime + 0.5; t < pulse.atAudioTime + 0.95; t += 0.002) {
        peak = Math.max(peak, conductor.light(second, t));
      }
      expect(peak).toBeGreaterThan(CHOIR_LIGHT_WEIGHT * 0.9);
      // Nothing else sang, so nothing else lights.
      expect(conductor.light(PRIMES, pulse.atAudioTime + LIGHT_RISE_SECONDS)).toBe(0);
    });
    expect(heard).toBeGreaterThanOrEqual(2);
  });

  it("lights nothing for a note the voice budget refused", () => {
    ambient.start();
    ambient.addThreadVoice("t1", FIBONACCI, COUNTERPOINT);
    // A full budget: every note is dropped rather than queued.
    for (let i = 0; i < COMFORT.voice.maxConcurrent; i += 1) {
      voiceBudget.claim(ctx.currentTime, 1e9);
    }
    const heard = listen((pulse) => {
      // The loop still speaks (its pulses are the scene's, and unchanged), but
      // no note sounded, so no bead lights.
      for (let t = pulse.atAudioTime; t < pulse.atAudioTime + 2.5; t += 0.01) {
        expect(conductor.light(FIBONACCI, t)).toBe(0);
        expect(conductor.light(COUNTERPOINT, t)).toBe(0);
      }
    });
    expect(heard).toBeGreaterThanOrEqual(2);
  });
});

// ─── The hand ───────────────────────────────────────────────────────────────

/** A grid with an origin off the clock's round numbers: sixteenths at 10.15 + k/8. */
const ORIGIN = 10.15;
const SIXTEENTH = 2 / HAND_DIVISION;
const armHand = (): void => conductor.arm({ slotSeconds: 2, origin: ORIGIN });

/** Everything a sound started, and every value it set, is at one moment on the grid. */
const expectAllAt = (at: number): void => {
  expect(started.length).toBeGreaterThan(0);
  for (const source of started) expect(source.at).toBeCloseTo(at, 9);
  expect(setAt.length).toBeGreaterThan(0);
  expect(Math.min(...setAt)).toBeCloseTo(at, 9);
  expect(offGrid(at, ORIGIN, SIXTEENTH)).toBeLessThan(1e-9);
};

const oscillators = (): number => started.filter((s) => s.kind === "oscillator").length;

const SOUNDS = {
  hover: () => hoverPing(FIBONACCI),
  select: () => selectTick(FIBONACCI),
  latch: () => latchTick(FIBONACCI),
  cancel: () => cancelGliss(),
  clink: () => beadClink(0.8, 0.12, 0.3),
} as const;

describe("the hand's sounds land on the hand grid", () => {
  it("starts every oscillator, noise and envelope of each sound on the next sixteenth", () => {
    for (const play of Object.values(SOUNDS)) {
      conductor.disarm();
      armHand();
      ctx.currentTime = 10.2;
      presentationMs += 1_000;
      clear();
      play();
      // The next sixteenth at least the lead ahead of 10.2 is 10.275.
      expectAllAt(10.275);
    }
  });

  it("answers soon, as before, when there is no grid", () => {
    for (const play of Object.values(SOUNDS)) {
      conductor.disarm();
      ctx.currentTime = 12.34;
      presentationMs += 1_000;
      clear();
      play();
      expect(started.length).toBeGreaterThan(0);
      for (const source of started) expect(source.at).toBeCloseTo(12.34 + UNARMED_LEAD_SECONDS, 9);
    }
  });

  it("lets two hover pings asking for the same grid point make one voice", () => {
    armHand();
    ctx.currentTime = 10.2;
    hoverPing(FIBONACCI);
    expect(oscillators()).toBe(1);
    // Past the ping's own throttle, but the same sixteenth (10.275) is next.
    ctx.currentTime = 10.21;
    presentationMs += 100;
    hoverPing(COUNTERPOINT);
    expect(oscillators()).toBe(1);
    // The next sixteenth is free.
    ctx.currentTime = 10.26;
    presentationMs += 100;
    hoverPing(COUNTERPOINT);
    expect(oscillators()).toBe(2);
    expect(started[1].at).toBeCloseTo(10.4, 9);
  });

  it("keeps the hover ping's own throttle as well", () => {
    armHand();
    ctx.currentTime = 10.2;
    hoverPing(FIBONACCI);
    // A different grid point, but within 90 ms of presentation time.
    ctx.currentTime = 10.4;
    presentationMs += 50;
    hoverPing(COUNTERPOINT);
    expect(oscillators()).toBe(1);
  });

  it("allows one of each kind per grid point, and any kind beside another", () => {
    for (const [kind, play] of Object.entries(SOUNDS)) {
      conductor.disarm();
      armHand();
      ctx.currentTime = 10.2;
      presentationMs += 1_000;
      clear();
      play();
      const once = started.length;
      expect(once).toBeGreaterThan(0);
      // The same kind, again, for the same point: dropped.
      presentationMs += 1_000;
      play();
      expect({ kind, sources: started.length }).toEqual({ kind, sources: once });
    }
    // Different kinds share a grid point freely.
    conductor.disarm();
    armHand();
    ctx.currentTime = 10.2;
    presentationMs += 1_000;
    clear();
    hoverPing(FIBONACCI);
    const afterHover = started.length;
    selectTick(FIBONACCI);
    expect(started.length).toBeGreaterThan(afterHover);
    for (const source of started) expect(source.at).toBeCloseTo(10.275, 9);
  });

  it("lights the bead a concept-bearing sound speaks for, at the hand's weight", () => {
    for (const play of [
      (id: string) => hoverPing(id),
      (id: string) => selectTick(id),
      (id: string) => latchTick(id),
    ]) {
      conductor.disarm();
      armHand();
      ctx.currentTime = 10.2;
      presentationMs += 1_000;
      play(FIBONACCI);
      expect(conductor.light(FIBONACCI, 10.275 - 0.001)).toBe(0);
      expect(conductor.light(FIBONACCI, 10.275 + LIGHT_RISE_SECONDS)).toBeCloseTo(
        HAND_LIGHT_WEIGHT,
        9
      );
      expect(conductor.light(COUNTERPOINT, 10.275 + LIGHT_RISE_SECONDS)).toBe(0);
    }
  });

  it("lights nothing for the sounds that speak for no bead", () => {
    armHand();
    ctx.currentTime = 10.2;
    cancelGliss();
    beadClink(0.8, 0.12, 0.3);
    for (const id of [FIBONACCI, COUNTERPOINT, PRIMES]) {
      expect(conductor.light(id, 10.275 + LIGHT_RISE_SECONDS)).toBe(0);
    }
  });

  it("lights nothing for a hand note the voice budget refused", () => {
    armHand();
    ctx.currentTime = 10.2;
    for (let i = 0; i < COMFORT.voice.maxConcurrent; i += 1) {
      voiceBudget.claim(ctx.currentTime, 1e9);
    }
    hoverPing(FIBONACCI);
    expect(conductor.light(FIBONACCI, 10.275 + LIGHT_RISE_SECONDS)).toBe(0);
  });
});

// ─── The production sink ────────────────────────────────────────────────────

describe("the production sink conducts, muted or not", () => {
  const outcome = (): PresentationCue =>
    ({
      id: "cue:outcome.documented",
      type: "outcome.documented",
      sourceEventId: null,
      startAt: 0,
      duration: 1,
      channels: ["audio"],
      payload: {
        threadId: toThreadId("t1"),
        pair: [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)],
        intention: "ground",
        relation: CASTALIA_RELATIONS[0],
        evidence: CASTALIA_RELATIONS[0].evidence,
        reception: "confirmed",
      },
    }) as PresentationCue;

  /** The plan a director writes for the outcome, as a recording sink receives it. */
  const written = (): VoicePlan => {
    const conducted: VoicePlan[] = [];
    const sink: AudioSink = {
      now: () => 0,
      quantize: () => 0,
      quantizeHand: () => 0,
      slotSeconds: () => 2,
      conduct: (plan) => {
        conducted.push(plan);
      },
      play: () => {},
      setSpace: () => {},
      activeVoiceCount: () => 0,
      concludeAt: () => {},
    };
    createAudioDirector({ sink, lookup: CASTALIA_LOOKUP }).handleCue(outcome());
    return conducted[0];
  };

  /** Every onset that reaches the conductor, and the audio time it arrived at. */
  let arrivals: { onset: ScheduledOnset; clock: number }[] = [];
  beforeEach(() => {
    arrivals = [];
    const reach = conductor.sound;
    vi.spyOn(conductor, "sound").mockImplementation((onset) => {
      arrivals.push({ onset, clock: ctx.currentTime });
      reach(onset);
    });
  });

  afterEach(() => {
    vi.mocked(conductor.sound).mockRestore();
    stopSemanticAudio();
    audio.setMuted(false);
    audioDirector.setIntensity("full");
  });

  /** Run the semantic scheduler's loop in 25 ms steps until `until`. */
  const run = (loop: () => void, until: number): void => {
    while (ctx.currentTime < until) {
      ctx.currentTime = Math.min(until, ctx.currentTime + 0.025);
      loop();
    }
  };

  it("puts every note of a muted player's outcome on the score, each before it sounds", () => {
    // Muted is the engine's silence and the director's silent intensity, set
    // together by the bridge: nothing at all is handed over to be heard.
    audio.setMuted(true);
    audioDirector.setIntensity("silent");
    const loops = ticks.length;
    audioDirector.handleCue(outcome());
    // A Ground is longer than the horizon, so conducting started the loop that
    // brings the rest.
    expect(ticks.length).toBe(loops + 1);
    const loop = ticks[loops];

    // Without a bed, the director's quantize answers soon after now.
    const at = 10 + UNARMED_LEAD_SECONDS;
    const plan = written();
    const last = Math.max(...plan.notes.map((n) => n.atSeconds));
    expect(last).toBeGreaterThan(SCORE_HORIZON_SECONDS);
    run(loop, at + last + 0.1);

    const expected: ScheduledOnset[] = [];
    publishPlanLights({ sound: (onset) => expected.push(onset) }, plan, at);
    const byTime = (a: ScheduledOnset, b: ScheduledOnset) => a.at - b.at;
    const onsets = arrivals.map((arrival) => arrival.onset);
    expect(onsets.length).toBe(expected.length);
    expect([...onsets].sort(byTime).map((o) => [o.conceptId, o.at, o.duration, o.weight])).toEqual(
      [...expected].sort(byTime).map((o) => [o.conceptId, expect.closeTo(o.at, 9), o.duration, o.weight])
    );
    // Each arrived before it sounded, and none more than the horizon early.
    for (const { onset, clock } of arrivals) {
      expect(clock).toBeLessThan(onset.at);
      expect(onset.at - clock).toBeLessThanOrEqual(SCORE_HORIZON_SECONDS + 1e-9);
    }
  });

  it("stops bringing what it holds when the room changes", () => {
    const concepts = [FIBONACCI, COUNTERPOINT, PRIMES];
    const plan = makeVoicePlan({
      id: "long",
      kind: "conclusion",
      intention: null,
      notes: Array.from({ length: 30 }, (_, i) => ({
        id: `n${i}`,
        conceptId: concepts[i % 3],
        role: "subject" as const,
        timbre: "glass" as const,
        articulation: "struck" as const,
        register: "mid" as const,
        degree: 0,
        frequency: 264,
        detuneCents: 0,
        atSeconds: i * 0.5,
        envelope: { attack: 0.01, hold: 0.1, release: 0.4 },
        gain: 0.05,
        floorGain: 0,
        openEnded: false,
        tense: false,
      })),
      meta: { conceptIds: concepts, grammar: "test", resolves: false, interval: null, beatingHz: null },
    });
    const loops = ticks.length;
    productionSink.conduct(plan, 10.5);
    const loop = ticks[loops];
    run(loop, 12);
    const before = arrivals.length;
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(30);
    // The room empties: whatever was still waiting is not a note any more.
    stopSemanticAudio();
    run(loop, 30);
    expect(arrivals.length).toBe(before);
  });
});
