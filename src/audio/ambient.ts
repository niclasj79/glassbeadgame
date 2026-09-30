import { audio } from "./engine";
import { CHOIR_LIGHT_WEIGHT, conductor, gridAhead } from "./conductor";
import {
  noteSeconds,
  playNote,
  playVoice,
  noiseSource,
  type RetireVoice,
  type SimpleVoiceOptions,
} from "./voices";
import { beadVoice, modeFreq } from "./theory";
import {
  chordFor,
  groundStrike,
  groundStrikeSlots,
  nextVoicing,
  rootForPhrase,
} from "./harmony";
import { castaliaConceptById } from "@/content/castalia";
import { hashString, mulberry32 } from "@/lib/utils";
import { frameState } from "@/scene/frameState";
import { runtimeRandom } from "@/runtime/testMode";
import { currentTheme } from "@/themes/useTheme";
import { SCORE } from "./score";
import type { FacultyId, TimbreId } from "@/content/castalia/schema";
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

/**
 * THE STEMS LOAD WITH THE BED, NOT WITH THE TITLE (ADR-017).
 *
 * They answer woven threads, and nothing is woven before the arena opens, so
 * the module is fetched the first time the bed starts and played from the
 * first slot after it arrives. The first load never carries it.
 */
type StemsModule = typeof import("./stems");
let stems: StemsModule | null = null;
let stemsLoading: Promise<StemsModule | null> | null = null;
export function loadStems(): Promise<StemsModule | null> {
  stemsLoading ??= import("./stems").then(
    (module) => {
      stems = module;
      return module;
    },
    () => {
      // Texture, not meaning: the bed plays on without them and asks again
      // the next time it starts.
      stemsLoading = null;
      return null;
    }
  );
  return stemsLoading;
}

interface Motif {
  threadId: string;
  /** The concepts whose identity notes the voice sings, so their beads can light. */
  conceptA: string;
  conceptB: string;
  freqA: number;
  freqB: number;
  timbreA: TimbreId;
  timbreB: TimbreId;
  rng: () => number;
  flip: boolean;
}

/** A choir note with the moment it was scheduled for. */
type ScheduledNote = SimpleVoiceOptions & { readonly at: number };

