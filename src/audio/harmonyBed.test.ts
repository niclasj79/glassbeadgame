/**
 * THE BED'S MOVING HARMONY AND ITS STEMS, AS SCHEDULED (ADR-017, M4-002).
 *
 * These run the real `AmbientEngine` against a recording AudioContext. Every
 * voice the bed asks for is recorded where it is born — `playVoice` and
 * `playNote` are wrapped, not replaced — so the claims are about what the bed
 * actually schedules: the root it walks, where the ground turns, the chord it
 * crossfades, and the stems it plays for the threads it has been given.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { FacultyId, TimbreId } from "@/content/castalia/schema";
import { frameState } from "@/scene/frameState";
import type { WorldTheme } from "@/themes";
import { tide } from "@/themes/worlds";
import { ambient, loadStems } from "./ambient";
import { COMFORT } from "./comfort";
import { FIRST_SLOT_LEAD_SECONDS, conductor } from "./conductor";
import { audio } from "./engine";
import { chordFor, nextVoicing, rootForPhrase } from "./harmony";
import { SCORE } from "./score";
import { STEM_CEILING, STEM_VOICE_RESERVE, stemPlan, stemSpeaks } from "./stems";
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

const recorded = vi.hoisted(() => ({
  played: [] as Played[],
  retired: [] as { readonly at: number; readonly fade: number }[],
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
                recorded.retired.push({ at, fade });
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
        seed: request.seed ?? "",
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

afterAll(() => {
  vi.restoreAllMocks();
});

const START = 10;
/** The bed's first slot, and so the grid's origin. */
const ORIGIN = START + FIRST_SLOT_LEAD_SECONDS;
/** No session in the room: Castalia's slot and phrase. */
const SLOT = 2;
const PHRASE = SCORE.harmony.phraseSlots * SLOT;

/** Only the newest interval callback: every `start()` installs one. */
const tick = (): void => ticks.at(-1)?.();

/** Let the loop compose until the clock reads `until`. */
const runUntil = (until: number): void => {
  while (ctx.currentTime < until) {
    ctx.currentTime = Math.min(until, ctx.currentTime + 0.5);
    tick();
  }
};

const played = (prefix: string): Played[] =>
  recorded.played.filter((note) => note.seed.startsWith(prefix));
/** The slot a note was scheduled in, from its seed: `ground:<slot>:…` or `stem:<faculty>:<slot>:…`. */
const slotOf = (seed: string): number => Number(seed.split(":")[seed.startsWith("stem:") ? 2 : 1]);

const FIBONACCI = "measure.fibonacci-sequence";
const COUNTERPOINT = "sound.counterpoint";
const STANDING_WAVE = "matter.standing-wave";

beforeEach(() => {
  ambient.stop();
  conductor.disarm();
  voiceBudget.reset();
  frameState.awakening = 0;
  frameState.pulses.length = 0;
  ctx.currentTime = START;
  recorded.played.length = 0;
  recorded.retired.length = 0;
});

describe("the stems wait for their module", () => {
  // First in the file on purpose: the module stays loaded once it has arrived.
  it("plays no stem until the module has arrived, then plays from the next slot", async () => {
    ambient.start();
    ambient.addThreadVoice("t1", FIBONACCI, COUNTERPOINT);
    tick();
    expect(played("ground:").length).toBeGreaterThan(0);
    expect(played("stem:")).toEqual([]);
    expect(await loadStems()).not.toBeNull();
    runUntil(ORIGIN + 3 * SLOT);
    expect(played("stem:").length).toBeGreaterThan(0);
  });
});

