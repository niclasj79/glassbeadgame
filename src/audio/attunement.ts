/**
 * ATTUNEMENT — a held heightened state (VERTICAL-SLICE-SPEC §13).
 *
 * "Threads become individually audible; relation channels shimmer according to
 * their grammar; no new intellectual assertions are generated."
 *
 * All three clauses are load-bearing and all three are implemented literally:
 *
 *  - **Individually audible** means the threads stop being a texture. Each gets
 *    its own window, with real silence between windows, in creation order. This
 *    is the one place in the game where you can hear *one* thread and know which
 *    one it is.
 *  - **Shimmer according to their grammar** means each channel is that thread's
 *    own relation plan — an Echo still imitates, a Tension still beats — plus one
 *    high partial whose pitch is chosen by the grammar rather than decoratively.
 *    Attunement is a change of attention, not a change of meaning.
 *  - **No new assertions** is enforced by construction: this module reads
 *    threads the player already wove and produces no relation, no facet, and no
 *    claim that was not already true before Attunement was entered.
 *
 * Pure. No Web Audio, no browser, no React.
 */
import type { RelationIntention } from "@/domain/events";
import type { MotifArticulation } from "@/content/castalia/schema";
import { planRelationVoices, imitationInterval, suspensionInterval } from "./grammar";
import { envelopeFor, anchorDegree, type AudioPhrasing, type MotifSource } from "./motif";
import {
  degreeFrequency,
  nearestStableDegree,
  shiftRegister,
  type WorldMode,
} from "./mode";
import {
  makeVoicePlan,
  type PlannedNote,
  type VoicePlan,
} from "./plan";
import { SCORE } from "./score";

export interface AttunementThread {
  readonly threadId: string;
  readonly intention: RelationIntention;
  readonly a: MotifSource;
  readonly b: MotifSource;
  /** Whether this thread's outcome closed. Attunement reports it, never changes it. */
  readonly resolves: boolean;
  readonly phrasing?: AudioPhrasing;
}

export interface AttunementChannel {
  readonly threadId: string;
  readonly intention: RelationIntention;
  readonly atSeconds: number;
  /** Onset span — where the next channel may begin without masking this one. */
  readonly spanSeconds: number;
  readonly plan: VoicePlan;
}

export interface AttunementPlan {
  readonly channels: readonly AttunementChannel[];
  readonly cycleSeconds: number;
  readonly bedGainScale: number;
  readonly densityScale: number;
  /** Threads deferred to a later cycle, so a long session rotates rather than piles. */
  readonly deferredThreadIds: readonly string[];
}

export interface AttunementInput {
  readonly planId: string;
  readonly mode: WorldMode;
  /** Woven threads in creation order. */
  readonly threads: readonly AttunementThread[];
  readonly unitSeconds: number;
  readonly ambientGain: number;
  /** Rotates the window over a long session. Deterministic; never random. */
  readonly cycleIndex?: number;
  /** Longest a single channel may occupy before the next thread speaks. */
  readonly maxChannelSeconds?: number;
}

const DEFAULT_MAX_CHANNEL_SECONDS = 7;

/** Onset span: where the sound stops arriving, ignoring release tails. */
function onsetSpan(plan: VoicePlan): number {
  let span = 0;
  for (const note of plan.notes) {
    span = Math.max(span, note.atSeconds + note.envelope.attack + note.envelope.hold);
  }
  return span;
}

/**
 * Fit a relation plan into a channel window without changing what it says.
 *
 * Onsets are untouched — rhythm is identity, and a compressed rhythm is a
 * different motif. Only the sustained portions shorten. A Tension's decay may
 * be shortened this way and stay inside CAV-007, because twelve seconds is a
 * ceiling on how long the amplitude may take to reach its floor, not a minimum.
 */
export function condenseChannel(plan: VoicePlan, maxSeconds: number): VoicePlan {
  const span = onsetSpan(plan);
  if (span <= maxSeconds || span <= 0) return plan;
  // Solve for the factor that fits the *worst* voice, rather than scaling by the
  // whole plan's overshoot: onsets and attacks are not scaled, so a naive ratio
  // leaves the latest voice still hanging past the window.
  let scale = 1;
  for (const note of plan.notes) {
    if (note.envelope.hold <= 0) continue;
    const room = maxSeconds - note.atSeconds - note.envelope.attack;
    scale = Math.min(scale, room / note.envelope.hold);
  }
  scale = Math.max(0.05, Math.min(1, scale));
  const notes = plan.notes.map((note) =>
    Object.freeze({
      ...note,
      envelope: Object.freeze({
        attack: note.envelope.attack,
        hold: Number((note.envelope.hold * scale).toFixed(5)),
        release: Number((note.envelope.release * scale).toFixed(5)),
      }),
    })
  );
  const beatings = plan.beatings.map((beating) =>
    Object.freeze({
      ...beating,
      decayToFloorSeconds: Number(
        (beating.decayToFloorSeconds * scale).toFixed(5)
      ),
    })
  );
  return makeVoicePlan({
    id: plan.id,
    kind: plan.kind,
    intention: plan.intention,
    notes,
    beatings,
    meta: plan.meta,
  });
}

