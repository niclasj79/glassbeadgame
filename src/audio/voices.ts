/**
 * THE SIX BODIES — glass, gut, reed, metal, wood, voice.
 *
 * The content pack authors a `TimbreId` per concept, so these six are not a
 * palette the audio layer chose; they are a vocabulary the content speaks. Each
 * one has to be identifiable in isolation, at any pitch, in any register, or the
 * whole idea of learning a bead by ear collapses — a player who cannot tell reed
 * from gut cannot tell Diffraction from Counterpoint.
 *
 * So the difference between them is *spectral*, not cosmetic. Each body is a
 * different way of making a sound rather than the same oscillator behind a
 * different filter:
 *
 *   glass   near-pure partials on odd harmonics, immediate onset, long ring
 *   gut     dense harmonic series, two slightly detuned strings, warm rolloff
 *   reed    odd harmonics only — a stopped pipe — plus audible breath
 *   metal   frequency modulation at an irrational ratio, so the partials are
 *           inharmonic and it clangs rather than sings
 *   wood    a pitched transient: fast downward glide plus a noise strike
 *   voice   fixed formants at vowel frequencies, so it reads as a voice
 *           regardless of the pitch underneath
 *
 * Three engineering rules hold everywhere below:
 *
 *  1. `playVoice()` is the only place a note is born (CAV-008). Swapping a
 *     branch for an `AudioBufferSourceNode` replaces synthesis with recordings
 *     and no content or grammar changes.
 *  2. Every node is fully enveloped and explicitly stopped. There is no path
 *     through this file that leaves an oscillator running.
 *  3. Nothing that can be shared is allocated per note. Wave tables, noise,
 *     vibrato LFOs, and each body's colour filter are pooled; only the
 *     oscillators and one envelope gain are per-note.
 */
import type { TimbreId } from "@/content/castalia/schema";
import { COMFORT, clampLifetimeSeconds } from "./comfort";
import { SCORE } from "./score";
import { hashString } from "@/lib/utils";
import { runtimeRandom } from "@/runtime/testMode";

// ─── The voice budget ───────────────────────────────────────────────────────

export interface VoiceBudget {
  /** Reserve a slot. False means the note is dropped rather than queued. */
  readonly claim: (now: number, endsAt: number) => boolean;
  readonly active: (now: number) => number;
  readonly reset: () => void;
}

/**
 * A hard ceiling on simultaneously scheduled voices, so "no unbounded audio
 * voice allocation" (VERTICAL-SLICE-SPEC §21) is a property of the code rather
 * than of the content behaving itself. Dropping the newest note is the right
 * failure: the texture thins, and nothing that is already sounding is cut off.
 *
 * Pure — no Web Audio — so the ceiling is unit-testable.
 */
export function createVoiceBudget(
  max: number = COMFORT.voice.maxConcurrent
): VoiceBudget {
  let ends: number[] = [];
  const budget: VoiceBudget = {
    claim: (now, endsAt) => {
      ends = ends.filter((end) => end > now);
      if (ends.length >= max) return false;
      ends.push(endsAt);
      return true;
    },
    active: (now) => ends.filter((end) => end > now).length,
    reset: () => {
      ends = [];
    },
  };
  return Object.freeze(budget);
}

/** The process-wide budget. The scheduler and every sfx path share it. */
export const voiceBudget: VoiceBudget = createVoiceBudget();

// ─── Pooled resources ───────────────────────────────────────────────────────

const waveCache = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
const stripCache = new WeakMap<AudioNode, Map<TimbreId, AudioNode>>();
const lfoCache = new WeakMap<BaseAudioContext, OscillatorNode[]>();
let sharedNoiseBuffer: AudioBuffer | null = null;

/**
 * Partial amplitudes per body. Index 1 is the fundamental (index 0 is DC and is
 * always zero). These tables are the timbral identity — everything else is
 * envelope and filtering.
 */
