/**
 * THE AUDIO DIRECTOR — one semantic moment, one musical response.
 *
 * ADR-009 exists because of a specific prototype failure: scene, audio, camera,
 * and UI each subscribing independently to the same store change and each
 * approximating the moment slightly differently, so the glass, the chord, and
 * the camera arrived at three different times. The cue bus fixed the timing. The
 * director is the audio half of the fix — the single place that turns a cue into
 * sound, so there is no second subscriber that could disagree about what a
 * moment means.
 *
 * It decides nothing the domain decided. It reads a cue, chooses the grammar the
 * declared intention names, and hands a plan to a sink. Everything intellectual
 * — whether a relation is documented, whether the reading was refined, whether a
 * motif completed — arrived in the cue.
 *
 * Two things make this testable without an AudioContext, which matters because
 * the grammar is the part most likely to regress:
 *
 *  - the `AudioSink` seam: the production sink schedules Web Audio, a test sink
 *    records plans;
 *  - the `AudioContentLookup` seam: the content pack is read through an
 *    interface, so a test supplies two motifs instead of twenty-four.
 *
 * Captions are emitted for *every* plan, whether or not anything is audible.
 * That is what makes the muted path first-class: it is not a fallback that runs
 * when sound fails, it is the same information leaving by a second door.
 *
 * The exception is the four cues of the focus view — a bead sighted under the
 * lens, a pair locked, a reading previewed, a thread reopened. They speak on a
 * lane of their own (`focusLane.ts`, planned by `focusVoicing.ts`) and say
 * nothing here, for the reason a weave landing never has: `src/runtime/captions`
 * already captions each of them from the cue, in the player's vocabulary, and a
 * second caption per hover would turn the track into noise. A track that can be
 * ignored is not an accessible path.
 */
import type { ConceptMotif } from "@/content/castalia/schema";
import type { RelationIntention } from "@/domain/events";
import type { CuePayloadMap, PresentationCue } from "@/runtime/cues";
import {
  ATTENTION_RELEASED,
  planAttentionSpace,
  type AttentionSpacePlan,
} from "./attention";
import {
  planAttunement,
  type AttunementPlan,
  type AttunementThread,
} from "./attunement";
import {
  planConclusionPerformance,
  type ConclusionAudioPlan,
  type PerformanceScore,
} from "./conclusion";
import {
  describeAttentionSpace,
  describeAttunement,
  describeConclusion,
  describeVoicePlan,
  type AudioNames,
} from "./describe";
import { admit, createFocusLane, type FocusVoiceKind } from "./focusLane";
import {
  FOCUS_VOICING,
  planPairExchange,
  planReadingBar,
  planSightingAnswer,
  scalePlanGain,
} from "./focusVoicing";
import { planRelationVoices } from "./grammar";
import { applyIntensity, type AudioIntensity } from "./intensity";
import {
  anchorDegree,
  envelopeFor,
  renderMotif,
  type MotifSource,
} from "./motif";
import {
  CASTALIA_MODE,
  degreeFrequency,
  nearestStableDegree,
  type WorldMode,
} from "./mode";
import {
  makeVoicePlan,
  planDurationSeconds,
  type AudioOutcomeKind,
  type PlannedNote,
  type VoicePlan,
  type VoicePlanKind,
} from "./plan";
import { SCORE, unitSecondsFor } from "./score";

// ─── Seams ──────────────────────────────────────────────────────────────────

/**
 * Everything the director needs from the content pack. Structurally satisfied by
 * `CASTALIA_LOOKUP`; declared here so `src/content` and `src/audio` stay
 * independently editable.
 */
export interface AudioContentLookup {
  readonly conceptMotif: (id: string) => ConceptMotif;
  readonly conceptName: (id: string) => string;
}

