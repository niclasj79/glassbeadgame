import { SCORE } from "./score";
import { runtimeRandom, testMode } from "@/runtime/testMode";

/** Stereo impulse response: decorrelated exponentially decaying noise. */
function makeImpulseResponse(
  ctx: AudioContext,
  seconds: number,
  decay: number
): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (runtimeRandom() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buffer;
}

/**
 * The audio engine singleton — context lifecycle and gain staging.
 * Everything audible flows: (voice) → ambientBus | sfxBus → master →
 * (dry + convolver wet) → compressor → destination. No React in here.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  ambientBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  /** Sits between ambientBus and master — the Breath modulates it alone,
   *  so it never fights setAmbientIntensity over the same AudioParam. */
  private breathGain: GainNode | null = null;
  /** Pad/drone lowpass whose cutoff the Breath sweeps. */
  breathFilter: BiquadFilterNode | null = null;
  /** Center of the breath's filter sweep — each world sets its own. */
  private breathCenter = 900;
  private convolver: ConvolverNode | null = null;
  private binaural: {
    oscL: OscillatorNode;
    oscR: OscillatorNode;
    gain: GainNode;
  } | null = null;
  private muted = false;

  private static MASTER_LEVEL = 0.8;
  private static BINAURAL_LEVEL = 0.018;

  /** Create (or resume) the context. Must first be called from a user gesture. */
  ensure(): AudioContext | null {
    if (typeof window === "undefined" || testMode.enabled) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 20;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.01;
      this.compressor.release.value = 0.25;
      this.compressor.connect(this.ctx.destination);

      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : AudioEngine.MASTER_LEVEL;
      this.master.connect(this.compressor);

      // The room: a generated impulse response gives every voice a shared
      // space — the single biggest step from "synthetic" toward "organic".
      // Parallel wet path: master → convolver → wet gain → compressor.
      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = makeImpulseResponse(
        this.ctx,
        SCORE.reverb.seconds,
        SCORE.reverb.decay
      );
      const wet = this.ctx.createGain();
      wet.gain.value = SCORE.reverb.wet;
      this.master.connect(this.convolver);
      this.convolver.connect(wet);
      wet.connect(this.compressor);

      this.breathGain = this.ctx.createGain();
      this.breathGain.gain.value = 1;
      this.breathGain.connect(this.master);

      this.ambientBus = this.ctx.createGain();
      this.ambientBus.gain.value = 0.9;
      this.ambientBus.connect(this.breathGain);

      // The pads' shared lowpass — the Breath sweeps its cutoff like a
      // slow wave washing over the drone.
      this.breathFilter = this.ctx.createBiquadFilter();
      this.breathFilter.type = "lowpass";
      this.breathFilter.frequency.value = 900;
      this.breathFilter.connect(this.ambientBus);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.master);

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void this.ctx?.resume();
      });
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Context if it already exists and is running-ish; never creates one. */
  get(): AudioContext | null {
    return this.ctx;
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(muted ? 0 : AudioEngine.MASTER_LEVEL, t, 0.05);
  }

  /** Gentle ambient swell as the web grows; capped, never dominant. */
  setAmbientIntensity(score: number): void {
    if (!this.ctx || !this.ambientBus) return;
    const target = 0.9 + Math.min(0.35, score / 400);
    this.ambientBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.8);
  }

  /**
   * The Breath, audio side — called ~15 Hz from the frame bridge with the
   * shared visual phase. ±1.25 dB on the ambient floor; inaudible seams.
   */
  applyBreath(phase: number, depth: number): void {
    if (!this.ctx || !this.breathGain) return;
    const t = this.ctx.currentTime;
    const db = 1.25 * depth * Math.sin(phase);
    this.breathGain.gain.setTargetAtTime(Math.pow(10, db / 20), t, 0.35);
    if (this.breathFilter) {
      this.breathFilter.frequency.setTargetAtTime(
        this.breathCenter + 350 * depth * Math.sin(phase),
        t,
        0.4
      );
    }
  }

  /** Each world's pads breathe around their own darkness. */
  setBreathCenter(hz: number): void {
    this.breathCenter = hz;
  }

  /**
   * The binaural bed: a 6 Hz theta beat between the ears at whisper level.
   * Routed straight to destination — the stereo-linked compressor would let
   * chord peaks pump the bed and smear the beat percept.
   */
  startBinaural(): void {
    const ctx = this.ensure();
    if (!ctx || this.binaural) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.setTargetAtTime(AudioEngine.BINAURAL_LEVEL, ctx.currentTime, 1.0);
    gain.connect(ctx.destination);

    const makeEar = (freq: number, pan: -1 | 1) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 400;
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      osc.connect(lp);
      lp.connect(panner);
      panner.connect(gain);
      osc.start();
      return osc;
    };

    this.binaural = { oscL: makeEar(108, -1), oscR: makeEar(114, 1), gain };
  }

  stopBinaural(): void {
    if (!this.ctx || !this.binaural) return;
    const { oscL, oscR, gain } = this.binaural;
    this.binaural = null;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(0.0001, t, 0.8);
    oscL.stop(t + 3);
    oscR.stop(t + 3);
  }
}

export const audio = new AudioEngine();