const PARTIALS: Partial<Record<TimbreId, readonly number[]>> = Object.freeze({
  // Odd partials, thin and clean: struck glass.
  glass: Object.freeze([0, 1, 0.02, 0.3, 0.012, 0.12, 0, 0.05, 0, 0.028]),
  // A full harmonic series falling roughly as 1/n^1.2: a bowed or plucked string.
  gut: Object.freeze([
    0, 1, 0.55, 0.34, 0.22, 0.15, 0.1, 0.072, 0.052, 0.038, 0.028, 0.021,
  ]),
  // Odd harmonics only — the spectrum of a pipe stopped at one end.
  reed: Object.freeze([0, 1, 0, 0.42, 0, 0.26, 0, 0.18, 0, 0.13, 0, 0.1]),
  // A sawtooth's 1/n series, which is what the formants below need to bite on.
  voice: Object.freeze([
    0, 1, 0.5, 0.333, 0.25, 0.2, 0.167, 0.143, 0.125, 0.111, 0.1, 0.091,
  ]),
});

/** Vowel formants for the `voice` body. Fixed in Hz — that is what a vowel is. */
const FORMANTS: readonly { readonly hz: number; readonly q: number; readonly gain: number }[] =
  Object.freeze([
    Object.freeze({ hz: 700, q: 8, gain: 1 }),
    Object.freeze({ hz: 1220, q: 10, gain: 0.5 }),
    Object.freeze({ hz: 2600, q: 12, gain: 0.22 }),
  ]);

function periodicWave(ctx: BaseAudioContext, timbre: TimbreId): PeriodicWave | null {
  const partials = PARTIALS[timbre];
  if (!partials) return null;
  let byTimbre = waveCache.get(ctx);
  if (!byTimbre) {
    byTimbre = new Map();
    waveCache.set(ctx, byTimbre);
  }
  const cached = byTimbre.get(timbre);
  if (cached) return cached;
  const real = new Float32Array(partials.length);
  const imag = new Float32Array(partials);
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  byTimbre.set(timbre, wave);
  return wave;
}

/**
 * The colour filter each body is heard through, created once per destination
 * and reused forever. `voice` returns a formant bank: three parallel bandpass
 * resonators, which is the expensive part of a sung tone and the part that does
 * not depend on the note.
 */
function timbreStrip(ctx: AudioContext, dest: AudioNode, timbre: TimbreId): AudioNode {
  let byTimbre = stripCache.get(dest);
  if (!byTimbre) {
    byTimbre = new Map();
    stripCache.set(dest, byTimbre);
  }
  const cached = byTimbre.get(timbre);
  if (cached) return cached;

  let node: AudioNode;
  switch (timbre) {
    case "glass": {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 5200;
      lp.connect(dest);
      node = lp;
      break;
    }
    case "gut": {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2600;
      lp.Q.value = 0.8;
      lp.connect(dest);
      node = lp;
      break;
    }
    case "reed": {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1500;
      bp.Q.value = 1.1;
      bp.connect(dest);
      node = bp;
      break;
    }
    case "metal": {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 260;
      hp.connect(dest);
      node = hp;
      break;
    }
    case "wood": {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 4200;
      lp.connect(dest);
      node = lp;
      break;
    }
    case "voice": {
      const input = ctx.createGain();
      input.gain.value = 1;
      for (const formant of FORMANTS) {
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = formant.hz;
        bp.Q.value = formant.q;
        const level = ctx.createGain();
        level.gain.value = formant.gain;
        input.connect(bp);
        bp.connect(level);
        level.connect(dest);
      }
      // A little direct signal keeps low notes from disappearing between formants.
      const through = ctx.createGain();
      through.gain.value = 0.18;
      input.connect(through);
      through.connect(dest);
      node = input;
      break;
    }
  }
  byTimbre.set(timbre, node);
  return node;
}

/** Three pooled LFOs at slightly different rates — vibrato without per-note LFOs. */
function vibratoSource(ctx: AudioContext, seed: number): OscillatorNode {
  let lfos = lfoCache.get(ctx);
  if (!lfos) {
    lfos = [0.92, 1, 1.09].map((ratio) => {
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = SCORE.humanize.vibratoHz * ratio;
      lfo.start();
      return lfo;
    });
    lfoCache.set(ctx, lfos);
  }
  return lfos[seed % lfos.length];
}

