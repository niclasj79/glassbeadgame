import type { SafeArea } from "./framing";

/**
 * WHERE A BEAD'S NAME GOES
 *
 * The names used to hang at a fixed offset below every bead, always, with no
 * knowledge of anything else on the screen. On the shipped build that put
 * "The Crystal Lattice" off the right edge of a 414px phone with its last
 * letter gone, ran "Cantor's Diagonal Argument" across the page's inner ruling,
 * dropped "Coupled Pendulums" through a bead, and stacked "Isorhythm" over
 * "Fibonacci Sequence" — at every viewport, because a fixed offset cannot know
 * that anything is in the way.
 *
 * This is the solver that replaced it. It works entirely in NDC, once per
 * frame, over the two dozen labels a draw actually has, and it decides three
 * things:
 *
 *   WHICH SIDE.   A name is placed below its bead if it can be, and otherwise
 *                 above, right, or left — the first candidate that is inside
 *                 the safe area and clear of every bead and every name already
 *                 placed. Below first because a hanging name reads as a caption
 *                 and a name above a bead reads as a title.
 *
 *   IN WHAT ORDER. Salient beads are placed first, so when the frame is crowded
 *                 the names that survive are the ones on the beads the frame is
 *                 actually about. The old behaviour — first in array order —
 *                 meant the winner was whatever the draw happened to list first.
 *
 *   WHETHER AT ALL. A name with nowhere legible to go is **suppressed**. This is
 *                 the part that matters: a label half off the screen is worse
 *                 than no label, because it tells the player the world is broken
 *                 rather than that this bead is currently crowded. Nothing is
 *                 lost — the name is on the inspect card, in the caption stream,
 *                 and one turn of the arena away.
 *
 * And one law over all three, added after the solver was measured against a
 * real frame rather than a synthetic one:
 *
 *   WHOSE NAME IT IS.  A name is read as belonging to whichever bead it is
 *                 nearest, and nothing else about the drawing says otherwise —
 *                 there is no leader, and there should not be one. On a
 *                 1280x720 frame with the Fibonacci Sequence attended, its own
 *                 name was placed 166 px below it (the attended bead reserves
 *                 the intention plate's radius, not its glass) and landed 73 px
 *                 from Anamorphosis — better than twice as close to a bead that
 *                 is not its own. The frame's one definite subject was
 *                 mislabelled, and a neighbour was given a name it does not
 *                 have. A placement that would do that is now refused, and if
 *                 no side survives the name is suppressed: SILENCE BEATS
 *                 FABRICATED SIGNIFICANCE, and a misattributed name is a
 *                 fabricated fact about the world.
 *
 *                 AND THE ONE NAME IT DOES NOT GOVERN. That law reads a bead as
 *                 a *point*, which is what a bead is — except for the one the
 *                 player is attending, which is drawn as a dial a hundred and
 *                 forty-eight pixels across. Measured as a point it made its own
 *                 reservation unusable: any placement clear of the dial is a
 *                 long way from the bead's centre and a short way from
 *                 everything else, so the law refused all four sides and the
 *                 attended bead lost its name. The arena's answer was to offset
 *                 that name by the glass instead, which put the frame's one
 *                 definite subject *underneath its own instrument* — measured at
 *                 1.5:1 against the dial's ring, while every other name in the
 *                 same frame ran 3.3:1 or better.
 *
 *                 A name on the rim of an instrument is not a floating caption
 *                 competing on proximity: it is that instrument's caption,
 *                 exactly one bead in the frame ever wears one, and the arena
 *                 sets it larger and on a ground of its own so that nothing
 *                 about the drawing leaves it to proximity to say. So a name
 *                 may be declared `anchored` to a drawn form, and the point law
 *                 is waived for that one — and for that one only. Nothing else
 *                 is waived: it must still be inside the page, still clear of
 *                 every bead's own silhouette, still clear of every thread and
 *                 every other name. A bead sitting on the caption still refuses
 *                 it, and it is still suppressed rather than fudged.
 *
 * Pure and allocation-free on the frame path: every array is the caller's.
 */

