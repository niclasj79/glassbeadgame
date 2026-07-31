/**
 * THE CUE BUS
 *
 * Directors subscribe here and nowhere else. The bus owns dispatch timing so
 * that every director receives the same cue at the same moment — which is the
 * entire point of ADR-009 and impossible if each director sets its own timers.
 *
 * The clock is injected. In the browser it is the Web Audio clock, because the
 * audio clock is authoritative for scheduled music (ARCHITECTURE §10) and
 * visuals that drift from it are immediately perceptible as a lack of causality.
 * In tests it is a controlled counter, so cue phrasing is assertable without a
 * real context.
 */
import type { CuePlan, CueChannel, PresentationCue } from "./types";

export type CueListener = (cue: PresentationCue, plan: CuePlan) => void;

export interface CueBus {
  /** Subscribe a director. Returns an unsubscribe function. */
  readonly subscribe: (channel: CueChannel, listener: CueListener) => () => void;
  /** Stage a plan. Cues at startAt 0 dispatch synchronously. */
  readonly publish: (plan: CuePlan) => void;
  /**
   * Advance the bus. Call once per frame from the render loop; the bus itself
   * owns no timer, so it cannot drift from the frame it is dressing.
   */
  readonly tick: (nowSeconds: number) => void;
  /** Drop everything pending. Used on session reset and on cancellation. */
  readonly reset: () => void;
  /** Pending cue count — for tests and for leak assertions. */
  readonly pending: () => number;
}

interface Scheduled {
  readonly at: number;
  readonly cue: PresentationCue;
  readonly plan: CuePlan;
}

export interface CueBusOptions {
  readonly now: () => number;
  /**
   * A plan longer than this is a bug, not a long moment; the bus refuses it so
   * a malformed plan cannot silently pin the presentation open forever.
   */
  readonly maxPlanSeconds?: number;
}

const DEFAULT_MAX_PLAN_SECONDS = 90;

export function createCueBus(options: CueBusOptions): CueBus {
  const listeners = new Map<CueChannel, Set<CueListener>>();
  const maxPlan = options.maxPlanSeconds ?? DEFAULT_MAX_PLAN_SECONDS;
  // Kept sorted by `at`, so tick only inspects the head.
  let queue: Scheduled[] = [];

  const deliver = (cue: PresentationCue, plan: CuePlan): void => {
    for (const channel of cue.channels) {
      const set = listeners.get(channel);
      if (!set) continue;
      // Copy: a director may unsubscribe from inside its own handler.
      for (const listener of [...set]) {
        listener(cue, plan);
      }
    }
  };

  const bus: CueBus = {
    subscribe: (channel, listener) => {
      let set = listeners.get(channel);
      if (!set) {
        set = new Set();
        listeners.set(channel, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
      };
    },

    publish: (plan) => {
      if (plan.duration > maxPlan) {
        throw new RangeError(
          `cue plan ${plan.id} spans ${plan.duration}s, beyond the ${maxPlan}s ceiling`
        );
      }
      const now = options.now();
      const deferred: Scheduled[] = [];
      for (const cue of plan.cues) {
        if (cue.startAt <= 0) deliver(cue, plan);
        else deferred.push({ at: now + cue.startAt, cue, plan });
      }
      if (deferred.length > 0) {
        queue = [...queue, ...deferred].sort((a, b) => a.at - b.at);
      }
    },

    tick: (nowSeconds) => {
      if (queue.length === 0) return;
      let index = 0;
      while (index < queue.length && queue[index].at <= nowSeconds) index += 1;
      if (index === 0) return;
      const due = queue.slice(0, index);
      queue = queue.slice(index);
      for (const entry of due) deliver(entry.cue, entry.plan);
    },

    reset: () => {
      queue = [];
    },

    pending: () => queue.length,
  };
  return Object.freeze(bus);
}