/** Looped white noise from one shared buffer. The caller starts and stops it. */
export function noiseSource(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
  if (!sharedNoiseBuffer || sharedNoiseBuffer.sampleRate !== ctx.sampleRate) {
    const length = Math.ceil(ctx.sampleRate * Math.max(2.5, seconds));
    sharedNoiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = sharedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = runtimeRandom() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = sharedNoiseBuffer;
  src.loop = true;
  return src;
}

// ─── Envelope ───────────────────────────────────────────────────────────────

/**
 * Small human imperfections, derived rather than rolled.
 *
 * Two things were wrong with rolling them. The game must be reproducible under a
 * fixed seed, and a random detune on *every* voice quietly falsified two claims
 * the score makes about itself: that stable just intervals are exact and
 * therefore do not beat, and that a Tension beats at the rate written into its
 * plan. Three and a half cents on each of two voices is a third of a hertz at
 * this register — on a planned two-hertz beat that is not a rounding error, it
 * is a different sound from the one the caption promised.
 *
 * So the jitter is a deterministic function of the voice's own identity: the
 * same note in the same plan is humanised the same way on every replay, and a
 * caller whose tuning is load-bearing asks for `exactTuning` and gets none.
 */
const jitterUnit = (seed: string, salt: string): number =>
  seed.length === 0
    ? runtimeRandom() * 2 - 1
    : hashString(`${salt}:${seed}`) / 2147483648 - 1;

function humanizedFrequency(
  hz: number,
  detuneCents: number,
  seed: string,
  exact: boolean
): number {
  const jitter = exact
    ? 0
    : jitterUnit(seed, "detune") * SCORE.humanize.detuneCents;
  return hz * Math.pow(2, (detuneCents + jitter) / 1200);
}

/**
 * Level jitter, and it only ever ducks.
 *
 * A planned gain is an upper bound — `capTenseGain()` sizes the tense voices to
 * sit exactly under the CAV-007 ceiling, and a humaniser that could add ten per
 * cent would put them back over it. Shaving rather than boosting keeps every
 * planned level a real ceiling and costs nothing musically: the ear reads the
 * variation, not its sign.
 */
function humanizedGain(gain: number, seed: string): number {
  return gain * (1 - Math.abs(jitterUnit(seed, "gain")) * SCORE.humanize.gainJitter);
}

/**
 * Attack → peak, hold → (floor, if one was asked for), release → silence.
 *
 * The floor is how a Tension persists: the amplitude falls to a low sustained
 * level over the hold, and the instability keeps sounding there rather than
 * either resolving or staying loud (CAV-007).
 */
function envelope(
  ctx: AudioContext,
  dest: AudioNode,
  peak: number,
  floor: number,
  t0: number,
  attack: number,
  hold: number,
  release: number
): GainNode {
  const g = ctx.createGain();
  const safePeak = Math.max(0.00012, peak);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(safePeak, t0 + attack);
  if (floor > 0.0001) {
    g.gain.exponentialRampToValueAtTime(
      Math.max(0.00011, Math.min(floor, safePeak)),
      t0 + attack + hold
    );
  } else {
    g.gain.setValueAtTime(safePeak, t0 + attack + hold);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  g.connect(dest);
  return g;
}

// ─── The one place a note is born ───────────────────────────────────────────

export interface VoiceRequest {
  readonly timbre: TimbreId;
  readonly frequency: number;
  readonly gain: number;
  /** Absolute AudioContext time. */
  readonly at: number;
  readonly attack: number;
  readonly hold: number;
  readonly release: number;
  /** Deliberate mistuning. This is what carries controlled beating. */
  readonly detuneCents?: number;
  /** Sustained level after the hold. Zero for an ordinary note. */
  readonly floorGain?: number;
  readonly pan?: number;
  /**
   * Stable identity for this voice — a planned note's id in the semantic layer.
   * Humanising is derived from it, so the same voice sounds identical on every
   * replay of the same session. Omitted means "no identity available"; those
   * callers fall back to the seeded runtime random.
   */
  readonly seed?: string;
  /**
   * Suppress the humanising detune entirely. Set wherever the tuning itself
   * carries meaning: a tense pair's beat rate, or a just interval whose whole
   * point is that it locks and does not beat.
   */
  readonly exactTuning?: boolean;
}

/**
 * Schedule one note. Returns false when the voice budget refused it.
 *
 * Every branch obeys the same contract: no node outlives `stopAt`, no node is
 * created that is not connected and stopped, and the total lifetime is clamped
 * by the comfort table regardless of what the caller asked for.
 */
export function playVoice(
  ctx: AudioContext,
  dest: AudioNode,
  request: VoiceRequest
): boolean {
  const attack = Math.max(0.001, request.attack);
  const hold = Math.max(0, request.hold);
  const release = Math.max(0.02, request.release);
  const life = clampLifetimeSeconds(attack + hold + release);
  if (life <= 0) return false;

  const t0 = request.at;
  const stopAt = t0 + life + 0.08;
  if (!voiceBudget.claim(ctx.currentTime, stopAt)) return false;

  const voiceSeed = request.seed ?? "";
  const freq = humanizedFrequency(
    request.frequency,
    request.detuneCents ?? 0,
    voiceSeed,
    request.exactTuning ?? false
  );
  const gain = humanizedGain(request.gain, voiceSeed);
  const floor = request.floorGain ?? 0;
  const sustained = life > 2.2;
  const seed = hashString(`${request.timbre}:${Math.round(freq)}`);

  // Panning is per-note and therefore not poolable; it is only created when a
  // caller actually asks for a position.
  let target: AudioNode = timbreStrip(ctx, dest, request.timbre);
  if (request.pan !== undefined && request.pan !== 0) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, request.pan));
    panner.connect(timbreStrip(ctx, dest, request.timbre));
    target = panner;
  }

  const env = envelope(ctx, target, gain, floor, t0, attack, hold, release);

  const startOscillator = (osc: OscillatorNode): void => {
    osc.start(t0);
    osc.stop(stopAt);
  };

  const addVibrato = (osc: OscillatorNode): void => {
    if (!sustained || SCORE.humanize.vibratoDepth <= 0) return;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t0);
    depth.gain.linearRampToValueAtTime(
      freq * SCORE.humanize.vibratoDepth,
      t0 + Math.min(0.9, life * 0.4)
    );
    depth.gain.setValueAtTime(freq * SCORE.humanize.vibratoDepth, stopAt);
    const lfo = vibratoSource(ctx, seed);
    lfo.connect(depth);
    depth.connect(osc.frequency);
    // The pooled LFO runs for the life of the context, so the per-note depth
    // gain must be released explicitly or it would be kept alive by it forever.
    // `ended` fires at the oscillator's own stop time — no timer, no leak.
    osc.addEventListener(
      "ended",
      () => {
        lfo.disconnect(depth);
        depth.disconnect();
      },
      { once: true }
    );
  };

  switch (request.timbre) {
    case "glass":
    case "reed":
    case "voice": {
      const osc = ctx.createOscillator();
      const wave = periodicWave(ctx, request.timbre);
      if (wave) osc.setPeriodicWave(wave);
      else osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(env);
      addVibrato(osc);
      startOscillator(osc);
      if (request.timbre === "reed") {
        // Breath: the noise a reed makes before it speaks. Short, and quiet
        // enough that it colours the onset rather than becoming a texture.
        const noise = noiseSource(ctx, 2.5);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = Math.min(9000, freq * 3);
        bp.Q.value = 3;
        const breath = envelope(
          ctx,
          target,
          gain * 0.22,
          0,
          t0,
          Math.min(attack, 0.05),
          0.03,
          Math.min(release, 0.5)
        );
        noise.connect(bp);
        bp.connect(breath);
        noise.start(t0);
        noise.stop(Math.min(stopAt, t0 + 1.2));
      }
      break;
    }

    case "gut": {
      // Two strings, a few cents apart. The beating between them is the warmth.
      const wave = periodicWave(ctx, "gut");
      for (const ratio of [0.9986, 1.0014]) {
        const osc = ctx.createOscillator();
        if (wave) osc.setPeriodicWave(wave);
        else osc.type = "sawtooth";
        osc.frequency.value = freq * ratio;
        const half = ctx.createGain();
        half.gain.value = 0.5;
        osc.connect(half);
        half.connect(env);
        addVibrato(osc);
        startOscillator(osc);
      }
      break;
    }

    case "metal": {
      // FM at an irrational ratio: the partials do not land on the harmonic
      // series, which is exactly why struck metal does not sound like a string.
      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = freq;
      const modulator = ctx.createOscillator();
      modulator.type = "sine";
      modulator.frequency.value = freq * Math.SQRT2;
      const index = ctx.createGain();
      index.gain.setValueAtTime(freq * 2.4, t0);
      // The index collapses fast — a strike is bright then settles into a hum.
      index.gain.exponentialRampToValueAtTime(
        Math.max(1, freq * 0.12),
        t0 + Math.min(1.2, life * 0.5)
      );
      modulator.connect(index);
      index.connect(carrier.frequency);
      carrier.connect(env);
      startOscillator(carrier);
      startOscillator(modulator);
      break;
    }

    case "wood": {
      // A pitched strike: the body drops in pitch as the block gives way, and a
      // filtered noise transient supplies the contact sound.
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq * 1.045, t0);
      osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.035);
      osc.connect(env);
      startOscillator(osc);

      const noise = noiseSource(ctx, 2.5);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = Math.min(9000, freq * 3.2);
      bp.Q.value = 6;
      const strike = envelope(ctx, target, gain * 0.5, 0, t0, 0.001, 0.004, 0.09);
      noise.connect(bp);
      bp.connect(strike);
      noise.start(t0);
      noise.stop(Math.min(stopAt, t0 + 0.35));
      break;
    }
  }

  return true;
}

