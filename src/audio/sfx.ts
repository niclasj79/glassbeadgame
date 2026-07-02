import { audio } from "./engine";
import { playVoice } from "./voices";
import { chordForPair, degreeToFreq, noteForConcept } from "./theory";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import type { Discovery } from "@/state/types";

let lastHoverAt = 0;

/** A bead announces its identity note on hover — the sphere is an instrument. */
export function hoverPing(conceptId: string): void {
  const now = performance.now();
  if (now - lastHoverAt < 90) return;
  lastHoverAt = now;
  const ctx = audio.get();
  if (!ctx || !audio.sfxBus) return;
  const concept = conceptById.get(conceptId);
  if (!concept) return;
  playVoice(ctx, audio.sfxBus, "bell", noteForConcept(concept) * 2, {
    gain: 0.045,
    release: 0.5,
  });
}

export function selectTick(conceptId: string): void {
  const ctx = audio.get();
  if (!ctx || !audio.sfxBus) return;
  const concept = conceptById.get(conceptId);
  if (!concept) return;
  const disc = disciplineById.get(concept.discipline);
  playVoice(ctx, audio.sfxBus, disc?.timbre ?? "pluck", noteForConcept(concept), {
    gain: 0.09,
    release: 0.45,
  });
}

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
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = degreeToFreq(4, 3); // A3
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = degreeToFreq(4, 3) * 1.006; // a hair sharp — expectancy
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
  osc.frequency.setValueAtTime(degreeToFreq(2, 4), t);
  osc.frequency.exponentialRampToValueAtTime(degreeToFreq(0, 3), t + 0.28);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(g);
  g.connect(audio.sfxBus);
  osc.start(t);
  osc.stop(t + 0.4);
}

/** The discovery chord — a strum voiced by tier, guaranteed consonant. */
export function discoveryChord(discovery: Discovery): void {
  const ctx = audio.ensure();
  if (!ctx || !audio.sfxBus) return;
  const notes = chordForPair(discovery.a, discovery.b, discovery.tier);
  const t0 = ctx.currentTime + 0.03;
  const tierGain = discovery.tier >= 3 ? 1.15 : discovery.tier === 2 ? 1.0 : 0.9;
  const release = discovery.tier >= 3 ? 3.2 : 2.2;
  for (const n of notes) {
    playVoice(ctx, audio.sfxBus, n.timbre, n.freq, {
      gain: n.gain * tierGain,
      at: t0 + n.delay,
      release,
    });
  }
}

/** Faint resonance: two quiet plucks a fifth apart. Honest, small. */
export function faintDyad(discovery: Discovery): void {
  const ctx = audio.get();
  if (!ctx || !audio.sfxBus) return;
  const a = conceptById.get(discovery.a);
  const b = conceptById.get(discovery.b);
  if (!a || !b) return;
  const t0 = ctx.currentTime + 0.02;
  playVoice(ctx, audio.sfxBus, "pluck", noteForConcept(a), { gain: 0.07, at: t0, release: 0.8 });
  playVoice(ctx, audio.sfxBus, "pluck", noteForConcept(b) * 1.5, {
    gain: 0.055,
    at: t0 + 0.13,
    release: 0.8,
  });
}

/** The conclusion cadence: every discovered pitch, resolving onto low C. */
export function conclusionCadence(pitches: number[]): void {
  const ctx = audio.ensure();
  const bus = audio.sfxBus;
  if (!ctx || !bus) return;
  const t0 = ctx.currentTime + 0.05;
  const unique = [...new Set(pitches)].slice(0, 10);
  unique.forEach((freq, i) => {
    playVoice(ctx, bus, "bell", freq, {
      gain: 0.08,
      at: t0 + i * 0.14,
      release: 2.8,
    });
  });
  const tEnd = t0 + unique.length * 0.14 + 0.5;
  playVoice(ctx, bus, "drone", degreeToFreq(0, 2), {
    gain: 0.3,
    at: tEnd,
    attack: 0.3,
    hold: 1.6,
    release: 4,
  });
  playVoice(ctx, bus, "pad", degreeToFreq(3, 3), {
    gain: 0.16,
    at: tEnd + 0.1,
    hold: 1.4,
    release: 3.6,
  });
}
