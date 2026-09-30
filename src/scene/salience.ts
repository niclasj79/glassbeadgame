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
 * ATTENTION HAS AN ORDER (I-017).
 *
 * The focus view names up to two beads as the subject of the frame — the
 * attended bead, and the second one: settled under the lens, locked as the
 * pair, or the other end of a reopened thread. A hover, a keyboard focus or
 * the lens passing over a bead is attention too, but lesser. So promotion is a
 * level, not a flag: the near tier's two places go to the attended bead and
 * then the second, whatever else is nearer the eye, and only then to anything
 * else the player is looking at.
 *
 * Still nothing here reads a band, a sigil or a documented flag. The only
 * thing in the focus view that answers to the bands is the fog's clarity
 * (`focusFog.ts`); the hierarchy answers to attention and to depth alone.
 */
export const PROMOTE_NOTICED = 1;
export const PROMOTE_SECOND = 2;
export const PROMOTE_ATTENDED = 3;

/** The promotion level for a bead in these roles. The strongest role wins. */
export function promotionFor(
  attended: boolean,
  second: boolean,
  noticed: boolean
): number {
  if (attended) return PROMOTE_ATTENDED;
  if (second) return PROMOTE_SECOND;
  return noticed ? PROMOTE_NOTICED : 0;
}

/**
 * Rank the draw and write one tier value per bead.
 *
 * `depth` is the distance from the eye — smaller is nearer. `promoted` is the
 * bead's promotion level (`promotionFor`), 0 for a bead nobody is attending to;
 * promoted beads are ranked ahead of everything else, higher levels first,
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

  // Insertion sort: the most promoted first, then nearest first. At two dozen
  // beads this is a few hundred comparisons and no allocation, and it is
  // stable, which matters — an unstable sort makes two equidistant beads trade
  // the near tier back and forth every frame.
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
  const pa = promoted[a] > 0 ? promoted[a] : 0;
  const pb = promoted[b] > 0 ? promoted[b] : 0;
  if (pa !== pb) return pa < pb;
  return depth[a] > depth[b];
}

/* ────────────────────────────────────────────────────────────────────── *
 * TWO BEADS MAY NOT READ AS ONE
 * ────────────────────────────────────────────────────────────────────── */

/**
 * THE DRAW IS A SET OF CONCEPTS, AND EVERY ONE OF THEM MUST BE IN THE DRAWING.
 *
 * Measured on the running build at the composed home pose, seed
 * castalia-golden-001: Coupled Pendulums and Diffraction stood **19.7 px apart
 * on a 1280x720 frame** — 17.8 px at 1024x768, 18.5 px at 768x900, 24.6 px at
 * 1600x900 — with a drawn bead radius of about 19 px. Two beads inside one
 * silhouette. The occluded one carried no name (its label had nowhere to go),
 * and the near one's hit sphere stood in front of it, so it could not be
 * pointed at either. A bead the player cannot reach is a concept removed from
 * the Game without saying so, and it happened on the *first frame of every
 * session* because the armillary's positions are fixed and so is the home pose.
 *
 * The layout module already keeps this law on the Lens plane — "two beads
 * closer than this read as one bead" (`game/layout.ts`) — but it can only keep
 * it in the plane it lays out. Depth is what breaks it: two beads a long way
 * apart in the world fall on the same ray, and no arrangement of a sphere
 * avoids that from every angle.
 *
 * So the law is kept where the collision actually happens: on the screen. Each
 * frame, any two beads whose drawn silhouettes overlap are eased apart along
 * the line between them, **both by the same amount** — neither of them is the
 * real one — and by the smallest displacement that separates them. As the
 * camera turns and the pair opens on its own, the displacement relaxes to
 * nothing. Nothing is moved that is not colliding, and nothing moves far: the
 * cap is a little over one bead.
 *
 * Pure and allocation-free: every array is the caller's.
 */

/** Air between two separated silhouettes, as a fraction of their radii. */
export const SEPARATION_CLEARANCE = 0.16;

/**
 * The furthest a bead may be carried from where the layout put it, in bead
 * radii. A displacement larger than this is not decluttering, it is a second
 * layout — and the armillary's geography is something the eye learns.
 */
export const SEPARATION_LIMIT = 1.7;

/**
 * Relaxation sweeps per frame. A pair opens in one; a cluster of three needs
 * several, because opening one pair closes another. Five converges the piles a
 * fibonacci sphere actually produces, and at two dozen beads it is a few
 * hundred comparisons and no allocation.
 */
const SEPARATION_PASSES = 5;

/** The golden angle: a deterministic bearing for beads that coincide exactly. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Push overlapping beads apart in screen space.
 *
 * `anchor` is the projected centre of each bead and `radius` its drawn radius,
 * both in the same isotropic screen units (one unit = half the frame height, x
 * carrying the aspect ratio, so a circle is a circle). `hidden` marks beads
 * that are off the frame or behind the eye.
 *
 * Writes the displacement per bead into `push` (xy interleaved, the caller's
 * array, cleared here) and returns how many pairs were overlapping — which is
 * the number a test can assert has reached zero.
 */