describe("the harmony that moves", () => {
  it("walks the root 0, 5, 9, 7 and home, turning the drone on the phrase boundary and nowhere else", () => {
    ambient.start();
    runUntil(ORIGIN + 4 * PHRASE + 1);
    const drones = played("ground:").filter((note) => note.timbre === "glass");
    expect(drones.map((note) => note.at - ORIGIN)).toEqual([0, 1, 2, 3, 4].map((p) => p * PHRASE));
    expect(drones.map((note) => note.frequency)).toEqual(
      [0, 5, 9, 7, 0].map((root) => modeFreq(root, "low"))
    );
    // Nothing else is ground: the eight-slot refresh is gone.
    expect(new Set(played("ground:").map((note) => slotOf(note.seed)))).toEqual(
      new Set([0, 12, 24, 36, 48])
    );
  });

  it("voices the pad as a three-voice chord, led from phrase to phrase", () => {
    ambient.start();
    runUntil(ORIGIN + 4 * PHRASE + 1);
    const pad = played("ground:").filter((note) => note.timbre === "voice");
    let voicing: number[] | null = null;
    for (let phrase = 0; phrase <= 4; phrase += 1) {
      voicing = nextVoicing(voicing, rootForPhrase(phrase));
      const chord = pad.filter((note) => slotOf(note.seed) === phrase * SCORE.harmony.phraseSlots);
      expect(chord.map((note) => note.frequency)).toEqual(
        voicing.map((degree) => modeFreq(degree, "low"))
      );
      // Three voices together at or under twice the one-note pad they replaced.
      expect(chord.reduce((sum, note) => sum + note.gain, 0)).toBeLessThanOrEqual(0.1);
    }
  });

  it("crossfades the chord over two seconds across the boundary, and tunes the ground exactly", () => {
    ambient.start();
    runUntil(ORIGIN + 2 * PHRASE + 1);
    const ground = played("ground:");
    for (const note of ground) {
      expect(note.exactTuning).toBe(true);
      expect(note.attack).toBe(SCORE.harmony.crossfadeSeconds);
      expect(note.release).toBe(SCORE.harmony.crossfadeSeconds);
      // The release begins on the next boundary, where the next chord attacks.
      expect(note.at + note.attack + note.hold - ORIGIN).toBeCloseTo(
        (slotOf(note.seed) / SCORE.harmony.phraseSlots + 1) * PHRASE,
        9
      );
    }
  });

  it("re-strikes the same chord at the half phrase where the phrase outlives a voice (Tide's 2.4 s slot)", () => {
    recorded.world = tide;
    try {
      ambient.start();
      const phraseSlots = SCORE.harmony.phraseSlots;
      runUntil(ORIGIN + 2 * phraseSlots * tide.music.slotSeconds + 1);
      const drones = played("ground:").filter((note) => note.timbre === "glass");
      expect(drones.map((note) => slotOf(note.seed))).toEqual([0, 6, 12, 18, 24]);
      // The root still turns only on the phrase boundary.
      expect(drones.map((note) => note.frequency)).toEqual(
        [0, 0, 5, 5, 9].map((root) => modeFreq(root, "low"))
      );
      for (const note of played("ground:")) {
        expect(note.attack + note.hold + note.release).toBeLessThanOrEqual(
          COMFORT.voice.maxLifetimeSeconds
        );
      }
    } finally {
      recorded.world = null;
    }
  });

  it("lets the ground go over the crossfade when the bed stops, rather than hold it in an empty room", () => {
    ambient.start();
    runUntil(ORIGIN + PHRASE + 1);
    expect(recorded.retired).toEqual([]);
    ctx.currentTime = ORIGIN + PHRASE + 3;
    ambient.stop();
    // The first phrase's four voices have gone; the second's are still holding.
    expect(recorded.retired).toEqual(
      Array.from({ length: 4 }, () => ({
        at: ORIGIN + PHRASE + 3,
        fade: SCORE.harmony.crossfadeSeconds,
      }))
    );
  });
});

