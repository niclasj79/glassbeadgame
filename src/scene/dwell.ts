/**
 * LOOKS THAT SETTLE (I-015, I-017, I-018).
 *
 * Two things in the focus view answer a *look* rather than a decision, and
 * both would flicker if they answered the pointer at once: the card a roaming
 * bead opens when the pointer rests on it, and the card the lens puts in the
 * gap as it sweeps across the arena. So neither answers the pointer. Both
 * answer the pointer *having stayed* — and this module is the one statement of
 * what "having stayed" means.
 *
 *   dwell    a roaming bead's card opens after ~700 ms on the bead, and closes
 *            ~300 ms after the pointer has left it. Moving onto another bead
 *            is leaving the first: its card closes on the grace, and the new
 *            bead waits its own full 700 ms.
 *   sight    the lens settles on a bead after ~250 ms, and settles on nothing
 *            after ~250 ms off every bead, so a sweep reads as looking rather
 *            than as a column flipping through cards.
 *
 * The rule is a pure function of three facts — what is shown, what is under
 * the pointer, and since when — so it can be proved without a clock. The
 * driver below only schedules the next time the rule needs asking, and it
 * never keeps its own copy of what is shown: the focus store is the one owner
 * of that, and the driver reads it each time (AGENTS.md: one source of truth).
 *
 * Nothing here knows a bead, a store or a pointer. A look records nothing
 * durable, and nothing here could.
 */

/** A roaming bead's card opens after the pointer has rested on it this long (I-015). */
export const DWELL_OPEN_MS = 700;
/** …and closes this long after the pointer has left it (I-015). */
export const DWELL_CLOSE_GRACE_MS = 300;
/** The lens settles on a bead — or on none — after this long (I-015, I-018). */
export const SIGHT_SETTLE_MS = 250;

export interface SettleTiming {
  /** How long a new value must stay under the pointer before it is shown. */
  readonly openMs: number;
  /** How long the shown value may go without the pointer before it is withdrawn. */
  readonly closeMs: number;
}

export const DWELL_TIMING: SettleTiming = Object.freeze({
  openMs: DWELL_OPEN_MS,
  closeMs: DWELL_CLOSE_GRACE_MS,
});

export const SIGHT_TIMING: SettleTiming = Object.freeze({
  openMs: SIGHT_SETTLE_MS,
  closeMs: SIGHT_SETTLE_MS,
});

export interface SettleInput<T> {
  /** What is shown now. */
  readonly shown: T | null;
  /** What is under the pointer now (null: nothing). */
  readonly observed: T | null;
  /** When the pointer arrived on `observed` — or left everything, if null. */
  readonly observedAt: number;
}

export interface SettleOutcome<T> {
  /** What should be shown at `now`. */
  readonly shown: T | null;
  /** When the answer can next change, or null when nothing is pending. */
  readonly wakeAt: number | null;
}

/**
 * What a look has settled on at `now`.
 *
 * The shown value never changes because the pointer passed through: it is
 * withdrawn only after `closeMs` away from it, and it is replaced only after
 * `openMs` on something else. Returning to the shown value inside the grace
 * cancels the withdrawal outright — a hand that slips off a bead's edge and
 * back has not left it.
 */
export function settle<T>(
  input: SettleInput<T>,
  now: number,
  timing: SettleTiming
): SettleOutcome<T> {
  const { shown, observed, observedAt } = input;
  if (observed === shown) return { shown, wakeAt: null };
  const elapsed = now - observedAt;

  if (observed === null) {
    return elapsed >= timing.closeMs
      ? { shown: null, wakeAt: null }
      : { shown, wakeAt: observedAt + timing.closeMs };
  }

  if (elapsed >= timing.openMs) return { shown: observed, wakeAt: null };
  if (shown === null) return { shown: null, wakeAt: observedAt + timing.openMs };
  // Something else is shown, and the pointer has left it for a new value that
  // has not yet stayed long enough: the old one is withdrawn on the grace, and
  // the new one waits for its own full opening.
  if (elapsed >= timing.closeMs) {
    return { shown: null, wakeAt: observedAt + timing.openMs };
  }
  return {
    shown,
    wakeAt: observedAt + Math.min(timing.closeMs, timing.openMs),
  };
}

/** A timer a settler may schedule and withdraw. Injected, so tests own time. */
export interface SettleTimers {
  readonly set: (callback: () => void, delayMs: number) => number;
  readonly clear: (handle: number) => void;
}

export interface SettlerOptions<T> {
  readonly timing: SettleTiming;
  readonly now: () => number;
  readonly timers: SettleTimers;
  /** What is shown right now, read from its owner every time — never cached here. */
  readonly read: () => T | null;
  /** Show a value, or withdraw it (null). The owner may refuse. */
  readonly write: (value: T | null) => void;
}

export interface Settler<T> {
  /** The pointer is now over `value` — or over nothing. Cheap to repeat. */
  readonly observe: (value: T | null) => void;
  /**
   * Forget what was under the pointer and anything pending. What is shown is
   * left to its owner. Called whenever the look stops applying — a press, a
   * stage change — so a later look starts its own full wait.
   */
  readonly reset: () => void;
  /** What is under observation (for tests and the frame tick). */
  readonly observed: () => T | null;
}

export function createSettler<T>(options: SettlerOptions<T>): Settler<T> {
  let observed: T | null = null;
  let observedAt = 0;
  let timer: number | null = null;

  const clearTimer = (): void => {
    if (timer === null) return;
    options.timers.clear(timer);
    timer = null;
  };

  const evaluate = (): void => {
    clearTimer();
    const now = options.now();
    const shown = options.read();
    const outcome = settle({ shown, observed, observedAt }, now, options.timing);
    if (outcome.shown !== shown) options.write(outcome.shown);
    if (outcome.wakeAt !== null) {
      timer = options.timers.set(() => {
        timer = null;
        evaluate();
      }, Math.max(0, outcome.wakeAt - now));
    }
  };

  return Object.freeze({
    observe: (value: T | null) => {
      // A pointer that is still where it was changes nothing, and must not
      // restart a wait it is in the middle of.
      if (value === observed && timer !== null) return;
      if (value !== observed) {
        observed = value;
        observedAt = options.now();
      }
      evaluate();
    },
    reset: () => {
      clearTimer();
      observed = null;
      // "Nothing under the pointer, as of now" — so a shown value the owner
      // has kept is still given its whole grace by the next look.
      observedAt = options.now();
    },
    observed: () => observed,
  });
}