/** Where a name sits relative to its bead. */
export type LabelSide =
  | "below"
  | "above"
  | "right"
  | "left"
  | "below-right"
  | "below-left";

/**
 * The order candidates are tried in. Below first: a caption, not a title.
 *
 * The two diagonals are offered **only to an anchored name** (see `anchored`
 * below), and they are the lower two because the plate's utility rail stands on
 * the upper ones. A bead is a point, and a caption hung off a point on the
 * diagonal reads as unattached to it — which is why the four cardinals are all
 * an ordinary name is ever given. A dial is a circle, its rim is continuous,
 * and a caption anywhere on that rim is plainly the dial's.
 *
 * It is not a nicety. Measured on a 414x896 phone with a bead attended: the
 * dial is 350 px across on a 414 px page, so *both* horizontal placements leave
 * the page, "above" leaves the top of the safe area, and "below" was taken by
 * two neighbouring beads — the attended bead, the frame's one definite subject,
 * had no name at all. The lower-left diagonal was free, on the page, and clear.
 */
export const LABEL_SIDES: readonly LabelSide[] = Object.freeze([
  "below",
  "above",
  "right",
  "left",
  "below-right",
  "below-left",
]);

/** How many of those any name may use. The rest are the dial's. */
const FLOATING_SIDES = 4;

/**
 * The unit bearing of each side, in the solver's own axes: x across the frame,
 * y up it. Parallel to `LABEL_SIDES`, and flat rather than a table of objects
 * because this is read on the frame path.
 */
const SIDE_BEARING: readonly number[] = Object.freeze([
  0, -1, // below
  0, 1, // above
  1, 0, // right
  -1, 0, // left
  Math.SQRT1_2, -Math.SQRT1_2, // below-right
  -Math.SQRT1_2, -Math.SQRT1_2, // below-left
]);

/**
 * Encoded placement, one per bead:
 *   -1  suppressed — there was nowhere legible for it to go
 *    0  below   1  above   2  right   3  left   4  below-right   5  below-left
 */
export const SUPPRESSED = -1;

export function sideOf(code: number): LabelSide | null {
  return code < 0 ? null : (LABEL_SIDES[code] ?? null);
}

/**
 * The gap a name keeps from a bead, from a rule, and from another name, in NDC.
 * Two labels closer than this are one smudge whatever the design says.
 */
export const LABEL_CLEARANCE = 0.012;

/* ------------------------------------------------ how a name is actually set */

/**
 * HOW LEGIBLE A NAME IS, AND WHICH NAME IS THE MOST LEGIBLE.
 *
 * Measured on the running build at 1280x720 with the Fibonacci Sequence
 * attended, over each name's own box — peak luminance against the ground it is
 * standing on:
 *
 *   Fibonacci Sequence (attended)   peak  86   ground 29   3.0:1
 *   Prime Numbers                   peak 183   ground 15  12.1:1
 *   Coupled Pendulums               peak 210   ground 26   8.1:1
 *   Anamorphosis                    peak 150   ground 15  10.2:1
 *   Entropy                         peak 184   ground 22   8.4:1
 *
 * The lowest peak and the lowest contrast in the frame belonged to the one
 * thing the player had just chosen. It was set at the same size and struck with
 * the same hairline outline as every other name, and it was drawn *inside* the
 * intention dial, so the dial's own engraving was its background.
 *
 * Attending now promotes the name instead, and does it in three registers that
 * all survive a monochrome print: the setting, the ground, and — in
 * `scene/Beads.tsx` — the clearance from the instrument. These live here rather
 * than in the arena because "how a name is set" is the same question as "where
 * a name goes", and a test can hold both.
 */

/** The hairline that keeps an ordinary name off a bright star. */
export const NAME_OUTLINE = 0.008;
export const NAME_OUTLINE_OPACITY = 0.92;

