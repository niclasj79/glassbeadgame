/**
 * ATTUNEMENT HOLDS THE BED'S CHORD, AND RELEASE PLAYS ITS CADENCE (ADR-018,
 * M6-001).
 *
 * These run the real `AmbientEngine` against a recording AudioContext, as the
 * bed's other tests do. Every voice the bed asks for is recorded where it is
 * born — `playVoice` and `playNote` are wrapped, not replaced — with every
 * retirement asked of it, and every pulse onset where it is asked of a body. So
 * the claims are about what the bed schedules: the chord holds and the phrase
 * clock waits; the cadence resolves to the root over one slot on the
 * conductor's grid; the clock resumes on a boundary. The director's half is
 * tested the way the director always is, through a recording sink.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CASTALIA_LOOKUP } from "@/content/castalia";
import { CASTALIA_RELATIONS } from "@/content/castalia/relations";
import type { TimbreId } from "@/content/castalia/schema";
import { toConceptId, toThreadId } from "@/domain/ids";
import type { CuePayloadMap, CueType, PresentationCue } from "@/runtime/cues";
import { frameState } from "@/scene/frameState";
import type { WorldTheme } from "@/themes";
import { tide } from "@/themes/worlds";
import { ambient, loadPulse, loadStems } from "./ambient";
import { COMFORT } from "./comfort";
import type { PerformanceScore } from "./conclusion";
import { FIRST_SLOT_LEAD_SECONDS, conductor } from "./conductor";
import { createAudioDirector, type AudioSink } from "./director";
import { audio } from "./engine";
import { groundStrikeSlots, nextVoicing, rootForPhrase } from "./harmony";
import { productionSink } from "./productionAudio";
import { SCORE } from "./score";
import { modeFreq } from "./theory";
import { voiceBudget } from "./voices";

interface Played {
  readonly timbre: TimbreId;
  readonly frequency: number;
  readonly gain: number;
  readonly at: number;
  readonly attack: number;
  readonly hold: number;
  readonly release: number;
  readonly seed: string;
  readonly exactTuning: boolean;
}

interface Retired {
  /** The seed of the voice that was let go. */
  readonly seed: string;
  readonly at: number;
  readonly fade: number;
}

const recorded = vi.hoisted(() => ({
  played: [] as Played[],
  retired: [] as Retired[],
  /** The seed of every onset the bed asked of a pulse body: `pulse:<slot>:<sixteenth>`. */
  pulse: [] as string[],
  /** The world the bed starts in; null is the room's own (Castalia, with no session). */
  world: null as WorldTheme | null,
}));

vi.mock("@/themes/useTheme", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/themes/useTheme")>();
  return { ...actual, currentTheme: () => recorded.world ?? actual.currentTheme() };
});

vi.mock("./voices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./voices")>();
  const playVoice: typeof actual.playVoice = (ctx, dest, request) => {
    const seed = request.seed ?? "";
    const onRetire = request.onRetire;
    const sounded = actual.playVoice(
      ctx,
      dest,
      onRetire === undefined
        ? request
        : {
            ...request,
            onRetire: (retire) =>
              onRetire((at, fade) => {
                recorded.retired.push({ seed, at, fade });
                retire(at, fade);
              }),
          }
    );
    if (sounded) {
      recorded.played.push({
        timbre: request.timbre,
        frequency: request.frequency,
        gain: request.gain,
        at: request.at,
        attack: request.attack,
        hold: request.hold,
        release: request.release,
        seed,
        exactTuning: request.exactTuning ?? false,
      });
    }
    return sounded;
  };
  const playNote: typeof actual.playNote = (ctx, dest, timbre, frequency, options = {}) => {
    const sounded = actual.playNote(ctx, dest, timbre, frequency, options);
    if (sounded) {
      recorded.played.push({
        timbre,
        frequency,
        gain: options.gain ?? 0.2,
        at: options.at ?? ctx.currentTime,
        attack: options.attack ?? 0.02,
        hold: options.hold ?? 0.1,
        release: options.release ?? 1.2,
        seed: options.seed ?? "",
        exactTuning: options.exactTuning ?? false,
      });
    }
    return sounded;
  };
  return { ...actual, playVoice, playNote };
});

