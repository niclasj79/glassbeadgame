import { audio } from "./engine";
import {
  CHOIR_LIGHT_WEIGHT,
  conductor,
  gridAhead,
  gridPointAtOrAfter,
} from "./conductor";
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
  cadenceArrival,
  chordFor,
  groundStrike,
  groundStrikeSlots,
  holdsThroughCadence,
  nextPhraseStart,
  nextVoicing,
  rootForPhrase,
  type GroundVoice,
} from "./harmony";
import { castaliaConceptById } from "@/content/castalia";
import { hashString, mulberry32 } from "@/lib/utils";
import { frameState } from "@/scene/frameState";
import { runtimeRandom } from "@/runtime/testMode";
import { currentTheme } from "@/themes/useTheme";
import { SCORE } from "./score";
import type { FacultyId, TimbreId } from "@/content/castalia/schema";
import type { MotifKind } from "@/domain/motifs";
import type { AudioIntensity } from "./intensity";
import type { PulseOnset } from "./pulse";

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
 * space is the score's own act (VERTICAL-SLICE-SPEC section 6). Attunement also
 * holds the bed's chord, and its release is the bed's cadence (`holdHarmony`).
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

/**
 * THE PULSE LOADS AFTER THE TITLE (ADR-017).
 *
 * The pulse's patterns and bodies (`pulse.ts`, `pulseBodies.ts`) are a chunk of
 * their own, fetched when the bed first starts — the first press into a room,
 * never the title — so the first load keeps its ceiling with the bed in it.
 * Until they arrive the bed writes its slots without a pulse, and from the
 * first slot after, the pulse is under them. A chunk that cannot be fetched
 * leaves the bed as it was, and the next room asks again.
 */
export interface PulseModules {
  readonly pattern: typeof import("./pulse");
  readonly bodies: typeof import("./pulseBodies");
}
let pulseModules: PulseModules | null = null;
let pulseLoading: Promise<PulseModules | null> | null = null;

/** Fetch the pulse, once. Resolves with it, or with null if it could not be fetched. */
export function loadPulse(): Promise<PulseModules | null> {
  pulseLoading ??= Promise.all([import("./pulse"), import("./pulseBodies")]).then(
    ([pattern, bodies]) => {
      pulseModules = { pattern, bodies };
      return pulseModules;
    },
    () => {
      pulseLoading = null;
      return null;
    }
  );
  return pulseLoading;
}

/**
 * How many written slots the bed remembers the pulse of: enough for a weave
 * landing inside the lookahead to add its fill to the slot it belongs to.
 */
const PULSE_MEMORY_SLOTS = 3;

/**
 * Two moments on the grid closer than this are the same boundary: a written
 * slot's start is a running sum of slots, a cadence's boundary is measured from
 * the origin, and the two may disagree in the last bits.
 */
const SAME_MOMENT_SECONDS = 1e-6;

/** A voice of the ground as struck, so the bed can let it go: at a cadence, or when it stops. */
interface GroundRecord {
  readonly timbre: TimbreId;
  readonly degree: number;
  readonly retire: RetireVoice;
  /** When it falls silent: its envelope's end, or its fade's once it is let go. */
  endsAt: number;
  /** When its fade begins, once it has been let go. */
  letGoAt: number | null;
}

