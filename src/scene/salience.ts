/**
 * THE FOCAL HIERARCHY
 *
 * Measured on the shipped build: the three brightest objects in an arena frame
 * were whichever beads happened to carry gold sigils, and across three seeds the
 * first-read target changed at random. A frame whose loudest element is decided
 * by the draw is a frame nobody authored — and worse, it quietly told the player
 * that the four gilded concepts were the important ones, which is the Game
 * nominating ideas on the player's behalf.
 *
 * What replaced it is a rendering-level hierarchy that knows nothing about
 * content. Every bead is put in one of three tiers by **where it stands in the
 * room**, and the tier — not the sigil, not the gold, not how woven it is —
 * decides how much rim energy it gathers, whether it keeps a specular highlight,
 * how hard it sits on its own shadow, and how much of the room's haze stands
 * between it and the eye.
 *
 *   NEAR   at most two beads in any frame. Full rim, full specular, a contact
 *          shadow under it, its label at full weight. This is the first read,
 *          and there is never a crowd of it.
 *   MID    the working body of the frame. Rim and label held back.
 *   FAR    no specular at all, and the room's haze in front of it. It is
 *          legible; it is not competing.
 *
 * TWO THINGS THIS MUST NOT DO, and both are tested:
 *
 *   It must not become colour-only meaning. Tier is *value*, contrast and
 *   sharpness — every one of which survives a monochrome print — and it is
 *   orthogonal to ink, which is what carries faculty.
 *
 *   It must not make gilded concepts better. Nothing here reads a sigil. The
 *   only thing that promotes a bead out of turn is the player's own attention,
 *   which is not content: a bead the player has reached for is by definition
 *   the subject of the frame.
 *
 * Pure and allocation-free: the caller owns every array, and the ranking is an
 * insertion sort over at most a couple of dozen beads.
 */

/**
 * The most beads that may be at maximum salience at once.
 *
 * Two, not three, and never "however many are close". A frame with four equally
 * loud objects has no first read, which is the defect this exists to fix.
 */
export const NEAR_CAP = 2;

/** How much of the draw sits in the middle tier, once the near tier is taken. */
export const MID_FRACTION = 0.4;

/** The three tiers, as the value the material actually reads. */
export const TIER_FAR = 0;
export const TIER_MID = 0.5;
export const TIER_NEAR = 1;

/**
 * How the material spends a tier. Emitted as GLSL from these same numbers by
 * `scene/glass.ts`, so the shader cannot drift from what is asserted here.
 */
export interface TierWeights {
  /** Multiplier on the rim gather — the strongest "this is glass" cue. */
  readonly rim: number;
  /** Multiplier on the specular highlight. Far beads lose it outright. */
  readonly specular: number;
  /** How much of the room's haze stands in front of the bead. */
  readonly haze: number;
  /** How hard the bead sits on its own shadow. */
  readonly contact: number;
  /** Multiplier on the label's opacity. */
  readonly label: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The weights for a tier value, which is continuous because the frame loop eases
 * between tiers rather than cutting — a bead that changes rank as the camera
 * turns must not pop.
 */
export function tierWeights(tier: number): TierWeights {
  const t = clamp01(tier);
  return {
    rim: lerp(0.52, 1, t),
    specular: lerp(0, 1, clamp01((t - 0.25) / 0.75)),
    haze: lerp(0.26, 0, t),
    contact: lerp(0.05, 0.34, t),
    label: lerp(0.5, 1, t),
  };
}

/**
 * Rank the draw and write one tier value per bead.
 *
 * `depth` is the distance from the eye — smaller is nearer. `promoted` is 1 for
 * a bead the player is working with; those are ranked ahead of everything else,
 * because attention is the subject of the frame and the frame should say so.
 *
 * `order` is scratch the caller owns, at least `count` long. Nothing allocates.
 */
export function assignSalience(
  depth: ArrayLike<number>,
  promoted: ArrayLike<number>,
  count: number,
  order: Int32Array,
  out: Float32Array
): void {
  if (count <= 0) return;

  // Insertion sort: promoted first, then nearest first. At two dozen beads this
  // is a few hundred comparisons and no allocation, and it is stable, which
  // matters — an unstable sort makes two equidistant beads trade the near tier
  // back and forth every frame.
  for (let i = 0; i < count; i++) {
    let j = i - 1;
    const candidate = i;
    while (j >= 0 && after(order[j], candidate, depth, promoted)) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = candidate;
  }

  const near = Math.min(NEAR_CAP, count);
  const mid = near + Math.round((count - near) * MID_FRACTION);
  for (let rank = 0; rank < count; rank++) {
    const index = order[rank];
    out[index] = rank < near ? TIER_NEAR : rank < mid ? TIER_MID : TIER_FAR;
  }
}

/** True when `a` should be ranked behind `b`. */
function after(
  a: number,
  b: number,
  depth: ArrayLike<number>,
  promoted: ArrayLike<number>
): boolean {
  const pa = promoted[a] > 0 ? 1 : 0;
  const pb = promoted[b] > 0 ? 1 : 0;
  if (pa !== pb) return pa < pb;
  return depth[a] > depth[b];
}

/** How many beads a draw of this size puts in each tier. Reported for tests. */
export function tierCounts(count: number): {
  readonly near: number;
  readonly mid: number;
  readonly far: number;
} {
  if (count <= 0) return { near: 0, mid: 0, far: 0 };
  const near = Math.min(NEAR_CAP, count);
  const mid = Math.round((count - near) * MID_FRACTION);
  return { near, mid, far: count - near - mid };
}
