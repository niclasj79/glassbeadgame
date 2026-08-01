import { tensionCeiling } from "./comfort";
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
 *
 * Everything audible flows:
 *   (voice) → ambientBus | motifBus | tensionBus | sfxBus
 *           → master → (dry + convolver wet) → compressor → destination.
 *
 * Four buses rather than two, because the semantic layer needs levels the bed
 * does not:
 *
 *   ambientBus  the generative floor — drone, pad, room tone
 *   motifBus    concept motifs and relation grammar: the things that mean something
 *   tensionBus  dissonance only, followed by a limiter set to the CAV-007
 *               ceiling, so "summed gain below the ambient bed" cannot be
 *               breached by a plan, a bug, or a future caller
 *   sfxBus      interaction sound: touch, silk, cancel
 *
 * The tense path used to be a bare `GainNode` at 0.85 that the comments called a
 * ceiling. A gain node multiplies; it does not bound. Feed it twice the bed and
 * it passes 1.7 times the bed, politely. The limiter below is what makes the
 * word "ceiling" true in the graph, and `capTenseGain()` in `plan.ts` makes it
 * true in the arithmetic before a voice is ever created — belt and braces, at
 * the two places a bound can be lost.
 *
 * No React in here, and no game rules.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  ambientBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  /** The semantic music: concept motifs, relation grammar, attunement channels. */
  motifBus: GainNode | null = null;
  /**
   * Dissonance, and only dissonance. Its output passes through `tensionLimiter`
   * before reaching the master, so what leaves is genuinely bounded.
   */
  tensionBus: GainNode | null = null;
  /** The brick wall the tense path is held under. Threshold tracks the bed. */
  private tensionLimiter: DynamicsCompressorNode | null = null;
  /** Multiplier the attention and attunement states apply to the bed. */
  private bedScale = 1;
  /** Sits between ambientBus and master — the Breath modulates it alone,
   *  so it never fights setAmbientReach over the same AudioParam. */
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

      this.motifBus = this.ctx.createGain();
      this.motifBus.gain.value = 1;
      this.motifBus.connect(this.master);

      // The ceiling is structural: a limiter, not a trim. Ratio 20 with a hard
      // knee is a brick wall in practice; the fast attack catches the onset of a
      // suspension, and the slow release keeps it from pumping while a Tension
      // decays to its floor over twelve seconds.
      this.tensionBus = this.ctx.createGain();
      this.tensionBus.gain.value = 1;
      this.tensionLimiter = this.ctx.createDynamicsCompressor();
      this.tensionLimiter.knee.value = 0;
      this.tensionLimiter.ratio.value = 20;
      this.tensionLimiter.attack.value = 0.003;
      this.tensionLimiter.release.value = 0.4;
      this.tensionLimiter.threshold.value = this.tensionThresholdDb();
      this.tensionBus.connect(this.tensionLimiter);
      this.tensionLimiter.connect(this.master);

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

  /**
   * Gentle ambient swell as the web is *carried*; capped, never dominant.
   *
   * The argument used to be the legacy score, divided by 400 — so the room got
   * louder as the player accumulated points, which is a completion meter wearing
   * an atmosphere. ADR-010 replaced the number with the portrait, and the bed
   * now follows topology instead: `reach` is 0..1, the fraction of the arena the
   * largest connected region of the composition spans. It rises when threads
   * join and cannot be raised by finding anything.
   */
  setAmbientReach(reach: number): void {
    if (!this.ctx || !this.ambientBus) return;
    this.ambientSwell = 0.9 + 0.35 * Math.max(0, Math.min(1, reach));
    this.ambientBus.gain.setTargetAtTime(
      this.ambientSwell * this.bedScale,
      this.ctx.currentTime,
      0.8
    );
  }

  private ambientSwell = 0.9;

  /**
   * The bed recedes so something else can be heard — attention leaving space,
   * Attunement dropping the floor beneath individual threads. Separate from
   * `setAmbientReach` so the web's growth and the current state of attention
   * never fight over the same AudioParam.
   */
  setBedScale(scale: number): void {
    this.bedScale = Math.max(0.1, Math.min(1, scale));
    if (!this.ctx || !this.ambientBus) return;
    this.ambientBus.gain.setTargetAtTime(
      this.ambientSwell * this.bedScale,
      this.ctx.currentTime,
      0.6
    );
    // The tense ceiling is a fraction of the bed, so when the bed moves the
    // ceiling moves with it. Thinning the bed while leaving the ceiling where it
    // was is precisely how Attunement ended up over CAV-007.
    if (this.tensionLimiter) {
      this.tensionLimiter.threshold.setTargetAtTime(
        this.tensionThresholdDb(),
        this.ctx.currentTime,
        0.3
      );
    }
  }

  /**
   * The bed's summed reference level, which is what the Tension gain ceiling is
   * expressed against (CAV-007). Planners read it rather than assuming a number.
   */
  bedGain(): number {
    return SCORE.grammar.bedGain * this.bedScale;
  }

  /** The absolute level tense voices may not exceed, right now. */
  tensionCeiling(): number {
    return tensionCeiling(this.bedGain());
  }

  private tensionThresholdDb(): number {
    return 20 * Math.log10(Math.max(1e-5, this.tensionCeiling()));
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