/** How much larger the attended bead's name is set than every other name. */
export const ATTENDED_NAME_SCALE = 1.28;
/**
 * The dark field the attended name is struck on, as a fraction of its em. Not
 * a hairline: a ground, so the name is legible on whatever it stands in front
 * of rather than only on the sky.
 */
export const ATTENDED_NAME_OUTLINE = 0.03;
/** How far that field is feathered, so it is a ground and not a slab. */
export const ATTENDED_NAME_BLUR = 0.018;
/** And it is opaque: a field held at 0.92 is a field the horizon comes through. */
export const ATTENDED_NAME_OUTLINE_OPACITY = 1;

/**
 * How wide the attended name may set before it wraps, in the label's own local
 * units — narrower than every other name, which is the opposite of what a
 * promotion sounds like and is the reason it can be promoted at all.
 *
 * Measured on a 414x896 phone with a bead attended: the dial is 350 px across a
 * 414 px page, and a single-line "Fibonacci Sequence" is about 200 px. There is
 * no side of that dial where a 200 px caption fits on the page, so the promoted
 * name — set larger again — had nowhere legible to go and was suppressed
 * outright. The same name over two lines is 100 px wide and hangs under the
 * plate with room to spare. A caption block is a caption; a caption that has to
 * be a single line is a caption that only exists on a desktop.
 */
export const ATTENDED_NAME_MAX_WIDTH = 0.95;
/** What every other name may set to. Wide: one line is right for a small bead. */
export const NAME_MAX_WIDTH = 2.1;

export interface LabelRequest {
  /** Bead centres in NDC, xy interleaved. */
  readonly anchor: Float32Array;
  /**
   * The radius every *other* name must keep clear of this bead, in NDC. It is
   * not always the glass: an attended bead reserves the whole intention plate,
   * because the plate is what a neighbouring name would actually collide with.
   */
  readonly beadRadius: Float32Array;
  /**
   * The radius a bead's *own* name is offset by, in NDC. Defaults to
   * `beadRadius`, which is right for every bead that draws nothing but its own
   * glass — and wrong for the one that does, which is why the two are separable
   * at all: a bead is not further from its own name because there is an
   * instrument around it, and a name pushed out to the plate's radius reads as
   * belonging to whatever else is out there.
   */
  readonly ownRadius?: Float32Array;
  /**
   * How far the drawn form reaches *between* the cardinal directions, in NDC.
   * Defaults to `ownRadius`, which is right for anything round.
   *
   * A dial is not round. Its four verbs stand on the cardinals with their
   * engraved captions outside them, and its two utility controls stand on the
   * upper diagonals; between all of that there is nothing but the graduated
   * circle itself, which is a third narrower. Reserving the widest reach in
   * every direction is what left a 414 px phone with no room at all: the plate
   * measures 350 px across there, so a name kept 350 px clear on the diagonal
   * as well is a name off the page.
   */
  readonly ownRadiusBetween?: Float32Array;
  /**
   * 1 for a bead whose name is anchored to something the arena actually draws
   * around it — in practice the attended bead's intention dial, and nothing
   * else. Such a name is that instrument's caption rather than a floating one,
   * so the "nearest bead wins" law above does not govern it. Every other
   * clearance still does. Absent means nothing is anchored, which is the law
   * unchanged.
   */
  readonly anchored?: Float32Array;
  /** Half-width and half-height of each name's box, in NDC, xy interleaved. */
  readonly half: Float32Array;
  /** Salience tier per bead — higher is placed first. */
  readonly tier: Float32Array;
  /** 1 when the bead is behind the camera or off the frame entirely. */
  readonly hidden: Float32Array;
  readonly count: number;
  readonly area: SafeArea;
  /**
   * Committed threads, as screen-space chords: x1, y1, x2, y2 each. A name laid
   * across the player's own composition is the worst of the collisions, because
   * the thread is the thing they made.
   */
  readonly thread?: Float32Array;
  readonly threadCount?: number;
}

export interface LabelScratch {
  /** Placement order, `count` long. */
  readonly order: Int32Array;
  /** Placed boxes: cx, cy, halfX, halfY per placed label. */
  readonly boxes: Float32Array;
}

