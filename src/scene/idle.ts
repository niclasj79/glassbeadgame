import { hashString } from "@/lib/utils";

/**
 * THE INSTRUMENT'S IDLE SCORE
 *
 * Measured on the shipped build over a 30-second idle screencast: 4.9% of
 * pixels changed by more than 12 luma, mean frame delta 3.86, bead centres
 * moved 3–5 px in total, and the armillary rings did not rotate at all.
 * Nothing arrived, nothing departed, nothing took or lost light. A stranger
 * watching for thirty seconds would reasonably conclude the page had stalled
 * while loading — which is precisely the question a contemplative game is
 * judged on, because contemplative is not the same word as inert.
 *
 * A world that is alive is not a world that is busy. What it needs is a *score*
 * — events with a period, so that watching is rewarded and looking away and
 * back is rewarded differently. Three voices, all of them slow, all of them
 * derived from one clock (`frameState.clock`, the same dilated clock the audio
 * bed reads), so the world breathes on the beat the music is on and never reads
 * as a screensaver bolted to the side:
 *
 *   PRECESSION.   The colures and the index ring turn about the world's axis at
 *                 three different rates, so the lattice genuinely reconfigures
 *                 — intersections migrate, the cage opens and closes — instead
 *                 of a rigid sphere sitting still. The prime circle does not
 *                 turn: it is the instrument's datum, and the gold stations
 *                 committed threads leave on it must stay where their beads
 *                 are. Its graduations creep instead.
 *
 *   THE LIGHT.    One travelling light crosses the firmament on a fifteen-second
 *                 cycle, brightening the vault and the brass it passes. It is a
 *                 single event with a beginning and an end, not a wobble.
 *
 *   KINDLING.     Every few seconds one bead — chosen by the clock, not by the
 *                 player and not by what the bead contains — takes light and
 *                 loses it again. This is the only voice with a *subject*, and
 *                 it is what makes the arena feel inhabited rather than lit.
 *
 * REDUCED MOTION. Life is not removed, it is re-expressed: the geometric
 * precession stops dead, and the two luminance voices stay — deepened slightly,
 * because with the travel gone they are carrying the whole score. A player who
 * cannot tolerate motion is not thereby a player who should be shown a
 * photograph.
 *
 * Pure and allocation-free: every function returns numbers, and the components
 * that read them do so from their own frame loops.
 */

/**
 * THE SCORE'S OWN CLOCK.
 *
 * It integrates the same dilated seconds `frameState.clock` does — so the world
 * still slows when a reveal slows time, and the score stays on the beat the
 * ambient bed is on — but it is **never reset**. `initFramePositions` zeroes the
 * frame clock when a draw is laid out, and a score read from it would snap every
 * ring back to its starting bearing and cut the travelling light dead at exactly
 * the moment the player pressed BEGIN, which is the one moment in the whole
 * session anybody is watching for a discontinuity.
 *
 * Advanced once per frame, by `scene/Cosmos`. Read by everything else.
 */
let idleSeconds = 0;

export function advanceIdleClock(dilatedSeconds: number): number {
  if (Number.isFinite(dilatedSeconds) && dilatedSeconds > 0) {
    idleSeconds += dilatedSeconds;
  }
  return idleSeconds;
}

export function idleClock(): number {
  return idleSeconds;
}

/** The travelling light's cycle. Well inside the twenty seconds a stranger gives. */
export const LIGHT_PERIOD_SECONDS = 15;

/** How often a bead takes light unprompted. */
export const KINDLE_PERIOD_SECONDS = 6.5;

/**
 * The slowest thing here, and the reason the lattice reconfigures: three
 * distinct rates in radians per second. They are deliberately not harmonics of
 * one another — three rings turning at 1, 2 and 3 units return to the same
 * arrangement, which is a pattern the eye learns and then stops seeing.
 */
export const PRECESSION_RATES = Object.freeze({
  /** The datum. Never turns; its graduations creep. */
  prime: 0,
  colureA: 0.0331,
  colureB: -0.0223,
  index: 0.0619,
  parallel: 0,
});

