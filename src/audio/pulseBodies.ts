/**
 * THE PULSE'S THREE BODIES (ADR-017, M4-002).
 *
 * The pulse is played on things the world already sounds like, at whisper level
 * under the bed:
 *
 *   skin    a wood strike on the mode's tonic in the sub register, exactly in
 *           tune and low-passed, so it reads as a soft drum rather than a block
 *   brush   an unpitched noise tap, bandpassed to 1.6–3.8 kHz
 *   bell    a glass tick on the tonic in the air register, only in fills
 *
 * One pitch or none: the skin sits on the tonic the drone and the heartbeat
 * already ground, and the brush has no pitch at all, so nothing here can beat
 * against the drone or the binaural layer (CAV-007).
 *
 * Every body is heard through the bus the bed hands it — the ambient bus, which
 * reach and space already scale and the master's reverb already carries — and
 * never through the tension bus. Every body takes a slot of the global voice
 * budget, and none outlives its envelope. Nothing here carries a concept, so the
 * pulse lights no bead (ADR-016): it is the bed's percussion, not a statement.
 *
 * The gain ceilings are one table, `PULSE_GAIN`. The bed asks each onset for
 * its weight times its ceiling times the bed's own scale; a body never plays
 * louder than its ceiling whatever it is asked for.
 */
import { hashString } from "@/lib/utils";
import type { PulseBody } from "./pulse";
import { modeFreq } from "./theory";
import { noiseSource, playNote, voiceBudget } from "./voices";

/**
 * THE PULSE'S CEILINGS, beside the bed's own levels. Peak gain of each body at
 * full weight, before the bed's scale. The skin sits beside the heartbeat's sub
 * onset (0.05 at full awakening) and well under the drone (0.13–0.16 by world);
 * the brush and the bell are quieter still. All three together, 0.095, stay
 * under the bed's summed level (`SCORE.grammar.bedGain`, 0.19).
 */
export const PULSE_GAIN: Readonly<Record<PulseBody, number>> = Object.freeze({
  skin: 0.06,
  brush: 0.02,
  bell: 0.015,
});

export interface PulseEnvelope {
  readonly attack: number;
  readonly hold: number;
  readonly release: number;
}

/** A soft drum: a quick strike, a short body, a quarter-second of decay. */
export const SKIN_ENVELOPE: PulseEnvelope = Object.freeze({
  attack: 0.004,
  hold: 0.03,
  release: 0.26,
});
/** A tap, gone in a sixteenth. */
export const BRUSH_ENVELOPE: PulseEnvelope = Object.freeze({
  attack: 0.006,
  hold: 0.02,
  release: 0.12,
});
/** A tick that rings. */
export const BELL_ENVELOPE: PulseEnvelope = Object.freeze({
  attack: 0.002,
  hold: 0.04,
  release: 0.7,
});

/** Above this the skin is block, not drum. */
export const SKIN_LOWPASS_HZ = 240;
/** The brush's band: its −3 dB edges. */
export const BRUSH_BAND_HZ = Object.freeze({ low: 1600, high: 3800 });

/** How far past its release a brush's noise is stopped. */
const BRUSH_STOP_MARGIN_SECONDS = 0.02;

/**
 * The colour filters are shared, one per bus, the way the bodies' own strips are
 * in `voices.ts`: only the source and one envelope gain are per onset.
 */
const skinFilters = new WeakMap<AudioNode, BiquadFilterNode>();
const brushFilters = new WeakMap<AudioNode, BiquadFilterNode>();

function skinFilter(ctx: AudioContext, bus: AudioNode): BiquadFilterNode {
  const cached = skinFilters.get(bus);
  if (cached !== undefined) return cached;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = SKIN_LOWPASS_HZ;
  lp.connect(bus);
  skinFilters.set(bus, lp);
  return lp;
}

function brushFilter(ctx: AudioContext, bus: AudioNode): BiquadFilterNode {
  const cached = brushFilters.get(bus);
  if (cached !== undefined) return cached;
  // One resonator whose −3 dB edges are the band's: centred on the band's
  // geometric mean, with the band's width as its bandwidth.
  const { low, high } = BRUSH_BAND_HZ;
  const centre = Math.sqrt(low * high);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = centre;
  bp.Q.value = centre / (high - low);
  bp.connect(bus);
  brushFilters.set(bus, bp);
  return bp;
}

/** A requested level held to the body's ceiling; nothing for a level that is not one. */
const levelFor = (body: PulseBody, gain: number): number =>
  Number.isFinite(gain) && gain > 0 ? Math.min(gain, PULSE_GAIN[body]) : 0;

/**
 * The skin: a wood strike on the tonic two octaves under the mode's middle,
 * exactly in tune. `seed` names the onset, so the bed's humanising is the same
 * on every replay and never draws on the shared random stream.
 */
export function playSkin(
  ctx: AudioContext,
  bus: AudioNode,
  at: number,
  gain: number,
  seed = "pulse:skin"
): boolean {
  const level = levelFor("skin", gain);
  if (level <= 0) return false;
  return playNote(ctx, skinFilter(ctx, bus), "wood", modeFreq(0, "sub"), {
    gain: level,
    at,
    attack: SKIN_ENVELOPE.attack,
    hold: SKIN_ENVELOPE.hold,
    release: SKIN_ENVELOPE.release,
    exactTuning: true,
    seed,
  });
}

/**
 * The brush: a tap of the world's shared noise through the band. It has no
 * pitch, so there is nothing to tune; where the tap starts in the noise is
 * taken from `seed`, so a roll of them is not one sample repeated.
 */
export function playBrush(
  ctx: AudioContext,
  bus: AudioNode,
  at: number,
  gain: number,
  seed = "pulse:brush"
): boolean {
  const level = levelFor("brush", gain);
  if (level <= 0) return false;
  const { attack, hold, release } = BRUSH_ENVELOPE;
  const end = at + attack + hold + release;
  const stopAt = end + BRUSH_STOP_MARGIN_SECONDS;
  if (!voiceBudget.claim(ctx.currentTime, stopAt)) return false;

  const noise = noiseSource(ctx, 2.5);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.linearRampToValueAtTime(level, at + attack);
  env.gain.setValueAtTime(level, at + attack + hold);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  noise.connect(env);
  env.connect(brushFilter(ctx, bus));
  // Somewhere in the first two seconds of the shared (at least 2.5 s) buffer.
  noise.start(at, (hashString(seed) % 2000) / 1000);
  noise.stop(stopAt);
  return true;
}

/** The bell: a glass tick on the tonic in the air register, exactly in tune. */
export function playBell(
  ctx: AudioContext,
  bus: AudioNode,
  at: number,
  gain: number,
  seed = "pulse:bell"
): boolean {
  const level = levelFor("bell", gain);
  if (level <= 0) return false;
  return playNote(ctx, bus, "glass", modeFreq(0, "air"), {
    gain: level,
    at,
    attack: BELL_ENVELOPE.attack,
    hold: BELL_ENVELOPE.hold,
    release: BELL_ENVELOPE.release,
    exactTuning: true,
    seed,
  });
}

/** Play one onset of the pulse on its body. False when nothing was scheduled. */
export function playPulseBody(
  ctx: AudioContext,
  bus: AudioNode,
  body: PulseBody,
  at: number,
  gain: number,
  seed?: string
): boolean {
  switch (body) {
    case "skin":
      return playSkin(ctx, bus, at, gain, seed);
    case "brush":
      return playBrush(ctx, bus, at, gain, seed);
    case "bell":
      return playBell(ctx, bus, at, gain, seed);
  }
}
