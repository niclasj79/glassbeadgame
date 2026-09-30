/**
 * THE BED PLAYS THE PULSE (ADR-017, M4-002).
 *
 * These run the real `AmbientEngine` against a recording AudioContext. The one
 * seam is `playPulseBody`, wrapped so each onset the bed asks of a body is seen
 * with its moment, its level, its bus and the slot and sixteenth it names — the
 * real body still plays. The director's half is tested the way the director
 * always is, through a recording sink.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CASTALIA_LOOKUP } from "@/content/castalia";
import { CASTALIA_RELATIONS } from "@/content/castalia/relations";
import type { RelationIntention } from "@/domain/events";
import { toConceptId, toMotifKindId, toThreadId } from "@/domain/ids";
import type { CuePayloadMap, CueType, PresentationCue } from "@/runtime/cues";
import { frameState } from "@/scene/frameState";
import { ambient, loadPulse } from "./ambient";
import { FIRST_SLOT_LEAD_SECONDS, conductor, type ScheduledOnset } from "./conductor";
import { createAudioDirector, type AudioSink } from "./director";
import { audio } from "./engine";
import type { AudioIntensity } from "./intensity";
import { productionSink } from "./productionAudio";
import { PULSE_SIXTEENTHS, pulseCell, type PulseBody } from "./pulse";
import { PULSE_GAIN } from "./pulseBodies";
import { SCORE } from "./score";
import { voiceBudget } from "./voices";

// ─── The seam: every onset the bed asks of a body ───────────────────────────

const recorder = vi.hoisted(() => ({
  calls: [] as {
    readonly body: string;
    readonly at: number;
    readonly gain: number;
    readonly bus: unknown;
    readonly seed: string | undefined;
  }[],
}));

vi.mock("./pulseBodies", async (importOriginal) => {
  const real = await importOriginal<typeof import("./pulseBodies")>();
  return {
    ...real,
    playPulseBody: (...args: Parameters<typeof real.playPulseBody>): boolean => {
      const [, bus, body, at, gain, seed] = args;
      recorder.calls.push({ body, at, gain, bus, seed });
      return real.playPulseBody(...args);
    },
  };
});

// ─── A recording AudioContext ───────────────────────────────────────────────

interface FakeNode {
  readonly outputs: unknown[];
  connect: (target: unknown) => void;
  disconnect: () => void;
}

/** Every node made, so a test can ask what anything was connected to. */
const created: FakeNode[] = [];
/** When every oscillator starts. */
const oscillatorStarts: number[] = [];
const ticks: (() => void)[] = [];

const node = (): FakeNode => {
  const outputs: unknown[] = [];
  const made: FakeNode = {
    outputs,
    connect: (target) => {
      outputs.push(target);
    },
    disconnect: () => {},
  };
  created.push(made);
  return made;
};

const fakeParam = (initial: number) => ({
  value: initial,
  setValueAtTime: () => {},
  linearRampToValueAtTime: () => {},
  exponentialRampToValueAtTime: () => {},
  cancelScheduledValues: () => {},
  setTargetAtTime: () => {},
});

const ctx = {
  currentTime: 0,
  sampleRate: 8000,
  state: "running",
  destination: node(),
  resume: () => Promise.resolve(),
  createGain: () => Object.assign(node(), { gain: fakeParam(1) }),
  createOscillator: () =>
    Object.assign(node(), {
      type: "sine",
      frequency: fakeParam(0),
      detune: fakeParam(0),
      setPeriodicWave: () => {},
      start: (at?: number) => {
        oscillatorStarts.push(at ?? ctx.currentTime);
      },
      stop: () => {},
      addEventListener: () => {},
    }),
  createPeriodicWave: () => ({}),
  createBiquadFilter: () =>
    Object.assign(node(), {
      type: "lowpass",
      frequency: fakeParam(0),
      Q: fakeParam(1),
      detune: fakeParam(0),
      gain: fakeParam(0),
    }),
  createBufferSource: () =>
    Object.assign(node(), {
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
  createStereoPanner: () => Object.assign(node(), { pan: fakeParam(0) }),
  createDynamicsCompressor: () =>
    Object.assign(node(), {
      threshold: fakeParam(0),
      knee: fakeParam(0),
      ratio: fakeParam(1),
      attack: fakeParam(0),
      release: fakeParam(0),
    }),
  createConvolver: () => Object.assign(node(), { buffer: null }),
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
      clearInterval: () => {},
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { addEventListener: () => {}, visibilityState: "visible" },
  });
  audio.ensure();
});

