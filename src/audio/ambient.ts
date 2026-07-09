import { audio } from "./engine";
import { playVoice, noiseSource } from "./voices";
import { degreeToFreq, noteForConcept } from "./theory";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import { hashString, mulberry32 } from "@/lib/utils";
import { frameState } from "@/scene/frameState";
import { currentTheme } from "@/themes/useTheme";
import { SCORE } from "./score";
import type { TimbreId } from "@/content/types";
import type { MotifAward } from "@/state/types";

/**
 * The generative soundtrack that grows with the web.
 * A lookahead scheduler (the "Tale of Two Clocks" pattern — a JS interval
 * schedules Web-Audio-clock-accurate events ahead of time; never the legacy
 * setTimeout-as-metronome). Each woven thread registers a recurring two-note
 * motif; density is capped and probabilities rebalance so the piece thickens
 * without turning to mud.
 */

const TICK_MS = 25;
const LOOKAHEAD_S = 1.2;
/** Default slot ≈ half a "bar" at largo; each world sets its own tempo. */
const DEFAULT_SLOT_S = 2.0;
const MAX_ACTIVE_MOTIFS = 6;

interface Motif {
  threadId: string;
  freqA: number;
  freqB: number;
  timbreA: TimbreId;
  timbreB: TimbreId;
  rng: () => number;
  flip: boolean;
}

class AmbientEngine {
  private timer: number | null = null;
  private nextSlotTime = 0;
  private slot = 0;
  private motifs: Motif[] = [];
  private droneRefreshAt = 0;
  private running = false;
  private airBed: {
    src: AudioBufferSourceNode;
    gain: GainNode;
    panner: StereoPannerNode;
  } | null = null;
  // The active world's musical temperament (set at start()).
  private slotS = DEFAULT_SLOT_S;
  private droneGain = 0.14;
  private motifBias = 1;
  /** Completed-motif ensemble voices — each motif joins the piece forever. */
  private motifPatterns: { kind: MotifAward["motifId"]; freqs: number[]; rng: () => number }[] =
    [];
  /** The harmonic journey: which pentatonic degree grounds the drone now. */
  private rootDegree: 0 | 4 = 0;

  start(): void {
    const ctx = audio.ensure();
    if (!ctx || this.running) return;
    const world = currentTheme().music;
    this.slotS = world.slotSeconds;
    this.droneGain = world.droneGain;
    this.motifBias = world.motifBias;
    audio.setBreathCenter(world.padCutoff);
    this.running = true;
    this.motifs = [];
    this.motifPatterns = [];
    this.rootDegree = 0;
    this.slot = 0;
    this.nextSlotTime = ctx.currentTime + 0.15;
    this.droneRefreshAt = 0;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.startAirBed(ctx);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    this.motifs = [];
    frameState.pulses.length = 0;
    this.stopAirBed();
    // Long-tailed voices fade out on their own envelopes.
  }

  /** Distant room tone — barely-there filtered noise that pans with the
   *  camera and breathes with the ambient bus it lives on. */
  private startAirBed(ctx: AudioContext): void {
    if (this.airBed || !audio.ambientBus) return;
    const src = noiseSource(ctx, 3);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 260;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.setTargetAtTime(0.012, ctx.currentTime, 2.5);
    const panner = ctx.createStereoPanner();
    src.connect(lp);
    lp.connect(gain);
    gain.connect(panner);
    panner.connect(audio.ambientBus);
    src.start();
    this.airBed = { src, gain, panner };
  }

  private stopAirBed(): void {
    const ctx = audio.get();
    if (!this.airBed || !ctx) return;
    const { src, gain } = this.airBed;
    this.airBed = null;
    gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
    src.stop(ctx.currentTime + 2.5);
  }

  /**
   * The next point on the world's rhythmic grid (slot/8) — discovery
   * chords land on it, so every payoff arrives in time with the piece.
   */
  quantize(): number {
    const ctx = audio.get();
    if (!ctx || !this.running) return audio.now() + 0.02;
    const grid = this.slotS / 8;
    const now = ctx.currentTime;
    const until = this.nextSlotTime - now;
    const phase = ((until % grid) + grid) % grid;
    let t = now + (phase < 0.03 ? phase + grid : phase);
    if (t - now > grid + 0.05) t = now + grid;
    return t;
  }

