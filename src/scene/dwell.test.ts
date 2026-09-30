import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DWELL_CLOSE_GRACE_MS,
  DWELL_OPEN_MS,
  DWELL_TIMING,
  SIGHT_SETTLE_MS,
  SIGHT_TIMING,
  createSettler,
  settle,
  type SettleTiming,
} from "./dwell";

/**
 * A look counts once it has lasted (I-015, I-018). The rule is pure, so most
 * of it is proved here without a clock at all; the driver is then run under
 * fake timers to show it asks the rule again at exactly the right moments and
 * never keeps a second copy of what is shown.
 */

describe("the accepted timings", () => {
  it("are the director's first values, named rather than scattered", () => {
    expect(DWELL_OPEN_MS).toBe(700);
    expect(DWELL_CLOSE_GRACE_MS).toBe(300);
    expect(SIGHT_SETTLE_MS).toBe(250);
    expect(DWELL_TIMING).toEqual({ openMs: 700, closeMs: 300 });
    expect(SIGHT_TIMING).toEqual({ openMs: 250, closeMs: 250 });
  });
});

describe("settle — the rule", () => {
  const at = (
    shown: string | null,
    observed: string | null,
    observedAt: number,
    now: number,
    timing: SettleTiming = DWELL_TIMING
  ) => settle({ shown, observed, observedAt }, now, timing);

  it("opens a card only after the pointer has rested for the whole opening", () => {
    expect(at(null, "a", 0, 0)).toEqual({ shown: null, wakeAt: 700 });
    expect(at(null, "a", 0, 699)).toEqual({ shown: null, wakeAt: 700 });
    expect(at(null, "a", 0, 700)).toEqual({ shown: "a", wakeAt: null });
  });

  it("closes it only after the grace, and not before", () => {
    expect(at("a", null, 1000, 1000)).toEqual({ shown: "a", wakeAt: 1300 });
    expect(at("a", null, 1000, 1299)).toEqual({ shown: "a", wakeAt: 1300 });
    expect(at("a", null, 1000, 1300)).toEqual({ shown: null, wakeAt: null });
  });

  it("keeps the card when the pointer comes back inside the grace", () => {
    // Back on the shown bead: nothing is pending, whatever the clock says.
    expect(at("a", "a", 1100, 1100)).toEqual({ shown: "a", wakeAt: null });
  });

  it("treats moving onto another bead as leaving the first", () => {
    // The first card closes on the grace …
    expect(at("a", "b", 2000, 2000)).toEqual({ shown: "a", wakeAt: 2300 });
    expect(at("a", "b", 2000, 2300)).toEqual({ shown: null, wakeAt: 2700 });
    // … and the second waits its own full opening from the moment it was reached.
    expect(at("a", "b", 2000, 2699)).toEqual({ shown: null, wakeAt: 2700 });
    expect(at("a", "b", 2000, 2700)).toEqual({ shown: "b", wakeAt: null });
  });

  it("settles a sighting straight from one bead to the next when the timings agree", () => {
    // The lens never shows an empty gap between two beads it has settled on.
    expect(at("a", "b", 0, 0, SIGHT_TIMING)).toEqual({ shown: "a", wakeAt: 250 });
    expect(at("a", "b", 0, 250, SIGHT_TIMING)).toEqual({ shown: "b", wakeAt: null });
    expect(at("a", null, 0, 250, SIGHT_TIMING)).toEqual({ shown: null, wakeAt: null });
  });

  it("is idle when nothing is shown and nothing is under the pointer", () => {
    expect(at(null, null, 0, 10_000)).toEqual({ shown: null, wakeAt: null });
  });
});

describe("createSettler — the driver", () => {
  let shown: string | null = null;
  const writes: (string | null)[] = [];

  const settler = (timing: SettleTiming = DWELL_TIMING, refuse = false) =>
    createSettler<string>({
      timing,
      now: () => Date.now(),
      timers: {
        set: (callback, delayMs) => setTimeout(callback, delayMs) as unknown as number,
        clear: (handle) => clearTimeout(handle),
      },
      read: () => shown,
      write: (value) => {
        writes.push(value);
        if (!refuse) shown = value;
      },
    });

  beforeEach(() => {
    vi.useFakeTimers();
    shown = null;
    writes.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dwells after 700 ms and closes 300 ms after leaving", () => {
    const look = settler();
    look.observe("a");
    vi.advanceTimersByTime(699);
    expect(shown).toBeNull();
    vi.advanceTimersByTime(1);
    expect(shown).toBe("a");

    look.observe(null);
    vi.advanceTimersByTime(299);
    expect(shown).toBe("a");
    vi.advanceTimersByTime(1);
    expect(shown).toBeNull();
    expect(writes).toEqual(["a", null]);
  });

  it("does not restart a wait for a pointer that has not moved off its bead", () => {
    const look = settler();
    look.observe("a");
    vi.advanceTimersByTime(400);
    // Every pointermove over the same bead reports it again.
    look.observe("a");
    look.observe("a");
    vi.advanceTimersByTime(300);
    expect(shown).toBe("a");
  });

  it("restarts the full opening on another bead, and closes the first on the grace", () => {
    const look = settler();
    look.observe("a");
    vi.advanceTimersByTime(700);
    expect(shown).toBe("a");

    look.observe("b");
    vi.advanceTimersByTime(300);
    expect(shown).toBeNull();
    vi.advanceTimersByTime(399);
    expect(shown).toBeNull();
    vi.advanceTimersByTime(1);
    expect(shown).toBe("b");
  });

  it("never opens a card for a sweep across several beads", () => {
    const look = settler();
    for (const bead of ["a", "b", "c", "d"]) {
      look.observe(bead);
      vi.advanceTimersByTime(200);
    }
    look.observe(null);
    vi.advanceTimersByTime(5_000);
    expect(writes).toEqual([]);
  });

  it("forgets everything pending on reset, so a later look waits its whole time", () => {
    const look = settler();
    look.observe("a");
    vi.advanceTimersByTime(600);
    look.reset();
    vi.advanceTimersByTime(5_000);
    expect(shown).toBeNull();
    expect(look.observed()).toBeNull();

    look.observe("a");
    vi.advanceTimersByTime(699);
    expect(shown).toBeNull();
    vi.advanceTimersByTime(1);
    expect(shown).toBe("a");
  });

  it("reads what is shown from its owner, and leaves a refusal alone", () => {
    // The owner says no (a card may not open outside roaming): the driver does
    // not insist, does not loop, and does not pretend the card is open.
    const look = settler(DWELL_TIMING, true);
    look.observe("a");
    vi.advanceTimersByTime(700);
    expect(writes).toEqual(["a"]);
    expect(shown).toBeNull();
    vi.advanceTimersByTime(5_000);
    expect(writes).toEqual(["a"]);
  });

  it("settles a sighting in a quarter of a second, both ways", () => {
    const look = settler(SIGHT_TIMING);
    look.observe("a");
    vi.advanceTimersByTime(249);
    expect(shown).toBeNull();
    vi.advanceTimersByTime(1);
    expect(shown).toBe("a");

    look.observe("b");
    vi.advanceTimersByTime(250);
    expect(shown).toBe("b");
    expect(writes).toEqual(["a", "b"]);

    look.observe(null);
    vi.advanceTimersByTime(250);
    expect(shown).toBeNull();
  });
});