// ─── The timeline ───────────────────────────────────────────────────────────

const FIBONACCI = "measure.fibonacci-sequence";
const COUNTERPOINT = "sound.counterpoint";
const PRIME = "measure.prime-numbers";
/** Castalia's slot, and its sixteenth. */
const SLOT = 2;
const STEP = SLOT / 16;

/** Only the newest interval callback: every `start()` installs one. */
const tick = (): void => ticks.at(-1)?.();

let origin = 0;

/**
 * The bed starts at `at` and writes its first slot. One thread is woven, as it
 * is whenever the web has woken at all, so the choir has a voice.
 */
function startBed(at = 10): void {
  ctx.currentTime = at;
  ambient.start();
  origin = at + FIRST_SLOT_LEAD_SECONDS;
  ambient.addThreadVoice("t1", FIBONACCI, COUNTERPOINT);
  tick();
}

/** Run the loop in 50 ms steps until `until`. */
function runUntil(until: number): void {
  while (ctx.currentTime < until - 1e-9) {
    ctx.currentTime = Math.min(until, ctx.currentTime + 0.05);
    tick();
  }
}

/** The moment by which the bed has written slot `slot` (its lookahead is 1.2 s). */
const writtenBy = (slot: number): number => origin + slot * SLOT - 1.2 + 0.05;

interface Heard {
  readonly body: string;
  readonly at: number;
  readonly gain: number;
  readonly bus: unknown;
  /** The slot that wrote the onset, and its sixteenth there, as the bed named them. */
  readonly slot: number;
  readonly sixteenth: number;
}

const heard = (): Heard[] =>
  recorder.calls.map((call) => {
    const [, slot, sixteenth] = (call.seed ?? "").split(":");
    return { ...call, slot: Number(slot), sixteenth: Number(sixteenth) };
  });

const inSlot = (slot: number): Heard[] =>
  heard()
    .filter((onset) => onset.slot === slot)
    .sort((a, b) => a.sixteenth - b.sixteenth);

/** What the bed has asked of the bodies since it had asked `count` things. */
const since = (count: number): Heard[] => heard().slice(count);

const shape = (onsets: readonly Heard[]): [number, string][] =>
  onsets.map((onset) => [onset.sixteenth, onset.body]);

const cellShape = (awakening: number, options: { fill?: boolean; secondVoice?: boolean } = {}) =>
  pulseCell(0, {
    awakening,
    density: 1,
    intensity: "full",
    secondVoice: options.secondVoice ?? false,
    fill: options.fill ?? false,
  }).map((onset) => [onset.sixteenth, onset.body] as [number, string]);

