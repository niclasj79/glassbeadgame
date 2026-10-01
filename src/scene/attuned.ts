/**
 * ATTUNEMENT, AS THE WORLD HOLDS IT (ADR-018, VERTICAL-SLICE-SPEC §13).
 *
 * Attunement used to read, in play, as the world turning down: the ribbons
 * receded, time thinned, and nothing rose to meet the player's attention. It is
 * the one held heightened state the Game has, so the whole room answers it now:
 * the bead glass deepens, the void deepens, the drawn sky brightens as the
 * threads' voices enter, and the camera drifts on the breath. Release is a
 * cadence: everything lifts back over one slot, on the conductor's grid, while
 * the bed resolves its held chord over the same slot.
 *
 * ONE SCALAR. The vault, the sky and the dust each used to keep their own ease
 * of the session's `attunementActive`, so "the room enters the held state
 * together" was true only while three copies of one constant agreed. Here the
 * held state is one number, stepped once a frame (`Cosmos`), and every answer
 * below is computed from it once and written where the readers find it
 * (`frameState.attunedAnswers`). Nothing else in the scene keeps an attuned
 * state of its own; a source scan holds that (`attuned.test.ts`). The ribbons'
 * per-thread presence (`Attunement.ts`) is a different quantity — which single
 * thread is speaking — and is not an answer to the held state.
 *
 * All of it is ephemeral (ADR-013, condition 3): nothing here is written to the
 * log, the cues keep their empty payloads, and a replay reconstructs nothing of
 * it. Pure: no Three, no React, no clock.
 */

/**
 * THE BOUNDS, IN ONE TABLE.
 *
 * Every answer is a function of the scalar and these numbers, and nothing that
 * reads an answer may scale it again, so no reader can exceed them locally
 * (the same discipline as `audio/comfort.ts`, CAV-007).
 */
export const ATTUNED = Object.freeze({
  /**
   * How the held state enters: the room's exponential ease, in seconds — slow
   * enough to read as attention changing rather than as a light switch.
   */
  enterSeconds: 0.9,
  /** How the share of voices heard is eased, in seconds: a channel entering is a rise, never a step. */
  voicesSeconds: 0.9,
  /** Index of refraction gained by the bead glass at full attunement. */
  iorRise: 0.06,
  /** Dispersion gained where the tier compiles it, as a fraction of its split. */
  dispersionRise: 1 / 3,
  /** How far the void's depth colour falls toward black at full attunement. */
  depthFall: 0.2,
  /** The drawn figures' brightness at its ceiling, as a multiple of rest. */
  figureGainMax: 1.5,
  /** The camera's drift: degrees of orbit per breath, at most. */
  driftDegreesPerBreath: 4,
  /** How long a drift the player has taken over takes to let go, in seconds. */
  driftLetGoSeconds: 0.25,
  /** No answer may oscillate in luminance faster than this (CAV-007), in Hz. */
  maxLuminanceHz: 3,
});

/**
 * Where the held state is:
 *
 *  - `rest` — not attuned, and every answer at rest;
 *  - `entering` — held, easing toward the full state;
 *  - `awaiting` — released, holding until the cadence's slot boundary;
 *  - `releasing` — lifting back over the cadence's one slot.
 */
export type AttunedPhase = "rest" | "entering" | "awaiting" | "releasing";

export interface AttunedState {
  phase: AttunedPhase;
  /** The scalar, 0..1. */
  value: number;
  /** Seconds left before the release begins, while awaiting. */
  wait: number;
  /** The value the release began from. */
  from: number;
  /** Seconds since the release began. */
  elapsed: number;
  /** The eased share of this hold's channels whose voices have begun, 0..1. */
  voices: number;
}

export function restingAttuned(): AttunedState {
  return { phase: "rest", value: 0, wait: 0, from: 0, elapsed: 0, voices: 0 };
}