  /** Camera azimuth → gentle stereo drift of the room tone. */
  setAirPan(pan: number): void {
    const ctx = audio.get();
    if (!this.airBed || !ctx) return;
    this.airBed.panner.pan.setTargetAtTime(
      Math.max(-0.6, Math.min(0.6, pan)),
      ctx.currentTime,
      0.3
    );
  }

  /** A completed motif takes a permanent seat in the ensemble. */
  addMotifPattern(kind: MotifAward["motifId"], beadIds: string[]): void {
    if (this.motifPatterns.some((p) => p.kind === kind)) return;
    let freqs: number[] = [];
    if (kind === "symposium") {
      // The council chord: one tonic per discipline present, in its register.
      const seen = new Set<string>();
      for (const id of beadIds) {
        const disc = conceptById.get(id)?.discipline;
        if (!disc || seen.has(disc)) continue;
        seen.add(disc);
        const d = disciplineById.get(disc);
        if (d) freqs.push(degreeToFreq(0, d.register === "low" ? 2 : d.register === "mid" ? 3 : 4));
        if (freqs.length >= 3) break;
      }
    } else {
      freqs = beadIds
        .map((id) => conceptById.get(id))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .map((c) => noteForConcept(c));
      if (kind === "triad") freqs = freqs.slice(0, 3);
    }
    if (freqs.length < 2) return;
    this.motifPatterns.push({
      kind,
      freqs,
      rng: mulberry32(hashString(`motif-${kind}`)),
    });
  }

  addThreadVoice(threadId: string, aId: string, bId: string): void {
    const a = conceptById.get(aId);
    const b = conceptById.get(bId);
    if (!a || !b) return;
    const da = disciplineById.get(a.discipline)!;
    const db = disciplineById.get(b.discipline)!;
    this.motifs.push({
      threadId,
      freqA: noteForConcept(a),
      freqB: noteForConcept(b),
      timbreA: da.timbre,
      timbreB: db.timbre,
      rng: mulberry32(hashString(threadId)),
      flip: false,
    });
    if (this.motifs.length > MAX_ACTIVE_MOTIFS * 2) {
      // The oldest voices retire entirely once the choir is very full.
      this.motifs.splice(0, this.motifs.length - MAX_ACTIVE_MOTIFS * 2);
    }
  }

  private tick(): void {
    const ctx = audio.get();
    if (!ctx || !audio.ambientBus) return;
    const horizon = ctx.currentTime + LOOKAHEAD_S;

    while (this.nextSlotTime < horizon) {
      this.scheduleSlot(ctx, this.nextSlotTime, this.slot);
      this.nextSlotTime += this.slotS;
      this.slot += 1;
    }
  }

