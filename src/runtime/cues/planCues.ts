/**
 * THE CUE PLANNER
 *
 * Pure. Deterministic. No browser, no React, no Three, no Web Audio. Given a
 * semantic moment and the current presentation context, it returns the one plan
 * every director follows.
 *
 * Timing here is *phrasing*, and phrasing is the campaign's main lever on
 * feel. Two rules govern the numbers below:
 *
 *  - Response is immediate; resolution takes as long as the meaning deserves.
 *    Nothing waits for an animation to finish before acknowledging input, so a
 *    latch is at 0 s and a weave release is at 0 s. What follows can breathe.
 *  - Epistemic status changes *resolution*, never *reward* (CAV-006). A
 *    documented relation and an Open Thread get the same duration budget and
 *    the same channels; what differs is whether the phrase closes.
 */
import type { GestureProfile, RelationIntention } from "@/domain/events";
import type { EventId } from "@/domain/ids";
import type {
  CuePlan,
  CueChannel,
  CueType,
  CuePayloadMap,
  PresentationCue,
} from "./types";

const ALL: readonly CueChannel[] = Object.freeze([
  "scene",
  "camera",
  "audio",
  "ui",
  "haptics",
  "caption",
]);

/** Looking, not acting: no camera impact, no vibration. */
const SIGHT: readonly CueChannel[] = Object.freeze([
  "scene",
  "audio",
  "ui",
  "caption",
]);

/**
 * A recognition of what is already woven: the world, the score, the page and
 * the words answer; nothing strikes the camera or the hand.
 */
const RECOGNITION: readonly CueChannel[] = Object.freeze([
  "scene",
  "audio",
  "ui",
  "caption",
]);

/** Words only: an answer that changes nothing in the world. */
const WORDS: readonly CueChannel[] = Object.freeze(["caption"]);

/**
 * How long a completed motif holds the stage. A Study solved by the same
 * commit waits it out, so the motif and the solved moment are two moments
 * rather than two ensembles sounding over each other.
 */
export const MOTIF_MOMENT_SECONDS = 4.5;

/**
 * Gesture shapes how long a phrase takes to unfold, never what it means. A
 * slow deliberate weave earns a slower, wider resolution; a quick decisive one
 * lands sooner. Bounded tightly so the difference is felt, not fought.
 */
export function gesturePhrasing(gesture: GestureProfile | undefined): number {
  if (!gesture || gesture.durationMs === undefined) return 1;
  const seconds = gesture.durationMs / 1000;
  // 0.25 s -> 0.88, 1 s -> 1.0, 4 s -> 1.22. Deliberately narrow.
  const scaled = 1 + Math.log10(Math.max(0.05, seconds)) * 0.18;
  return Math.min(1.25, Math.max(0.85, Number(scaled.toFixed(4))));
}

/**
 * How long a relation's response takes to resolve. Tension is given the most
 * time because instability has to be established before it can be *held* rather
 * than read as an error; Ground settles fastest because settling is its point.
 */
const INTENTION_SPAN: Readonly<Record<RelationIntention, number>> = Object.freeze({
  echo: 2.4,
  passage: 2.8,
  tension: 3.2,
  ground: 2.0,
});

interface DraftOfType<Type extends CueType> {
  readonly type: Type;
  readonly startAt: number;
  readonly duration: number;
  readonly channels: readonly CueChannel[];
  readonly payload: CuePayloadMap[Type];
}

type Draft = { [Type in CueType]: DraftOfType<Type> }[CueType];

/** Keeps each draft's payload checked against its own cue type. */
const draft = <Type extends CueType>(value: DraftOfType<Type>): Draft =>
  value as Draft;

/**
 * Deterministic identity. Cue ids must be stable under replay, so they derive
 * from the staged event and the cue's position — never from a counter, a clock,
 * or a random source.
 */
function planId(sourceEventId: EventId | null, kind: string, seq: number): string {
  return `cue:${sourceEventId ?? "ephemeral"}:${kind}:${seq}`;
}