/** Return a state to rest in place: a new Game owes nothing to the last one's held state. */
export function resetAttuned(state: AttunedState): void {
  state.phase = "rest";
  state.value = 0;
  state.wait = 0;
  state.from = 0;
  state.elapsed = 0;
  state.voices = 0;
}

export interface AttunedStep {
  /** Whether the session is held in Attunement. */
  readonly held: boolean;
  /** Musical seconds since the last step: the conductor's clock while the grid is armed. */
  readonly dt: number;
  /** One slot of the world, in seconds: the length of the release. */
  readonly slotSeconds: number;
  /**
   * Seconds from now to the cadence's slot boundary. Read only on the step the
   * hold ends; zero (or less) begins the release at once, as it does without a grid.
   */
  readonly untilCadence: number;
  /** The share of this hold's channels whose voices have begun, 0..1. */
  readonly sounded: number;
}

/** 0..1 → 0..1, with a level start and a level arrival. */
function smoothstep(u: number): number {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
}

/**
 * THE HELD STATE, ONE STEP ON. Advances `state` in place, without allocating.
 *
 * In: the room's exponential ease toward 1. Out: nothing moves until the
 * cadence's boundary, and from there the scalar falls along a smoothstep to
 * zero over exactly one slot, so the world lifts back with the chord's
 * resolution rather than snapping or trailing behind it. Entering again at any
 * point eases on from wherever the scalar stands.
 */
export function advanceAttuned(state: AttunedState, step: AttunedStep): void {
  const dt = Math.max(0, Number.isFinite(step.dt) ? step.dt : 0);
  const slot = step.slotSeconds > 0 ? step.slotSeconds : 1;

  if (step.held) {
    state.phase = "entering";
    state.value += (1 - state.value) * Math.min(1, dt / ATTUNED.enterSeconds);
    const sounded = Math.max(0, Math.min(1, step.sounded));
    state.voices += (sounded - state.voices) * Math.min(1, dt / ATTUNED.voicesSeconds);
    return;
  }

  if (state.phase === "rest") return;

  if (state.phase === "entering") {
    state.phase = "awaiting";
    state.wait = Math.max(0, step.untilCadence);
    // The release is measured from the boundary, not from this frame: a step
    // that already crosses it carries the overshoot into the fall.
    state.wait -= dt;
  } else if (state.phase === "awaiting") {
    state.wait -= dt;
  } else {
    state.elapsed += dt;
  }

  if (state.phase === "awaiting") {
    if (state.wait > 0) return;
    state.phase = "releasing";
    state.from = state.value;
    state.elapsed = -state.wait;
    state.wait = 0;
  }

  const u = state.elapsed / slot;
  if (u >= 1) {
    resetAttuned(state);
    return;
  }
  state.value = state.from * (1 - smoothstep(u));
}

/** A thread voice the scene has been told about, on the conductor's clock. */
export interface HeardVoice {
  readonly threadId: string;
  readonly atAudioTime: number;
}

/**
 * The share of this hold's channels whose voices have begun: the distinct
 * threads heard from `since` up to `now`, out of the channels one cycle can
 * play (`perCycle`, the score's bound, or fewer when the web holds fewer
 * threads). A voice scheduled ahead has not entered yet, and one heard before
 * the hold began is not this hold's. Nothing heard is nothing: a context that
 * never unlocked brightens nothing, because nothing has entered.
 */
export function soundedShare(
  voices: readonly HeardVoice[],
  since: number,
  now: number,
  threadCount: number,
  perCycle: number
): number {
  const channels = Math.min(Math.max(0, Math.floor(threadCount)), Math.max(0, perCycle));
  if (channels === 0) return 0;
  // A scratch list rather than a Set: at most two dozen voices are ever held,
  // and the frame loop that asks allocates nothing.
  COUNTED.length = 0;
  for (const voice of voices) {
    if (voice.atAudioTime < since || voice.atAudioTime > now) continue;
    if (COUNTED.includes(voice.threadId)) continue;
    COUNTED.push(voice.threadId);
  }
  const heard = COUNTED.length;
  COUNTED.length = 0;
  return Math.min(1, heard / channels);
}