beforeEach(async () => {
  ambient.stop();
  ambient.clearSpace();
  ambient.setIntensity("full");
  conductor.disarm();
  voiceBudget.reset();
  frameState.awakening = 0.8;
  frameState.pulses.length = 0;
  oscillatorStarts.length = 0;
  ctx.currentTime = 10;
  await loadPulse();
  recorder.calls.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── The bed ────────────────────────────────────────────────────────────────

describe("the bed plays the pulse", () => {
  it("sounds nothing until the pulse has loaded, and from the first slot written after", async () => {
    // A room the pulse has never been fetched for: a fresh module graph.
    vi.resetModules();
    const fresh = await import("./ambient");
    const { audio: freshAudio } = await import("./engine");
    const { frameState: freshFrame } = await import("@/scene/frameState");
    freshAudio.ensure();
    freshFrame.awakening = 0.8;
    ctx.currentTime = 50;
    fresh.ambient.start();
    fresh.ambient.addThreadVoice("t1", FIBONACCI, COUNTERPOINT);
    // The first slot is written while the chunk is still on its way.
    tick();
    expect(recorder.calls).toEqual([]);
    expect(await fresh.loadPulse()).not.toBeNull();
    origin = 50 + FIRST_SLOT_LEAD_SECONDS;
    runUntil(writtenBy(2));
    expect(recorder.calls.length).toBeGreaterThan(0);
    expect(Math.min(...heard().map((onset) => onset.slot))).toBe(1);
    fresh.ambient.stop();
  });

  it("puts every onset on a sixteenth of the slot that wrote it, under its ceiling, through the ambient bus", () => {
    startBed();
    ambient.requestSecondVoice(12);
    runUntil(14);
    ambient.requestFill(ambient.quantize());
    runUntil(24);
    const all = heard();
    expect(all.length).toBeGreaterThan(20);
    expect(all.some((onset) => onset.body === "bell")).toBe(true);
    for (const onset of all) {
      expect(onset.at).toBeCloseTo(origin + onset.slot * SLOT + onset.sixteenth * STEP, 9);
      expect(PULSE_SIXTEENTHS).toContain(onset.sixteenth);
      expect(onset.gain).toBeGreaterThan(0);
      expect(onset.gain).toBeLessThanOrEqual(PULSE_GAIN[onset.body as PulseBody] + 1e-12);
      expect(onset.bus).toBe(audio.ambientBus);
    }
    expect(audio.tensionBus).not.toBe(audio.ambientBus);
    // Nothing the bed made was ever connected to the tension bus.
    expect(created.filter((made) => made.outputs.includes(audio.tensionBus))).toEqual([]);
  });

  it("follows the web's awakening: nothing under a quarter, the skin alone under a half, the brush from there", () => {
    frameState.awakening = 0.2;
    startBed();
    runUntil(16);
    expect(heard()).toEqual([]);

    frameState.awakening = 0.3;
    runUntil(22);
    const quarter = heard();
    expect(quarter.length).toBeGreaterThan(0);
    for (const onset of quarter) {
      expect(onset.body).toBe("skin");
      expect([0, 6, 12]).toContain(onset.sixteenth);
      expect(onset.gain).toBeCloseTo(0.3 * PULSE_GAIN.skin, 12);
    }

    recorder.calls.length = 0;
    frameState.awakening = 0.8;
    runUntil(28);
    const slots = [...new Set(heard().map((onset) => onset.slot))];
    expect(slots.length).toBeGreaterThan(1);
    for (const slot of slots) {
      expect(shape(inSlot(slot))).toEqual(cellShape(0.8));
      for (const onset of inSlot(slot)) {
        const weight = onset.body === "brush" ? 0.4 : 0.8;
        expect(onset.gain).toBeCloseTo(weight * PULSE_GAIN[onset.body as PulseBody], 12);
      }
    }
  });

  it("keeps only the downbeats under attention, at the thinned bed's level", () => {
    startBed();
    const bed = SCORE.attention.bedGainScale;
    ambient.setSpace(SCORE.attention.thinDensityScale, bed);
    recorder.calls.length = 0;
    ambient.requestSecondVoice(12);
    runUntil(22);
    const thinned = heard();
    expect(thinned.length).toBeGreaterThan(3);
    for (const onset of thinned) {
      expect([onset.sixteenth, onset.body]).toEqual([0, "skin"]);
      expect(onset.gain).toBeCloseTo(0.8 * PULSE_GAIN.skin * bed, 12);
      expect(onset.gain).toBeLessThanOrEqual(PULSE_GAIN.skin * bed + 1e-12);
    }
  });

  it("is silent under Attunement, and the heartbeat keeps the slot", () => {
    startBed();
    ambient.setSpace(SCORE.attunement.densityScale, SCORE.attunement.bedGainScale);
    recorder.calls.length = 0;
    oscillatorStarts.length = 0;
    ambient.requestSecondVoice(12);
    ambient.requestFill(ambient.quantize());
    runUntil(20);
    expect(heard()).toEqual([]);
    // Slots 1–5 were written in that time, and something sounds on every one of
    // their boundaries: the heartbeat, which the pulse leaves the slot to.
    for (let slot = 1; slot <= 5; slot += 1) {
      const boundary = origin + slot * SLOT;
      expect(oscillatorStarts.some((at) => Math.abs(at - boundary) < 1e-9)).toBe(true);
    }
  });

  it("keeps the skin on the downbeats under reduced intensity, and nothing when silent", () => {
    ambient.setIntensity("reduced");
    startBed();
    ambient.requestSecondVoice(12);
    ambient.requestFill(ambient.quantize());
    runUntil(20);
    const reduced = heard();
    expect(reduced.length).toBeGreaterThan(3);
    for (const onset of reduced) expect([onset.sixteenth, onset.body]).toEqual([0, "skin"]);

    recorder.calls.length = 0;
    ambient.setIntensity("silent");
    ambient.requestSecondVoice(12);
    ambient.requestFill(ambient.quantize());
    runUntil(30);
    expect(heard()).toEqual([]);
  });

  it("stops with the room", () => {
    startBed();
    runUntil(16);
    expect(heard().length).toBeGreaterThan(0);
    ambient.stop();
    recorder.calls.length = 0;
    // A callback still in flight, and highlights asked of a bed that is gone.
    ctx.currentTime = 30;
    tick();
    ambient.requestFill(30.25);
    ambient.requestSecondVoice(12);
    expect(heard()).toEqual([]);
  });

  it("leaves with the bed at the coda, and takes no fill under it", () => {
    startBed();
    runUntil(12);
    // The coda speaks at 20 and the bed fades over the four seconds before it:
    // no slot that would begin inside the fade is written.
    ambient.concludeAt(20, 4);
    ambient.requestFill(ambient.quantize());
    runUntil(25);
    expect(ambient.isRunning()).toBe(false);
    const all = heard();
    expect(all.length).toBeGreaterThan(0);
    for (const onset of all) expect(origin + onset.slot * SLOT).toBeLessThan(20 - 4);
    expect(all.some((onset) => onset.body === "bell")).toBe(false);
  });
});

// ─── A weave's fill ─────────────────────────────────────────────────────────

describe("a weave's fill", () => {
  it("fills the last half of the slot the landing falls in, and lands its bell on the closing boundary", () => {
    startBed();
    const written = recorder.calls.length;
    expect(shape(inSlot(0))).toEqual(cellShape(0.8));
    // Slot 0 is already written; the weave lands on its second eighth.
    ctx.currentTime = 10.3;
    ambient.requestFill(origin + 2 * STEP);
    const fill = since(written);
    expect(fill.every((onset) => onset.slot === 0)).toBe(true);
    expect(shape(fill)).toEqual([
      [8, "brush"],
      [10, "brush"],
      [11, "brush"],
      [13, "brush"],
      [14, "brush"],
      [15, "brush"],
      [16, "bell"],
    ]);
    const bell = fill.at(-1) as Heard;
    expect(bell.at).toBeCloseTo(origin + SLOT, 9);
    expect(bell.gain).toBeCloseTo(0.8 * PULSE_GAIN.bell, 12);
    for (const onset of fill) expect(onset.at).toBeGreaterThanOrEqual(10.3);
    // The slot now sounds as its cell with the fill would have.
    expect(shape(inSlot(0))).toEqual(cellShape(0.8, { fill: true }));
  });

  it("rolls into the boundary after when the landing falls in a slot's second half", () => {
    startBed();
    runUntil(11.2);
    recorder.calls.length = 0;
    // Slot 0's last half has begun by the landing: a fill there would begin
    // before the act it answers. Slot 1 is written already, and takes it.
    ambient.requestFill(origin + 10 * STEP);
    const fill = heard();
    expect(fill.every((onset) => onset.slot === 1)).toBe(true);
    expect(shape(fill)).toEqual([
      [8, "brush"],
      [10, "brush"],
      [11, "brush"],
      [13, "brush"],
      [14, "brush"],
      [15, "brush"],
      [16, "bell"],
    ]);
    expect((fill.at(-1) as Heard).at).toBeCloseTo(origin + 2 * SLOT, 9);
  });

  it("marks the right slot when it is not yet written, and that slot's cell carries the fill", () => {
    startBed();
    const written = recorder.calls.length;
    // Slot 1 begins at origin + 2 and is not written yet; its last half begins
    // after this landing, and slot 0's before it.
    ambient.requestFill(origin + SLOT + STEP * 2);
    expect(since(written)).toEqual([]);
    runUntil(writtenBy(2));
    expect(shape(inSlot(1))).toEqual(cellShape(0.8, { fill: true }));
    expect(shape(inSlot(2))).toEqual(cellShape(0.8));
    expect(shape(inSlot(0))).toEqual(cellShape(0.8));
  });

  it("is played once, however often it is asked for", () => {
    startBed();
    ctx.currentTime = 10.3;
    ambient.requestFill(origin + 2 * STEP);
    const once = heard().length;
    ambient.requestFill(origin + 2 * STEP);
    ambient.requestFill(origin + 3 * STEP);
    expect(heard().length).toBe(once);
  });

  it("is what the pulse's profile leaves of it", () => {
    startBed();
    const written = recorder.calls.length;
    ambient.setIntensity("reduced");
    ctx.currentTime = 10.3;
    ambient.requestFill(origin + 2 * STEP);
    expect(since(written)).toEqual([]);
    // And under attention's space, which a weave releases before it asks.
    ambient.setIntensity("full");
    ambient.setSpace(SCORE.attention.thinDensityScale, SCORE.attention.bedGainScale);
    ambient.requestFill(origin + 2 * STEP);
    expect(since(written)).toEqual([]);
  });
});

// ─── A completed motif's second voice ───────────────────────────────────────

describe("a completed motif's second voice", () => {
  const brushes = (slot: number): number[] =>
    inSlot(slot)
      .filter((onset) => onset.body === "brush")
      .map((onset) => onset.sixteenth);

  it("gives the next twelve slots the bed writes the brush on every other eighth, and the thirteenth none", () => {
    startBed();
    ambient.requestSecondVoice(SCORE.harmony.phraseSlots);
    runUntil(writtenBy(14));
    expect(brushes(0)).toEqual([9]);
    for (let slot = 1; slot <= 12; slot += 1) expect(brushes(slot)).toEqual([2, 9, 10, 14]);
    expect(brushes(13)).toEqual([9]);
    expect(brushes(14)).toEqual([9]);
  });

  it("is extended by a second completion, and never shortened", () => {
    startBed();
    ambient.requestSecondVoice(12);
    runUntil(writtenBy(5));
    ambient.requestSecondVoice(12);
    ambient.requestSecondVoice(3);
    runUntil(writtenBy(19));
    expect(brushes(17)).toEqual([2, 9, 10, 14]);
    expect(brushes(18)).toEqual([9]);
  });
});

// ─── No light ───────────────────────────────────────────────────────────────

describe("the pulse lights nothing", () => {
  it("puts no note on the conductor: the score is the same with the pulse silent", () => {
    const score = (intensity: AudioIntensity) => {
      ambient.stop();
      conductor.disarm();
      voiceBudget.reset();
      ambient.setIntensity(intensity);
      // Under the shimmer, whose draw on the shared random stream is its own.
      frameState.awakening = 0.6;
      recorder.calls.length = 0;
      const onsets: ScheduledOnset[] = [];
      const sound = vi.spyOn(conductor, "sound").mockImplementation((onset) => {
        onsets.push(onset);
      });
      startBed();
      ambient.requestSecondVoice(12);
      runUntil(30);
      sound.mockRestore();
      return { onsets, pulse: recorder.calls.length };
    };
    const withPulse = score("full");
    const without = score("silent");
    expect(withPulse.pulse).toBeGreaterThan(0);
    expect(without.pulse).toBe(0);
    expect(withPulse.onsets.length).toBeGreaterThan(0);
    expect(withPulse.onsets).toEqual(without.onsets);
  });
});

// ─── The director asks for the highlights ───────────────────────────────────

const cue = <Type extends CueType>(type: Type, payload: CuePayloadMap[Type]): PresentationCue =>
  ({
    id: `cue:${type}`,
    type,
    sourceEventId: null,
    startAt: 0,
    duration: 1,
    channels: ["audio"],
    payload,
  }) as PresentationCue;

const woven = (intention: RelationIntention = "echo"): PresentationCue =>
  cue("thread.woven", {
    threadId: toThreadId("t1"),
    pair: [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)],
    intention,
    gesture: { inputModality: "mouse", durationMs: 900 },
  });

const OUTCOMES: Readonly<Record<"documented" | "open-thread" | "unresolved", PresentationCue>> = {
  documented: cue("outcome.documented", {
    threadId: toThreadId("t1"),
    pair: [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)],
    intention: "echo",
    relation: CASTALIA_RELATIONS[0],
    evidence: CASTALIA_RELATIONS[0].evidence,
    reception: "confirmed",
  }),
  "open-thread": cue("outcome.open-thread", {
    threadId: toThreadId("t1"),
    pair: [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)],
    intention: "echo",
    question: "Is there a work in which this can be demonstrated?",
    sharedFacet: CASTALIA_RELATIONS[0].sharedFacets[0],
  }),
  unresolved: cue("outcome.unresolved", {
    threadId: toThreadId("t1"),
    pair: [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)],
    intention: "echo",
    statement: "The Game has no grounded relation here yet.",
  }),
};

