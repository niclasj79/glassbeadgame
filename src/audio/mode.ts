/**
 * THE WORLD MODE — the pitch space, and the end of the consonance guarantee.
 *
 * The prototype pinned every pitch to one C-pentatonic gamut so that any subset
 * of simultaneous notes was consonant by construction. `docs/CURRENT-STATE-AUDIT.md`
 * lists that assumption for removal, and the reason is not that it sounded bad —
 * it sounded fine. The reason is that a world where nothing can clash cannot
 * express Tension, and Tension is one of the four things a player can say.
 *
 * What replaces it is a *mode*: a tonic, a temperament, and an explicit split of
 * the twelve semitone classes into those the world treats as stable ground and
 * those it treats as tense. Nothing is consonant by accident any more; a
 * dissonance is now something a plan has to ask for, by name, from `tense`.
 *
 * The temperament is five-limit just intonation, and that is a working decision
 * rather than a period affectation:
 *
 *  - Stable intervals are *exact* small-integer ratios, so their partials
 *    coincide and they do not beat at all. Any beating a player hears is
 *    therefore deliberate — which is what makes controlled beating controllable.
 *  - `sound.overtone-series` authors its motif as degrees [0, 12, 19, 24, 28].
 *    Under just intonation those render as frequency ratios 1 : 2 : 3 : 4 : 5 —
 *    the concept's motif is literally the thing the concept describes.
 *  - Equal temperament's own concept motif still renders honestly, as the
 *    evenly-spaced whole-tone ladder it authored.
 *
 * `degrees` in a `ConceptMotif` are semitone offsets from the mode's tonic, not
 * indices into a diatonic ladder. The authored content settles this: a major
 * triad is [0, 4, 7], the overtone series climbs past 24, and Cantor's diagonal
 * widens by 1, 2, 3, 4. All three are semitone contours.
 *
 * Pure. No Web Audio, no browser, no React.
 */
import type { MotifRegister } from "@/content/castalia/schema";

export const TEMPERAMENTS = Object.freeze(["just", "equal"] as const);
export type TemperamentId = (typeof TEMPERAMENTS)[number];

export interface WorldMode {
  readonly id: string;
  readonly name: string;
  readonly temperament: TemperamentId;
  /** Frequency of degree 0 in the `mid` register, in Hz. */
  readonly tonicHz: number;
  /** Octave displacement per register, relative to `mid`. */
  readonly registerOctave: Readonly<Record<MotifRegister, number>>;
  /** Semitone classes the mode treats as ground. Contains 0. */
  readonly stable: readonly number[];
  /** Semitone classes the mode treats as tense. Never empty. */
  readonly tense: readonly number[];
}

/**
 * Five-limit just ratios for the twelve semitone classes. The tritone is 45/32
 * (the "just" augmented fourth) rather than 7/5, because 45/32 keeps the tense
 * classes derived from the same 5-limit lattice as the stable ones — the
 * dissonance belongs to the mode rather than arriving from outside it.
 */
const JUST_RATIOS: readonly number[] = Object.freeze([
  1, // unison
  16 / 15, // minor second
  9 / 8, // major second
  6 / 5, // minor third
  5 / 4, // major third
  4 / 3, // perfect fourth
  45 / 32, // tritone
  3 / 2, // perfect fifth
  8 / 5, // minor sixth
  5 / 3, // major sixth
  9 / 5, // minor seventh
  15 / 8, // major seventh
]);

export const REGISTER_ORDER: readonly MotifRegister[] = Object.freeze([
  "sub",
  "low",
  "mid",
  "high",
  "air",
]);

/** C3, from A4 = 440. Written as a computation so the reference is visible. */
const C3_HZ = 440 * Math.pow(2, (48 - 69) / 12);

/** Hearing bounds. A motif that climbs out of the band is folded, never clipped. */
const MIN_AUDIBLE_HZ = 24;
const MAX_AUDIBLE_HZ = 11000;

export const CASTALIA_MODE: WorldMode = Object.freeze({
  id: "castalia.just-c",
  name: "Castalia",
  temperament: "just",
  tonicHz: C3_HZ,
  registerOctave: Object.freeze({ sub: -2, low: -1, mid: 0, high: 1, air: 2 }),
  // The fourth is included: in just intonation 4/3 is exact and grounds as
  // firmly as the fifth. The major second is *not* stable — it is the mildest
  // thing a suspension can be built from, and a mode needs one of those.
  stable: Object.freeze([0, 3, 4, 5, 7, 8, 9]),
  tense: Object.freeze([1, 2, 6, 10, 11]),
});

