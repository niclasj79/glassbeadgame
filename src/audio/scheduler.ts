/**
 * THE LOOK-AHEAD SCHEDULER — the timing foundation, kept.
 *
 * The prototype already used the right pattern ("A Tale of Two Clocks"): a JS
 * interval wakes up often, looks a little way into the future, and schedules
 * Web-Audio-clock-accurate events ahead of time. Nothing here replaces that. It
 * generalises it, so relation grammar, attention, Attunement, and the conclusion
 * all ride the same clock the ambient bed rides, and a light pulse in the scene
 * can be aligned to a note by reading the same timestamp.
 *
 * Two properties are non-negotiable and both are enforced here rather than by
 * convention:
 *
 *  - **The Web Audio clock is authoritative** (ARCHITECTURE §10). The queue
 *    stores absolute AudioContext times. It never stores "in 2 seconds".
 *  - **Nothing allocates without bound.** The queue has a fixed capacity and
 *    refuses work past it, and every scheduled note passes through the voice
 *    budget in `voices.ts`.
 *
 * The queue itself is pure and has no AudioContext, so the look-ahead behaviour
 * is unit-testable with an injected clock.
 */
import { audio } from "./engine";
import { playVoice } from "./voices";
import type { VoicePlan } from "./plan";

export interface QueuedPlan {
  /** Absolute AudioContext time at which the plan begins. */
  readonly at: number;
  readonly plan: VoicePlan;
}

export interface PlanQueue {
  /** Enqueue. False means the queue is full and the plan was refused. */
  readonly push: (plan: VoicePlan, at: number) => boolean;
  /** Everything starting at or before `horizon`, in time order, removed. */
  readonly drain: (horizon: number) => readonly QueuedPlan[];
  readonly pending: () => number;
  readonly reset: () => void;
}

export interface PlanQueueOptions {
  /**
   * Maximum plans held at once. A refusal is the correct failure: it drops the
   * newest gesture rather than delaying every scheduled note behind a backlog.
   */
  readonly capacity?: number;
}

const DEFAULT_CAPACITY = 48;

export function createPlanQueue(options: PlanQueueOptions = {}): PlanQueue {
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  let queue: QueuedPlan[] = [];

  const api: PlanQueue = {
    push: (plan, at) => {
      if (queue.length >= capacity) return false;
      const entry: QueuedPlan = Object.freeze({ at, plan });
      // Insertion sort: the queue is short and almost always already ordered.
      let index = queue.length;
      while (index > 0 && queue[index - 1].at > at) index -= 1;
      queue = [...queue.slice(0, index), entry, ...queue.slice(index)];
      return true;
    },

    drain: (horizon) => {
      let index = 0;
      while (index < queue.length && queue[index].at <= horizon) index += 1;
      if (index === 0) return Object.freeze([]);
      const due = queue.slice(0, index);
      queue = queue.slice(index);
      return Object.freeze(due);
    },

    pending: () => queue.length,

    reset: () => {
      queue = [];
    },
  };
  return Object.freeze(api);
}

// ─── Realisation ────────────────────────────────────────────────────────────

export interface RealizeTargets {
  /** Where ordinary semantic voices go. */
  readonly music: AudioNode;
  /** Where tense voices go — a bus with its own ceiling. */
  readonly tension: AudioNode;
}

/**
 * Turn a plan into scheduled voices. Returns how many notes actually sounded,
 * which is less than the plan's note count whenever the voice budget refused
 * one — the texture thins rather than the ceiling being breached.
 *
 * This is the entire Web Audio surface of the semantic layer. Everything above
 * it is data.
 */
export function realizeVoicePlan(
  ctx: AudioContext,
  targets: RealizeTargets,
  plan: VoicePlan,
  atSeconds: number
): number {
  let sounded = 0;
  const tense = plan.intention === "tension";
  for (const note of plan.notes) {
    // A note in the past is dropped, not rushed: playing it "now" would put it
    // off the grid, and off the grid is more noticeable than absent.
    const at = atSeconds + note.atSeconds;
    if (at < ctx.currentTime - 0.02) continue;
    const dest = tense || note.role === "shadow" ? targets.tension : targets.music;
    const ok = playVoice(ctx, dest, {
      timbre: note.timbre,
      frequency: note.frequency,
      gain: note.gain,
      at,
      attack: note.envelope.attack,
      hold: note.envelope.hold,
      release: note.envelope.release,
      detuneCents: note.detuneCents,
      floorGain: note.floorGain,
    });
    if (ok) sounded += 1;
  }
  return sounded;
}

// ─── The loop ───────────────────────────────────────────────────────────────

export interface LookaheadScheduler {
  readonly start: () => void;
  readonly stop: () => void;
  readonly running: () => boolean;
  /** Schedule a plan at an absolute AudioContext time. */
  readonly schedule: (plan: VoicePlan, atSeconds: number) => boolean;
  /** Drain and realise everything inside the look-ahead window. */
  readonly tick: () => void;
  readonly pending: () => number;
  readonly reset: () => void;
}

export interface LookaheadSchedulerOptions {
  readonly tickMs?: number;
  readonly lookaheadSeconds?: number;
  readonly capacity?: number;
}

const DEFAULT_TICK_MS = 25;
const DEFAULT_LOOKAHEAD_S = 1.2;

/**
 * The production scheduler for the semantic layer. It shares the engine's
 * context and buses; it does not own them, and it creates none of its own.
 */
export function createLookaheadScheduler(
  options: LookaheadSchedulerOptions = {}
): LookaheadScheduler {
  const queue = createPlanQueue({ capacity: options.capacity });
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
  const lookahead = options.lookaheadSeconds ?? DEFAULT_LOOKAHEAD_S;
  let timer: number | null = null;

  const tick = (): void => {
    const ctx = audio.get();
    const music = audio.motifBus;
    const tension = audio.tensionBus;
    if (!ctx || !music || !tension) return;
    for (const entry of queue.drain(ctx.currentTime + lookahead)) {
      realizeVoicePlan(ctx, { music, tension }, entry.plan, entry.at);
    }
  };

  const scheduler: LookaheadScheduler = {
    start: () => {
      if (timer !== null || typeof window === "undefined") return;
      timer = window.setInterval(tick, tickMs);
    },
    stop: () => {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
      queue.reset();
    },
    running: () => timer !== null,
    schedule: (plan, atSeconds) => queue.push(plan, atSeconds),
    tick,
    pending: () => queue.pending(),
    reset: () => queue.reset(),
  };
  return Object.freeze(scheduler);
}