const solved = (by: "threads" | "silence"): PresentationCue =>
  cue("study.solved", {
    studyId: "study.eschholz-1",
    by,
    threadIds: by === "threads" ? [toThreadId("t1"), toThreadId("t2")] : [],
    conceptIds: by === "threads" ? [FIBONACCI, COUNTERPOINT, PRIME].map(toConceptId) : [],
    marks: by === "threads" ? ["economical"] : [],
    brief: "From Fibonacci Sequence to Prime Numbers in two threads",
  });

/** A recording sink that keeps a pulse, as the production sink does. */
function pulseHarness(now = 100) {
  const fills: number[] = [];
  const secondVoices: number[] = [];
  const played: { readonly id: string; readonly atSeconds: number }[] = [];
  const sink: AudioSink = {
    now: () => now,
    quantize: () => now + 0.25,
    quantizeHand: () => now + 0.125,
    slotSeconds: () => SLOT,
    play: (plan, atSeconds) => {
      played.push({ id: plan.id, atSeconds });
    },
    conduct: () => {},
    setSpace: () => {},
    activeVoiceCount: () => 1,
    concludeAt: () => {},
    pulseFill: (atSeconds) => {
      fills.push(atSeconds);
    },
    pulseSecondVoice: (untilSlots) => {
      secondVoices.push(untilSlots);
    },
  };
  const director = createAudioDirector({ sink, lookup: CASTALIA_LOOKUP });
  return { director, fills, secondVoices, played };
}