/** Semitone class of a degree, always in 0–11. */
export function pitchClass(degree: number): number {
  return ((Math.round(degree) % 12) + 12) % 12;
}

/** Unordered interval class between two degrees, always in 0–11. */
export function intervalClass(a: number, b: number): number {
  return pitchClass(Math.round(b) - Math.round(a));
}

export function ratioForClass(mode: WorldMode, semitone: number): number {
  const index = pitchClass(semitone);
  return mode.temperament === "just"
    ? JUST_RATIOS[index]
    : Math.pow(2, index / 12);
}

export function registerIndex(register: MotifRegister): number {
  const index = REGISTER_ORDER.indexOf(register);
  return index < 0 ? 2 : index;
}

export function registerAt(index: number): MotifRegister {
  const clamped = Math.min(
    REGISTER_ORDER.length - 1,
    Math.max(0, Math.round(index))
  );
  return REGISTER_ORDER[clamped];
}

/** Move a register up or down the ladder, saturating at the ends. */
export function shiftRegister(
  register: MotifRegister,
  steps: number
): MotifRegister {
  return registerAt(registerIndex(register) + steps);
}

/**
 * Resolve a motif degree in a register to a frequency.
 *
 * Degrees beyond an octave carry their own octave displacement, so [0, 12, 19]
 * spans two octaves from one register anchor rather than wrapping back on
 * itself. The result is folded by octaves — never clamped — if it leaves the
 * audible band, so an extreme degree changes register instead of losing its
 * interval identity.
 */
export function degreeFrequency(
  mode: WorldMode,
  degree: number,
  register: MotifRegister
): number {
  const rounded = Math.round(degree);
  const octaveFromDegree = Math.floor(rounded / 12);
  const octaves = mode.registerOctave[register] + octaveFromDegree;
  let hz = mode.tonicHz * Math.pow(2, octaves) * ratioForClass(mode, rounded);
  while (hz > MAX_AUDIBLE_HZ) hz /= 2;
  while (hz < MIN_AUDIBLE_HZ) hz *= 2;
  return hz;
}

/** Apply a cents offset to a frequency. */
export function transposeCents(hz: number, cents: number): number {
  return hz * Math.pow(2, cents / 1200);
}

export function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(b / a);
}

/** The amplitude-modulation rate two summed frequencies produce, in Hz. */
export function beatingHzBetween(a: number, b: number): number {
  return Math.abs(a - b);
}

/**
 * The cents offset that makes a doubled voice beat against its twin at exactly
 * `beatHz`. This is the one place a beat rate is turned into a tuning, so it is
 * the one place the CAV-007 band has to be respected — callers clamp first.
 */
export function centsForBeatingHz(hz: number, beatHz: number): number {
  if (hz <= 0) return 0;
  return 1200 * Math.log2((hz + beatHz) / hz);
}

export function isStable(mode: WorldMode, semitone: number): boolean {
  return mode.stable.includes(pitchClass(semitone));
}

export function isTense(mode: WorldMode, semitone: number): boolean {
  return mode.tense.includes(pitchClass(semitone));
}

/**
 * The nearest stable degree at or below `degree`'s own octave — used where a
 * line has to close. Ties resolve downward, so closing settles rather than
 * rises.
 */
export function nearestStableDegree(mode: WorldMode, degree: number): number {
  const rounded = Math.round(degree);
  if (isStable(mode, rounded)) return rounded;
  const base = Math.floor(rounded / 12) * 12;
  const target = pitchClass(rounded);
  let best = mode.stable[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of mode.stable) {
    const distance = Math.abs(candidate - target);
    if (distance < bestDistance || (distance === bestDistance && candidate < best)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return base + best;
}

/**
 * The nearest tense degree to `degree`. Used where a line must *not* close:
 * an Open Thread ends on an unresolved degree (CAV-006) rather than fading out
 * on the tonic and sounding finished.
 */
export function nearestTenseDegree(mode: WorldMode, degree: number): number {
  const rounded = Math.round(degree);
  if (isTense(mode, rounded)) return rounded;
  const base = Math.floor(rounded / 12) * 12;
  const target = pitchClass(rounded);
  let best = mode.tense[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of mode.tense) {
    const distance = Math.abs(candidate - target);
    if (distance < bestDistance || (distance === bestDistance && candidate < best)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return base + best;
}