export function separateOnScreen(
  anchor: ArrayLike<number>,
  radius: ArrayLike<number>,
  hidden: ArrayLike<number>,
  count: number,
  push: Float32Array
): number {
  for (let i = 0; i < count * 2; i++) push[i] = 0;
  if (count <= 1) return 0;

  let overlapping = 0;
  for (let pass = 0; pass < SEPARATION_PASSES; pass++) {
    for (let i = 0; i < count; i++) {
      if (hidden[i] > 0) continue;
      for (let j = i + 1; j < count; j++) {
        if (hidden[j] > 0) continue;
        const wanted = (radius[i] + radius[j]) * (1 + SEPARATION_CLEARANCE);
        let dx =
          anchor[j * 2] + push[j * 2] - (anchor[i * 2] + push[i * 2]);
        let dy =
          anchor[j * 2 + 1] + push[j * 2 + 1] - (anchor[i * 2 + 1] + push[i * 2 + 1]);
        let distance = Math.hypot(dx, dy);
        if (distance >= wanted) continue;
        if (pass === 0) overlapping++;
        if (distance < 1e-6) {
          // Exactly coincident: no line between them to push along, so the
          // bearing comes from the pair's own indices and is therefore the
          // same on every frame and in every session.
          const bearing = GOLDEN_ANGLE * (i + 1) + j * 0.5;
          dx = Math.cos(bearing);
          dy = Math.sin(bearing);
          distance = 1;
        }
        const half = (wanted - distance) / (2 * distance);
        push[i * 2] -= dx * half;
        push[i * 2 + 1] -= dy * half;
        push[j * 2] += dx * half;
        push[j * 2 + 1] += dy * half;
      }
    }
  }

  // Nothing is carried further than the cap, whatever the crowd asked for.
  for (let i = 0; i < count; i++) {
    const limit = radius[i] * SEPARATION_LIMIT;
    const x = push[i * 2];
    const y = push[i * 2 + 1];
    const length = Math.hypot(x, y);
    if (length > limit && length > 1e-9) {
      const k = limit / length;
      push[i * 2] = x * k;
      push[i * 2 + 1] = y * k;
    }
  }
  return overlapping;
}

/* ────────────────────────────────────────────────────────────────────── *
 * THE INVITATION
 * ────────────────────────────────────────────────────────────────────── */

/**
 * ONE BEAD REACHES, UNTIL SOMEBODY TOUCHES ONE.
 *
 * Sampled on a fresh profile at 5, 10, 15, 25 and 40 seconds, the arena told a
 * sighted player nothing about what to do: the only text on the screen was the
 * two HUD verbs, every instruction in the build was positioned off the left
 * edge for assistive technology, and hovering a bead grew it by about eight per
 * cent. The world was beautiful and mute.
 *
 * The answer is not a tutorial overlay and not a HUD line — it is the
 * instrument itself. The idle score already chooses one bead every few seconds
 * and gives it light (`scene/idle.ts`, kindling); until the player has touched
 * anything, that same bead also **reaches** — it comes forward while the rest of
 * the draw settles back — so the frame is always making one specific offer, and
 * the offer is a bead. Nothing is written, nothing is named, nothing counts
 * down, and the choice of bead is a function of the clock alone, so the world
 * never nominates an idea on the player's behalf.
 *
 * It resolves on first contact: the first hover, press or focus ends it for the
 * session. An invitation that is still being made after it has been accepted is
 * not an invitation, it is a nag.
 */
export interface InvitationWeights {
  /** Scale multiplier for the bead that is reaching. */
  readonly reach: number;
  /** Scale multiplier for every other bead in the draw. */
  readonly recede: number;
  /** Extra light for the reaching bead, on top of the idle score's own. */
  readonly light: number;
}

/** How far the invited bead comes forward. Well past "did something happen?". */
export const INVITATION_REACH = 0.26;
/** How far the rest of the draw settles back. Deliberately much smaller. */
export const INVITATION_RECEDE = 0.055;

const STILL: InvitationWeights = Object.freeze({
  reach: 1,
  recede: 1,
  light: 0,
});

/**
 * `gain` is the idle score's kindling gain for this moment (0 between events);
 * `unresolved` is 1 until the player's first contact with the draw and eases to
 * 0 afterwards. Both zero out the whole gesture, so the invitation cannot
 * survive being accepted and cannot be seen between kindlings.
 */
export function invitationWeights(
  gain: number,
  unresolved: number
): InvitationWeights {
  const strength = clamp01(gain) * clamp01(unresolved);
  if (strength <= 0) return STILL;
  return {
    reach: 1 + INVITATION_REACH * strength,
    recede: 1 - INVITATION_RECEDE * strength,
    light: strength,
  };
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