/** Attunement's cadence (ADR-018), from its release until the harmony resumes. */
interface PendingCadence {
  /** The slot boundary the cadence begins on, on the audio clock. */
  readonly at: number;
  /** One slot later: the boundary the next phrase's chord is struck on. */
  readonly resumeAt: number;
  /** The harmonic slot the phrase clock resumes on there. */
  readonly resumeHarmonicSlot: number;
}

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
  /** The ground still sounding, so the bed can let it go. */
  private groundVoices: GroundRecord[] = [];
  /** The grid's origin: the first slot's start, where `start()` armed the conductor. */
  private gridOrigin = 0;
  /**
   * THE PHRASE CLOCK: how many slots the harmony has advanced. Without
   * Attunement it is the bed's own slot count; a held chord has no phrase
   * movement (ADR-018), so while Attunement holds it the clock waits.
   */
  private harmonicSlot = 0;
  /** Attunement is holding the chord. */
  private held = false;
  /** The slot the ground was last struck in. */
  private lastStrikeSlot = Number.NEGATIVE_INFINITY;
  /** The cadence that released the hold, until the harmony resumes after it. */
  private cadence: PendingCadence | null = null;
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
  /** The profile the director's plans are heard at; the pulse follows it (CAV-007). */
  private intensity: AudioIntensity = "full";
  /** Slots not yet written that a weave has asked to roll into their closing boundary. */
  private fillSlots = new Set<number>();
  /** The pulse carries its second voice on every slot before this one. */
  private secondVoiceUntil = 0;
  /** The pulse of the last few written slots, by slot, and when each began. */
  private pulseWritten = new Map<
    number,
    { readonly t: number; onsets: readonly PulseOnset[] }
  >();

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
    this.resetHarmony();
    this.densityScale = 1;
    this.bedScale = 1;
    this.slot = 0;
    // The bed's first slot is the grid's origin: from here the world keeps one
    // time, and the conductor carries it to everything else that moves with the
    // music (ADR-016).
    const grid = gridAhead(this.slotS, ctx.currentTime);
    this.nextSlotTime = grid.origin;
    this.gridOrigin = grid.origin;
    conductor.arm(grid);
    // A previous session may have ended: the loop was told to stop and the bed
    // was ramped to silence. Both have to be released, or the new session opens
    // into a room that is still finishing the last one.
    this.silenceFrom = null;
    this.lastSlotBefore = Number.POSITIVE_INFINITY;
    audio.setBedScale(1);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.startAirBed(ctx);
    // The pulse (ADR-017) is fetched now, after the title, and a new session
    // owes no fill and no second voice to the last one.
    this.fillSlots.clear();
    this.secondVoiceUntil = 0;
    this.pulseWritten.clear();
    void loadPulse();
  }

  /**
   * The bed leaves the room, and the grid with it: the conductor forgets its
   * time and every light it holds, because the next room keeps its own (ADR-016).
   */
  stop(): void {
    this.halt();
    conductor.disarm();
    // The pulse leaves with the bed: nothing it was asked for outlives the room.
    this.fillSlots.clear();
    this.secondVoiceUntil = 0;
    this.pulseWritten.clear();
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
    // A hold or a cadence belongs to the composition that asked for it.
    this.resetHarmony();
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

  /**
   * The profile the director's plans are heard at, which the pulse follows
   * (CAV-007): reduced keeps the skin on the downbeats, silent keeps nothing.
   * The bridge sets it where it sets the director's, from the same settings.
   */
  setIntensity(intensity: AudioIntensity): void {
    this.intensity = intensity;
  }

  /**
   * A WEAVE HAS LANDED, AND THE PULSE ROLLS INTO A BOUNDARY (ADR-017).
   *
   * `atSeconds` is the landing on the audio clock. The fill belongs to the first
   * slot whose last half begins at or after it — never earlier, because a fill
   * begun before the thread landed would anticipate the act — and lands its bell
   * on that slot's closing boundary. A slot not yet written is marked, and its
   * cell carries the fill. A slot already written (the lookahead is more than
   * half a slot, so it usually is) has the fill's own onsets added now, on the
   * sixteenths it left free, as its cell with the fill would have struck them.
   * Once the ending has been asked for, nothing new is added under it.
   */
  requestFill(atSeconds: number): void {
    if (!this.running || this.silenceFrom !== null || !Number.isFinite(atSeconds)) {
      return;
    }
    const ctx = audio.get();
    if (!ctx) return;
    // Slot `this.slot` is the next to be written and begins at `nextSlotTime`;
    // each slot's last half begins half a slot after its start.
    const ahead = Math.ceil(
      (atSeconds - this.nextSlotTime) / this.slotS - 0.5 - 1e-6
    );
    const slot = this.slot + ahead;
    if (slot < 0) return;
    if (ahead >= 0) {
      this.fillSlots.add(slot);
      return;
    }
    const written = this.pulseWritten.get(slot);
    const pulse = pulseModules;
    if (written === undefined || pulse === null) return;
    const fill = pulse.pattern.pulseFill(slot, {
      awakening: frameState.awakening,
      density: this.densityScale,
      intensity: this.intensity,
    });
    const onsets = pulse.pattern.mergePulse(written.onsets, fill);
    const added = onsets.filter((onset) => !written.onsets.includes(onset));
    written.onsets = onsets;
    this.playPulse(ctx, pulse, written.t, slot, added);
  }

  /**
   * A COMPLETED MOTIF, OR A SOLVED STUDY (ADR-017): the pulse gains its second
   * voice — the brush on every other eighth — for the next `slots` slots the bed
   * writes, which the director asks for as one phrase. A second completion
   * inside the phrase extends it; nothing shortens it.
   */
  requestSecondVoice(slots: number): void {
    if (!this.running || !Number.isFinite(slots) || slots <= 0) return;
    this.secondVoiceUntil = Math.max(
      this.secondVoiceUntil,
      this.slot + Math.floor(slots)
    );
  }

  /**
   * ATTUNEMENT HOLDS THE CHORD, AND LETS IT GO WITH A CADENCE (ADR-018).
   *
   * Held, the phrase clock stops: the root and the pad's voicing stay as they
   * are, and the ground is struck again on that same chord at its usual
   * interval, so the chord sustains through a hold of any length while no voice
   * outlives the comfort table's 30 s.
   *
   * Released, the cadence, on the first slot boundary at least the score's
   * `cadenceLeadSeconds` ahead — the moment the scene reads from the conductor
   * at the same cue, so the world lifts on the slot the chord resolves on.
   * Across that slot the fifth and the colour release, the root holds, and one
   * voice arrives on the root an octave above the pad's; on the next boundary
   * the next phrase's chord is struck, led from the held voicing, and the clock
   * resumes there. The cadence closes the phrase it paused in: the phrase was
   * heard as far as Attunement let it go, and is not taken up again halfway.
   * The cadence's slot carries no stem and no pulse: the bed's movement rests
   * while the chord resolves, and the heartbeat keeps the slot.
   *
   * Held again before the cadence has closed, the cadence is taken back: the
   * harmony stays on the phrase it paused in, and the chord the cadence had
   * begun to let go is struck again on the first boundary the lead allows —
   * the cadence's own, while that is still ahead, so a cadence taken back
   * before it begins is never heard.
   */
  holdHarmony(held: boolean): void {
    if (held === this.held) return;
    this.held = held;
    // A cadence is only ever pending while nothing holds the chord.
    const cadence = this.cadence;
    this.cadence = null;
    const ctx = audio.get();
    const ground = audio.breathFilter ?? audio.ambientBus;
    const pad = this.padVoices;
    // Nothing struck yet, or no bed to strike in: nothing to keep or resolve.
    if (ctx === null || ground === null || pad === null || !this.running) return;
    if (!held) this.beginCadence(ctx, ground, pad);
    else if (cadence !== null) this.strikeAgain(ctx, ground, cadence);
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
    // The room re-seats the whole session with every new thread, and a seat
    // is one per thread: a choir that held a thread twice spoke twice as often
    // as designed and over-reported its voices to the director.
    if (this.motifs.some((motif) => motif.threadId === threadId)) return;
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
   * One strike of the ground (`groundStrike`) on the chord as it stands, held
   * for `strikeSlots` slots. The pad is led to a new root's chord on the phrase
   * boundary, before the strike; only a hold from the bed's very first slot
   * reaches here with no chord yet, and voices it from the pad's floor.
   */
  private strikeGround(
    ctx: AudioContext,
    ground: AudioNode,
    t: number,
    slot: number,
    strikeSlots: number
  ): void {
    const pad = (this.padVoices ??= nextVoicing(null, this.rootDegree));
    this.lastStrikeSlot = slot;
    this.playGround(
      ctx,
      ground,
      t,
      `ground:${slot}`,
      groundStrike(this.rootDegree, pad, strikeSlots * this.slotS, this.droneGain)
    );
  }

  /**
   * Voices of the ground from `t`, each remembered with its body and degree so
   * the bed can let it go. Tuned exactly, because the chord's intervals are just
   * ratios whose point is that they lock; seeded, so the same slot is humanised
   * the same way on every replay.
   */
  private playGround(
    ctx: AudioContext,
    ground: AudioNode,
    t: number,
    seed: string,
    voices: readonly GroundVoice[]
  ): void {
    const now = ctx.currentTime;
    this.groundVoices = this.groundVoices.filter((voice) => voice.endsAt > now);
    for (const voice of voices) {
      const { timbre, degree } = voice;
      const endsAt = t + voice.attack + voice.hold + voice.release;
      playVoice(ctx, ground, {
        timbre,
        frequency: modeFreq(degree, "low"),
        gain: voice.gain * this.bedScale,
        at: t,
        attack: voice.attack,
        hold: voice.hold,
        release: voice.release,
        seed: `${seed}:${timbre}:${degree}`,
        exactTuning: true,
        onRetire: (retire) =>
          this.groundVoices.push({ timbre, degree, retire, endsAt, letGoAt: null }),
      });
    }
  }

  /**
   * Let a voice of the ground go: fade it from `at` over `fade`. Once let go, a
   * voice is let go again only to silence it sooner from a moment before its
   * fade begins. A fade that has begun is never restarted: taking it back would
   * lift the voice to full before cutting it, which is a click, not a release.
   */
  private letGo(voice: GroundRecord, at: number, fade: number): void {
    if (voice.endsAt <= at) return;
    if (voice.letGoAt !== null && (at >= voice.letGoAt || at + fade >= voice.endsAt)) {
      return;
    }
    voice.retire(at, fade);
    voice.letGoAt = at;
    voice.endsAt = Math.min(voice.endsAt, at + fade);
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
        this.letGo(voice, now, SCORE.harmony.crossfadeSeconds);
      }
    }
    this.groundVoices = [];
  }

  /** Every session's harmony begins at home and unheld, its clock at the top. */
  private resetHarmony(): void {
    this.harmonicSlot = 0;
    this.held = false;
    this.lastStrikeSlot = Number.NEGATIVE_INFINITY;
    this.cadence = null;
  }

  /**
   * The first boundary of the bed's grid at least the cadence's lead ahead: the
   * conductor's `next(1, cadenceLeadSeconds)` at the same moment, by the same
   * formula from the same origin, because the scene reads it there.
   */
  private cadenceBoundary(ctx: AudioContext): number {
    return gridPointAtOrAfter(
      this.gridOrigin,
      this.slotS,
      ctx.currentTime + SCORE.harmony.cadenceLeadSeconds
    );
  }

  /** The slot of the bed's grid that begins at `t`. */
  private slotAt(t: number): number {
    return Math.round((t - this.gridOrigin) / this.slotS);
  }

  /**
   * THE CADENCE (ADR-018), from the release that asked for it. Whatever of it
   * falls inside the slots already written is scheduled on them now: the
   * ground's voices are long-held, and a voice may begin at any moment ahead.
   * The lookahead is shorter than any world's slot, so the slot it resumes on
   * is never one already written.
   */
  private beginCadence(
    ctx: AudioContext,
    ground: AudioNode,
    pad: readonly number[]
  ): void {
    const at = this.cadenceBoundary(ctx);
    const resumeAt = at + this.slotS;
    const slot = this.slotAt(at);
    const root = this.rootDegree;
    // The fifth and the colour release across the cadence's slot; the drone and
    // the pad's root hold to the boundary after it and hand over there to the
    // next phrase's chord, as the ground always turns.
    for (const voice of this.groundVoices) {
      if (holdsThroughCadence(root, voice.degree)) {
        this.letGo(voice, resumeAt, SCORE.harmony.crossfadeSeconds);
      } else {
        this.letGo(voice, at, this.slotS);
      }
    }
    const voices: GroundVoice[] = [cadenceArrival(root, pad, this.slotS)];
    // Held, the chord would have been struck again on this very slot, where its
    // voices begin to release: the root alone is struck there instead, so it
    // still carries the cadence to the boundary.
    if (slot - this.lastStrikeSlot >= groundStrikeSlots(this.slotS)) {
      voices.push(
        ...groundStrike(root, pad, this.slotS, this.droneGain).filter((voice) =>
          holdsThroughCadence(root, voice.degree)
        )
      );
      this.lastStrikeSlot = slot;
    }
    this.playGround(ctx, ground, at, `cadence:${slot}`, voices);
    // The cadence's slot takes no weave's fill either, even where it was
    // written before the release.
    for (const written of this.pulseWritten.keys()) {
      if (written >= slot) this.pulseWritten.delete(written);
    }
    this.cadence = {
      at,
      resumeAt,
      resumeHarmonicSlot: nextPhraseStart(this.harmonicSlot),
    };
  }

  /**
   * The cadence is taken back. What it had begun to let go hands over to the
   * held chord, struck again on the first boundary the lead allows; a voice
   * already fading keeps its fade, and the arrival, if it has not begun, never
   * does. The boundary is the cadence's own or the one it resumes on wherever
   * either is still ahead, named as the cadence named it, so the voices it
   * scheduled are met at exactly their own moments.
   */
  private strikeAgain(
    ctx: AudioContext,
    ground: AudioNode,
    cadence: PendingCadence
  ): void {
    const from = ctx.currentTime + SCORE.harmony.cadenceLeadSeconds;
    const at =
      [cadence.at, cadence.resumeAt].find((boundary) => boundary >= from) ??
      this.cadenceBoundary(ctx);
    for (const voice of this.groundVoices) {
      this.letGo(voice, at, SCORE.harmony.crossfadeSeconds);
    }
    this.strikeGround(ctx, ground, at, this.slotAt(at), groundStrikeSlots(this.slotS));
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
    //
    // The phrase is counted on the harmony's own clock, not the grid's, because
    // Attunement stops it (ADR-018). Held, the chord is struck again on itself
    // at its usual interval, so it sustains without moving and without a voice
    // outliving its bound; released, the cadence's slot strikes nothing, and
    // the slot after it resumes on the next phrase.
    const ground = audio.breathFilter ?? bus;
    const strikeSlots = groundStrikeSlots(this.slotS);
    const cadence = this.cadence;
    const inCadence =
      cadence !== null && t < cadence.resumeAt - SAME_MOMENT_SECONDS;
    if (cadence !== null && !inCadence) {
      this.cadence = null;
      this.harmonicSlot = cadence.resumeHarmonicSlot;
    }
    if (inCadence) {
      // A fill a weave asked of this slot goes with its pulse.
      this.fillSlots.delete(slot);
    } else if (this.held) {
      if (slot - this.lastStrikeSlot >= strikeSlots) {
        this.strikeGround(ctx, ground, t, slot, strikeSlots);
      }
    } else {
      const { phraseSlots } = SCORE.harmony;
      const harmonic = this.harmonicSlot;
      this.rootDegree = rootForPhrase(Math.floor(harmonic / phraseSlots));
      if (harmonic % strikeSlots === 0) {
        if (this.padVoices === null || harmonic % phraseSlots === 0) {
          this.padVoices = nextVoicing(this.padVoices, this.rootDegree);
        }
        this.strikeGround(ctx, ground, t, slot, strikeSlots);
      }
      this.harmonicSlot = harmonic + 1;
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

    // The bed's movement rests while the cadence resolves: its slot has no stem
    // and no pulse, and the heartbeat keeps it.
    if (!inCadence) {
      this.scheduleStems(ctx, t, slot);
      // The pulse keeps the slot whether or not the choir has a voice to seat:
      // it follows the web's awakening, not the choir's roll (M4-002).
      this.schedulePulse(ctx, t, slot);
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

  /**
   * THE PULSE UNDER THE SLOT (ADR-017).
   *
   * The slot's cell, from the bed's own state — how far the web has woken, the
   * space the score is leaving, the profile it is heard at, a completed motif's
   * second voice, a weave's fill — on the grid of the slot's sixteenths. Until
   * the pulse has loaded, a slot has none.
   */
  private schedulePulse(ctx: AudioContext, t: number, slot: number): void {
    const fill = this.fillSlots.delete(slot);
    for (const marked of this.fillSlots) {
      if (marked < slot) this.fillSlots.delete(marked);
    }
    for (const kept of this.pulseWritten.keys()) {
      if (kept <= slot - PULSE_MEMORY_SLOTS) this.pulseWritten.delete(kept);
    }
    const pulse = pulseModules;
    if (pulse === null) return;
    const onsets = pulse.pattern.pulseCell(slot, {
      awakening: frameState.awakening,
      density: this.densityScale,
      intensity: this.intensity,
      secondVoice: slot < this.secondVoiceUntil,
      fill,
    });
    this.pulseWritten.set(slot, { t, onsets });
    this.playPulse(ctx, pulse, t, slot, onsets);
  }

  /**
   * Each onset on its body, at its sixteenth of the slot that began at `t`, at
   * its weight of the body's ceiling under the bed's scale, through the ambient
   * bus that reach and space already scale. It carries no concept, so it
   * lights nothing. An onset whose moment has passed is not played late.
   */
  private playPulse(
    ctx: AudioContext,
    pulse: PulseModules,
    t: number,
    slot: number,
    onsets: readonly PulseOnset[]
  ): void {
    const bus = audio.ambientBus;
    if (bus === null) return;
    const step = this.slotS / pulse.pattern.PULSE_DIVISION;
    for (const onset of onsets) {
      const at = t + onset.sixteenth * step;
      if (at < ctx.currentTime) continue;
      pulse.bodies.playPulseBody(
        ctx,
        bus,
        onset.body,
        at,
        onset.weight * pulse.bodies.PULSE_GAIN[onset.body] * this.bedScale,
        `pulse:${slot}:${onset.sixteenth}`
      );
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