function assemble(
  sourceEventId: EventId | null,
  drafts: readonly Draft[]
): CuePlan {
  if (drafts.length === 0) {
    throw new RangeError("a cue plan must stage at least one cue");
  }
  const cues = drafts.map((entry, index) => {
    if (entry.channels.length === 0) {
      throw new RangeError(`cue ${entry.type} reaches no director`);
    }
    if (entry.startAt < 0 || entry.duration < 0) {
      throw new RangeError(`cue ${entry.type} has negative timing`);
    }
    return Object.freeze({
      id: planId(sourceEventId, entry.type, index),
      type: entry.type,
      sourceEventId,
      startAt: entry.startAt,
      duration: entry.duration,
      channels: Object.freeze([...entry.channels]),
      payload: entry.payload,
    });
  }) as PresentationCue[];

  const duration = cues.reduce(
    (span, cue) => Math.max(span, cue.startAt + cue.duration),
    0
  );
  return Object.freeze({
    id: `plan:${cues[0].id}`,
    cues: Object.freeze(cues),
    duration,
  });
}

// ─── Ephemeral moments ──────────────────────────────────────────────────────

export function planAttention(
  payload: CuePayloadMap["attention.enter"],
  sourceEventId: EventId | null
): CuePlan {
  // Attention must open space, and space takes a moment to become audible.
  return assemble(sourceEventId, [
    draft({
      type: "attention.enter",
      startAt: 0,
      duration: 1.1,
      channels: ALL,
      payload,
    }),
  ]);
}

export function planAttentionCleared(): CuePlan {
  return assemble(null, [
    draft({
      type: "attention.clear",
      startAt: 0,
      duration: 0.55,
      channels: ALL,
      payload: Object.freeze({}),
    }),
  ]);
}

/**
 * The lens settles on a bead, or leaves them all. Scene, sound, the column and
 * the caption answer; the camera and the hand do not — a sweep is looking, and
 * looking must not jolt anything (I-017).
 */
export function planSighting(
  payload: CuePayloadMap["attention.sighted"]
): CuePlan {
  return assemble(null, [
    draft({
      type: "attention.sighted",
      startAt: 0,
      duration: 0.35,
      channels: SIGHT,
      payload,
    }),
  ]);
}

/** The second bead is fixed; the camera turns to frame the pair (I-016). */
export function planPairLocked(payload: CuePayloadMap["pair.locked"]): CuePlan {
  return assemble(null, [
    draft({
      type: "pair.locked",
      startAt: 0,
      duration: 0.6,
      channels: ALL,
      payload,
    }),
  ]);
}

/**
 * A reading heard before it is made. A hovered preview reaches the scene, the
 * sound and the caption only; a chosen reading also reaches the camera and the
 * hand, because choosing is an act and hovering is not (I-012).
 */
export function planReadingPreviewed(
  payload: CuePayloadMap["reading.previewed"]
): CuePlan {
  return assemble(null, [
    draft({
      type: "reading.previewed",
      startAt: 0,
      duration: 0.5,
      channels: payload.chosen ? ALL : SIGHT,
      payload,
    }),
  ]);
}

/** A committed thread reopened for reading (I-019). */
export function planThreadReopened(
  payload: CuePayloadMap["thread.reopened"]
): CuePlan {
  return assemble(null, [
    draft({
      type: "thread.reopened",
      startAt: 0,
      duration: 0.8,
      channels: ALL,
      payload,
    }),
  ]);
}

// ─── The commit moment ──────────────────────────────────────────────────────

export interface CommitMomentInput {
  readonly woven: CuePayloadMap["thread.woven"];
  readonly wovenEventId: EventId;
  readonly outcome:
    | { readonly kind: "documented"; readonly payload: CuePayloadMap["outcome.documented"]; readonly eventId: EventId }
    | { readonly kind: "open-thread"; readonly payload: CuePayloadMap["outcome.open-thread"]; readonly eventId: EventId }
    | { readonly kind: "unresolved"; readonly payload: CuePayloadMap["outcome.unresolved"] };
}

/**
 * One plan stages the whole commit: the thread lands, then its outcome
 * resolves. Splitting these across two subscriptions is exactly the drift
 * ADR-009 exists to prevent.
 */
