import type { TimbreId } from "@/content/types";

export interface VoiceOptions {
  gain?: number;
  attack?: number;
  /** Seconds of audible body before release begins. */
  hold?: number;
  release?: number;
  /** Absolute AudioContext time to start; defaults to now. */
  at?: number;
}

/**
 * Six timbre families, one per discipline — all pure synthesis, descended
 * from v1's warm-pad recipes: soft attacks, lowpass everywhere, every node
 * fully enveloped and stopped (no clicks, no leaks).
 */
export function playVoice(
  ctx: AudioContext,
  dest: AudioNode,
  timbre: TimbreId,
  freq: number,
  opts: VoiceOptions = {}
): void {
  const t0 = opts.at ?? ctx.currentTime;
  const gain = opts.gain ?? 0.2;

  switch (timbre) {
    case "bell": {
      // Glassy: fundamental + quiet 3rd harmonic, fast attack, long ring.
      tone(ctx, dest, "sine", freq, gain, t0, opts.attack ?? 0.004, opts.hold ?? 0.05, opts.release ?? 1.6);
      tone(ctx, dest, "sine", freq * 3, gain * 0.14, t0, 0.004, 0.02, (opts.release ?? 1.6) * 0.45);
      break;
    }
    case "pluck": {
      // Harp-like: detuned triangle pair through a lowpass, quick decay.
      const lp = lowpass(ctx, dest, 2400);
      tone(ctx, lp, "triangle", freq * 0.9985, gain * 0.6, t0, 0.002, 0.03, opts.release ?? 0.7);
      tone(ctx, lp, "triangle", freq * 1.0015, gain * 0.6, t0, 0.002, 0.03, opts.release ?? 0.7);
      break;
    }
    case "pad": {
      // v1's warm pad, essentially verbatim: detuned saws, dark filter, slow swell.
      const lp = lowpass(ctx, dest, 900);
      tone(ctx, lp, "sawtooth", freq * 0.9965, gain * 0.32, t0, opts.attack ?? 0.5, opts.hold ?? 1.2, opts.release ?? 1.8);
      tone(ctx, lp, "sawtooth", freq * 1.0035, gain * 0.32, t0, opts.attack ?? 0.5, opts.hold ?? 1.2, opts.release ?? 1.8);
      break;
    }
    case "fm": {
      // Hollow, physical: one sine bending another.
      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = freq;
      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.value = freq * 2.001;
      const modGain = ctx.createGain();
      modGain.gain.value = freq * 0.35;
      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      const env = envelope(ctx, dest, gain, t0, opts.attack ?? 0.03, opts.hold ?? 0.15, opts.release ?? 1.1);
      carrier.connect(env);
      const stopAt = t0 + (opts.attack ?? 0.03) + (opts.hold ?? 0.15) + (opts.release ?? 1.1) + 0.1;
      carrier.start(t0);
      mod.start(t0);
      carrier.stop(stopAt);
      mod.stop(stopAt);
      break;
    }
    case "breath": {
      // Airy: bandpassed noise with a sine core.
      const noise = noiseSource(ctx, 2.5);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = freq;
      bp.Q.value = 14;
      const env = envelope(ctx, dest, gain * 0.8, t0, opts.attack ?? 0.09, opts.hold ?? 0.25, opts.release ?? 1.2);
      noise.connect(bp);
      bp.connect(env);
      tone(ctx, dest, "sine", freq, gain * 0.35, t0, opts.attack ?? 0.09, opts.hold ?? 0.25, opts.release ?? 1.2);
      const stopAt = t0 + (opts.attack ?? 0.09) + (opts.hold ?? 0.25) + (opts.release ?? 1.2) + 0.1;
      noise.start(t0);
      noise.stop(Math.min(stopAt, t0 + 2.4));
      break;
    }
    case "drone": {
      // Deep and steady: detuned sines plus a sub octave.
      tone(ctx, dest, "sine", freq * 0.998, gain * 0.5, t0, opts.attack ?? 0.4, opts.hold ?? 1.0, opts.release ?? 2.2);
      tone(ctx, dest, "sine", freq * 1.002, gain * 0.5, t0, opts.attack ?? 0.4, opts.hold ?? 1.0, opts.release ?? 2.2);
      tone(ctx, dest, "sine", freq * 0.5, gain * 0.35, t0, opts.attack ?? 0.5, opts.hold ?? 1.0, opts.release ?? 2.4);
      break;
    }
  }
}

// ── primitives ────────────────────────────────────────────────────────────

function envelope(
  ctx: AudioContext,
  dest: AudioNode,
  peak: number,
  t0: number,
  attack: number,
  hold: number,
  release: number
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  g.connect(dest);
  return g;
}

function tone(
  ctx: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  peak: number,
  t0: number,
  attack: number,
  hold: number,
  release: number
): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(envelope(ctx, dest, peak, t0, attack, hold, release));
  osc.start(t0);
  osc.stop(t0 + attack + hold + release + 0.1);
}

function lowpass(ctx: AudioContext, dest: AudioNode, cutoff: number): BiquadFilterNode {
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  lp.connect(dest);
  return lp;
}

let sharedNoiseBuffer: AudioBuffer | null = null;

function noiseSource(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
  if (!sharedNoiseBuffer || sharedNoiseBuffer.sampleRate !== ctx.sampleRate) {
    const len = Math.ceil(ctx.sampleRate * Math.max(2.5, seconds));
    sharedNoiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = sharedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = sharedNoiseBuffer;
  src.loop = true;
  return src;
}