vi.mock("./pulseBodies", async (importOriginal) => {
  const real = await importOriginal<typeof import("./pulseBodies")>();
  return {
    ...real,
    playPulseBody: (...args: Parameters<typeof real.playPulseBody>): boolean => {
      recorded.pulse.push(args[5] ?? "");
      return real.playPulseBody(...args);
    },
  };
});

// ─── A recording AudioContext ───────────────────────────────────────────────

const ticks: (() => void)[] = [];

const fakeParam = (initial: number) => ({
  value: initial,
  setValueAtTime: () => {},
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
    start: () => {},
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

beforeAll(async () => {
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
  // The stems and the pulse stay loaded once they have arrived: every slot the
  // bed writes here can carry both, which is what makes their absence from the
  // cadence's slot a claim rather than an accident.
  expect(await loadStems()).not.toBeNull();
  expect(await loadPulse()).not.toBeNull();
});

afterAll(() => {
  vi.restoreAllMocks();
});

// ─── The timeline ───────────────────────────────────────────────────────────

const START = 10;
/** The bed's first slot, and so the grid's origin. */
const ORIGIN = START + FIRST_SLOT_LEAD_SECONDS;
/** How far ahead the bed writes its slots (`LOOKAHEAD_S` in the bed). */
const LOOKAHEAD = 1.2;
const LEAD = SCORE.harmony.cadenceLeadSeconds;
const FADE = SCORE.harmony.crossfadeSeconds;
const PHRASE = SCORE.harmony.phraseSlots;

const FIBONACCI = "measure.fibonacci-sequence";
const COUNTERPOINT = "sound.counterpoint";
const STANDING_WAVE = "matter.standing-wave";

/** The world's slot, in the world the bed was last started in. */
let slotSeconds = 2;
const slotStart = (slot: number): number => ORIGIN + slot * slotSeconds;
/** A moment by which the bed has written `slot`, and not the slot after it. */
const writtenBy = (slot: number): number => slotStart(slot) - LOOKAHEAD + 0.05;

/** Only the newest interval callback: every `start()` installs one. */
const tick = (): void => ticks.at(-1)?.();

/** Let the loop compose, in 50 ms steps, until the clock reads `until`. */
function runUntil(until: number): void {
  while (ctx.currentTime < until - 1e-9) {
    ctx.currentTime = Math.min(until, ctx.currentTime + 0.05);
    tick();
  }
}

/** The bed starts in `world` (the room's own by default), with two threads seated. */
function startBed(world: WorldTheme | null = null): void {
  recorded.world = world;
  slotSeconds = world?.music.slotSeconds ?? 2;
  ctx.currentTime = START;
  ambient.start();
  ambient.addThreadVoice("t1", FIBONACCI, COUNTERPOINT);
  ambient.addThreadVoice("t2", STANDING_WAVE, FIBONACCI);
  tick();
}

/** The room is empty again, and nothing is recorded. */
function emptyRoom(): void {
  ambient.stop();
  ambient.clearSpace();
  ambient.setIntensity("full");
  conductor.disarm();
  voiceBudget.reset();
  frameState.pulses.length = 0;
  ctx.currentTime = START;
  slotSeconds = 2;
  recorded.played.length = 0;
  recorded.retired.length = 0;
  recorded.pulse.length = 0;
}

/**
 * The cadence's boundary as the scene reads it at the cue: the conductor's
 * next slot at least the lead ahead. The bed computes it by the same formula
 * from the same origin, so the two are compared exactly.
 */
const cadenceInstant = (): number => conductor.next(1, LEAD);

const played = (prefix: string): Played[] =>
  recorded.played.filter((note) => note.seed.startsWith(prefix));

/** The ground struck in `slot`: the drone, then the pad, low to high. */
const ground = (slot: number): Played[] => played(`ground:${slot}:`);
/** Every slot the ground was struck in. */
const groundSlots = (): number[] =>
  [...new Set(played("ground:").map((note) => Number(note.seed.split(":")[1])))].sort(
    (a, b) => a - b
  );
/** What the ground struck in `slot` sounds: the drone's pitch, then the pad's. */
const chordAt = (slot: number): number[] => ground(slot).map((note) => note.frequency);
/** The drone on `root` and the pad on `voicing`, as the bed tunes them. */
const chord = (root: number, voicing: readonly number[]): number[] => [
  modeFreq(root, "low"),
  ...voicing.map((degree) => modeFreq(degree, "low")),
];

/** The heartbeat on the boundary of `slot`: the one note on every slot, on the root, sub. */
const heartbeat = (slot: number): Played | undefined =>
  recorded.played.find(
    (note) =>
      note.seed === "" &&
      note.timbre === "glass" &&
      note.attack === 0.06 &&
      note.release === 0.7 &&
      Math.abs(note.at - slotStart(slot)) < 1e-9
  );

const pulseIn = (slot: number): string[] =>
  recorded.pulse.filter((seed) => Number(seed.split(":")[1]) === slot);
const stemsIn = (slot: number): Played[] =>
  played("stem:").filter((note) => Number(note.seed.split(":")[2]) === slot);

/** The pad over phrase `phrase`, led from the first. */
const voicingFor = (phrase: number): number[] => {
  let voicing: number[] | null = null;
  for (let p = 0; p <= phrase; p += 1) voicing = nextVoicing(voicing, rootForPhrase(p));
  return voicing as number[];
};

const bySeed = (retired: readonly Retired[]): Retired[] =>
  [...retired].sort((a, b) => a.seed.localeCompare(b.seed) || a.at - b.at);

beforeEach(() => {
  emptyRoom();
  // Awake enough for the heartbeat and the pulse's full cell, short of the
  // shimmer, whose draw on the shared random stream is its own.
  frameState.awakening = 0.6;
});

afterEach(() => {
  recorded.world = null;
});

// ─── The hold ───────────────────────────────────────────────────────────────

/**
 * The held chord, in every test below: the bed has written slot 14, so the
 * harmony has advanced fifteen slots and stands in the second phrase, on F.
 */
const HELD_ROOT = rootForPhrase(1);
const HELD_PAD = voicingFor(1);
/** The pad's root voice over F, and the arrival an octave above it. */
const PAD_ROOT = 17;
const ARRIVAL = PAD_ROOT + 12;

describe("the chord holds while Attunement does", () => {
  it("is the second phrase's F, voiced F3 over A2 and C3", () => {
    expect(HELD_ROOT).toBe(5);
    expect(HELD_PAD).toEqual([9, 12, PAD_ROOT]);
  });

  for (const world of [null, tide] as const) {
    it(`holds root and voicing for three phrases and more, struck again on its own span, no voice past its bound (${world?.name ?? "Castalia"})`, () => {
      startBed(world);
      const strikeSlots = groundStrikeSlots(slotSeconds);
      runUntil(writtenBy(14));
      const before = groundSlots();
      ambient.holdHarmony(true);
      const last = 14 + 3 * PHRASE + 3;
      runUntil(writtenBy(last));

      // Struck again every strike's span from the last strike before the hold,
      // and only ever on the held chord: across the phrase boundaries at 24, 36
      // and 48 nothing turns.
      expect(before.at(-1)).toBe(12);
      const held = groundSlots().filter((slot) => slot > 14);
      const expected: number[] = [];
      for (let slot = 12 + strikeSlots; slot <= last; slot += strikeSlots) expected.push(slot);
      expect(held).toEqual(expected);
      expect(expected.length).toBeGreaterThanOrEqual((3 * PHRASE) / strikeSlots);
      for (const slot of held) {
        expect(chordAt(slot)).toEqual(chord(HELD_ROOT, HELD_PAD));
        for (const note of ground(slot)) expect(note.at).toBeCloseTo(slotStart(slot), 9);
      }
      // Each strike hands over to the next where it begins to release, so the
      // chord sustains rather than restarting.
      for (const [index, slot] of [12, ...held].entries()) {
        const next = held[index];
        if (next === undefined) break;
        for (const note of ground(slot)) {
          expect(note.at + note.attack + note.hold).toBeCloseTo(slotStart(next), 9);
          expect(note.release).toBe(FADE);
        }
      }
      // No slot moved the phrase: the heartbeat, on the root, never leaves F.
      for (let slot = 15; slot <= last; slot += 1) {
        expect(heartbeat(slot)?.frequency).toBe(modeFreq(HELD_ROOT, "sub"));
      }
      for (const note of played("ground:")) {
        expect(note.attack + note.hold + note.release).toBeLessThanOrEqual(
          COMFORT.voice.maxLifetimeSeconds
        );
      }
      // A hold lets nothing go and arrives on nothing.
      expect(recorded.retired).toEqual([]);
      expect(played("cadence:")).toEqual([]);
    });
  }

  it("is let go with the room: every session's harmony begins unheld", () => {
    startBed();
    runUntil(writtenBy(3));
    ambient.holdHarmony(true);
    ambient.stop();
    emptyRoom();
    startBed();
    runUntil(writtenBy(PHRASE));
    expect(groundSlots()).toEqual([0, PHRASE]);
    expect(chordAt(PHRASE)).toEqual(chord(rootForPhrase(1), voicingFor(1)));
  });
});

// ─── The cadence ────────────────────────────────────────────────────────────

describe("release plays the cadence", () => {
  /**
   * Held from slot 14 as the director holds it — the space thinned to
   * Attunement's — and released half a slot into slot 30, when slot 31 is not
   * yet written. The held chord was last struck in slot 24.
   */
  const holdThenRelease = (): { readonly now: number; readonly expected: number } => {
    startBed();
    runUntil(writtenBy(14));
    ambient.holdHarmony(true);
    ambient.setSpace(SCORE.attunement.densityScale, SCORE.attunement.bedGainScale);
    runUntil(slotStart(30) + 0.5);
    const now = ctx.currentTime;
    const expected = cadenceInstant();
    recorded.retired.length = 0;
    ambient.holdHarmony(false);
    ambient.setSpace(1, 1);
    return { now, expected };
  };

  it("begins on the first boundary at least the lead ahead: the conductor's own next slot", () => {
    const { now, expected } = holdThenRelease();
    const at = slotStart(31);
    expect(expected).toBeCloseTo(at, 9);
    expect(expected).toBeGreaterThanOrEqual(now + LEAD);
    expect(expected - (now + LEAD)).toBeLessThan(slotSeconds);
    const [arrival] = played("cadence:");
    expect(arrival.at).toBe(expected);
  });

  it("lets the fifth and the colour go over the slot, and holds the drone and the pad's root to the boundary after it", () => {
    const { expected: at } = holdThenRelease();
    expect(bySeed(recorded.retired)).toEqual(
      bySeed([
        { seed: "ground:24:voice:9", at, fade: slotSeconds },
        { seed: "ground:24:voice:12", at, fade: slotSeconds },
        { seed: `ground:24:glass:${HELD_ROOT}`, at: at + slotSeconds, fade: FADE },
        { seed: `ground:24:voice:${PAD_ROOT}`, at: at + slotSeconds, fade: FADE },
      ])
    );
  });

  it("arrives on one voice, the root an octave above the pad's, swelling to the boundary and handing over there", () => {
    const { expected: at } = holdThenRelease();
    expect(played("cadence:")).toEqual([
      {
        timbre: "voice",
        frequency: modeFreq(ARRIVAL, "low"),
        // The pad's level under the bed the hold was heard at.
        gain: SCORE.harmony.padGain * SCORE.attunement.bedGainScale,
        at,
        attack: slotSeconds,
        hold: 0,
        release: FADE,
        seed: `cadence:31:voice:${ARRIVAL}`,
        exactTuning: true,
      },
    ]);
    expect(modeFreq(ARRIVAL, "low")).toBeCloseTo(2 * modeFreq(PAD_ROOT, "low"), 9);
  });

  it("writes no pulse, no stem and no ground in the cadence's slot, over the heartbeat on the held root", () => {
    holdThenRelease();
    // A weave landing in the cadence's slot asks for a fill there; it goes with
    // the slot's pulse.
    ambient.requestFill(slotStart(31) + 0.1);
    runUntil(writtenBy(33));
    expect(pulseIn(31)).toEqual([]);
    expect(stemsIn(31)).toEqual([]);
    expect(ground(31)).toEqual([]);
    expect(heartbeat(31)?.frequency).toBe(modeFreq(HELD_ROOT, "sub"));
    // The slots after it carry both, at the density the release restored.
    for (const slot of [32, 33]) {
      expect(pulseIn(slot).length).toBeGreaterThan(0);
      expect(stemsIn(slot).length).toBeGreaterThan(0);
    }
  });

  it("strikes the next phrase's chord on the boundary after it, led from the held voicing, and moves on from there", () => {
    const { expected: at } = holdThenRelease();
    runUntil(writtenBy(32 + 2 * PHRASE));
    // The phrase it paused in was the second (F); the third (A) follows, and
    // the fourth (G) a phrase later. None is skipped.
    const third = nextVoicing(HELD_PAD, rootForPhrase(2));
    const fourth = nextVoicing(third, rootForPhrase(3));
    expect(rootForPhrase(2)).toBe(9);
    expect(groundSlots().filter((slot) => slot > 24)).toEqual([32, 32 + PHRASE, 32 + 2 * PHRASE]);
    expect(chordAt(32)).toEqual(chord(rootForPhrase(2), third));
    expect(chordAt(32 + PHRASE)).toEqual(chord(rootForPhrase(3), fourth));
    expect(chordAt(32 + 2 * PHRASE)).toEqual(
      chord(rootForPhrase(4), nextVoicing(fourth, rootForPhrase(4)))
    );
    for (const note of ground(32)) expect(note.at).toBeCloseTo(at + slotSeconds, 9);
    // The arrival and the root it doubles hand over across the same boundary
    // the next chord attacks on.
    const [arrival] = played("cadence:");
    expect(arrival.at + arrival.attack).toBeCloseTo(slotStart(32), 9);
    expect(heartbeat(32)?.frequency).toBe(modeFreq(rootForPhrase(2), "sub"));
    expect(heartbeat(32 + PHRASE)?.frequency).toBe(modeFreq(rootForPhrase(3), "sub"));
  });

  it("closes the phrase whose chord it holds, even where the hold began on that phrase's last slot", () => {
    startBed();
    // The first phrase is written to its last slot, and the second's chord is
    // not yet struck: the harmony has advanced exactly one phrase.
    runUntil(writtenBy(PHRASE - 1));
    ambient.holdHarmony(true);
    runUntil(slotStart(PHRASE + 1) + 0.5);
    const at = cadenceInstant();
    ambient.holdHarmony(false);
    // Held across the boundary, the first phrase's chord (C) was struck again
    // on it, and the cadence resolves that chord, arriving on C4…
    expect(chordAt(PHRASE)).toEqual(chord(rootForPhrase(0), voicingFor(0)));
    expect(played("cadence:").map((note) => [note.frequency, note.at])).toEqual([
      [modeFreq(24, "low"), at],
    ]);
    // …and the second phrase (F) follows it, not the third.
    runUntil(writtenBy(PHRASE + 3));
    expect(groundSlots()).toEqual([0, PHRASE, PHRASE + 3]);
    expect(chordAt(PHRASE + 3)).toEqual(chord(rootForPhrase(1), voicingFor(1)));
    for (const note of ground(PHRASE + 3)) expect(note.at).toBeCloseTo(at + slotSeconds, 9);
  });

  it("begins on the conductor's boundary wherever in a slot the release falls, written ahead or not", () => {
    for (const offset of [0, 0.3, 0.7, 0.8, 0.85, 1.2, 1.6, 1.94, 1.96, 1.99]) {
      emptyRoom();
      startBed();
      runUntil(writtenBy(3));
      ambient.holdHarmony(true);
      runUntil(slotStart(5) + offset);
      const now = ctx.currentTime;
      const expected = cadenceInstant();
      ambient.holdHarmony(false);
      const arrival = played("cadence:");
      expect(arrival).toHaveLength(1);
      expect(arrival[0].at).toBe(expected);
      // On the slot grid, the first boundary at least the lead ahead.
      const slots = (expected - ORIGIN) / slotSeconds;
      expect(Math.abs(slots - Math.round(slots))).toBeLessThan(1e-9);
      expect(expected).toBeGreaterThanOrEqual(now + LEAD - 1e-9);
      expect(expected - (now + LEAD)).toBeLessThan(slotSeconds);
      // The first phrase was paused in; the second resumes one slot later.
      runUntil(expected + slotSeconds);
      const resumed = Math.round(slots) + 1;
      expect(groundSlots()).toEqual([0, resumed]);
      expect(chordAt(resumed)).toEqual(chord(rootForPhrase(1), voicingFor(1)));
    }
  });

  it("strikes the root alone across the cadence when the held chord was due to be struck on its slot", () => {
    startBed();
    runUntil(writtenBy(14));
    ambient.holdHarmony(true);
    // Struck again in 24, the held chord is due again in 36: released half a
    // slot into 35, the cadence falls on that very slot.
    runUntil(slotStart(35) + 0.5);
    recorded.retired.length = 0;
    const at = cadenceInstant();
    expect(at).toBeCloseTo(slotStart(36), 9);
    ambient.holdHarmony(false);
    expect(
      played("cadence:").map((note) => [note.seed, note.at, note.attack, note.hold, note.release])
    ).toEqual([
      [`cadence:36:voice:${ARRIVAL}`, at, slotSeconds, 0, FADE],
      [`cadence:36:glass:${HELD_ROOT}`, at, FADE, 0, FADE],
      [`cadence:36:voice:${PAD_ROOT}`, at, FADE, 0, FADE],
    ]);
    // The fifth and the colour of the last strike let go over the slot.
    const resolving = recorded.retired.filter((entry) =>
      /^ground:24:voice:(9|12)$/.test(entry.seed)
    );
    expect(resolving).toEqual([
      { seed: "ground:24:voice:9", at, fade: slotSeconds },
      { seed: "ground:24:voice:12", at, fade: slotSeconds },
    ]);
    runUntil(writtenBy(37));
    expect(ground(36)).toEqual([]);
    expect(chordAt(37)).toEqual(chord(rootForPhrase(2), nextVoicing(HELD_PAD, rootForPhrase(2))));
  });

  it("only un-holds where nothing is sounding to resolve", () => {
    // Before the first slot is written there is no chord yet.
    ctx.currentTime = START;
    ambient.start();
    ambient.holdHarmony(true);
    ambient.holdHarmony(false);
    tick();
    expect(played("cadence:")).toEqual([]);
    expect(groundSlots()).toEqual([0]);
    // And a release with nothing held is nothing at all.
    runUntil(writtenBy(4));
    ambient.holdHarmony(false);
    runUntil(writtenBy(PHRASE));
    expect(played("cadence:")).toEqual([]);
    expect(groundSlots()).toEqual([0, PHRASE]);
  });
});

// ─── Held again during the cadence ──────────────────────────────────────────

describe("held again before the cadence has closed", () => {
  /**
   * Held from slot 14, released half a slot into slot 30: the cadence is on
   * 31, and the harmony would resume on 32.
   */
  const release = (): { readonly at: number; readonly resumeAt: number } => {
    startBed();
    runUntil(writtenBy(14));
    ambient.holdHarmony(true);
    runUntil(slotStart(30) + 0.5);
    const at = cadenceInstant();
    ambient.holdHarmony(false);
    expect(at).toBeCloseTo(slotStart(31), 9);
    return { at, resumeAt: at + slotSeconds };
  };

  it("takes the cadence back before it begins: the held chord is struck again on its boundary, and the arrival never sounds", () => {
    const { at } = release();
    // The cadence's slot is written — it struck nothing — but its boundary is
    // still ahead.
    runUntil(slotStart(30) + 0.9);
    expect(ground(31)).toEqual([]);
    recorded.retired.length = 0;
    ambient.holdHarmony(true);
    expect(chordAt(31)).toEqual(chord(HELD_ROOT, HELD_PAD));
    for (const note of ground(31)) {
      expect(note.at).toBe(at);
      // A whole strike's span: the held chord is held again.
      expect(note.attack + note.hold).toBeCloseTo(groundStrikeSlots(slotSeconds) * slotSeconds, 9);
    }
    // The arrival is let go at its own onset, so it never begins; the drone and
    // the pad's root hand over here rather than a slot later; the fifth and the
    // colour keep the fade they began.
    expect(bySeed(recorded.retired)).toEqual(
      bySeed([
        { seed: `cadence:31:voice:${ARRIVAL}`, at, fade: FADE },
        { seed: `ground:24:glass:${HELD_ROOT}`, at, fade: FADE },
        { seed: `ground:24:voice:${PAD_ROOT}`, at, fade: FADE },
      ])
    );
    // The resume is cancelled: nothing turns at 32, the held chord is struck
    // again a strike's span on, and the slot after the cancelled cadence is an
    // ordinary slot again.
    runUntil(writtenBy(31 + PHRASE));
    expect(groundSlots().filter((slot) => slot > 24)).toEqual([31, 31 + PHRASE]);
    expect(chordAt(31 + PHRASE)).toEqual(chord(HELD_ROOT, HELD_PAD));
    expect(heartbeat(32)?.frequency).toBe(modeFreq(HELD_ROOT, "sub"));
    expect(pulseIn(32).length).toBeGreaterThan(0);
  });

  it("takes it back once it has begun: the held chord returns on the boundary the phrase would have turned on", () => {
    const { resumeAt } = release();
    // The cadence has begun; the slot it resumes on is not yet written.
    runUntil(slotStart(31) + 0.3);
    recorded.retired.length = 0;
    ambient.holdHarmony(true);
    expect(chordAt(32)).toEqual(chord(HELD_ROOT, HELD_PAD));
    for (const note of ground(32)) expect(note.at).toBe(resumeAt);
    // Only the arrival is let go anew; everything else keeps the fade the
    // cadence gave it, and none is let go twice.
    expect(recorded.retired).toEqual([
      { seed: `cadence:31:voice:${ARRIVAL}`, at: resumeAt, fade: FADE },
    ]);
    runUntil(writtenBy(33));
    expect(heartbeat(32)?.frequency).toBe(modeFreq(HELD_ROOT, "sub"));
    expect(heartbeat(33)?.frequency).toBe(modeFreq(HELD_ROOT, "sub"));
  });

  it("stays on the phrase it paused in, so the next release resumes on the phrase after it", () => {
    release();
    runUntil(slotStart(31) + 0.3);
    ambient.holdHarmony(true);
    runUntil(slotStart(40) + 0.5);
    ambient.holdHarmony(false);
    runUntil(writtenBy(42));
    // Released again on 41: the third phrase, not the fourth, follows on 42.
    expect(played("cadence:41:").length).toBeGreaterThan(0);
    expect(groundSlots().filter((slot) => slot > 32)).toEqual([42]);
    expect(chordAt(42)).toEqual(chord(rootForPhrase(2), nextVoicing(HELD_PAD, rootForPhrase(2))));
  });
});

// ─── Without a hold ─────────────────────────────────────────────────────────

describe("without a hold", () => {
  it("keeps the phrase clock on the bed's own slots: strikes, roots and every slot's heartbeat as before", () => {
    startBed();
    runUntil(writtenBy(2 * PHRASE + 1));
    expect(groundSlots()).toEqual([0, PHRASE, 2 * PHRASE]);
    for (const phrase of [0, 1, 2]) {
      expect(chordAt(phrase * PHRASE)).toEqual(chord(rootForPhrase(phrase), voicingFor(phrase)));
    }
    for (let slot = 0; slot <= 2 * PHRASE + 1; slot += 1) {
      expect(heartbeat(slot)?.frequency).toBe(
        modeFreq(rootForPhrase(Math.floor(slot / PHRASE)), "sub")
      );
      expect(pulseIn(slot).length).toBeGreaterThan(0);
    }
    expect(played("cadence:")).toEqual([]);
    expect(recorded.retired).toEqual([]);
  });
});

// ─── The director ───────────────────────────────────────────────────────────

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

const documented = (threadId: string, a: string, b: string): PresentationCue =>
  cue("outcome.documented", {
    threadId: toThreadId(threadId),
    pair: [toConceptId(a), toConceptId(b)],
    intention: "echo",
    relation: CASTALIA_RELATIONS[0],
    evidence: CASTALIA_RELATIONS[0].evidence,
    reception: "confirmed",
  });

const PERFORMANCE = {
  sessionId: "s1",
  secondsPerBeat: 0.75,
  entries: [],
  ensembles: [],
  unresolved: [],
  coda: null,
  totalSeconds: 4,
} satisfies PerformanceScore;

/** A sink that logs, in order, everything the director asks of it; with or without a bed to hold. */
function holdHarness(keepsBed = true) {
  const log: string[] = [];
  const sink: AudioSink = {
    now: () => 100,
    quantize: () => 100.25,
    quantizeHand: () => 100.125,
    slotSeconds: () => 2,
    play: (plan) => {
      log.push(`play:${plan.id}`);
    },
    conduct: (plan) => {
      log.push(`conduct:${plan.id}`);
    },
    setSpace: (density, bed) => {
      log.push(`space:${density}:${bed}`);
    },
    activeVoiceCount: () => 2,
    concludeAt: () => {
      log.push("concludeAt");
    },
    ...(keepsBed
      ? {
          holdHarmony: (held: boolean) => {
            log.push(`hold:${held}`);
          },
        }
      : {}),
  };
  const director = createAudioDirector({ sink, lookup: CASTALIA_LOOKUP });
  director.handleCue(documented("t1", FIBONACCI, COUNTERPOINT));
  director.handleCue(documented("t2", STANDING_WAVE, FIBONACCI));
  log.length = 0;
  return { director, log };
}

describe("the director holds the bed through Attunement", () => {
  it("holds the chord before the space thins and before the first channel is conducted or played", () => {
    const { director, log } = holdHarness();
    director.handleCue(cue("attunement.changed", { active: true }));
    expect(log[0]).toBe("hold:true");
    expect(log[1]).toBe(
      `space:${SCORE.attunement.densityScale}:${SCORE.attunement.bedGainScale}`
    );
    expect(log.filter((entry) => entry.startsWith("play:attunement:")).length).toBeGreaterThan(0);
    expect(log.filter((entry) => entry.startsWith("hold:"))).toEqual(["hold:true"]);
  });

  it("releases it when Attunement ends, before the space returns", () => {
    const { director, log } = holdHarness();
    director.handleCue(cue("attunement.changed", { active: true }));
    log.length = 0;
    director.handleCue(cue("attunement.changed", { active: false }));
    expect(log).toEqual(["hold:false", "space:1:1"]);
  });

  it("releases it when the conclusion begins, first, whether or not the performance can be read", () => {
    const { director, log } = holdHarness();
    director.handleCue(cue("attunement.changed", { active: true }));
    log.length = 0;
    director.handleCue(cue("conclusion.perform", { performance: PERFORMANCE }));
    expect(log[0]).toBe("hold:false");
    expect(log.filter((entry) => entry.startsWith("hold:"))).toEqual(["hold:false"]);
    log.length = 0;
    director.handleCue(cue("conclusion.perform", { performance: { oops: true } }));
    expect(log).toEqual(["hold:false"]);
  });

  it("asks the same at silent intensity: muting strips the sound, never the schedule", () => {
    const { director, log } = holdHarness();
    director.setIntensity("silent");
    director.handleCue(cue("attunement.changed", { active: true }));
    director.handleCue(cue("attunement.changed", { active: false }));
    director.handleCue(cue("conclusion.perform", { performance: PERFORMANCE }));
    expect(log.filter((entry) => entry.startsWith("hold:"))).toEqual([
      "hold:true",
      "hold:false",
      "hold:false",
    ]);
    expect(log.filter((entry) => entry.startsWith("play:"))).toEqual([]);
  });

  it("asks nothing of the hold on a reset, or of any other moment", () => {
    const { director, log } = holdHarness();
    director.handleCue(cue("attention.enter", { conceptId: toConceptId(FIBONACCI), candidates: [] }));
    director.handleCue(cue("attention.clear", {}));
    director.reset();
    expect(log.filter((entry) => entry.startsWith("hold:"))).toEqual([]);
  });

  it("plays Attunement as before for a sink that keeps no bed", () => {
    const withBed = holdHarness();
    const without = holdHarness(false);
    for (const { director } of [withBed, without]) {
      director.handleCue(cue("attunement.changed", { active: true }));
      director.handleCue(cue("attunement.changed", { active: false }));
      director.handleCue(cue("conclusion.perform", { performance: PERFORMANCE }));
    }
    expect(without.log).toEqual(withBed.log.filter((entry) => !entry.startsWith("hold:")));
    expect(without.log.filter((entry) => entry.startsWith("play:attunement:")).length).toBeGreaterThan(0);
  });
});

describe("the production sink", () => {
  it("hands Attunement's hold to the bed", () => {
    const hold = vi.spyOn(ambient, "holdHarmony");
    try {
      productionSink.holdHarmony?.(true);
      productionSink.holdHarmony?.(false);
      expect(hold.mock.calls).toEqual([[true], [false]]);
    } finally {
      hold.mockRestore();
    }
  });
});