export function planCommitMoment(input: CommitMomentInput): CuePlan {
  const phrasing = gesturePhrasing(input.woven.gesture);
  const span = INTENTION_SPAN[input.woven.intention] * phrasing;
  // The thread arrives instantly; the outcome follows once the weave has
  // physically landed. Long enough to feel like consequence, short enough that
  // it never reads as a loading pause.
  const settle = 0.42 * phrasing;

  const drafts: Draft[] = [
    draft({
      type: "thread.woven",
      startAt: 0,
      duration: settle,
      channels: ALL,
      payload: input.woven,
    }),
  ];

  if (input.outcome.kind === "documented") {
    drafts.push(
      draft({
        type: "outcome.documented",
        startAt: settle,
        duration: span,
        channels: ALL,
        payload: input.outcome.payload,
      })
    );
  } else if (input.outcome.kind === "open-thread") {
    // Same budget as a documented relation. An Open Thread is a different
    // epistemic status, not a lesser event (CAV-006).
    drafts.push(
      draft({
        type: "outcome.open-thread",
        startAt: settle,
        duration: span,
        channels: ALL,
        payload: input.outcome.payload,
      })
    );
  } else {
    // Honest near-silence: short and quiet, but never dimmed or greyed, because
    // the player did nothing wrong.
    drafts.push(
      draft({
        type: "outcome.unresolved",
        startAt: settle,
        duration: span * 0.55,
        channels: ALL,
        payload: input.outcome.payload,
      })
    );
  }

  return assemble(input.wovenEventId, drafts);
}

export function planMotifCompleted(
  payload: CuePayloadMap["motif.completed"],
  sourceEventId: EventId,
  afterSeconds = 0
): CuePlan {
  // A motif changes the world's structure, so it is given room — but it enters
  // *under* ongoing play rather than interrupting it. No modal ceremony.
  //
  // It also enters AFTER the commit that completed it has resolved. A motif can
  // only ever be completed by a commit, and the commit's own outcome is staged
  // a settle after the weave lands (`planCommitMoment`); a motif cue at 0 s
  // therefore arrived *before* the outcome it belonged to, and the outcome
  // note then covered the motif note in the margin. In the recorded playtest
  // a Bridge formed on the third thread and the only trace of it was the
  // Attune mark. The caller passes the commit moment's span, so the world's
  // one structural event in the middle game gets its own moment, not a gap.
  if (!Number.isFinite(afterSeconds) || afterSeconds < 0) {
    throw new RangeError("a motif may not be staged before the commit it completes");
  }
  return assemble(sourceEventId, [
    draft({
      type: "motif.completed",
      startAt: afterSeconds,
      duration: MOTIF_MOMENT_SECONDS,
      channels: ALL,
      payload,
    }),
  ]);
}

// ─── Studies (STUDIES-SPEC §7) ──────────────────────────────────────────────

/**
 * A Study solved: one coordinated moment — the world, the score, the caption
 * and the plate together (ADR-009).
 *
 * Solved by threads, it follows the commit that completed the answer, as a
 * motif follows its outcome: the caller passes how long that commit takes to
 * settle, so the moment never covers the outcome it grew out of. Solved by a
 * declared silence, it is staged at once, because nothing precedes it.
 *
 * It is a recognition, not a new event in the web: it reaches no camera and
 * no hand, and its span is the ensemble it reuses, a motif's.
 */
export function planStudySolved(
  payload: CuePayloadMap["study.solved"],
  sourceEventId: EventId | null,
  afterSeconds = 0
): CuePlan {
  if (!Number.isFinite(afterSeconds) || afterSeconds < 0) {
    throw new RangeError("a Study may not be solved on stage before the commit that solved it");
  }
  return assemble(sourceEventId, [
    draft({
      type: "study.solved",
      startAt: afterSeconds,
      duration: MOTIF_MOMENT_SECONDS,
      channels: RECOGNITION,
      payload,
    }),
  ]);
}

/**
 * Silence declared where an answer exists: a caption and nothing else. The
 * margin line is the page's; the world does not answer, because nothing in it
 * changed, and the moment never interrupts (STUDIES-SPEC §7).
 */
export function planStudyNotYet(payload: CuePayloadMap["study.not-yet"]): CuePlan {
  return assemble(null, [
    draft({
      type: "study.not-yet",
      startAt: 0,
      duration: 0.6,
      channels: WORDS,
      payload,
    }),
  ]);
}

export function planAttunement(
  payload: CuePayloadMap["attunement.changed"],
  sourceEventId: EventId
): CuePlan {
  return assemble(sourceEventId, [
    draft({
      type: "attunement.changed",
      startAt: 0,
      duration: payload.active ? 3.5 : 2.0,
      channels: ALL,
      payload,
    }),
  ]);
}

export function planConclusion(
  payload: CuePayloadMap["conclusion.perform"],
  sourceEventId: EventId
): CuePlan {
  return assemble(sourceEventId, [
    draft({
      type: "conclusion.perform",
      startAt: 0,
      duration: 0,
      channels: ALL,
      payload,
    }),
  ]);
}
