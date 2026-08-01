/**
 * THE PRODUCTION HAPTICS STAGE — the only file here that knows about a device.
 *
 * Three refusals, all deliberate:
 *
 *  - **Reduced motion silences it entirely.** A vibration is felt in the body,
 *    which is exactly the register the preference is about; `frameState`'s
 *    stage already removes the camera impact for the same reason.
 *  - **No feature detection theatre.** If `navigator.vibrate` is absent — every
 *    desktop browser, and Safari everywhere — nothing happens and nothing is
 *    reported. There is no fallback, because a visual substitute for a
 *    vibration would be a second, unplanned answer to a moment the cue already
 *    answered.
 *  - **A throw is swallowed.** Some engines reject `vibrate` outside a user
 *    gesture. The world must not fall over because a phone declined to buzz.
 */
import { useStore } from "@/state/store";
import type { HapticsStage } from "./createHapticsDirector";

type Vibrator = { vibrate?: (pattern: number | number[]) => boolean };

export const productionHapticsStage: HapticsStage = Object.freeze({
  vibrate: (patternMs: readonly number[]) => {
    if (useStore.getState().settings.reducedMotion) return;
    if (typeof navigator === "undefined") return;
    const vibrate = (navigator as Vibrator).vibrate;
    if (typeof vibrate !== "function") return;
    try {
      vibrate.call(navigator, [...patternMs]);
    } catch {
      // A device that declines is not an error worth propagating.
    }
  },
});