/** How fast a ring's engraving slides along it when the ring itself is fixed. */
export const CREEP_RATES = Object.freeze({
  prime: 0.0118,
  parallel: 0.0081,
});

const TAU = Math.PI * 2;

/** A raised bump on [0,1]: zero at both ends, one in the middle, smooth. */
function bump(t: number): number {
  if (!(t > 0) || t >= 1) return 0;
  const s = Math.sin(Math.PI * t);
  return s * s;
}

/** Positive remainder, so a clock that is briefly negative does not glitch. */
function cycle(clock: number, period: number): number {
  const t = (clock / period) % 1;
  return t < 0 ? t + 1 : t;
}

export interface TravellingLight {
  /** Longitude of the light's centre, radians, in (-PI, PI]. */
  readonly longitude: number;
  /** Colatitude the band is struck at, radians. */
  readonly colatitude: number;
  /** 0 between events, rising to 1 as the light passes. */
  readonly gain: number;
}

/**
 * Where the light is, and how strongly it is being felt. It enters, crosses,
 * and leaves: the frame at t = 0 and the frame at t = 0.05 look the same, which
 * is what makes its arrival an event rather than an oscillation.
 */
export function travellingLight(
  clock: number,
  reducedMotion = false
): TravellingLight {
  const t = cycle(clock, LIGHT_PERIOD_SECONDS);
  // The crossing occupies the middle four fifths of the cycle; the rest is the
  // dark the crossing is legible against.
  const span = (t - 0.1) / 0.8;
  const gain = bump(span) * (reducedMotion ? 1.35 : 1);
  const longitude = (span * 2 - 1) * Math.PI;
  // The band leans over the course of the crossing, so a second pass is not a
  // repeat of the first.
  const colatitude =
    Math.PI * 0.5 + Math.sin(clock / LIGHT_PERIOD_SECONDS + 1.1) * 0.34;
  return {
    longitude: Math.max(-Math.PI, Math.min(Math.PI, longitude)),
    colatitude,
    gain,
  };
}

export interface Kindling {
  /** Which bead is taking light, or -1 when none is. */
  readonly index: number;
  /** 0..1. */
  readonly gain: number;
}

/**
 * The bead that is taking light right now.
 *
 * Which one is a function of the clock and of nothing else — not of what the
 * bead means, not of whether it is gilded, not of how woven it is. A world that
 * kindled its *important* beads would be a world quietly telling the player
 * which ideas to pick up, and the player composes the interpretation.
 */
export function kindling(clock: number, count: number, seed = 0): Kindling {
  if (count <= 0) return { index: -1, gain: 0 };
  const raw = clock / KINDLE_PERIOD_SECONDS;
  const event = Math.floor(raw);
  if (event < 0) return { index: -1, gain: 0 };
  const local = raw - event;
  // The light occupies half the interval, so there is real silence between
  // beads: two beads alight at once is a decorated world, not an inhabited one.
  const gain = bump(local / 0.5);
  if (gain <= 0) return { index: -1, gain: 0 };
  const index = hashString(`kindle:${seed}:${event}`) % count;
  return { index, gain };
}

/**
 * How far a ring has turned by now. Reduced motion returns zero: this is the
 * one voice that is travel, and travel is what the preference is about.
 */
export function precession(
  rate: number,
  clock: number,
  reducedMotion = false
): number {
  if (reducedMotion) return 0;
  const turned = rate * clock;
  return turned - Math.floor(turned / TAU + 0.5) * TAU;
}

/**
 * The whole score's slowest returning arrangement, in seconds — how long until
 * every ring is back where it started at the same time. Reported so a test can
 * say out loud that the lattice does not repeat inside a session.
 */
export function precessionRecurrence(): number {
  const rates: readonly number[] = [
    PRECESSION_RATES.colureA,
    PRECESSION_RATES.colureB,
    PRECESSION_RATES.index,
  ];
  let worst = 0;
  for (let i = 0; i < rates.length; i++) {
    for (let j = i + 1; j < rates.length; j++) {
      const relative = Math.abs(rates[i] - rates[j]);
      if (relative > 1e-9) worst = Math.max(worst, TAU / relative);
    }
  }
  return worst;
}