export interface AudioSink {
  /** Absolute time in the sink's clock — the Web Audio clock in production. */
  readonly now: () => number;
  /**
   * The next musically sensible moment at or after now: the answer grid, the
   * eighth of the world's slot, where relations, the attended figure, the weave
   * landing, ensembles, Attunement and the conclusion begin.
   */
  readonly quantize: () => number;
  /**
   * THE HAND GRID (ADR-016): the next point on the sixteenth of the world's slot
   * at least `leadSeconds` ahead of now, on the sink's clock. The focus lane —
   * sighting, lock, preview, reopen — begins there, so what the player hears
   * while looking lands on the same grid as the sounds their hand makes. A sink
   * that keeps no grid answers "soon"; the director never begins a focus voice
   * sooner than the lead, whatever the sink answers.
   */
  readonly quantizeHand: (leadSeconds: number) => number;
  /**
   * The world's slot, in seconds. The director's rhythm unit is its sixteenth
   * (`unitSecondsFor`), read per plan, so a motif keeps the gait of the world it
   * is heard in rather than Castalia's in every world.
   */
  readonly slotSeconds: () => number;
  readonly play: (plan: VoicePlan, atSeconds: number) => void;
  /**
   * THE SCORE AS WRITTEN, FOR THE EYE (ADR-016).
   *
   * Every plan the director schedules is handed over here whole, at the time it
   * is scheduled for and before it is played — at every intensity, silent
   * included, because muting strips the sound and never the schedule. The
   * production sink puts its notes on the conductor, which the scene reads as
   * light on the beads they belong to. Nothing heard depends on it.
   */
  readonly conduct: (plan: VoicePlan, atSeconds: number) => void;
  /** Density and bed multipliers. See `ambient.setSpace`. */
  readonly setSpace: (density: number, bed: number) => void;
  /** Thread voices currently able to speak. Decides which kind of space to open. */
  readonly activeVoiceCount: () => number;
  /**
   * BRING THE GENERATIVE LOOP TO AN END.
   *
   * The ambient score is a loop, and a loop has no ending — left running under
   * the conclusion it turns the last authored sound into an interruption of
   * something that carries on afterwards, which is why the review found that the
   * Game stopped rather than ended.
   *
   * `atSeconds` is the moment on the sink's own clock at which nothing generative
   * may still be sounding; `fadeSeconds` is how long it has to get there. The
   * director calls it once, with the coda's onset. It is the sink's business how
   * to obey — which slots to stop scheduling, how to ramp the bed — because that
   * is rendering, not meaning.
   */
  readonly concludeAt: (atSeconds: number, fadeSeconds: number) => void;
  /**
   * TAKE BACK A PLAN THE SINK ALREADY HOLDS.
   *
   * Looking is not acting, and it repeats: a lens crossing a cluster or a pointer
   * crossing four sigils asks for a new answer every few hundred milliseconds,
   * and each answer is a plan already handed to `play`. Without a way to take one
   * back, a sweep can only pile them up.
   *
   * Whatever of the plan called `planId` is sounding is faded to silence over
   * `fadeSeconds` from `atSeconds` on the sink's clock, and whatever has not yet
   * begun by then never does. It applies to what the sink holds *when it is
   * called*: a later plan that happens to share the id is a new plan.
   *
   * Optional, because rendering is the sink's business and a sink that cannot
   * fade a plan is still a lawful sink. The director then bounds the overlap
   * itself — ducking what would stack and declining what would not fit — using
   * its own ledger of what it has handed over (`focusLane.ts`). What it cannot do
   * without this is make a superseded voice stop.
   */
  readonly retire?: (
    planId: string,
    atSeconds: number,
    fadeSeconds: number
  ) => void;
  /**
   * THE PULSE ANSWERS A WEAVE (ADR-017).
   *
   * The bed's pulse rolls a fill of brush sixteenths into the next slot boundary
   * it can reach from `atSeconds` — the weave's landing, on the sink's clock —
   * and lands it on one bell. The director asks for it where the thread lands,
   * before any outcome is known, and hands over nothing but the time: one fill
   * for documented, open and unresolved alike (CAV-006). Optional, because a
   * sink that keeps no pulse is still a lawful sink.
   */
  readonly pulseFill?: (atSeconds: number) => void;
  /**
   * The pulse's second voice — the brush on every other eighth — for the next
   * `untilSlots` slots of the bed: a completed motif, or a solved Study, is
   * given one phrase of it (ADR-017). Optional, as `pulseFill` is.
   */
  readonly pulseSecondVoice?: (untilSlots: number) => void;
  /**
   * ATTUNEMENT HOLDS THE BED'S CHORD (ADR-018).
   *
   * While Attunement is held the bed's chord sustains without its phrase
   * movement; released, it plays the cadence — the held chord resolves to the
   * root of the phrase it paused in over one slot on the conductor's grid, and
   * the phrase clock resumes at the next boundary. The director holds it before
   * Attunement thins the space and its channels begin, releases it when
   * Attunement ends, and releases it again when the conclusion begins, because
   * the domain closes Attunement in the log before concluding and publishes no
   * cue of its own for it. Asked at every intensity, silent included: muting
   * strips the sound, never the schedule. Optional, because a sink that keeps no
   * bed is still a lawful sink.
   */
  readonly holdHarmony?: (held: boolean) => void;
}

/**
 * One thing the music is doing, in words.
 *
 * `text` is the sentence. The rest is structure a caption surface needs and
 * should not have to parse back out of prose: which plan it belongs to, what
 * kind of moment it was, and — the field the review asked for — which epistemic
 * state it describes, so an Open Thread and a weak outcome can be presented
 * differently as well as read differently (CAV-006).
 */
export interface AudioCaption {
  readonly planId: string;
  readonly text: string;
  readonly kind: VoicePlanKind | "system";
  readonly outcome: AudioOutcomeKind | null;
  /** Nothing the audio layer says ever interrupts. */
  readonly urgency: "polite";
}

export type AudioCaptionListener = (caption: AudioCaption) => void;

