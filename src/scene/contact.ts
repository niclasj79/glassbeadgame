import { COMFORT } from "@/audio/comfort";
import { SEPARATION_CLEARANCE } from "./salience";

/**
 * WHEN TWO BEADS MEET.
 *
 * `separateOnScreen` already knows when two beads would read as one: it
 * measures the gap between their drawn discs and pushes them apart. What it
 * does not do is notice the *moment* the gap closes, and that moment is a
 * physical event — two pieces of glass touching — that the world has always
 * performed silently.
 *
 * This finds those moments. It is deliberately a separate pass rather than a
 * hook inside the separation loop: that loop runs several relaxation passes per
 * frame and reports a running count, so a rising edge detected inside it would
 * fire once per pass, and threading contact state through it would put a
 * presentation concern inside a layout law. At twelve beads a second pass is
 * sixty-six comparisons, which is nothing.
 *
 * IT MEASURES THE UNPUSHED POSITIONS. The push is the *response* to the
 * collision; if contact were detected after it, the separation would have
 * already resolved the overlap it is supposed to be reporting, and hard hits
 * would read as soft ones.
 *
 * NOTHING HERE IS DURABLE, AND NOTHING HERE IS A CUE. A contact is incidental —
 * it happens because the camera turned, not because the player said anything —
 * so it carries no meaning, publishes no event, and has no caption. ADR-009
 * stages *semantic* events through the cue bus; putting this on it would force
 * every caption surface to learn to ignore a cue type, and would tell a screen
 * reader about something that means nothing.
 */

/** One meeting, as the synthesiser needs it. */
export interface BeadContact {
  readonly a: number;
  readonly b: number;
  /**
   * 0–1. How hard, from closing speed measured against the pair's own size, so
   * that a large pair drifting together slowly and a small pair snapping shut
   * are judged on the same scale.
   */
  readonly strength: number;
  /** Combined drawn radius, in the same screen units the anchors use. */
  readonly size: number;
  /** Where it happened, -1 to 1 across the frame. Becomes stereo position. */
  readonly pan: number;
}

/**
 * Per-pair memory. Two flat arrays over the upper triangle, so there is no
 * allocation per frame and no map lookup in the inner loop.
 */
export interface ContactTracker {
  /** Gap between the discs on the previous frame, in screen units. */
  readonly previousGap: Float32Array;
  /** When each pair last sounded, on the presentation clock. */
  readonly lastSoundedAt: Float32Array;
  /** How many beads the arrays were sized for. */
  count: number;
  /** When anything last sounded, so the global rate limit is one comparison. */
  lastAnySoundAt: number;
}

const pairs = (count: number): number => (count * (count - 1)) / 2;

/** Index of pair (i, j), i < j, in the upper triangle. */
export function pairIndex(i: number, j: number, count: number): number {
  return (i * (2 * count - i - 1)) / 2 + (j - i - 1);
}

export function createContactTracker(count = 0): ContactTracker {
  return {
    /*
     * NaN means "no measurement", and it is deliberately not +Infinity. An
     * infinite previous gap compares as "was clear" against anything, so a pair
     * that goes off screen overlapping and comes back overlapping would be
     * reported as a fresh strike at full strength. NaN fails every comparison,
     * which is exactly the wanted behaviour: one frame of silence to re-measure.
     */
    previousGap: new Float32Array(pairs(count)).fill(Number.NaN),
    /*
     * Negative infinity, not zero. Both cooldowns are expressed as "now minus
     * then", so a zero here means nothing may sound until the presentation
     * clock has passed the cooldown — silencing the opening of every session,
     * and silencing the tests entirely, which is how it was found.
     */
    lastSoundedAt: new Float32Array(pairs(count)).fill(Number.NEGATIVE_INFINITY),
    count,
    lastAnySoundAt: Number.NEGATIVE_INFINITY,
  };
}

/**
 * A new draw is a new set of beads, and a stale gap would report a contact that
 * never happened on the first frame after it. Returns a tracker sized to
 * `count`, reusing the one given when it already fits.
 */
