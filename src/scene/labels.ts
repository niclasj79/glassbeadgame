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
 * Pure and allocation-free on the frame path: every array is the caller's.
 */

/** Where a name sits relative to its bead. */
export type LabelSide = "below" | "above" | "right" | "left";

/** The order candidates are tried in. Below first: a caption, not a title. */
export const LABEL_SIDES: readonly LabelSide[] = Object.freeze([
  "below",
  "above",
  "right",
  "left",
]);

/**
 * Encoded placement, one per bead:
 *   -1  suppressed — there was nowhere legible for it to go
 *    0  below   1  above   2  right   3  left
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
    const r = ownRadius[i] + LABEL_CLEARANCE;

    for (let s = 0; s < LABEL_SIDES.length; s++) {
      const dx =
        s === 2 ? r + hx : s === 3 ? -(r + hx) : 0;
      const dy =
        s === 0 ? -(r + hy) : s === 1 ? r + hy : 0;
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
        const toOther = (cx - bx) * (cx - bx) + (cy - by) * (cy - by);
        if (toOther < own) blocked = true;
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