/**
 * The degree a channel's shimmer sits on, chosen by the thread's own grammar.
 *
 * Echo shimmers at the interval it imitates by; Passage at its destination;
 * Tension at its suspension; Ground at the pitch it grounds on. The shimmer
 * therefore carries information rather than decorating four different meanings
 * identically.
 */
export function shimmerDegree(
  mode: WorldMode,
  thread: AttunementThread
): number {
  switch (thread.intention) {
    case "echo":
      return anchorDegree(thread.a.motif) + imitationInterval(mode, thread.a, thread.b);
    case "passage":
      return anchorDegree(thread.b.motif);
    case "tension":
      return anchorDegree(thread.a.motif) + suspensionInterval(mode, thread.a, thread.b);
    case "ground":
      return nearestStableDegree(mode, anchorDegree(thread.a.motif));
  }
}

/**
 * A Tension channel gets no separate shimmer voice, and this is a constraint
 * rather than an omission. CAV-007 allows at most three sounding voices in a
 * tense interval class and caps their summed gain below the bed; a fourth
 * decorative partial would breach both. Its grammar already shimmers — that is
 * what the beating is — so adding one would also be saying the same thing twice.
 */
function shimmerNote(
  input: AttunementInput,
  thread: AttunementThread,
  index: number
): PlannedNote | null {
  if (thread.intention === "tension") return null;
  const degree = shimmerDegree(input.mode, thread);
  const register = shiftRegister("air", 0);
  const length = input.unitSeconds * 6;
  return Object.freeze({
    id: `${input.planId}:shimmer:${index}`,
    conceptId: thread.b.conceptId,
    role: "ensemble" as const,
    timbre: "glass" as const,
    articulation: "rung" as MotifArticulation,
    register,
    degree,
    frequency: degreeFrequency(input.mode, degree, register),
    detuneCents: 0,
    atSeconds: 0,
    envelope: envelopeFor("rung", length),
    gain: Number((input.ambientGain * SCORE.grammar.shimmerGain).toFixed(5)),
    floorGain: 0,
    openEnded: !thread.resolves,
  });
}

export function planAttunement(input: AttunementInput): AttunementPlan {
  if (input.unitSeconds <= 0) {
    throw new RangeError("a rhythmic unit must be a positive number of seconds");
  }
  const maxChannel = input.maxChannelSeconds ?? DEFAULT_MAX_CHANNEL_SECONDS;
  const perCycle = SCORE.attunement.maxChannelsPerCycle;
  const cycleIndex = Math.max(0, Math.floor(input.cycleIndex ?? 0));

  // Bounded by construction: a session with forty threads still schedules six
  // channels, and the window walks forward one cycle at a time.
  const offset =
    input.threads.length === 0
      ? 0
      : (cycleIndex * perCycle) % input.threads.length;
  const ordered = [...input.threads.slice(offset), ...input.threads.slice(0, offset)];
  const speaking = ordered.slice(0, perCycle);
  const deferred = ordered.slice(perCycle).map((thread) => thread.threadId);

  const channels: AttunementChannel[] = [];
  let cursor = 0;

  for (let index = 0; index < speaking.length; index++) {
    const thread = speaking[index];
    const relation = planRelationVoices({
      planId: `${input.planId}:${thread.threadId}`,
      mode: input.mode,
      intention: thread.intention,
      a: thread.a,
      b: thread.b,
      unitSeconds: input.unitSeconds,
      ambientGain: input.ambientGain * SCORE.attunement.channelGainScale,
      phrasing: thread.phrasing,
      resolves: thread.resolves,
    });
    const condensed = condenseChannel(relation, maxChannel);
    const shimmer = shimmerNote(input, thread, index);
    const withShimmer = makeVoicePlan({
      id: condensed.id,
      kind: "attunement",
      intention: condensed.intention,
      notes: shimmer === null ? condensed.notes : [...condensed.notes, shimmer],
      beatings: condensed.beatings,
      meta: condensed.meta,
    });
    const span = onsetSpan(withShimmer);

    channels.push(
      Object.freeze({
        threadId: thread.threadId,
        intention: thread.intention,
        atSeconds: Number(cursor.toFixed(5)),
        spanSeconds: Number(span.toFixed(5)),
        plan: withShimmer,
      })
    );
    cursor += span + SCORE.attunement.channelGapSeconds;
  }

  return Object.freeze({
    channels: Object.freeze(channels),
    cycleSeconds: Number(Math.max(0, cursor).toFixed(4)),
    bedGainScale: SCORE.attunement.bedGainScale,
    densityScale: SCORE.attunement.densityScale,
    deferredThreadIds: Object.freeze(deferred),
  });
}
