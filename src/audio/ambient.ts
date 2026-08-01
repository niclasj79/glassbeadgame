import { audio } from "./engine";
import { playNote, noiseSource } from "./voices";
import { beadVoice, modeFreq } from "./theory";
import { castaliaConceptById } from "@/content/castalia";
import { hashString, mulberry32 } from "@/lib/utils";
import { frameState } from "@/scene/frameState";
import { runtimeRandom } from "@/runtime/testMode";
import { currentTheme } from "@/themes/useTheme";
import { SCORE } from "./score";
import type { TimbreId } from "@/content/castalia/schema";
import type { MotifKind } from "@/domain/motifs";

/**
 * The generative soundtrack that grows with the web.
 * A lookahead scheduler (the "Tale of Two Clocks" pattern — a JS interval
 * schedules Web-Audio-clock-accurate events ahead of time; never the legacy
 * setTimeout-as-metronome). Each woven thread registers a recurring two-note
 * motif; density is capped and probabilities rebalance so the piece thickens
 * without turning to mud.
 *
 * It also owns the *space* the semantic layer speaks into. setSpace() is how
 * attention and Attunement thin the texture: they hand the score a density
 * multiplier and a bed level, and the score decides what to do with them. The
 * attention planner never reaches in and silences a particular voice — leaving
 * space is the score's own act (VERTICAL-SLICE-SPEC section 6).
 */

const TICK_MS = 25;
const LOOKAHEAD_S = 1.2;
/** Default slot ≈ half a "bar" at largo; each world sets its own tempo. */
const DEFAULT_SLOT_S = 2.0;
const MAX_ACTIVE_MOTIFS = 6;
/**
 * Completed motifs are permanent, but the ensemble is not unbounded: a long
 * session can complete many, and every seated voice speaks against the same
 * bed. The oldest seats retire so the piece thickens without turning to mud.
 */