export interface SimpleVoiceOptions {
  readonly gain?: number;
  readonly attack?: number;
  /** Seconds of audible body before release begins. */
  readonly hold?: number;
  readonly release?: number;
  /** Absolute AudioContext time to start; defaults to now. */
  readonly at?: number;
  readonly detuneCents?: number;
  readonly floorGain?: number;
  readonly pan?: number;
  readonly seed?: string;
  readonly exactTuning?: boolean;
}

/**
 * The convenience form, for callers that only want a note and sensible
 * defaults. It is a thin adapter over `playVoice()` and adds no synthesis of its
 * own — there is still exactly one place a note is born.
 */
export function playNote(
  ctx: AudioContext,
  dest: AudioNode,
  timbre: TimbreId,
  frequency: number,
  options: SimpleVoiceOptions = {}
): boolean {
  return playVoice(ctx, dest, {
    timbre,
    frequency,
    gain: options.gain ?? 0.2,
    at: options.at ?? ctx.currentTime,
    attack: options.attack ?? 0.02,
    hold: options.hold ?? 0.1,
    release: options.release ?? 1.2,
    detuneCents: options.detuneCents,
    floorGain: options.floorGain,
    pan: options.pan,
    seed: options.seed,
    exactTuning: options.exactTuning,
  });
}

/**
 * The legacy prototype's six discipline timbres, mapped onto the six bodies.
 *
 * Kept only so the pre-Castalia ambient bed and sfx keep sounding while the
 * legacy content pack is retired. Nothing new should reach for these names.
 */
export const LEGACY_TIMBRE: Readonly<
  Record<"bell" | "pluck" | "pad" | "fm" | "breath" | "drone", TimbreId>
> = Object.freeze({
  bell: "glass",
  pluck: "gut",
  pad: "voice",
  fm: "metal",
  breath: "reed",
  drone: "glass",
});