describe("the stems in the bed", () => {
  const seat = (): void => {
    ambient.addThreadVoice("t1", FIBONACCI, COUNTERPOINT);
    ambient.addThreadVoice("t2", STANDING_WAVE, FIBONACCI);
  };

  /** Every stem note the bed played in `slot` for `faculty`. */
  const stemNotes = (faculty: FacultyId, slot: number): Played[] =>
    played(`stem:${faculty}:${slot}:`);

  it("plays exactly the stems' plan for each faculty with a thread, on the grid and under the ceiling", async () => {
    await loadStems();
    ambient.start();
    seat();
    runUntil(ORIGIN + PHRASE + 3 * SLOT);
    const threads: Record<FacultyId, number> = { measure: 2, sound: 1, matter: 1, image: 0 };
    for (let slot = 0; slot <= SCORE.harmony.phraseSlots + 2; slot += 1) {
      const root = rootForPhrase(Math.floor(slot / SCORE.harmony.phraseSlots));
      for (const faculty of ["measure", "sound", "matter", "image"] as const) {
        const plan = stemPlan(faculty, chordFor(root), threads[faculty], slot);
        const notes = stemNotes(faculty, slot);
        expect(notes.map((note) => note.frequency)).toEqual(plan.map((note) => note.frequency));
        notes.forEach((note, index) => {
          const planned = plan[index];
          const start = ORIGIN + slot * SLOT;
          expect(note.timbre).toBe(planned.timbre);
          expect(note.at).toBeCloseTo(start + (planned.sixteenth * SLOT) / 16, 9);
          // On the sixteenth grid of the conductor's slot.
          const sixteenths = ((note.at - ORIGIN) * 16) / SLOT;
          expect(Math.abs(sixteenths - Math.round(sixteenths))).toBeLessThan(1e-9);
          expect(note.gain).toBeLessThanOrEqual(STEM_CEILING);
          expect(note.at + note.attack + note.hold + note.release).toBeLessThanOrEqual(
            start + (faculty === "matter" ? 2 : 1) * SLOT + 1e-9
          );
        });
      }
    }
    // Image has no thread, so no stem.
    expect(played("stem:image:")).toEqual([]);
  });

  it("counts a thread once in each of its faculties however often the room re-seats it", async () => {
    await loadStems();
    ambient.start();
    for (let i = 0; i < 3; i += 1) ambient.addThreadVoice("t1", FIBONACCI, COUNTERPOINT);
    runUntil(ORIGIN + 2 * SLOT);
    // One thread: one voice on Measure's downbeat, not three.
    expect(stemNotes("measure", 0).filter((note) => note.at === ORIGIN)).toHaveLength(1);
    expect(stemNotes("sound", 0)).toHaveLength(1);
  });

  it("thins with the space attention asks for, the same way every time, and follows the bed down", async () => {
    await loadStems();
    ambient.start();
    seat();
    ambient.setSpace(SCORE.attention.thinDensityScale, SCORE.attention.bedGainScale);
    runUntil(ORIGIN + PHRASE);
    for (const faculty of ["measure", "sound"] as const) {
      const heard = new Set(played(`stem:${faculty}:`).map((note) => slotOf(note.seed)));
      const expected = Array.from({ length: SCORE.harmony.phraseSlots }, (_, slot) => slot).filter(
        (slot) => stemSpeaks(faculty, slot, SCORE.attention.thinDensityScale)
      );
      expect([...heard].filter((slot) => slot < SCORE.harmony.phraseSlots).sort((a, b) => a - b)).toEqual(
        expected
      );
      expect(expected.length).toBeLessThan(SCORE.harmony.phraseSlots);
    }
    for (const note of played("stem:")) {
      expect(note.gain).toBeLessThanOrEqual(STEM_CEILING * SCORE.attention.bedGainScale + 1e-12);
    }
  });

  it("leaves with the bed: nothing after the ending begins, and no seat survives the room", async () => {
    await loadStems();
    ambient.start();
    seat();
    ambient.concludeAt(ORIGIN + 6 * SLOT, 4);
    runUntil(ORIGIN + 10 * SLOT);
    const lastSlotBefore = ORIGIN + 6 * SLOT - 4;
    expect(played("stem:").length).toBeGreaterThan(0);
    for (const note of played("stem:")) {
      expect(ORIGIN + slotOf(note.seed) * SLOT).toBeLessThan(lastSlotBefore);
    }

    // A new session in the room: its bed starts with no faculty seated.
    ambient.stop();
    recorded.played.length = 0;
    ctx.currentTime = 40;
    ambient.start();
    runUntil(40 + 4 * SLOT);
    expect(played("ground:").length).toBeGreaterThan(0);
    expect(played("stem:")).toEqual([]);
  });

  it("gives the stems up before the rest of the room when the voice budget runs short", async () => {
    await loadStems();
    ambient.start();
    seat();
    // Past the stems' half of the budget for the whole run.
    for (let i = 0; i < COMFORT.voice.maxConcurrent - STEM_VOICE_RESERVE; i += 1) {
      voiceBudget.claim(ctx.currentTime, 1e9);
    }
    runUntil(ORIGIN + 3 * SLOT);
    expect(played("stem:")).toEqual([]);
    // The ground is not the stems': it still takes what the budget has left.
    expect(played("ground:").length).toBeGreaterThan(0);
  });

  /**
   * Room for `free` stem notes in the first slot, after its ground has taken
   * four: the stems' half of the budget, less what is already held.
   */
  const firstSlotWithRoomFor = async (free: number): Promise<void> => {
    await loadStems();
    ambient.stop();
    voiceBudget.reset();
    recorded.played.length = 0;
    ctx.currentTime = START;
    ambient.start();
    seat();
    const held = COMFORT.voice.maxConcurrent - STEM_VOICE_RESERVE - 4 - free;
    for (let i = 0; i < held; i += 1) voiceBudget.claim(ctx.currentTime, 1e9);
    tick();
  };

  it("thins the stems before it silences any, and keeps the cheaper lines when it must choose", async () => {
    // Everything asked for in the first slot: Measure's two voices (five
    // notes), Sound's one and Matter's one.
    await firstSlotWithRoomFor(7);
    expect(stemNotes("measure", 0)).toHaveLength(5);
    expect(stemNotes("sound", 0)).toHaveLength(1);
    expect(stemNotes("matter", 0)).toHaveLength(1);

    // Room for six: every line keeps its first voice, and Measure loses the
    // voice it would have added on the downbeat.
    await firstSlotWithRoomFor(6);
    expect(stemNotes("measure", 0)).toHaveLength(4);
    expect(stemNotes("measure", 0).filter((note) => note.at === ORIGIN)).toHaveLength(1);
    expect(stemNotes("sound", 0)).toHaveLength(1);
    expect(stemNotes("matter", 0)).toHaveLength(1);

    // Room for three: Measure's arpeggio does not fit, the two cheaper lines do.
    await firstSlotWithRoomFor(3);
    expect(stemNotes("measure", 0)).toEqual([]);
    expect(stemNotes("sound", 0)).toHaveLength(1);
    expect(stemNotes("matter", 0)).toHaveLength(1);
  });
});