const MAX_MOTIF_PATTERNS = 4;

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
  private motifPatterns: {
    key: string;
    kind: MotifKind;
    freqs: number[];
    rng: () => number;
  }[] = [];
  /** The harmonic journey: which semitone of the mode grounds the drone now. */
  private rootDegree = 0;
  /** Space the semantic layer has asked for: density and bed multipliers. */
  private densityScale = 1;
  private bedScale = 1;

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
    this.densityScale = 1;
    this.bedScale = 1;
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
    // A previous session's completed motifs may not keep their seats in the
    // next one. `start()` already resets them, but a session that never reaches
    // `start()` — no audio context yet — would otherwise inherit an ensemble
    // from a composition the player has left.
    this.motifPatterns = [];
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

  /**
   * Leave space, or stop leaving it.
   *
   * The first argument scales the probability that any thread voice speaks; the
   * second scales the ambient floor. Both are multipliers rather than
   * absolutes, so attention composes with the web's own growth instead of
   * overwriting it.
   */
  setSpace(density: number, bed: number): void {
    this.densityScale = Math.max(0, Math.min(1, density));
    this.bedScale = Math.max(0.1, Math.min(1, bed));
    audio.setBedScale(this.bedScale);
  }

  /** Restore ordinary play. */
  clearSpace(): void {
    this.setSpace(1, 1);
  }

  /** Thread voices currently able to speak — the attention planner reads it. */
  activeVoiceCount(): number {
    return Math.min(this.motifs.length, MAX_ACTIVE_MOTIFS);
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

  /**
   * A completed motif takes a permanent seat in the ensemble.
   *
   * The three families are the domain's own (`domain/motifs`): a Dialectic is a
   * Tension held by a third concept, a Canon is a facet recurring transformed
   * across the web, a Bridge is the joint two regions hang on. Each is voiced
   * with the beads that formed it and nothing else — no new material is
   * invented, because a motif is a recognition of what the player already built.
   *
   * Keyed by the completion, not by the family, so a second Canon on a
   * different facet is a second voice rather than a silently dropped one.
   */
  addMotifPattern(key: string, kind: MotifKind, beadIds: string[]): void {
    if (this.motifPatterns.some((p) => p.key === key)) return;
    let freqs: number[] = [];
    if (kind === "dialectic") {
      // The held chord: one tonic per faculty present, sounded in the register
      // the first bead of that faculty actually speaks in. A Dialectic that
      // crosses faculties therefore sounds as more than one body at once.
      const seen = new Set<string>();
      for (const id of beadIds) {
        const concept = castaliaConceptById.get(id);
        if (!concept || seen.has(concept.faculty)) continue;
        seen.add(concept.faculty);
        freqs.push(modeFreq(0, concept.motif.register));
        if (freqs.length >= 3) break;
      }
      if (freqs.length < 2) {
        freqs = beadIds
          .map((id) => beadVoice(id))
          .filter((v): v is NonNullable<typeof v> => !!v)
          .map((v) => v.freq)
          .slice(0, 3);
      }
    } else {
      freqs = beadIds
        .map((id) => beadVoice(id))
        .filter((v): v is NonNullable<typeof v> => !!v)
        .map((v) => v.freq);
      // A Bridge is the joint, not the whole province: three voices state the
      // crossing without turning the bed into a roll call.
      if (kind === "bridge") freqs = freqs.slice(0, 3);
    }
    if (freqs.length < 2) return;
    this.motifPatterns.push({
      key,
      kind,
      freqs,
      rng: mulberry32(hashString(`motif-${key}`)),
    });
    if (this.motifPatterns.length > MAX_MOTIF_PATTERNS) {
      this.motifPatterns.splice(0, this.motifPatterns.length - MAX_MOTIF_PATTERNS);
    }
  }

  /** Completed-motif voices currently seated. Read by tests and the scene. */
  motifPatternCount(): number {
    return this.motifPatterns.length;
  }

  addThreadVoice(threadId: string, aId: string, bId: string): void {
    const a = beadVoice(aId);
    const b = beadVoice(bId);
    if (!a || !b) return;
    this.motifs.push({
      threadId,
      freqA: a.freq,
      freqB: b.freq,
      timbreA: a.timbre,
      timbreB: b.timbre,
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
      playNote(ctx, ground, "glass", modeFreq(this.rootDegree, "low"), {
        gain: this.droneGain * this.bedScale,
        at: t,
        attack: 2.5,
        hold: 12,
        release: 6,
      });
      // The fifth above the root when grounded, the fourth when leaning to the
      // mode's shadow — both exact ratios, so the floor locks rather than beats.
      playNote(
        ctx,
        ground,
        "voice",
        modeFreq(this.rootDegree + (this.rootDegree === 0 ? 7 : 5), "low"),
        { gain: 0.05 * this.bedScale, at: t + 1.2, attack: 3, hold: 10, release: 6 }
      );
    }

    // The heartbeat: past half-awakening, a low pulse enters on each slot —
    // the stage is alive and knows it.
    const awakening = frameState.awakening;
    if (awakening >= 0.5) {
      playNote(ctx, ground, "glass", modeFreq(this.rootDegree, "sub"), {
        gain: 0.05 * awakening * this.bedScale,
        at: t,
        attack: 0.06,
        hold: 0.05,
        release: 0.7,
      });
    }

    // Near-full awakening: a rare high shimmer, three quick falling bells.
    if (awakening >= SCORE.shimmer.threshold && runtimeRandom() < SCORE.shimmer.probability) {
      const top = modeFreq(4, "air");
      [top, modeFreq(2, "air"), modeFreq(9, "high")].forEach((f, i) => {
        playNote(ctx, bus, "glass", f, {
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
      if (p.kind === "bridge") {
        // The joint: the crossing stated as an arpeggio, one voice at a time.
        p.freqs.forEach((f, i) =>
          playNote(ctx, ground, "voice", f, {
            gain: SCORE.motifVoices.bridgeGain,
            at: start + i * 0.09,
            attack: 0.4,
            hold: 0.8,
            release: 2.2,
          })
        );
      } else if (p.kind === "dialectic") {
        // The held chord: the poles and the third that holds them, together.
        p.freqs.forEach((f) =>
          playNote(ctx, ground, "voice", f, {
            gain: SCORE.motifVoices.dialecticGain,
            at: start,
            attack: 1.6,
            hold: 1.8,
            release: 3.5,
          })
        );
      } else {
        // The Canon's subject: its beads' notes as a walking line, recurring.
        const step = this.slotS / SCORE.motifVoices.canonStepDivisor;
        p.freqs.forEach((f, i) =>
          playNote(ctx, bus, "gut", f, {
            gain: SCORE.motifVoices.canonGain,
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
    // The one place setSpace actually bites: fewer voices speak while the score
    // is leaving room for something else.
    const perMotifProb =
      (0.4 * this.motifBias * this.densityScale * (1 + 0.6 * awakening)) /
      Math.sqrt(density);
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
      playNote(ctx, bus, timbre1, first, {
        gain: 0.075 * gainScale * this.bedScale,
        at: t + jitter,
        release: 1.6,
      });
      playNote(ctx, bus, timbre2, second, {
        gain: 0.06 * gainScale * this.bedScale,
        at: t + jitter + 0.55 + m.rng() * 0.3,
        release: 1.8,
      });
      // Occasionally the motif lifts an octave — a thought recurring, changed.
      if (m.rng() < 0.18) {
        playNote(ctx, bus, "glass", first * 2, {
          gain: 0.03 * gainScale * this.bedScale,
          at: t + jitter + 1.3,
          release: 1.4,
        });
      }
    }
  }
}

export const ambient = new AmbientEngine();