const COUNTED: string[] = [];

/** What every reader applies, computed once a frame from the scalar. */
export interface AttunedAnswers {
  /** Added to the theme's index of refraction. */
  ior: number;
  /** Multiplies the tier's dispersion split, where the tier compiles one. */
  dispersionScale: number;
  /** Multiplies the void's depth colour, in the vault and in what the beads carry. */
  depthScale: number;
  /** Multiplies the drawn figures' rest brightness, stars and lines. */
  figureGain: number;
  /** Radians of orbit per second the camera may drift at this breath, before the rig's own conditions. */
  driftRate: number;
}

export function restingAnswers(): AttunedAnswers {
  return { ior: 0, dispersionScale: 1, depthScale: 1, figureGain: 1, driftRate: 0 };
}

export interface AttunedProfile {
  /** Reduced motion keeps the material and the sky and drops the drift. */
  readonly reducedMotion: boolean;
  /** Reduced bloom keeps the depth and drops the brightening. */
  readonly reducedBloom: boolean;
}

export interface BreathNow {
  /** The breath's phase, radians: cresting on the bar while the grid is armed. */
  readonly phase: number;
  /** 0..1: how deep the breath runs (eased down in reveals, zero under reduced motion). */
  readonly depth: number;
  /** One breath, in seconds: four slots on the grid, or the free breath's period. */
  readonly seconds: number;
}

/**
 * THE ANSWERS, written into `out` without allocating.
 *
 * The drift's rate swells with the breath, `1 + depth × sin(phase)`, whose mean
 * over a breath is one, so it turns at most `driftDegreesPerBreath` in a breath
 * and moves most on the crest: a slow orbit that eases with the room's breathing
 * rather than gliding at a constant rate.
 */
export function attunedAnswers(
  out: AttunedAnswers,
  value: number,
  voices: number,
  profile: AttunedProfile,
  breath: BreathNow
): AttunedAnswers {
  const a = Math.max(0, Math.min(1, value));
  const v = Math.max(0, Math.min(1, voices));
  out.ior = ATTUNED.iorRise * a;
  out.dispersionScale = 1 + ATTUNED.dispersionRise * a;
  out.depthScale = 1 - ATTUNED.depthFall * a;
  out.figureGain = profile.reducedBloom ? 1 : 1 + (ATTUNED.figureGainMax - 1) * a * v;
  if (profile.reducedMotion || a === 0 || !(breath.seconds > 0)) {
    out.driftRate = 0;
  } else {
    const mean = (ATTUNED.driftDegreesPerBreath * Math.PI) / 180 / breath.seconds;
    const depth = Math.max(0, Math.min(1, breath.depth));
    out.driftRate = mean * a * (1 + depth * Math.sin(breath.phase));
  }
  return out;
}

/**
 * How far the camera may turn this frame, after the rig's own conditions:
 * `gate` is 1 while the drift is the camera's only authority and eases to 0
 * once the player has taken it, `dt` is musical seconds.
 */
export function driftAngle(rate: number, gate: number, dt: number): number {
  if (!(rate > 0) || !(gate > 0) || !(dt > 0)) return 0;
  return rate * Math.min(1, gate) * dt;
}

/**
 * The drift's gate, one step on: easing open at the room's own pace while the
 * drift may run, so a drift that resumes after a scripted move gathers rather
 * than jerks, and letting go within `driftLetGoSeconds` once it may not.
 */
export function driftGateAfter(gate: number, open: boolean, dt: number): number {
  const step = Math.max(0, dt);
  if (open) return gate + (1 - gate) * Math.min(1, step / ATTUNED.enterSeconds);
  const next = gate * Math.exp(-step / (ATTUNED.driftLetGoSeconds / 3));
  return next < 1e-3 ? 0 : next;
}