/**
 * ONE THREAD, SPEAKING, AT A KNOWN MOMENT.
 *
 * The scene has no way of its own to know *which* relation the music is
 * sounding right now, and the whole of Attunement's first clause — "threads
 * become individually audible" (spec §13) — is only legible if the world can
 * show you the one you are hearing. This is that channel, and it carries the
 * sink's own clock so the light on the strand and the note in the ear are the
 * same event rather than two approximations of it (ARCHITECTURE §10).
 *
 * It asserts nothing. It reports what the director already decided to play.
 */
export interface ThreadVoiceLight {
  readonly threadId: string;
  /** Absolute time in the sink's clock at which the thread's voice begins. */
  readonly atSeconds: number;
  readonly durationSeconds: number;
}

export type ThreadVoiceListener = (light: ThreadVoiceLight) => void;

export interface AudioDirectorOptions {
  readonly sink: AudioSink;
  readonly lookup: AudioContentLookup;
  readonly mode?: WorldMode;
  readonly intensity?: AudioIntensity;
}

export interface AudioDirector {
  /** Handle one cue from the `audio` channel of the cue bus. */
  readonly handleCue: (cue: PresentationCue) => void;
  readonly setIntensity: (intensity: AudioIntensity) => void;
  readonly intensity: () => AudioIntensity;
  readonly onCaption: (listener: AudioCaptionListener) => () => void;
  /**
   * Subscribe to "this thread is sounding, from this moment, for this long".
   * The scene uses it to light the strand in time with its own voice.
   */
  readonly onThreadVoice: (listener: ThreadVoiceListener) => () => void;
  /** The last caption emitted, for a caption region that renders on mount. */
  readonly lastCaption: () => AudioCaption | null;
  /** Threads the director has heard about, in creation order. */
  readonly threads: () => readonly AttunementThread[];
  readonly reset: () => void;
}

/** A sink that reports no usable slot keeps the two seconds the director always assumed. */
const DEFAULT_SLOT_SECONDS = 2;

// ─── Small structural plans ─────────────────────────────────────────────────

/** The weave lands: both anchors in their own bodies, close together. */
function planLanding(
  planId: string,
  mode: WorldMode,
  a: MotifSource,
  b: MotifSource,
  ambientGain: number
): VoicePlan {
  const notes: PlannedNote[] = [a, b].map((source, index) => {
    const degree = anchorDegree(source.motif);
    return Object.freeze({
      id: `${planId}:land:${index}`,
      conceptId: source.conceptId,
      role: (index === 0 ? "subject" : "answer") as PlannedNote["role"],
      timbre: source.motif.timbre,
      articulation: source.motif.articulation,
      register: source.motif.register,
      degree,
      frequency: degreeFrequency(mode, degree, source.motif.register),
      detuneCents: 0,
      atSeconds: index * 0.11,
      envelope: envelopeFor(source.motif.articulation, 0.8),
      gain: Number((ambientGain * SCORE.grammar.residueGain).toFixed(5)),
      floorGain: 0,
      openEnded: false,
      tense: false,
    });
  });
  return makeVoicePlan({
    id: planId,
    kind: "attention",
    intention: null,
    notes,
    meta: {
      conceptIds: [a.conceptId, b.conceptId],
      grammar: "landing",
      resolves: false,
      interval: null,
      beatingHz: null,
      outcome: null,
    },
  });
}

/**
 * A completed motif takes a seat in the ensemble: its concepts' own motifs,
 * entering in order, staggered — a canon made of the beads that formed it. No
 * new material is invented for it, because a motif is a recognition of what the
 * player already built.
 */
function planEnsemble(
  planId: string,
  mode: WorldMode,
  sources: readonly MotifSource[],
  unitSeconds: number,
  ambientGain: number
): VoicePlan {
  const notes: PlannedNote[] = [];
  sources.slice(0, 4).forEach((source, index) => {
    notes.push(
      ...renderMotif(source, {
        mode,
        at: index * unitSeconds * 6,
        unitSeconds,
        gain: ambientGain * SCORE.grammar.answerGain,
        role: "ensemble",
        idPrefix: `${planId}:voice:${index}`,
        transpose:
          index === 0
            ? 0
            : nearestStableDegree(mode, anchorDegree(source.motif)) -
              anchorDegree(source.motif),
      })
    );
  });
  return makeVoicePlan({
    id: planId,
    kind: "ensemble",
    intention: null,
    notes,
    meta: {
      conceptIds: sources.map((source) => source.conceptId),
      grammar: "ensemble",
      resolves: true,
      interval: null,
      beatingHz: null,
      outcome: null,
    },
  });
}

// ─── The performance score guard ────────────────────────────────────────────

/**
 * The conclusion cue carries `performance: unknown`, because the cue types must
 * not depend on the domain's performance module. Narrowing it here is the one
 * boundary check — a malformed payload produces silence and a caption rather
 * than a thrown error in the middle of the conclusion.
 */
