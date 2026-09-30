import { audio } from "./engine";
import { playNote, noiseSource } from "./voices";
import { beadVoice, modeFreq } from "./theory";
import { COMFORT, clampBeatingHz } from "./comfort";
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
 * THE CLINK — two beads meeting.
 *
 * `scene/contact.ts` finds the moment two drawn discs close on each other as
 * the camera turns. This is what that sounds like, and it is the only sound in
 * the game that means nothing: it is not a cue, it carries no interpretation,
 * and it happens because of where the player is looking rather than because of
 * anything they said.
 *
 * WHY IT IS NOT TUNED. Every bead owns an identity note, and a collision that
 * sounded both notes would be lovely — two ideas touching, making an interval.
 * It is also a lie. An interval is the vocabulary this game reserves for a
 * relation the player actually declared, and hearing one because two discs
 * drifted across each other would imply a reading nobody made. So the pitch
 * comes from *size* and is continuous, off the scale, and slightly detuned per
 * strike: it reads as a thing touching a thing, not as a note.
 *
 * THE PHYSICS IT IMITATES. Struck glass is inharmonic and decays fast, and the
 * strike itself is most of what you hear. So: a short bandpassed noise
 * transient carrying the contact, a glass body under it whose frequency falls
 * as the pair gets larger, and — only when the hit is hard enough to justify it
 * — one partial at 2.34x, which is roughly where a wine glass puts its second
 * mode. Harder hits are louder, brighter, and ring a little longer, which is
 * how real glass behaves and is also the only reason velocity is worth
 * carrying.
 *
 * Its rate limits, its silence threshold and its ceiling are all in
 * `comfort.ts` with every other comfort bound (CAV-007), because an unbounded
 * version of this machine-guns during a camera sweep.
 */
export function beadClink(strength: number, size: number, pan: number): void {
  const ctx = audio.get();
  if (!ctx || !audio.sfxBus) return;

  const hit = Math.max(0, Math.min(1, strength));
  const t0 = ctx.currentTime;
  const bounds = COMFORT.contact;
  const level = bounds.maxGain * (0.3 + 0.7 * hit);

  /*
   * Bigger glass rings lower. `size` is a combined screen radius, so it grows
   * as a bead approaches the camera and as the pair's discs get larger; the
   * span below covers what the arena actually produces at both quality tiers,
   * and is clamped because a bead filling the frame should not descend into
   * a thud.
   */
  const span = Math.max(0, Math.min(1, (size - 0.05) / 0.22));
  const body = 2400 - 1500 * span;

  // The contact. Almost all of the character is here.
  const noise = noiseSource(ctx, 0.25);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3200 + 4200 * hit;
  bp.Q.value = 2.4;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(level, t0 + 0.0035);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.028 + 0.03 * hit);
  noise.connect(bp);
  bp.connect(env);

  // Placed where it happened. A contact at the edge of the frame belongs at the
  // edge of the field, which is most of what makes a busy frame legible.
  if (Math.abs(pan) > 0.01 && typeof ctx.createStereoPanner === "function") {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    env.connect(panner);
    panner.connect(audio.sfxBus);
  } else {
    env.connect(audio.sfxBus);
  }
  noise.start(t0);
  noise.stop(t0 + 0.3);

  // The body, through the one place a note is born.
  playNote(ctx, audio.sfxBus, "glass", body, {
    gain: level * 0.65,
    attack: 0.001,
    hold: 0,
    release: 0.1 + 0.22 * hit,
    pan,
  });

  // The second mode, only when the hit earns it. Below this the clink is a
  // tick, which is what a soft touch on glass actually sounds like.
  if (hit > 0.45) {
    playNote(ctx, audio.sfxBus, "glass", body * 2.34, {
      gain: level * 0.3 * hit,
      attack: 0.001,
      hold: 0,
      release: 0.06 + 0.1 * hit,
      pan,
    });
  }
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

/**
 * ── Prototype voices deleted here, and why ──────────────────────────────────
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
 *
 * `setSilkActive` / `updateSilk`, the silk shimmer, rode the pointer's speed
 * while a thread was dragged from one bead to another. The focus view weaves by
 * holding a reading's sigil on a pair already chosen (I-016, I-020), so there
 * is no drag for it to ride; its last caller went with the drag.
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