export function resizeContactTracker(
  tracker: ContactTracker,
  count: number
): ContactTracker {
  if (tracker.count === count) return tracker;
  return createContactTracker(count);
}

export interface ContactInputs {
  /** Screen anchors, x/y interleaved, BEFORE separation is applied. */
  readonly anchor: ArrayLike<number>;
  /** Drawn radius per bead, in the same units. */
  readonly radius: ArrayLike<number>;
  /** Non-zero where a bead is off screen or behind the camera. */
  readonly hidden: ArrayLike<number>;
  readonly count: number;
  /** Seconds since the previous frame. */
  readonly dt: number;
  /** Presentation clock, in milliseconds. */
  readonly nowMs: number;
}

/**
 * Every contact that began on this frame, loudest first, already limited to
 * what CAV-007 allows to be heard at once.
 *
 * Mutates `tracker`. Returns a fresh array, which is at most
 * `COMFORT.contact.maxPerFrame` long and is usually empty — the allocation is
 * bounded and only happens on frames where something actually touched.
 */
export function detectContacts(
  tracker: ContactTracker,
  inputs: ContactInputs
): readonly BeadContact[] {
  const { anchor, radius, hidden, count, dt, nowMs } = inputs;
  if (count !== tracker.count || count < 2 || dt <= 0) return EMPTY;

  const { previousGap, lastSoundedAt } = tracker;
  const bounds = COMFORT.contact;
  let found: BeadContact[] | null = null;

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const p = pairIndex(i, j, count);

      // A pair with either end off screen has no measurable gap. Forget it
      // rather than remembering a stale one, so its return is not a collision.
      if (hidden[i] > 0 || hidden[j] > 0) {
        previousGap[p] = Number.NaN;
        continue;
      }

      const touching = (radius[i] + radius[j]) * (1 + SEPARATION_CLEARANCE);
      const dx = anchor[j * 2] - anchor[i * 2];
      const dy = anchor[j * 2 + 1] - anchor[i * 2 + 1];
      const gap = Math.hypot(dx, dy) - touching;
      const wasClear = previousGap[p];
      previousGap[p] = gap;

      // The rising edge, and only the rising edge: a pair that is already
      // touching is being held apart, not struck.
      if (!(wasClear > 0 && gap <= 0)) continue;

      // Speed is measured in pair-radii per second so size does not decide
      // loudness on its own — it decides pitch, further down.
      const closed = wasClear - gap;
      const speed = closed / dt / Math.max(1e-6, touching);
      if (speed < bounds.minClosingSpeed) continue;

      if (nowMs - lastSoundedAt[p] < bounds.pairCooldownMs) continue;

      const span = bounds.fullClosingSpeed - bounds.minClosingSpeed;
      const strength = Math.min(1, (speed - bounds.minClosingSpeed) / span);
      const midX = (anchor[i * 2] + anchor[j * 2]) / 2;

      (found ??= []).push({
        a: i,
        b: j,
        strength,
        size: radius[i] + radius[j],
        pan: Math.max(-1, Math.min(1, midX)),
      });
    }
  }

  if (found === null) return EMPTY;

  // The loudest few, and never more often than the envelope allows. Sorting
  // before limiting matters: taking the first two found would let index order
  // decide which collision is heard.
  found.sort((left, right) => right.strength - left.strength);

  const heard: BeadContact[] = [];
  let clock = tracker.lastAnySoundAt;
  for (const contact of found) {
    if (heard.length >= bounds.maxPerFrame) break;
    if (nowMs - clock < bounds.minIntervalMs) break;
    heard.push(contact);
    lastSoundedAt[pairIndex(contact.a, contact.b, count)] = nowMs;
    clock = nowMs;
  }
  if (heard.length > 0) tracker.lastAnySoundAt = nowMs;
  return heard;
}

const EMPTY: readonly BeadContact[] = Object.freeze([]);