export function createLabelScratch(count: number): LabelScratch {
  return {
    order: new Int32Array(Math.max(1, count)),
    boxes: new Float32Array(Math.max(1, count) * 4),
  };
}

/**
 * Solve every name's placement. Writes one code per bead into `out` and the
 * chosen offset, in NDC, into `offset` (xy interleaved).
 */
export function placeLabels(
  request: LabelRequest,
  scratch: LabelScratch,
  out: Int32Array,
  offset: Float32Array
): void {
  const { anchor, beadRadius, half, tier, hidden, count, area } = request;
  const ownRadius = request.ownRadius ?? beadRadius;
  const ownBetween = request.ownRadiusBetween ?? ownRadius;
  const anchored = request.anchored;
  if (count <= 0) return;

  // Most salient first, and among equals the nearer the top of the frame — a
  // stable order, so a name does not change sides because two beads tied.
  const order = scratch.order;
  for (let i = 0; i < count; i++) {
    let j = i - 1;
    while (j >= 0 && rankAfter(order[j], i, tier, anchor)) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = i;
  }

  const boxes = scratch.boxes;
  let placed = 0;

  for (let rank = 0; rank < count; rank++) {
    const i = order[rank];
    out[i] = SUPPRESSED;
    offset[i * 2] = 0;
    offset[i * 2 + 1] = 0;
    if (hidden[i] > 0) continue;

    const ax = anchor[i * 2];
    const ay = anchor[i * 2 + 1];
    const hx = half[i * 2];
    const hy = half[i * 2 + 1];
    const cardinal = ownRadius[i] + LABEL_CLEARANCE;
    const between = ownBetween[i] + LABEL_CLEARANCE;
    /** Whether this name is a caption competing on proximity. See above. */
    const floating = !anchored || anchored[i] <= 0;

    const sides = floating ? FLOATING_SIDES : LABEL_SIDES.length;
    /** The best placement found so far, for an anchored name. See below. */
    let bestSide = SUPPRESSED;
    let bestGap = Number.NEGATIVE_INFINITY;
    let bestX = 0;
    let bestY = 0;
    for (let s = 0; s < sides; s++) {
      const ux = SIDE_BEARING[s * 2];
      const uy = SIDE_BEARING[s * 2 + 1];
      // How far along this bearing the box's own nearest edge clears the form
      // drawn around the bead. For a cardinal it is exactly `r + hy` or
      // `r + hx`, which is what this used to be written as; on a diagonal it is
      // the box's support in that direction, so the whole box is outside the
      // circle rather than only its centre.
      const r = s < FLOATING_SIDES ? cardinal : between;
      const reach = r + hx * Math.abs(ux) + hy * Math.abs(uy);
      const dx = ux * reach;
      const dy = uy * reach;
      const cx = ax + dx;
      const cy = ay + dy;
      // How far this placement stands from the bead it belongs to. Squared,
      // because nothing here needs the distance itself.
      const own = dx * dx + dy * dy;

      // Inside the page. A name that crosses the ruling is the defect.
      if (
        cx - hx < area.minX ||
        cx + hx > area.maxX ||
        cy - hy < area.minY ||
        cy + hy > area.maxY
      ) {
        continue;
      }

      // Clear of every bead, including its own neighbours' glass — and nearer
      // to the bead it names than to any of them, or it names the wrong one.
      let blocked = false;
      for (let k = 0; k < count && !blocked; k++) {
        if (k === i || hidden[k] > 0) continue;
        const bx = anchor[k * 2];
        const by = anchor[k * 2 + 1];
        const br = beadRadius[k] + LABEL_CLEARANCE;
        if (Math.abs(cx - bx) < hx + br && Math.abs(cy - by) < hy + br) {
          blocked = true;
          break;
        }
        if (floating) {
          const toOther = (cx - bx) * (cx - bx) + (cy - by) * (cy - by);
          if (toOther < own) blocked = true;
        }
      }
      if (blocked) continue;

      // Clear of the player's own threads.
      const threads = request.threadCount ?? 0;
      const chords = request.thread;
      for (let t = 0; t < threads && !blocked && chords; t++) {
        if (
          segmentCrossesBox(
            chords[t * 4],
            chords[t * 4 + 1],
            chords[t * 4 + 2],
            chords[t * 4 + 3],
            cx,
            cy,
            hx + LABEL_CLEARANCE,
            hy + LABEL_CLEARANCE
          )
        ) {
          blocked = true;
        }
      }
      if (blocked) continue;

      // Clear of every name already placed.
      for (let b = 0; b < placed && !blocked; b++) {
        const ox = boxes[b * 4];
        const oy = boxes[b * 4 + 1];
        const ohx = boxes[b * 4 + 2];
        const ohy = boxes[b * 4 + 3];
        if (
          Math.abs(cx - ox) < hx + ohx + LABEL_CLEARANCE &&
          Math.abs(cy - oy) < hy + ohy + LABEL_CLEARANCE
        ) {
          blocked = true;
        }
      }
      if (blocked) continue;

      // An anchored name does not take the first side that survives, it takes
      // the emptiest. Proximity is waived for it, so proximity is exactly what
      // it should spend a free choice on: of the placements that are legal, the
      // one standing furthest from any other bead is the one nobody has to work
      // out who it belongs to.
      if (!floating) {
        let nearest = Number.POSITIVE_INFINITY;
        for (let k = 0; k < count; k++) {
          if (k === i || hidden[k] > 0) continue;
          const gap =
            Math.hypot(cx - anchor[k * 2], cy - anchor[k * 2 + 1]) -
            beadRadius[k];
          if (gap < nearest) nearest = gap;
        }
        if (nearest <= bestGap) continue;
        bestGap = nearest;
        bestSide = s;
        bestX = cx;
        bestY = cy;
        offset[i * 2] = dx;
        offset[i * 2 + 1] = dy;
        continue;
      }

      out[i] = s;
      offset[i * 2] = dx;
      offset[i * 2 + 1] = dy;
      boxes[placed * 4] = cx;
      boxes[placed * 4 + 1] = cy;
      boxes[placed * 4 + 2] = hx;
      boxes[placed * 4 + 3] = hy;
      placed++;
      break;
    }

    // The anchored name's chosen placement, once every side has been weighed.
    // `offset` already holds it; only the record of it is left to write.
    if (!floating && bestSide !== SUPPRESSED) {
      out[i] = bestSide;
      boxes[placed * 4] = bestX;
      boxes[placed * 4 + 1] = bestY;
      boxes[placed * 4 + 2] = hx;
      boxes[placed * 4 + 3] = hy;
      placed++;
    }
  }
}

/**
 * Does the segment (x1,y1)-(x2,y2) touch the box centred at (cx,cy)?
 *
 * The slab test, clipped to the segment's own parameter range — no allocation,
 * no square roots, and correct for a chord that begins or ends inside the box.
 */
function segmentCrossesBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  hx: number,
  hy: number
): boolean {
  let lo = 0;
  let hi = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (let axis = 0; axis < 2; axis++) {
    const d = axis === 0 ? dx : dy;
    const from = axis === 0 ? x1 - cx : y1 - cy;
    const half = axis === 0 ? hx : hy;
    if (Math.abs(d) < 1e-9) {
      if (Math.abs(from) > half) return false;
      continue;
    }
    let near = (-half - from) / d;
    let far = (half - from) / d;
    if (near > far) [near, far] = [far, near];
    if (near > lo) lo = near;
    if (far < hi) hi = far;
    if (lo > hi) return false;
  }
  return true;
}

function rankAfter(
  a: number,
  b: number,
  tier: Float32Array,
  anchor: Float32Array
): boolean {
  if (tier[a] !== tier[b]) return tier[a] < tier[b];
  return anchor[a * 2 + 1] < anchor[b * 2 + 1];
}
