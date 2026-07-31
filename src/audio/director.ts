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
 */
import type { ConceptMotif } from "@/content/castalia/schema";
import type { RelationIntention } from "@/domain/events";
import type { PresentationCue } from "@/runtime/cues";
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
  shiftRegister,
  type WorldMode,
} from "./mode";
import {
  makeVoicePlan,
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
  /** The next musically sensible moment at or after now. */
  readonly quantize: () => number;
  readonly play: (plan: VoicePlan, atSeconds: number) => void;
  /** Density and bed multipliers. See `ambient.setSpace`. */
  readonly setSpace: (density: number, bed: number) => void;
  /** Thread voices currently able to speak. Decides which kind of space to open. */
  readonly activeVoiceCount: () => number;
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

export interface AudioDirectorOptions {
  readonly sink: AudioSink;
  readonly lookup: AudioContentLookup;
  readonly mode?: WorldMode;
  /** Phrase slot length for the active world. Sets the rhythmic unit. */
  readonly slotSeconds?: number;
  readonly intensity?: AudioIntensity;
}

export interface AudioDirector {
  /** Handle one cue from the `audio` channel of the cue bus. */
  readonly handleCue: (cue: PresentationCue) => void;
  readonly setIntensity: (intensity: AudioIntensity) => void;
  readonly intensity: () => AudioIntensity;
  readonly onCaption: (listener: AudioCaptionListener) => () => void;
  /** The last caption emitted, for a caption region that renders on mount. */
  readonly lastCaption: () => AudioCaption | null;
  /** Threads the director has heard about, in creation order. */
  readonly threads: () => readonly AttunementThread[];
  readonly reset: () => void;
}

const DEFAULT_SLOT_SECONDS = 2;

// ─── Small structural plans ─────────────────────────────────────────────────

/**
 * How arming an intention changes the sound *immediately* (I-012: arming is the
 * moment the player learns intention is a tool, not a label).
 *
 * One note, at the interval that intention's grammar is built on: Echo answers
 * at the fifth, Passage rises an octave toward its destination, Tension leans on
 * the compound minor ninth, Ground drops an octave. It asserts nothing about the
 * pair — no pair exists yet — and it is the shortest honest preview of what the
 * grammar will do.
 */
const ARM_INTERVAL: Readonly<Record<RelationIntention, number>> = Object.freeze({
  echo: 7,
  passage: 12,
  tension: 13,
  ground: -12,
});

function planArming(
  planId: string,
  mode: WorldMode,
  source: MotifSource,
  intention: RelationIntention,
  ambientGain: number
): VoicePlan {
  const degree = anchorDegree(source.motif) + ARM_INTERVAL[intention];
  const register =
    intention === "ground"
      ? shiftRegister(source.motif.register, -1)
      : source.motif.register;
  const length = 0.9;
  const note: PlannedNote = Object.freeze({
    id: `${planId}:arm`,
    conceptId: source.conceptId,
    role: "subject" as const,
    timbre: source.motif.timbre,
    articulation: source.motif.articulation,
    register,
    degree,
    frequency: degreeFrequency(mode, degree, register),
    detuneCents: 0,
    atSeconds: 0,
    envelope: envelopeFor(source.motif.articulation, length),
    gain: Number((ambientGain * SCORE.grammar.residueGain).toFixed(5)),
    floorGain: 0,
    openEnded: intention === "tension",
    // One voice cannot be a tense simultaneity; arming asserts nothing.
    tense: false,
  });
  return makeVoicePlan({
    id: planId,
    kind: "attention",
    intention: null,
    notes: [note],
    meta: {
      conceptIds: [source.conceptId],
      grammar: `armed:${intention}`,
      resolves: false,
      interval: ARM_INTERVAL[intention],
      beatingHz: null,
      outcome: null,
    },
  });
}

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
    Array.isArray(candidate.unresolved)
  );
}

// ─── The director ───────────────────────────────────────────────────────────