class AmbientEngine {
  private timer: number | null = null;
  private nextSlotTime = 0;
  private slot = 0;
  private motifs: Motif[] = [];
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
  /** The pad's voices as last led, in the low register; null before the first chord. */
  private padVoices: readonly number[] | null = null;
  /** The ground still sounding, so the bed can let it go when it stops. */
  private groundVoices: { readonly retire: RetireVoice; readonly endsAt: number }[] = [];
  /** The woven threads seated in each faculty: who the stems play for (ADR-017). */
  private facultyThreads = new Map<FacultyId, Set<string>>();
  /** Space the semantic layer has asked for: density and bed multipliers. */
  private densityScale = 1;
  private bedScale = 1;
  /**
   * The moment the loop has to be gone by, on the audio clock, or null while the
   * session is still open. See `concludeAt`.
   */
  private silenceFrom: number | null = null;
  /** From here the loop schedules nothing new; the bed is already ramping out. */
  private lastSlotBefore = Number.POSITIVE_INFINITY;

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
    this.facultyThreads = new Map();
    void loadStems();
    this.motifPatterns = [];
    this.rootDegree = 0;
    this.padVoices = null;
    this.densityScale = 1;
    this.bedScale = 1;
    this.slot = 0;
    // The bed's first slot is the grid's origin: from here the world keeps one
    // time, and the conductor carries it to everything else that moves with the
    // music (ADR-016).
    const grid = gridAhead(this.slotS, ctx.currentTime);
    this.nextSlotTime = grid.origin;
    conductor.arm(grid);
    // A previous session may have ended: the loop was told to stop and the bed
    // was ramped to silence. Both have to be released, or the new session opens
    // into a room that is still finishing the last one.
    this.silenceFrom = null;
    this.lastSlotBefore = Number.POSITIVE_INFINITY;
    audio.setBedScale(1);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.startAirBed(ctx);
  }

  /**
   * The bed leaves the room, and the grid with it: the conductor forgets its
   * time and every light it holds, because the next room keeps its own (ADR-016).
   */
  stop(): void {
    this.halt();
    conductor.disarm();
  }

  /**
   * The loop stops composing. This alone is what the loop's own ending does: the
   * coda it ended for is still sounding on the grid, so the grid, and the light
   * of the coda's notes, stay until the room changes and calls `stop()`.
   */
  private halt(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    this.motifs = [];
    this.facultyThreads = new Map();
    this.releaseGround();
    // A previous session's completed motifs may not keep their seats in the
    // next one. `start()` already resets them, but a session that never reaches
    // `start()` — no audio context yet — would otherwise inherit an ensemble
    // from a composition the player has left.
    this.motifPatterns = [];
    this.silenceFrom = null;
    this.lastSlotBefore = Number.POSITIVE_INFINITY;
    frameState.pulses.length = 0;
    this.stopAirBed();
    // Long-tailed voices fade out on their own envelopes.
  }

  /**
   * THE LOOP ENDS.
   *
   * A generative bed does not end on its own — it is a loop, and the review
   * found it still running under the conclusion, so the performance's last
   * authored sound arrived over a texture that carried on afterwards. That is
   * the difference between a game that ends and a game that stops.
   *
   * Three things happen, all on the audio clock so they cannot drift from the
   * notes the semantic scheduler has already placed:
   *
   *  - no slot is scheduled from the moment the fade begins, so no *new*
   *    generative material is created under the ending;
   *  - the bed ramps to silence and is finished by `atSeconds`;
   *  - the loop stops running once that moment passes, and the room tone with it.
   *
   * Idempotent, and always takes the earliest ending asked for: a second call
   * may bring the end forward but may never push it back.
   */
  concludeAt(atSeconds: number, fadeSeconds: number): void {
    const fade = Math.max(0.25, fadeSeconds);
    if (this.silenceFrom !== null && this.silenceFrom <= atSeconds) return;
    this.silenceFrom = atSeconds;
    this.lastSlotBefore = atSeconds - fade;
    audio.fadeAmbientOut(atSeconds, fade);
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

  /**
   * Whether the loop is still composing. Read by tests, and by anything that
   * needs to know the difference between a session in progress and one that has
   * ended — which, before `concludeAt`, was a difference the engine could not
   * express.
   */
  isRunning(): boolean {
    return this.running;
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
    // The stems count a thread in the faculty of each of its two concepts. A
    // set, because the room re-seats the whole session with every new thread.
    for (const id of [aId, bId]) {
      const faculty = castaliaConceptById.get(id)?.faculty;
      if (faculty === undefined) continue;
      const seated = this.facultyThreads.get(faculty) ?? new Set<string>();
      seated.add(threadId);
      this.facultyThreads.set(faculty, seated);
    }
    this.motifs.push({
      threadId,
      conceptA: aId,
      conceptB: bId,
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

  /**
   * One strike of the ground (`groundStrike`): on a phrase boundary the pad is
   * first led to the new root's chord. Tuned exactly, because the chord's
   * intervals are just ratios whose point is that they lock; seeded, so the
   * same slot is humanised the same way on every replay.
   */
  private strikeGround(
    ctx: AudioContext,
    ground: AudioNode,
    t: number,
    slot: number,
    strikeSlots: number
  ): void {
    if (this.padVoices === null || slot % SCORE.harmony.phraseSlots === 0) {
      this.padVoices = nextVoicing(this.padVoices, this.rootDegree);
    }
    const now = ctx.currentTime;
    this.groundVoices = this.groundVoices.filter((voice) => voice.endsAt > now);
    const span = strikeSlots * this.slotS;
    for (const voice of groundStrike(this.rootDegree, this.padVoices, span, this.droneGain)) {
      const endsAt = t + voice.attack + voice.hold + voice.release;
      playVoice(ctx, ground, {
        timbre: voice.timbre,
        frequency: modeFreq(voice.degree, "low"),
        gain: voice.gain * this.bedScale,
        at: t,
        attack: voice.attack,
        hold: voice.hold,
        release: voice.release,
        seed: `ground:${slot}:${voice.timbre}:${voice.degree}`,
        exactTuning: true,
        onRetire: (retire) => this.groundVoices.push({ retire, endsAt }),
      });
    }
  }

  /**
   * The ground holds for a whole phrase. When the bed stops it is let go over
   * the crossfade, rather than left holding a chord in a room that has changed
   * — a new session opens on its own root while the last one's fades.
   */
  private releaseGround(): void {
    const ctx = audio.get();
    if (ctx !== null) {
      const now = ctx.currentTime;
      for (const voice of this.groundVoices) {
        if (voice.endsAt > now) voice.retire(now, SCORE.harmony.crossfadeSeconds);
      }
    }
    this.groundVoices = [];
  }

  /**
   * The stems (ADR-017): every faculty the web has reached plays its stem on
   * the chord, once the module has arrived. The stems thin with the density
   * as the choir does, and leave with the loop.
   */
  private scheduleStems(ctx: AudioContext, t: number, slot: number): void {
    if (stems === null || this.facultyThreads.size === 0) return;
    stems.playStems(ctx, audio.ambientBus!, {
      chord: chordFor(this.rootDegree),
      slot,
      at: t,
      slotSeconds: this.slotS,
      density: this.densityScale,
      bed: this.bedScale,
      threads: this.facultyThreads,
    });
  }

  private tick(): void {
    const ctx = audio.get();
    // `running` is the authority, not the interval handle: an ended session must
    // not compose again because one last scheduled callback was still in flight.
    if (!ctx || !audio.ambientBus || !this.running) return;

    if (this.silenceFrom !== null && ctx.currentTime >= this.silenceFrom) {
      // The ending has passed. Everything generative is silent by now; keeping
      // the interval alive would only be a timer with nothing to schedule. The
      // grid is not the loop's to take away: the coda is sounding on it.
      this.halt();
      return;
    }

    const horizon = ctx.currentTime + LOOKAHEAD_S;

    while (this.nextSlotTime < horizon) {
      // Past this point the bed is on its way out and the coda is arriving.
      // Adding new material here is exactly what "the loop is audible under the
      // last sound" means, so the loop stops composing rather than being ducked.
      if (this.nextSlotTime >= this.lastSlotBefore) break;
      this.scheduleSlot(ctx, this.nextSlotTime, this.slot);
      this.nextSlotTime += this.slotS;
      this.slot += 1;
    }
  }

  private scheduleSlot(ctx: AudioContext, t: number, slot: number): void {
    const bus = audio.ambientBus!;

    // THE HARMONY THAT MOVES (ADR-017). The root walks the cycle one phrase at
    // a time — C, F, A, G, and home — and the ground turns with it on the
    // phrase boundary, never between: the drone on the root, and the pad as a
    // chord of three voices led to the nearest tones of the next, the old chord
    // releasing over the two seconds the new one attacks in. (A world whose
    // phrase outlives a voice's lifetime bound re-strikes the same chord inside
    // the phrase: `groundStrikeSlots`.) Every chord is a just triad on the
    // mode's stable degrees, so the ground's intervals are exact ratios and
    // lock rather than beat. (The lean this replaces set a fourth over A,
    // degrees 9 and 14: in this tuning that is 27/20, a comma wider than 4/3,
    // so it beat.) Both route through the breath filter — the wave the whole
    // cosmos inhales on.
    this.rootDegree = rootForPhrase(Math.floor(slot / SCORE.harmony.phraseSlots));
    const ground = audio.breathFilter ?? bus;
    const strikeSlots = groundStrikeSlots(this.slotS);
    if (slot % strikeSlots === 0) this.strikeGround(ctx, ground, t, slot, strikeSlots);

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

    this.scheduleStems(ctx, t, slot);

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
      const concept1 = m.flip ? m.conceptB : m.conceptA;
      const concept2 = m.flip ? m.conceptA : m.conceptB;
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
      // Each identity note that is actually scheduled is on the score, and its
      // bead may light with it. A note the voice budget refused is not a musical
      // event, so it lights nothing.
      const firstNote: ScheduledNote = {
        gain: 0.075 * gainScale * this.bedScale,
        at: t + jitter,
        release: 1.6,
      };
      if (playNote(ctx, bus, timbre1, first, firstNote)) {
        this.conduct(concept1, firstNote);
      }
      const secondNote: ScheduledNote = {
        gain: 0.06 * gainScale * this.bedScale,
        at: t + jitter + 0.55 + m.rng() * 0.3,
        release: 1.8,
      };
      if (playNote(ctx, bus, timbre2, second, secondNote)) {
        this.conduct(concept2, secondNote);
      }
      // Occasionally the motif lifts an octave — a thought recurring, changed.
      if (m.rng() < 0.18) {
        const lift: ScheduledNote = {
          gain: 0.03 * gainScale * this.bedScale,
          at: t + jitter + 1.3,
          release: 1.4,
        };
        if (playNote(ctx, bus, "glass", first * 2, lift)) this.conduct(concept1, lift);
      }
    }
  }

  /** A choir note on a concept is on the score the scene reads (ADR-016). */
  private conduct(conceptId: string, note: ScheduledNote): void {
    conductor.sound({
      conceptId,
      at: note.at,
      duration: noteSeconds(note),
      weight: CHOIR_LIGHT_WEIGHT,
    });
  }
}

export const ambient = new AmbientEngine();
