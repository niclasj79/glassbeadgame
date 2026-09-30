/**
 * THE HAPTICS DIRECTOR — the fourth channel of ADR-009.
 *
 * Every cue plan in `runtime/cues/planCues.ts` declares `haptics`, and until
 * this existed nothing anywhere in the repository subscribed to it. A contract
 * that advertises a director which never ran is worse than an absent one: it
 * reads as implemented, so nobody looks again.
 *
 * The whole channel is one sentence long, and it is deliberate that it stays
 * that way. This game is contemplative; a phone that buzzes at a player who is
 * thinking is a worse defect than a phone that stays still. So:
 *
 *  - every pattern is *short* — the longest is a single 30 ms tap, and the only
 *    multi-part pattern in the table is the motif, which is three taps under
 *    half a second;
 *  - `attention.enter` and `attention.clear` get nothing at all. They fire on
 *    every glance, and a buzz per glance is a nervous device, not a responsive
 *    one;
 *  - the three epistemic outcomes get the SAME pattern, from the same branch
 *    (CAV-006). Documented, Open Thread and Unresolved differ in resolution,
 *    never in reward, and a longer buzz for a documented relation would teach
 *    the hand what the product refuses to teach the eye;
 *  - nothing repeats, nothing loops, nothing waits on a timer.
 *
 * Pure: it names durations and calls a seam. Whether the device can vibrate,
 * whether the player asked for reduced motion, and whether the browser exposes
 * `navigator.vibrate` all belong to the stage.
 */
import type { PresentationCue } from "../cues";

export interface HapticsStage {
  /**
   * A vibration pattern in milliseconds, alternating on and off, exactly as
   * `navigator.vibrate` reads it. The stage decides whether to honour it.
   */
  readonly vibrate: (patternMs: readonly number[]) => void;
}

export interface HapticsDirector {
  readonly handleCue: (cue: PresentationCue) => void;
}

/**
 * The whole vocabulary, in one table, so that the CAV-006 equality below is
 * readable as an equality rather than as three arrays that happen to match.
 */
export const HAPTIC_PATTERNS = Object.freeze({
  /** Arming: the lightest thing the hand can feel. */
  arm: Object.freeze([8]),
  /** The candidate is caught — a little firmer, so a latch is not a hover. */
  latch: Object.freeze([12]),
  /** The weave lands. */
  woven: Object.freeze([18]),
  /** Every outcome, identically. */
  outcome: Object.freeze([10, 40, 10]),
  /** A motif: three taps, because the *web* said something and not one thread. */
  motif: Object.freeze([12, 60, 12, 60, 12]),
  attunementEnter: Object.freeze([26]),
  attunementExit: Object.freeze([12]),
  conclusion: Object.freeze([30]),
});

export function createHapticsDirector(stage: HapticsStage): HapticsDirector {
  const handleCue = (cue: PresentationCue): void => {
    switch (cue.type) {
      case "attention.enter":
      case "attention.clear":
        // Deliberately silent. See the note above.
        break;

      case "attention.sighted":
      case "thread.reopened":
        // Looking is silent in the hand.
        break;

      case "reading.previewed":
        if (cue.payload.chosen) stage.vibrate(HAPTIC_PATTERNS.arm);
        break;

      case "pair.locked":
        stage.vibrate(HAPTIC_PATTERNS.latch);
        break;

      case "weave.released":
      case "thread.woven":
        stage.vibrate(HAPTIC_PATTERNS.woven);
        break;

      // One branch for all three, on purpose (CAV-006).
      case "outcome.documented":
      case "outcome.open-thread":
      case "outcome.unresolved":
        stage.vibrate(HAPTIC_PATTERNS.outcome);
        break;

      case "motif.completed":
        stage.vibrate(HAPTIC_PATTERNS.motif);
        break;

      case "attunement.changed":
        stage.vibrate(
          cue.payload.active
            ? HAPTIC_PATTERNS.attunementEnter
            : HAPTIC_PATTERNS.attunementExit
        );
        break;

      case "conclusion.perform":
        stage.vibrate(HAPTIC_PATTERNS.conclusion);
        break;

      default:
        break;
    }
  };

  return Object.freeze({ handleCue });
}
