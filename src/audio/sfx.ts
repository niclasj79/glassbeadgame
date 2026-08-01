import { audio } from "./engine";
import { playNote, noiseSource } from "./voices";
import { beadVoice, modeFreq } from "./theory";
import { clampBeatingHz } from "./comfort";
import { centsForBeatingHz, transposeCents } from "./mode";
import { presentationNow } from "@/runtime/testMode";

let lastHoverAt = 0;

/** A bead announces its identity note on hover — the sphere is an instrument. */
export function hoverPing(conceptId: string): void {
  const now = presentationNow();
  if (now - lastHoverAt < 90) return;
  lastHoverAt = now;
  const ctx = audio.get();
  if (!ctx || !audio.sfxBus) return;
  const voice = beadVoice(conceptId);
  if (!voice) return;
  playNote(ctx, audio.sfxBus, "glass", voice.freq * 2, {
    gain: 0.045,
    release: 0.5,
  });
}

export function selectTick(conceptId: string): void {
  const ctx = audio.get();
  if (!ctx || !audio.sfxBus) return;
  const voice = beadVoice(conceptId);
  if (!voice) return;
  playNote(ctx, audio.sfxBus, voice.timbre, voice.freq, {
    gain: 0.09,
    release: 0.45,
  });

  // The glass touch — a close-mic tap layered under the tick: the ASMR of
  // a fingertip meeting a cold bead.
  const t0 = ctx.currentTime;
  const noise = noiseSource(ctx, 2.5);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3800;
  bp.Q.value = 9;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(0.03, t0 + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
  noise.connect(bp);
  bp.connect(env);
  env.connect(audio.sfxBus);
  noise.start(t0);
  noise.stop(t0 + 0.35);
  playNote(ctx, audio.sfxBus, "glass", voice.freq * 4, {
    gain: 0.012,
    release: 0.35,
  });
}

/**
 * THE CATCH — a candidate magnetising under the aim.
 *
 * This moment used to call `hoverPing`: the same function, the same gain, the
 * same timbre as moving the mouse across a bead. Latching a candidate — the
 * instant the weave acquires its other end — was sonically identical to
 * pointing at something, which is why the aim never felt like it gripped.
 *
 * It is deliberately an *articulation* rather than a pitch: a short damped
 * click with a low thock under it, so it reads as a mechanism catching and
 * cannot muddy the sustained relation voice the audio director plays on top of
 * the same cue. Hover sings; this one bites.
 */
export function latchTick(conceptId: string): void {
  const ctx = audio.get();
  if (!ctx || !audio.sfxBus) return;
  const t0 = ctx.currentTime;

  const noise = noiseSource(ctx, 0.4);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1650;
  bp.Q.value = 3.2;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(0.05, t0 + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.075);
  noise.connect(bp);
  bp.connect(env);
  env.connect(audio.sfxBus);
  noise.start(t0);
  noise.stop(t0 + 0.12);

  // Which bead was caught, said once and quietly, an octave below its identity
  // note so it sits under the click instead of competing with it.
  const voice = beadVoice(conceptId);
  if (!voice) return;
  playNote(ctx, audio.sfxBus, "gut", voice.freq * 0.5, {
    gain: 0.035,
    release: 0.18,
  });
}

/**
 * The world offering Attunement — two rising notes, quiet, at the far edge of
 * audibility. An invitation, and specifically not an alert: nothing about it
 * asks to be acted on, and it is played exactly once when the composition
 * becomes able to carry it.
 */
export function attunementInvitation(): void {
  const ctx = audio.get();
  if (!ctx || !audio.sfxBus) return;
  const t0 = ctx.currentTime + 0.02;
  playNote(ctx, audio.sfxBus, "glass", modeFreq(0, "mid"), {
    gain: 0.035,
    at: t0,
    attack: 0.08,
    release: 2.2,
  });
  playNote(ctx, audio.sfxBus, "glass", modeFreq(7, "high"), {
    gain: 0.028,
    at: t0 + 0.42,
    attack: 0.1,
    release: 2.8,
  });
}

// ── The silk shimmer — a continuous close texture while a thread is drawn,
// its brightness and level riding the pointer's velocity. Silence when still.
let silkNodes: {
  src: AudioBufferSourceNode;
  bp: BiquadFilterNode;
  gain: GainNode;
} | null = null;

export function setSilkActive(active: boolean): void {
  const ctx = audio.get();
  if (!ctx || !audio.sfxBus) return;
  if (active && !silkNodes) {
    const src = noiseSource(ctx, 3);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2200;
    bp.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(audio.sfxBus);
    src.start();
    silkNodes = { src, bp, gain };
  } else if (!active && silkNodes) {
    const { src, gain } = silkNodes;
    silkNodes = null;
    gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
    src.stop(ctx.currentTime + 0.6);
  }
}

/** Pointer speed (px/frame, smoothed by the caller) → silk brightness. */
export function updateSilk(speed: number): void {
  const ctx = audio.get();
  if (!ctx || !silkNodes) return;
  const t = ctx.currentTime;
  silkNodes.gain.gain.setTargetAtTime(Math.min(0.025, speed * 4e-4), t, 0.12);
  silkNodes.bp.frequency.setTargetAtTime(
    1500 + Math.min(3500, speed * 55),
    t,
    0.15
  );
}

/**
 * ── Three prototype voices were deleted here, and why ───────────────────────
 *
 * `updateSympathy` / `stopSympathy` sang the identity note of "the nearest bead
 * holding an *undiscovered* luminous connection with the thread's origin" —
 * a hot-and-cold signal steering the pointer toward an authored pair. That is
 * the guess-the-hidden-answer loop this game does not have: the player composes
 * an interpretation, and a sound that gets warmer as the aim approaches a
 * correct answer converts composition into search. It had zero callers, and
 * wiring it would have been a regression rather than a fix, so it is gone
 * along with `frameState.sympathy`.
 *
 * `consecrationChime` and `illuminationChime` belonged to the retired tier and
 * spent-Insight mechanics and also had zero callers. `scene/Illumination.tsx`,
 * the ghost arc the second of those voiced, went with them: the ribbon's own
 * material already draws an Open Thread as a figure that does not close, and it
 * does so at *solved* equal coverage (`scene/resolution.ts`), so a second mark
 * would have re-introduced the reward gradient that module exists to remove.
 *
 * `discoveryChord`, `faintDyad` and `conclusionCadence` have now gone the same
 * way. All three took a `Discovery` — the legacy record that carried `tier` and
 * `points` — and the first two were literally voiced *by tier*, which is a
 * reward gradient in sound. Their only callers read `session.discoveries`, a
 * projection published empty since the legacy scoring model was removed, so
 * none of them had sounded in a long time. What replaced them is not a
 * substitute chord: it is `audio/grammar.ts`, where a relation is voiced by the
 * intention the player declared, and `audio/conclusion.ts`, where the closing
 * performance is compiled from the event log. Both are epistemically flat by
 * construction (CAV-006).
 */

// A sustained, quiet, slightly tense dyad while a thread is being aimed.
let tensionNodes: { osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null;

export function setAimTension(active: boolean): void {
  const ctx = audio.get();
  if (!ctx || !audio.sfxBus) return;
  if (active && !tensionNodes) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.25);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    lp.connect(gain);
    gain.connect(audio.sfxBus);
    // Expectancy, not dissonance: one pitch and its slightly sharp twin, tuned
    // to beat at the slow end of the comfort band (CAV-007) rather than at
    // whatever rate an arbitrary ratio happened to give.
    const aim = modeFreq(9, "mid");
    const aimBeatHz = clampBeatingHz(1.3);
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = aim;
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = transposeCents(aim, centsForBeatingHz(aim, aimBeatHz));
    osc1.connect(lp);
    osc2.connect(lp);
    osc1.start();
    osc2.start();
    tensionNodes = { osc1, osc2, gain };
  } else if (!active && tensionNodes) {
    const { osc1, osc2, gain } = tensionNodes;
    tensionNodes = null;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(0.0001, t, 0.12);
    osc1.stop(t + 0.8);
    osc2.stop(t + 0.8);
  }
}

/** Downward gliss — a gesture released into nothing. */
export function cancelGliss(): void {
  const ctx = audio.get();
  if (!ctx || !audio.sfxBus) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(modeFreq(4, "high"), t);
  osc.frequency.exponentialRampToValueAtTime(modeFreq(0, "mid"), t + 0.28);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(g);
  g.connect(audio.sfxBus);
  osc.start(t);
  osc.stop(t + 0.4);
}

