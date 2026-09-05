import type { FacultyId } from "@/content/castalia/schema";

/**
 * THE SKY ANSWERS THE COMPOSITION.
 *
 * DESIGN-REVIEW-SCHELL §4: the idle score was identical at minute one and
 * minute fourteen, and nothing in the world responded to the web's *growth* —
 * only to individual commits. The old world brightness was a progress bar
 * wearing a sky, and removing it was right; but removing a bad rise is not
 * the same as designing a good one.
 *
 * So the firmament assembles. Each of the six authored figures belongs to one
 * of the six pairs of faculties, and its drawn lines become legible as the web
 * joins those two faculties: a picture assembling, not a gauge filling. It
 * cannot be read as a percentage because there is no denominator on screen —
 * a session that never crosses Image and Sound simply never draws the vault,
 * and that is a fact about the composition, not a shortfall.
 *
 * What counts is a thread whose two beads sit in different faculties. Threads
 * inside one faculty draw nothing here, however many there are, and the
 * outcome of a thread is not consulted: a documented crossing and an unlit
 * one join the same two regions (CAV-006). Pure and allocation-light.
 */

/** The six pairs, in the authored figure order (`CONSTELLATIONS`). */
export const FIGURE_FACULTY_PAIRS: readonly (readonly [FacultyId, FacultyId])[] =
  Object.freeze([
    // The armilla: the instrument that measures the heavens.
    Object.freeze(["measure", "matter"] as const),
    // The monochord: its stars sit at the string divisions — ratios, drawn.
    Object.freeze(["measure", "sound"] as const),
    // The vault: the room where what is heard is also seen.
    Object.freeze(["sound", "image"] as const),
    // The dividers: the geometer's compass, the construction of a picture.
    Object.freeze(["measure", "image"] as const),
    // The lens: light made to resolve.
    Object.freeze(["matter", "image"] as const),
    // The balance: weights and strings, a pan that does not agree.
    Object.freeze(["sound", "matter"] as const),
  ]);

export const FIGURE_COUNT = FIGURE_FACULTY_PAIRS.length;

/**
 * How much of a figure is drawn before its faculties have met: enough that the
 * sky is never empty, not enough to read as a figure.
 */
export const FIGURE_BASE = 0.3;

/** Seconds for a figure to come most of the way in once its pair has met. */
export const FIGURE_ASSEMBLY_SECONDS = 4;

const pairKey = (a: FacultyId, b: FacultyId): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

const FIGURE_BY_PAIR: ReadonlyMap<string, number> = new Map(
  FIGURE_FACULTY_PAIRS.map(([a, b], index) => [pairKey(a, b), index])
);

export interface RevealableThread {
  readonly pair: readonly [string, string];
}

/**
 * How legible each figure's lines are, 0..1, in `CONSTELLATIONS` order.
 *
 * One crossing makes a figure readable; further crossings between the same
 * two faculties bring it the rest of the way in, saturating so that a fourth
 * thread adds almost nothing — the sky answers the shape of the web, not its
 * size.
 */
export function figureReveal(
  threads: readonly RevealableThread[],
  facultyOf: (conceptId: string) => FacultyId | undefined
): Float32Array {
  const crossings = new Array<number>(FIGURE_COUNT).fill(0);
  for (const thread of threads) {
    const a = facultyOf(thread.pair[0]);
    const b = facultyOf(thread.pair[1]);
    if (a === undefined || b === undefined || a === b) continue;
    const index = FIGURE_BY_PAIR.get(pairKey(a, b));
    if (index !== undefined) crossings[index] += 1;
  }
  const reveal = new Float32Array(FIGURE_COUNT);
  for (let i = 0; i < FIGURE_COUNT; i++) {
    reveal[i] = crossings[i] === 0 ? 0 : 1 - Math.pow(0.45, crossings[i]);
  }
  return reveal;
}

/** One frame of assembly: each figure eases toward its target, never snapping. */
export function easeReveal(
  current: Float32Array,
  target: Float32Array,
  dtSeconds: number
): void {
  const rate = Math.min(1, Math.max(0, dtSeconds) / FIGURE_ASSEMBLY_SECONDS * 3);
  for (let i = 0; i < current.length && i < target.length; i++) {
    current[i] += (target[i] - current[i]) * rate;
  }
}
