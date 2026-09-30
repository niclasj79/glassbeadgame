/**
 * THE HARMONY THAT MOVES (ADR-017).
 *
 * The bed used to ground on C and lean to A every third phrase. Its root now
 * walks a cycle of the mode's stable degrees one phrase at a time
 * (`SCORE.harmony.rootCycle`), the pad is a chord of three voices led to the
 * nearest tones of the next chord, and the drone and the pad turn together on
 * the phrase boundary, the old chord releasing over the seconds the new one
 * attacks in.
 *
 * Pure. No Web Audio. The bed reads it from its first slot, so it is in the
 * first load and kept small.
 */
import type { TimbreId } from "@/content/castalia/schema";
import { COMFORT } from "./comfort";
import {
  CASTALIA_MODE,
  intervalClass,
  isStable,
  pitchClass,
  type WorldMode,
} from "./mode";
import { SCORE } from "./score";

/**
 * A chord as three pitch classes of the mode (0–11): the root, its fifth, and
 * one colour. "Fifth" is the root's perfect partner: the fifth above, or where
 * that is a tense degree of the mode, the fifth below (the fourth above).
 */
export type Chord = readonly [root: number, fifth: number, colour: number];

/** The root of a phrase: the cycle walked one phrase at a time, and returned. */
export function rootForPhrase(phraseIndex: number): number {
  const cycle = SCORE.harmony.rootCycle;
  const at = Math.floor(phraseIndex) % cycle.length;
  return cycle[at < 0 ? at + cycle.length : at];
}

/** Colour candidates, as steps above the root: the third before the sixth, major before minor. */
const COLOURS = [4, 3, 9, 8] as const;

/**
 * The chord over a root, by one rule rather than a table.
 *
 * The fifth is the fifth above the root, or where that is tense in the mode
 * (over 7 it would be 2), the fifth below. The colour is the first of the
 * root's major third, minor third, major sixth and minor sixth that is a
 * stable degree of the mode and stands at a stable interval from both the root
 * and the fifth, so no chord holds a tense degree and no two of its voices rub.
 *
 * Over the cycle that gives C–G–E, F–C–A, A–E–C, and G–C–E: the third over
 * every root but 7, which has no stable third and takes its major sixth. (The
 * sixth over 9 is F, a semitone from the E the chord already holds.)
 */
export function chordFor(root: number, mode: WorldMode = CASTALIA_MODE): Chord {
  const r = pitchClass(root);
  const fifth = pitchClass(isStable(mode, r + 7) ? r + 7 : r + 5);
  const colour = COLOURS.map((step) => pitchClass(r + step)).find(
    (tone) =>
      isStable(mode, tone) &&
      isStable(mode, intervalClass(r, tone)) &&
      isStable(mode, intervalClass(fifth, tone))
  );
  // Every stable degree of the Castalia mode finds a colour; a mode that did
  // not would double the root rather than invent a tone.
  return [r, fifth, colour ?? r];
}

/**
 * The pad's first voicing: each tone of the chord at its first degree at or
 * above `floor` (a degree in the pad's register), low to high.
 */
export function voiceChord(chord: Chord, floor: number = SCORE.harmony.padFloor): number[] {
  return chord.map((tone) => floor + pitchClass(tone - floor)).sort((a, b) => a - b);
}

/** Every way to hand three voices three tones. */
const ORDERS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
] as const;

/** The instance of pitch class `tone` nearest to `from`; a tritone away resolves down. */
function nearestInstance(from: number, tone: number): number {
  const up = pitchClass(tone - from);
  return up < 6 ? from + up : from - (12 - up);
}

/**
 * Lead the pad's voices to the next chord: every tone of it taken once, each
 * voice to the nearest instance of the tone it takes, and of the six ways to
 * share the tones out, the one that moves least in all, then the one that
 * moves furthest down (ties settle rather than rise). Voices keep their order.
 */
export function leadVoices(previous: readonly number[], next: Chord): number[] {
  let best: number[] = [...previous];
  let bestMotion = Number.POSITIVE_INFINITY;
  let bestRise = Number.POSITIVE_INFINITY;
  for (const order of ORDERS) {
    const moved = previous.map((from, voice) => nearestInstance(from, next[order[voice]]));
    let motion = 0;
    let rise = 0;
    moved.forEach((to, voice) => {
      motion += Math.abs(to - previous[voice]);
      rise += to - previous[voice];
    });
    if (motion < bestMotion || (motion === bestMotion && rise < bestRise)) {
      best = moved;
      bestMotion = motion;
      bestRise = rise;
    }
  }
  return best;
}

/** The pad over `root`: voiced from the floor the first time, led from `previous` after. */
export function nextVoicing(previous: readonly number[] | null, root: number): number[] {
  const chord = chordFor(root);
  return previous === null ? voiceChord(chord) : leadVoices(previous, chord);
}

/**
 * Whether a concept's identity note stands at a stable interval class from a
 * root: the consonance the cycle promises the concepts (ADR-017).
 */
export function identityIsConsonant(
  identityDegree: number,
  root: number,
  mode: WorldMode = CASTALIA_MODE
): boolean {
  return isStable(mode, intervalClass(root, identityDegree));
}

/**
 * How many slots one strike of the ground holds: the whole phrase, unless the
 * phrase and its crossfade would outlive a voice's lifetime bound, in which
 * case the largest division of the phrase that does not — the ground is then
 * struck again on the same chord inside the phrase rather than cut off by the
 * bound. Castalia's two-second slot holds the phrase (24 s and a 2 s release);
 * a 2.4 s slot would not (28.8 s and 2 s is past 30 s) and strikes every six.
 */
export function groundStrikeSlots(slotSeconds: number): number {
  const { phraseSlots, crossfadeSeconds } = SCORE.harmony;
  for (let slots = phraseSlots; slots > 1; slots -= 1) {
    if (
      phraseSlots % slots === 0 &&
      slots * slotSeconds + crossfadeSeconds <= COMFORT.voice.maxLifetimeSeconds
    ) {
      return slots;
    }
  }
  return 1;
}

/** One voice of the ground, before the bed's scale. Degrees are in the low register. */
export interface GroundVoice {
  readonly timbre: TimbreId;
  readonly degree: number;
  readonly gain: number;
  readonly attack: number;
  readonly hold: number;
  readonly release: number;
}

/**
 * One strike of the ground: the drone on the root, in glass, and the pad's
 * voices, in voice. Everything attacks over the crossfade from the strike and
 * holds until the next strike, where it releases over the same seconds while
 * the next attacks — so the chord turns across the boundary rather than
 * stopping at it.
 */
export function groundStrike(
  root: number,
  pad: readonly number[],
  spanSeconds: number,
  droneGain: number
): readonly GroundVoice[] {
  const fade = SCORE.harmony.crossfadeSeconds;
  const envelope = { attack: fade, hold: Math.max(0, spanSeconds - fade), release: fade };
  return [
    { timbre: "glass", degree: pitchClass(root), gain: droneGain, ...envelope },
    ...pad.map((degree) => ({
      timbre: "voice" as const,
      degree,
      gain: SCORE.harmony.padGain,
      ...envelope,
    })),
  ];
}