export function createAudioDirector(
  options: AudioDirectorOptions
): AudioDirector {
  const { sink, lookup } = options;
  const mode = options.mode ?? CASTALIA_MODE;
  const unitSeconds = unitSecondsFor(options.slotSeconds ?? DEFAULT_SLOT_SECONDS);
  const names: AudioNames = { conceptName: (id) => lookup.conceptName(id) };

  let intensity: AudioIntensity = options.intensity ?? "full";
  let attended: string | null = null;
  let attunementCycle = 0;
  let lastCaption: AudioCaption | null = null;
  const threads: AttunementThread[] = [];
  const captionListeners = new Set<AudioCaptionListener>();

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

  const emit = (plan: VoicePlan, atSeconds: number): void => {
    // The caption describes the plan as *planned*, before intensity thins it.
    // A reduced-intensity player is told the same thing a full-intensity player
    // is told; what changes is how much of it they hear.
    say(plan.id, describeVoicePlan(plan, names), plan.kind, plan.meta.outcome);
    const rendered = applyIntensity(plan, intensity);
    if (rendered.notes.length === 0) return;
    sink.play(rendered, atSeconds);
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
      unitSeconds,
      ambientGain: ambientGain(),
      bedGain: bedGain(),
      // Only a documented relation closes (CAV-006). The other two states are
      // rendered at the same weight and left unclosed; what distinguishes them
      // for a muted player is the caption, not the gain.
      resolves: outcome === "documented",
      outcome,
    });

  const handleAttention = (
    conceptId: string
  ): AttentionSpacePlan => {
    const plan = planAttentionSpace({
      planId: `attention:${conceptId}`,
      mode,
      attended: source(conceptId),
      unitSeconds,
      ambientGain: ambientGain(),
      activeThreadCount: sink.activeVoiceCount(),
    });
    setSpace(plan.densityScale, plan.bedGainScale);
    say(plan.foreground.id, describeAttentionSpace(plan, names), "attention");
    const rendered = applyIntensity(plan.foreground, intensity);
    if (rendered.notes.length > 0) sink.play(rendered, sink.quantize());
    return plan;
  };

  const handleAttunement = (active: boolean): AttunementPlan | null => {
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
      unitSeconds,
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
      const rendered = applyIntensity(channel.plan, intensity);
      if (rendered.notes.length > 0) sink.play(rendered, start + channel.atSeconds);
    }
    return plan;
  };

  const handleConclusion = (performance: unknown): ConclusionAudioPlan | null => {
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
      const rendered = applyIntensity(section.plan, intensity);
      if (rendered.notes.length > 0) sink.play(rendered, start + section.atSeconds);
    }
    return plan;
  };

  const handleCue = (cue: PresentationCue): void => {
    switch (cue.type) {
      case "attention.enter": {
        attended = String(cue.payload.conceptId);
        handleAttention(attended);
        break;
      }

      case "attention.clear": {
        attended = null;
        setSpace(
          ATTENTION_RELEASED.densityScale,
          ATTENTION_RELEASED.bedGainScale
        );
        break;
      }

      case "intention.armed": {
        const conceptId = String(cue.payload.conceptId);
        emit(
          planArming(
            `arm:${conceptId}:${cue.payload.intention}`,
            mode,
            source(conceptId),
            cue.payload.intention,
            ambientGain()
          ),
          sink.now()
        );
        break;
      }

      case "candidate.latched": {
        const [a, b] = cue.payload.pair;
        emit(
          planLanding(
            `latch:${String(a)}:${String(b)}`,
            mode,
            source(String(a)),
            source(String(b)),
            ambientGain()
          ),
          sink.now()
        );
        break;
      }

      case "weave.released":
      case "thread.woven": {
        const [a, b] = cue.payload.pair;
        emit(
          planLanding(
            `woven:${String(cue.payload.threadId)}`,
            mode,
            source(String(a)),
            source(String(b)),
            ambientGain()
          ),
          sink.quantize()
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
        emit(
          relation(threadId, pair, cue.payload.intention, "documented"),
          sink.quantize()
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
        emit(
          relation(threadId, pair, cue.payload.intention, "open-thread"),
          sink.quantize()
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
        if (thinned.notes.length > 0) sink.play(thinned, sink.quantize());
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
            unitSeconds,
            ambientGain()
          ),
          sink.quantize()
        );
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
    lastCaption: () => lastCaption,
    threads: () => Object.freeze([...threads]),
    reset: () => {
      threads.length = 0;
      attunementCycle = 0;
      attended = null;
      lastCaption = null;
      setSpace(
        ATTENTION_RELEASED.densityScale,
        ATTENTION_RELEASED.bedGainScale
      );
    },
  };
  return Object.freeze(director);
}