export function isPerformanceScore(value: unknown): value is PerformanceScore {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PerformanceScore>;
  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.totalSeconds === "number" &&
    Array.isArray(candidate.entries) &&
    Array.isArray(candidate.ensembles) &&
    Array.isArray(candidate.unresolved) &&
    // The ending is part of the contract, not an optional extra: a payload that
    // does not carry one is a payload from a compiler that cannot end a session,
    // and silence plus a caption is the honest response to that.
    (candidate.coda === null ||
      (typeof candidate.coda === "object" &&
        Array.isArray((candidate.coda as { voices?: unknown }).voices)))
  );
}

// ─── The director ───────────────────────────────────────────────────────────

export function createAudioDirector(
  options: AudioDirectorOptions
): AudioDirector {
  const { sink, lookup } = options;
  const mode = options.mode ?? CASTALIA_MODE;
  const names: AudioNames = { conceptName: (id) => lookup.conceptName(id) };

  /**
   * One rhythm unit in the world in the room: a sixteenth of its slot (ADR-016).
   * Read per plan from the sink, which knows the world; a slot that is not a
   * positive number of seconds is no slot, and the director keeps its old two.
   */
  const rhythmUnit = (): number => {
    const slot = sink.slotSeconds();
    return unitSecondsFor(
      Number.isFinite(slot) && slot > 0 ? slot : DEFAULT_SLOT_SECONDS
    );
  };

  let intensity: AudioIntensity = options.intensity ?? "full";
  let attended: string | null = null;
  let attunementCycle = 0;
  let lastCaption: AudioCaption | null = null;
  const threads: AttunementThread[] = [];
  const captionListeners = new Set<AudioCaptionListener>();
  const voiceListeners = new Set<ThreadVoiceListener>();

  const lightThread = (
    threadId: string,
    atSeconds: number,
    durationSeconds: number
  ): void => {
    if (durationSeconds <= 0) return;
    const light: ThreadVoiceLight = Object.freeze({
      threadId,
      atSeconds,
      durationSeconds,
    });
    for (const listener of [...voiceListeners]) listener(light);
  };

  const source = (id: string): MotifSource => ({
    conceptId: id,
    motif: lookup.conceptMotif(id),
  });

  /**
   * The bed the score is currently leaving, as a multiplier. Every state that
   * thins the bed does so by telling the sink; the director remembers what it
   * asked for, because the CAV-007 tense ceiling is a fraction of the bed the
   * player can actually hear at that moment — the review found it being taken
   * against the nominal bed while Attunement had already dropped it to 0.55.
   */
  let bedScale = ATTENTION_RELEASED.bedGainScale;

  const setSpace = (density: number, bed: number): void => {
    bedScale = bed;
    sink.setSpace(density, bed);
  };

  /** The bed, sized against the room; the level relations are sized against. */
  const ambientGain = (): number => SCORE.grammar.bedGain;
  /** The bed as it actually sounds now. The tense ceiling is a fraction of it. */
  const bedGain = (): number => SCORE.grammar.bedGain * bedScale;

  const say = (
    planId: string,
    text: string | null,
    kind: VoicePlanKind | "system",
    outcome: AudioOutcomeKind | null = null
  ): void => {
    if (text === null || text.length === 0) return;
    const caption: AudioCaption = Object.freeze({
      planId,
      text,
      kind,
      outcome,
      urgency: "polite" as const,
    });
    lastCaption = caption;
    for (const listener of [...captionListeners]) listener(caption);
  };

  /**
   * Hand a plan to the sink at `atSeconds`: the plan as written, to be conducted
   * (ADR-016), and then what intensity leaves of it, to be heard. The score the
   * scene reads is the written one at every intensity, the way the caption is:
   * a muted player sees the same notes land that a hearing player hears, and an
   * unresolved outcome, heard thinner, lights exactly as a documented one does
   * (CAV-006).
   */
  const schedule = (
    written: VoicePlan,
    heard: VoicePlan,
    atSeconds: number
  ): void => {
    sink.conduct(written, atSeconds);
    if (heard.notes.length > 0) sink.play(heard, atSeconds);
  };

  const emit = (plan: VoicePlan, atSeconds: number): void => {
    // The caption describes the plan as *planned*, before intensity thins it.
    // A reduced-intensity player is told the same thing a full-intensity player
    // is told; what changes is how much of it they hear.
    say(plan.id, describeVoicePlan(plan, names), plan.kind, plan.meta.outcome);
    schedule(plan, applyIntensity(plan, intensity), atSeconds);
  };

  const rememberThread = (
    threadId: string,
    pair: readonly [string, string],
    intention: RelationIntention,
    resolves: boolean
  ): void => {
    const existing = threads.findIndex((thread) => thread.threadId === threadId);
    const record: AttunementThread = Object.freeze({
      threadId,
      intention,
      a: source(pair[0]),
      b: source(pair[1]),
      resolves,
    });
    if (existing >= 0) threads[existing] = record;
    else threads.push(record);
  };

  const relation = (
    threadId: string,
    pair: readonly [string, string],
    intention: RelationIntention,
    outcome: AudioOutcomeKind
  ): VoicePlan =>
    planRelationVoices({
      planId: `relation:${threadId}`,
      mode,
      intention,
      a: source(pair[0]),
      b: source(pair[1]),
      unitSeconds: rhythmUnit(),
      ambientGain: ambientGain(),
      bedGain: bedGain(),
      // Only a documented relation closes (CAV-006). The other two states are
      // rendered at the same weight and left unclosed; what distinguishes them
      // for a muted player is the caption, not the gain.
      resolves: outcome === "documented",
      outcome,
    });

  /**
   * Play a relation and light its strand over the same span. One call, so a
   * later outcome kind cannot be added that sounds without showing which
   * thread sounded.
   */
  const playRelation = (threadId: string, plan: VoicePlan): void => {
    const at = sink.quantize();
    emit(plan, at);
    lightThread(threadId, at, planDurationSeconds(plan.notes, plan.beatings));
  };

  const handleAttention = (
    conceptId: string
  ): AttentionSpacePlan => {
    const plan = planAttentionSpace({
      planId: `attention:${conceptId}`,
      mode,
      attended: source(conceptId),
      unitSeconds: rhythmUnit(),
      ambientGain: ambientGain(),
      activeThreadCount: sink.activeVoiceCount(),
    });
    setSpace(plan.densityScale, plan.bedGainScale);
    say(plan.foreground.id, describeAttentionSpace(plan, names), "attention");
    schedule(
      plan.foreground,
      applyIntensity(plan.foreground, intensity),
      sink.quantize()
    );
    return plan;
  };

  // ─── The focus lane ───────────────────────────────────────────────────────
  //
  // What the score says while the player looks, chooses, and returns. The plans
  // are `focusVoicing.ts`'s; this is the part that has to remember what is still
  // sounding and decide what a new voice must do about it. Everything begins on
  // the sink's own clock, on the hand grid (ADR-016) and at least a lead after
  // the cue, so that a note is never already in the past by the time the
  // scheduler's next tick finds it.

  const focusLane = createFocusLane();

  /**
   * Where a focus voice may begin: the first point on the hand grid at least
   * `lead` ahead — and never sooner than `lead`, whatever the sink's grid says.
   * The lead is scheduling room, and it is also the time a superseded voice takes
   * to fade (`FOCUS_VOICING`): a voice begun inside it would begin under the one
   * it replaces, and the lane would duck it or turn it away.
   */
  const handOnset = (now: number, lead: number): number =>
    Math.max(now + lead, sink.quantizeHand(lead));

  /**
   * The last sighting handed to the sink: when it begins, and the moment its
   * spacing was measured from. A sighting the lens leaves before it begins is
   * dropped, and the one that replaces it is spaced from the last that really
   * sounded — that is the `anchor`.
   */
  let lastSighting: { readonly onset: number; readonly anchor: number } | null =
    null;

  /**
   * Fade a voice out, where the sink can take it back. Where it cannot, the
   * ledger goes on counting it, because it goes on sounding.
   */
  const retireFocusVoice = (id: string, atSeconds: number): void => {
    if (sink.retire === undefined) return;
    sink.retire(id, atSeconds, FOCUS_VOICING.fadeSeconds);
    focusLane.retire(id, atSeconds, FOCUS_VOICING.fadeSeconds);
  };

  /**
   * Whatever the lane is saying yields to a moment that is not looking: a new
   * Attend, attention released, a weave. The commit's own phrase must not begin
   * under a preview the player was still hearing — least of all a Tension's.
   */
  const settleFocus = (): void => {
    const now = sink.now();
    for (const voice of focusLane.live(now)) {
      if (voice.retiredAt === null) retireFocusVoice(voice.id, now);
    }
    lastSighting = null;
  };

  /** Hand a plan to the sink on the lane — unless the lane has no room for it. */
  const speakOnLane = (
    kind: FocusVoiceKind,
    plan: VoicePlan,
    onset: number
  ): boolean => {
    const rendered = applyIntensity(plan, intensity);
    // At silent intensity there is nothing to hand over to be heard, and nothing
    // takes the lane, so no later answer is spaced or ducked on its account. The
    // moment is still captioned, by the cue layer, and still on the score: its
    // notes are conducted, as a muted player's world still keeps time.
    if (rendered.notes.length === 0) {
      sink.conduct(plan, onset);
      return false;
    }
    const admission = admit(rendered, focusLane, onset, bedGain());
    if (!admission.play) return false;
    const shaped = scalePlanGain(rendered, admission.scale);
    schedule(plan, shaped, onset);
    focusLane.add({ id: shaped.id, kind, onsetSeconds: onset, plan: shaped });
    return true;
  };

  /**
   * A voice that answers something the player did — the lock, a reading chosen or
   * heard, a thread returned to. It begins at once and everything else on the
   * lane yields.
   */
  const answerOnLane = (kind: FocusVoiceKind, plan: VoicePlan): void => {
    const now = sink.now();
    const live = focusLane.live(now);
    // Already saying exactly this, and still sounding: nothing new to say.
    if (live.some((voice) => voice.id === plan.id && voice.retiredAt === null)) {
      return;
    }
    for (const voice of live) {
      if (voice.retiredAt === null) retireFocusVoice(voice.id, now);
    }
    lastSighting = null;
    speakOnLane(kind, plan, handOnset(now, FOCUS_VOICING.leadSeconds));
  };

  /**
   * The bead under the lens answers once, in its own voice — and at a rate a
   * sweep can survive. A lens crossing a crowded cluster changes bead many times
   * a second, and an answer for each would be a machine gun.
   *
   * Sightings begin at least a window apart. Where the sink can take a voice
   * back, one that arrives inside the window *replaces* what was there: the
   * earlier answer is let finish until the new one takes over (or dropped, if it
   * has not begun), and the new one is deferred to the end of the window. The
   * bead the lens comes to rest on is therefore always the one heard, and never
   * more than one is. Where the sink cannot, an answer inside the window is
   * declined, because the only alternative is to stack it.
   */
  const answerSighting = (payload: CuePayloadMap["attention.sighted"]): void => {
    const sighted = payload.sighted;
    // The lens has left every bead. The gap opening again is the scene's to show.
    if (sighted === null) return;

    const now = sink.now();
    const conceptId = String(sighted.conceptId);
    const plan = planSightingAnswer({
      planId: `sighted:${conceptId}:${sighted.band}`,
      mode,
      sighted: source(conceptId),
      band: sighted.band,
      unitSeconds: rhythmUnit(),
      ambientGain: ambientGain(),
    });
    const live = focusLane.live(now);
    // The same bead, still speaking: a lens that leaves and returns does not
    // restart it.
    if (live.some((voice) => voice.id === plan.id && voice.retiredAt === null)) {
      return;
    }

    const earliest = handOnset(now, FOCUS_VOICING.leadSeconds);
    let onset = earliest;
    let anchor = Number.NEGATIVE_INFINITY;
    const previous = lastSighting;
    if (previous !== null) {
      const canTakeBack = sink.retire !== undefined;
      anchor =
        canTakeBack && previous.onset > now ? previous.anchor : previous.onset;
      const spaced = anchor + FOCUS_VOICING.sighting.windowSeconds;
      if (!canTakeBack) {
        if (earliest < spaced) return;
      } else if (earliest < spaced) {
        // Deferred to the end of the window, and onto the hand grid from there.
        onset = handOnset(now, spaced - now);
      }
    }

    for (const voice of live) {
      if (voice.retiredAt !== null) continue;
      // A sighting already speaking is let finish until the new one takes over.
      // Anything else — a sighting still to begin, a preview from the last stage —
      // yields at once.
      const speaking = voice.kind === "sighting" && voice.onsetSeconds <= now;
      retireFocusVoice(
        voice.id,
        speaking ? Math.max(now, onset - FOCUS_VOICING.fadeSeconds) : now
      );
    }
    if (speakOnLane("sighting", plan, onset)) lastSighting = { onset, anchor };
  };

  const handleAttunement = (active: boolean): AttunementPlan | null => {
    // The bed's chord holds before the space thins and the channels begin, so
    // they are heard over a chord that has stopped moving. Released, it plays
    // its cadence before the space returns, so the cadence is struck at the
    // level the chord was held at and the room rises over it (ADR-018).
    sink.holdHarmony?.(active);
    if (!active) {
      setSpace(ATTENTION_RELEASED.densityScale, ATTENTION_RELEASED.bedGainScale);
      say(
        "attunement:exit",
        "Attunement released. The score returns to its usual density.",
        "system"
      );
      return null;
    }
    const plan = planAttunement({
      planId: `attunement:${attunementCycle}`,
      mode,
      threads,
      unitSeconds: rhythmUnit(),
      ambientGain: ambientGain(),
      cycleIndex: attunementCycle,
    });
    attunementCycle += 1;
    // The bed is dropped *before* the channels are played, and `planAttunement`
    // already sized their tense voices against that dropped bed.
    setSpace(plan.densityScale, plan.bedGainScale);
    say(`attunement:${attunementCycle}`, describeAttunement(plan, names), "attunement");
    const start = sink.quantize();
    for (const channel of plan.channels) {
      schedule(
        channel.plan,
        applyIntensity(channel.plan, intensity),
        start + channel.atSeconds
      );
      // Spec §13's first clause, made visible: the world can now show which
      // single thread is speaking, because the director says so on the same
      // clock it scheduled the notes on. Published even at silent intensity —
      // the captioned player still sees the web take its turns.
      lightThread(
        channel.threadId,
        start + channel.atSeconds,
        channel.spanSeconds
      );
    }
    return plan;
  };

  const handleConclusion = (performance: unknown): ConclusionAudioPlan | null => {
    // Concluding from inside Attunement closes it in the log without a cue of
    // its own, so the conclusion is what releases the bed's held chord — and
    // its cadence plays as any release's does. Whether or not the performance
    // can be read: Attunement has ended either way.
    sink.holdHarmony?.(false);
    if (!isPerformanceScore(performance)) {
      say(
        "conclusion:invalid",
        "The performance could not be read, so nothing is played back.",
        "system"
      );
      return null;
    }
    // The conclusion thins the bed the way Attunement does, so the tense voices
    // of its unresolved threads are capped against that thinner bed.
    setSpace(SCORE.attunement.densityScale, SCORE.attunement.bedGainScale);
    const plan = planConclusionPerformance(performance, {
      mode,
      ambientGain: ambientGain(),
      bedGain: bedGain(),
      motifFor: (id) => lookup.conceptMotif(id) ?? null,
    });
    say(`conclusion:${plan.sessionId}`, describeConclusion(plan, names), "conclusion");
    const start = sink.quantize();
    for (const section of plan.sections) {
      schedule(
        section.plan,
        applyIntensity(section.plan, intensity),
        start + section.atSeconds
      );
    }
    /*
     * THE ENDING IS AN ENDING.
     *
     * The bed is told to be gone by the time the coda speaks. This is not
     * mixing taste: a generative loop still running under the last authored
     * sound means the performance has no last sound, only a point after which
     * the player stops listening. Asked for at every intensity, including
     * silent — the loop is not a caption and does not belong to that path.
     */
    const coda = plan.sections.find((section) => section.kind === "coda");
    if (coda !== undefined) {
      sink.concludeAt(start + coda.atSeconds, SCORE.conclusion.bedFadeSeconds);
    }
    return plan;
  };

  const handleCue = (cue: PresentationCue): void => {
    switch (cue.type) {
      case "attention.enter": {
        // A new Attend begins a new moment: what was being heard about the last
        // one yields to it.
        settleFocus();
        attended = String(cue.payload.conceptId);
        handleAttention(attended);
        break;
      }

      case "attention.clear": {
        settleFocus();
        attended = null;
        setSpace(
          ATTENTION_RELEASED.densityScale,
          ATTENTION_RELEASED.bedGainScale
        );
        break;
      }

      case "attention.sighted": {
        answerSighting(cue.payload);
        break;
      }

      case "pair.locked": {
        // The pair is the object (I-016): the attended figure calls, the second
        // answers, never together — no reading has been chosen yet.
        const [a, b] = cue.payload.pair.map(String);
        answerOnLane(
          "exchange",
          planPairExchange({
            planId: `locked:${a}:${b}`,
            mode,
            attended: source(a),
            second: source(b),
            unitSeconds: rhythmUnit(),
            ambientGain: ambientGain(),
          })
        );
        break;
      }

      case "reading.previewed": {
        // The reading heard before it is made (I-016): the pair, in the grammar
        // of the intention being heard. Hovered is quieter and shorter than
        // chosen. Nothing here says which reading the record prefers — the
        // planner is never told (CAV-006).
        const [a, b] = cue.payload.pair.map(String);
        const { intention, chosen } = cue.payload;
        answerOnLane(
          "reading",
          planReadingBar({
            seed: `reading:${intention}:${a}:${b}`,
            mode,
            intention,
            a: source(a),
            b: source(b),
            weight: chosen ? "chosen" : "hover",
            unitSeconds: rhythmUnit(),
            ambientGain: ambientGain(),
            bedGain: bedGain(),
          })
        );
        break;
      }

      case "thread.reopened": {
        // Returning to a thought (I-019): the thread's own phrase, softly, once.
        // It is the phrase the weave sounded — the same figures, the same
        // interval, the same beating, the same humanising — and, like every
        // preview, it does not close and is not told whether the record does.
        const [a, b] = cue.payload.pair.map(String);
        answerOnLane(
          "recall",
          planReadingBar({
            seed: `relation:${String(cue.payload.threadId)}`,
            mode,
            intention: cue.payload.intention,
            a: source(a),
            b: source(b),
            weight: "recall",
            unitSeconds: rhythmUnit(),
            ambientGain: ambientGain(),
            bedGain: bedGain(),
          })
        );
        break;
      }

      case "weave.released":
      case "thread.woven": {
        // The commit's phrase is unchanged, and it begins over silence: nothing
        // the player was merely hearing sounds under it.
        settleFocus();
        // A weave ends the look that led to it: the draft is back to roaming
        // and the fog lifts on its own (I-016), so the score comes back too
        // rather than staying thinned until the next Attend.
        attended = null;
        setSpace(ATTENTION_RELEASED.densityScale, ATTENTION_RELEASED.bedGainScale);
        const [a, b] = cue.payload.pair;
        const plan = planLanding(
          `woven:${String(cue.payload.threadId)}`,
          mode,
          source(String(a)),
          source(String(b)),
          ambientGain()
        );
        const at = sink.quantize();
        emit(plan, at);
        // The pulse answers the weave: a fill into the next slot boundary it can
        // reach from the landing (ADR-017). Asked for here, where the thread
        // lands, with nothing but the time, so it is one fill whatever the
        // outcome turns out to be (CAV-006); the outcome cues ask for nothing.
        sink.pulseFill?.(at);
        lightThread(
          String(cue.payload.threadId),
          at,
          planDurationSeconds(plan.notes, plan.beatings)
        );
        break;
      }

      case "outcome.documented": {
        const threadId = String(cue.payload.threadId);
        const pair: readonly [string, string] = [
          String(cue.payload.pair[0]),
          String(cue.payload.pair[1]),
        ];
        // A documented relation closes — except a Tension, which the grammar
        // refuses to close whatever the record says.
        rememberThread(threadId, pair, cue.payload.intention, true);
        playRelation(
          threadId,
          relation(threadId, pair, cue.payload.intention, "documented")
        );
        break;
      }

      case "outcome.open-thread": {
        const threadId = String(cue.payload.threadId);
        const pair: readonly [string, string] = [
          String(cue.payload.pair[0]),
          String(cue.payload.pair[1]),
        ];
        // Same grammar, same gain, same duration as a documented relation. The
        // only difference is that it does not close (CAV-006) — and that the
        // caption names it as an Open Thread, which is the only way a muted
        // player can tell it from a weak outcome.
        rememberThread(threadId, pair, cue.payload.intention, false);
        playRelation(
          threadId,
          relation(threadId, pair, cue.payload.intention, "open-thread")
        );
        break;
      }

      case "outcome.unresolved": {
        const threadId = String(cue.payload.threadId);
        const pair: readonly [string, string] = [
          String(cue.payload.pair[0]),
          String(cue.payload.pair[1]),
        ];
        rememberThread(threadId, pair, cue.payload.intention, false);
        // Quiet and short, never dim and never grey (CAV-006): the same grammar,
        // thinned. Nothing was done wrong, so nothing sounds like an error.
        const plan = relation(threadId, pair, cue.payload.intention, "unresolved");
        say(plan.id, describeVoicePlan(plan, names), plan.kind, plan.meta.outcome);
        const thinned = applyIntensity(
          plan,
          intensity === "silent" ? "silent" : "reduced"
        );
        const at = sink.quantize();
        // Heard thinned; conducted as written, so its beads light as a
        // documented relation's do.
        schedule(plan, thinned, at);
        // The strand lights for the same span as any other outcome. An
        // Unresolved thread is quieter, never dimmer (CAV-006).
        lightThread(threadId, at, planDurationSeconds(plan.notes, plan.beatings));
        break;
      }

      case "motif.completed": {
        const sources = cue.payload.conceptIds.map((id) => source(String(id)));
        if (sources.length === 0) break;
        emit(
          planEnsemble(
            `motif:${String(cue.payload.motifKindId)}:${sources.length}`,
            mode,
            sources,
            rhythmUnit(),
            ambientGain()
          ),
          sink.quantize()
        );
        // The pulse gains its second voice for the following phrase (ADR-017).
        sink.pulseSecondVoice?.(SCORE.harmony.phraseSlots);
        break;
      }

      case "study.solved": {
        // A Study solved (M9-001) takes a seat the way a completed motif does:
        // the answer's own beads, entering in turn. No new grammar, and nothing
        // here can hear how any thread resolved, because the cue carries no
        // outcome (CAV-006). A silence has no beads, and is answered by one.
        const sources = cue.payload.conceptIds.map((id) => source(String(id)));
        if (sources.length === 0) break;
        emit(
          planEnsemble(
            `solved:${cue.payload.studyId}`,
            mode,
            sources,
            rhythmUnit(),
            ambientGain()
          ),
          sink.quantize()
        );
        // As a completed motif does, the pulse gains its second voice for the
        // following phrase (ADR-017). A silence, answered by silence above,
        // asks nothing of the pulse either.
        sink.pulseSecondVoice?.(SCORE.harmony.phraseSlots);
        break;
      }

      case "attunement.changed": {
        handleAttunement(cue.payload.active);
        break;
      }

      case "conclusion.perform": {
        handleConclusion(cue.payload.performance);
        break;
      }

      default:
        break;
    }
  };

  const director: AudioDirector = {
    handleCue,
    setIntensity: (next) => {
      intensity = next;
    },
    intensity: () => intensity,
    onCaption: (listener) => {
      captionListeners.add(listener);
      return () => captionListeners.delete(listener);
    },
    onThreadVoice: (listener) => {
      voiceListeners.add(listener);
      return () => voiceListeners.delete(listener);
    },
    lastCaption: () => lastCaption,
    threads: () => Object.freeze([...threads]),
    reset: () => {
      threads.length = 0;
      attunementCycle = 0;
      attended = null;
      lastCaption = null;
      focusLane.clear();
      lastSighting = null;
      setSpace(
        ATTENTION_RELEASED.densityScale,
        ATTENTION_RELEASED.bedGainScale
      );
    },
  };
  return Object.freeze(director);
}