describe("the director asks the bed for its highlights", () => {
  it("asks for a fill where the thread lands, at the landing's own moment", () => {
    const { director, fills, secondVoices, played } = pulseHarness();
    director.handleCue(woven());
    expect(fills).toEqual([100.25]);
    expect(played.find((plan) => plan.id === "woven:t1")?.atSeconds).toBe(fills[0]);
    expect(secondVoices).toEqual([]);
  });

  it("asks for the same fill whatever the outcome, and no outcome asks for anything (CAV-006)", () => {
    const asked = Object.entries(OUTCOMES).map(([kind, outcome]) => {
      const commit = pulseHarness();
      commit.director.handleCue(woven());
      commit.director.handleCue(outcome);
      const alone = pulseHarness();
      alone.director.handleCue(outcome);
      expect({ kind, fills: alone.fills, secondVoices: alone.secondVoices }).toEqual({
        kind,
        fills: [],
        secondVoices: [],
      });
      return { fills: commit.fills, secondVoices: commit.secondVoices };
    });
    expect(asked).toHaveLength(3);
    for (const each of asked) expect(each).toEqual({ fills: [100.25], secondVoices: [] });
  });

  it("asks for one phrase of the second voice for a completed motif and for a solved Study", () => {
    for (const moment of [
      cue("motif.completed", {
        motifKindId: toMotifKindId("canon"),
        conceptIds: [FIBONACCI, COUNTERPOINT, PRIME].map(toConceptId),
        threadIds: [toThreadId("t1"), toThreadId("t2")],
        reason: "A shared structure recurs across three concepts.",
      }),
      solved("threads"),
    ]) {
      const { director, fills, secondVoices } = pulseHarness();
      director.handleCue(moment);
      expect(secondVoices).toEqual([SCORE.harmony.phraseSlots]);
      expect(SCORE.harmony.phraseSlots).toBe(12);
      expect(fills).toEqual([]);
    }
  });

  it("asks nothing for a Study solved by a silence, which is answered by one", () => {
    const { director, fills, secondVoices } = pulseHarness();
    director.handleCue(solved("silence"));
    expect({ fills, secondVoices }).toEqual({ fills: [], secondVoices: [] });
  });

  it("asks nothing for looking: attention, a sighting, a lock, a preview, a return, Attunement", () => {
    const { director, fills, secondVoices } = pulseHarness();
    const pair = [toConceptId(FIBONACCI), toConceptId(COUNTERPOINT)] as const;
    for (const looking of [
      cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] }),
      cue("attention.sighted", {
        attendedConceptId: toConceptId(FIBONACCI),
        sighted: { conceptId: toConceptId(COUNTERPOINT), band: "medium", sharedFacets: [] },
      }),
      cue("pair.locked", { pair: [pair[0], pair[1]], sharedFacets: [] }),
      cue("reading.previewed", { pair: [pair[0], pair[1]], intention: "echo", chosen: true }),
      cue("thread.reopened", { threadId: toThreadId("t1"), pair: [pair[0], pair[1]], intention: "echo" }),
      cue("attention.clear", {}),
      cue("attunement.changed", { active: true }),
      cue("attunement.changed", { active: false }),
    ]) {
      director.handleCue(looking);
    }
    expect({ fills, secondVoices }).toEqual({ fills: [], secondVoices: [] });
  });

  it("plays as before for a sink that keeps no pulse", () => {
    const played: string[] = [];
    const sink: AudioSink = {
      now: () => 100,
      quantize: () => 100.25,
      quantizeHand: () => 100.125,
      slotSeconds: () => SLOT,
      play: (plan) => {
        played.push(plan.id);
      },
      conduct: () => {},
      setSpace: () => {},
      activeVoiceCount: () => 0,
      concludeAt: () => {},
    };
    const director = createAudioDirector({ sink, lookup: CASTALIA_LOOKUP });
    director.handleCue(woven());
    director.handleCue(solved("threads"));
    expect(played).toEqual(["woven:t1", "solved:study.eschholz-1"]);
  });
});

describe("the production sink", () => {
  it("hands the pulse's highlights to the bed", () => {
    const fill = vi.spyOn(ambient, "requestFill");
    const secondVoice = vi.spyOn(ambient, "requestSecondVoice");
    productionSink.pulseFill?.(12.4);
    productionSink.pulseSecondVoice?.(12);
    expect(fill).toHaveBeenCalledWith(12.4);
    expect(secondVoice).toHaveBeenCalledWith(12);
  });
});