  private scheduleSlot(ctx: AudioContext, t: number, slot: number): void {
    const bus = audio.ambientBus!;

    // The harmonic journey: most phrases ground on C; every Nth leans onto
    // A, the pentatonic's minor shadow — motion without ever losing home.
    const phrase = Math.floor(slot / SCORE.harmony.phraseSlots);
    this.rootDegree =
      phrase % SCORE.harmony.cycle === SCORE.harmony.cycle - 1
        ? SCORE.harmony.minorRootDegree
        : 0;

    // The ground: root drone + slow pad, refreshed every 8 slots (~16s)
    // with overlapping envelopes so the floor never drops out. Both route
    // through the breath filter — the wave the whole cosmos inhales on.
    const ground = audio.breathFilter ?? bus;
    if (slot >= this.droneRefreshAt) {
      this.droneRefreshAt = slot + 8;
      playVoice(ctx, ground, "drone", degreeToFreq(this.rootDegree, 2), {
        gain: this.droneGain,
        at: t,
        attack: 2.5,
        hold: 12,
        release: 6,
      });
      playVoice(ctx, ground, "pad", degreeToFreq(this.rootDegree === 0 ? 3 : 1, 2), {
        gain: 0.05,
        at: t + 1.2,
        attack: 3,
        hold: 10,
        release: 6,
      });
    }

    // The heartbeat: past half-awakening, a low pulse enters on each slot —
    // the stage is alive and knows it.
    const awakening = frameState.awakening;
    if (awakening >= 0.5) {
      playVoice(ctx, ground, "drone", degreeToFreq(this.rootDegree, 2) * 0.5, {
        gain: 0.05 * awakening,
        at: t,
        attack: 0.06,
        hold: 0.05,
        release: 0.7,
      });
    }

    // Near-full awakening: a rare high shimmer, three quick falling bells.
    if (awakening >= SCORE.shimmer.threshold && Math.random() < SCORE.shimmer.probability) {
      const top = degreeToFreq(2, 5);
      [top, top * 0.833, degreeToFreq(4, 4)].forEach((f, i) => {
        playVoice(ctx, bus, "bell", f, {
          gain: SCORE.shimmer.gain,
          at: t + 0.4 + i * 0.19,
          release: 1.6,
        });
      });
    }

    // The motif ensemble: completed motifs speak with their own voices.
    for (const p of this.motifPatterns) {
      if (p.rng() > SCORE.motifVoices.speakProbability) continue;
      const start = t + p.rng() * (this.slotS * 0.4);
      if (p.kind === "triad") {
        p.freqs.forEach((f, i) =>
          playVoice(ctx, ground, "pad", f, {
            gain: SCORE.motifVoices.triadGain,
            at: start + i * 0.09,
            attack: 0.4,
            hold: 0.8,
            release: 2.2,
          })
        );
      } else if (p.kind === "symposium") {
        p.freqs.forEach((f) =>
          playVoice(ctx, ground, "pad", f, {
            gain: SCORE.motifVoices.symposiumGain,
            at: start,
            attack: 1.6,
            hold: 1.8,
            release: 3.5,
          })
        );
      } else {
        // The fugue subject: its beads' notes as a walking line.
        const step = this.slotS / SCORE.motifVoices.fugueStepDivisor;
        p.freqs.forEach((f, i) =>
          playVoice(ctx, bus, "pluck", f, {
            gain: SCORE.motifVoices.fugueGain,
            at: start + i * step,
            release: 0.9,
          })
        );
      }
    }

    // The choir: each thread's motif speaks with probability scaled by
    // density, thickening as the session awakens.
    const active = this.motifs.slice(-MAX_ACTIVE_MOTIFS * 2);
    const density = Math.min(active.length, MAX_ACTIVE_MOTIFS);
    if (density === 0) return;
    const perMotifProb =
      (0.4 * this.motifBias * (1 + 0.6 * awakening)) / Math.sqrt(density);
    const gainScale = 1 / Math.sqrt(Math.max(1, density));

    for (const m of active) {
      if (m.rng() > perMotifProb) continue;
      const jitter = m.rng() * (this.slotS * 0.5);
      const usedFlip = m.flip;
      const first = m.flip ? m.freqB : m.freqA;
      const second = m.flip ? m.freqA : m.freqB;
      const timbre1 = m.flip ? m.timbreB : m.timbreA;
      const timbre2 = m.flip ? m.timbreA : m.timbreB;
      m.flip = !m.flip;

      // Tell the scene: this thread's motif will sound at `t + jitter` —
      // a light-pulse rides the strand in sync (same audio clock).
      frameState.pulses.push({
        threadId: m.threadId,
        atAudioTime: t + jitter,
        duration: 1.4,
        flip: usedFlip,
      });
      if (frameState.pulses.length > 24) {
        frameState.pulses.splice(0, frameState.pulses.length - 24);
      }
      playVoice(ctx, bus, timbre1, first, {
        gain: 0.075 * gainScale,
        at: t + jitter,
        release: 1.6,
      });
      playVoice(ctx, bus, timbre2, second, {
        gain: 0.06 * gainScale,
        at: t + jitter + 0.55 + m.rng() * 0.3,
        release: 1.8,
      });
      // Occasionally the motif lifts an octave — a thought recurring, changed.
      if (m.rng() < 0.18) {
        playVoice(ctx, bus, "bell", first * 2, {
          gain: 0.03 * gainScale,
          at: t + jitter + 1.3,
          release: 1.4,
        });
      }
    }
  }
}

export const ambient = new AmbientEngine();
