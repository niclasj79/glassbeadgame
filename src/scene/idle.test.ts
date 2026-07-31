import { describe, expect, it } from "vitest";
import {
  KINDLE_PERIOD_SECONDS,
  advanceIdleClock,
  idleClock,
  LIGHT_PERIOD_SECONDS,
  PRECESSION_RATES,
  kindling,
  precession,
  precessionRecurrence,
  travellingLight,
} from "./idle";

/**
 * A3 — THE WORLD HAS TO BE ALIVE WHILE NOBODY IS TOUCHING IT
 *
 * Measured on the shipped build across a 30-second idle screencast: 4.9% of
 * pixels changed by more than 12 luma, mean frame delta 3.86, bead centres
 * moved 3–5 px in total, and the rings did not rotate. The whole of the idle
 * frame's motion was star twinkle.
 *
 * The stranger's test is twenty seconds: that is how long a screen gets before
 * it is judged to be either a picture or a program that has hung. Every law
 * below is written against that window.
 */

/** The window a stranger gives a screen before deciding it has stalled. */
const STRANGER_SECONDS = 20;

describe("the idle score", () => {
  it("brings a light all the way across inside the stranger's window", () => {
    expect(LIGHT_PERIOD_SECONDS).toBeLessThanOrEqual(STRANGER_SECONDS);

    let peak = 0;
    let entered = false;
    let left = false;
    let previous = travellingLight(0);
    for (let t = 0; t <= STRANGER_SECONDS; t += 1 / 30) {
      const now = travellingLight(t);
      peak = Math.max(peak, now.gain);
      if (previous.gain <= 0.02 && now.gain > 0.02) entered = true;
      if (entered && previous.gain > 0.02 && now.gain <= 0.02) left = true;
      previous = now;
    }
    // An event, not an oscillation: it arrives, it crosses, it is gone.
    expect(peak).toBeGreaterThan(0.95);
    expect(entered).toBe(true);
    expect(left).toBe(true);
  });

  it("carries the light the whole way round rather than nudging it", () => {
    const at = (t: number) => travellingLight(t).longitude;
    expect(at(LIGHT_PERIOD_SECONDS * 0.1)).toBeCloseTo(-Math.PI, 3);
    expect(at(LIGHT_PERIOD_SECONDS * 0.5)).toBeCloseTo(0, 3);
    expect(at(LIGHT_PERIOD_SECONDS * 0.9)).toBeCloseTo(Math.PI, 3);
  });

  it("turns the rings at rates that actually reconfigure the lattice", () => {
    const rates = [
      PRECESSION_RATES.colureA,
      PRECESSION_RATES.colureB,
      PRECESSION_RATES.index,
    ];
    for (const rate of rates) expect(Math.abs(rate)).toBeGreaterThan(0.02);

    // Every pair opens by at least thirty degrees inside the window: that is a
    // lattice the eye can see changing, not a drift it has to be told about.
    // The old build's rate was zero, on every ring.
    for (let i = 0; i < rates.length; i++) {
      for (let j = i + 1; j < rates.length; j++) {
        const opened = Math.abs(rates[i] - rates[j]) * STRANGER_SECONDS;
        expect(opened).toBeGreaterThan(Math.PI / 6);
      }
    }
  });

  it("never returns the rings to the same arrangement inside a session", () => {
    // Three rates that are ratios of small integers put the cage back where it
    // was on a period the eye learns and then stops seeing.
    // Longer than any session anybody sits through in one go.
    expect(precessionRecurrence()).toBeGreaterThan(180);
  });

  it("keeps the datum still so the gold stays where its beads are", () => {
    // The prime circle carries the stations committed threads leave. It is the
    // one ring that must not turn: its graduations creep instead.
    expect(PRECESSION_RATES.prime).toBe(0);
    expect(PRECESSION_RATES.parallel).toBe(0);
  });

  it("kindles a different bead every few seconds, and only one at a time", () => {
    expect(KINDLE_PERIOD_SECONDS).toBeLessThan(STRANGER_SECONDS / 2);
    const seen = new Set<number>();
    let alight = 0;
    let dark = 0;
    for (let t = 0; t <= STRANGER_SECONDS; t += 1 / 30) {
      const k = kindling(t, 24);
      if (k.index >= 0) {
        seen.add(k.index);
        alight += 1;
        expect(k.gain).toBeGreaterThan(0);
      } else {
        dark += 1;
        expect(k.gain).toBe(0);
      }
    }
    // Three separate beads take light in twenty seconds…
    expect(seen.size).toBeGreaterThanOrEqual(3);
    // …and there is real silence between them. A world where something is
    // always lit is decorated; a world with pauses in it is inhabited.
    expect(dark).toBeGreaterThan(alight * 0.6);
  });

  it("chooses the kindled bead from the clock and from nothing else", () => {
    // Not from what the bead means, not from whether it is gilded, not from
    // how woven it is: the world must never nominate an idea for the player.
    const first = kindling(3.2, 24);
    expect(kindling(3.2, 24)).toEqual(first);
    for (let count = 4; count <= 32; count++) {
      const k = kindling(41.3, count);
      if (k.index >= 0) expect(k.index).toBeLessThan(count);
    }
    expect(kindling(3.2, 0).index).toBe(-1);
    expect(kindling(-4, 24).index).toBe(-1);
  });

  it("stops the travel under reduced motion and keeps the light", () => {
    for (let t = 0; t < 40; t += 0.37) {
      expect(precession(PRECESSION_RATES.index, t, true)).toBe(0);
      expect(precession(PRECESSION_RATES.colureA, t, true)).toBe(0);
    }
    // Life is re-expressed, never removed: the luminance voices stay, and are
    // carried a little deeper because they are carrying the whole score.
    let peak = 0;
    for (let t = 0; t <= STRANGER_SECONDS; t += 1 / 30) {
      peak = Math.max(peak, travellingLight(t, true).gain);
    }
    expect(peak).toBeGreaterThan(1);
    expect(kindling(KINDLE_PERIOD_SECONDS * 2.25, 24).gain).toBeGreaterThan(0);
  });

  it("runs on a clock a new draw does not reset", () => {
    // `initFramePositions` zeroes `frameState.clock` when a draw is laid out.
    // A score read from that clock snaps every ring back to its starting
    // bearing and cuts the travelling light dead at exactly the moment the
    // player pressed BEGIN — the one discontinuity anybody is watching for.
    const before = idleClock();
    advanceIdleClock(0.5);
    advanceIdleClock(0.25);
    expect(idleClock()).toBeCloseTo(before + 0.75, 9);
    // It only ever goes forward: a hitch that reports a negative or NaN delta
    // must not rewind the world.
    advanceIdleClock(-3);
    advanceIdleClock(Number.NaN);
    expect(idleClock()).toBeCloseTo(before + 0.75, 9);
  });

  it("keeps the turn bounded so a long session cannot lose precision", () => {
    for (const t of [0, 60, 3600, 86_400]) {
      const angle = precession(PRECESSION_RATES.index, t);
      expect(Math.abs(angle)).toBeLessThanOrEqual(Math.PI + 1e-9);
    }
  });
});
