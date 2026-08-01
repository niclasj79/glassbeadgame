import { presentationNow } from "../testMode";
import { createCueBus } from "./createCueBus";

/**
 * The production bus.
 *
 * Its clock is `presentationNow()` in seconds, which is `performance.now()` in
 * ordinary play and the controlled test clock under `?testMode=1`. That single
 * substitution is what makes cue phrasing assertable in the browser suite: a
 * test can advance time and watch a plan resolve without waiting in real
 * seconds, and without the directors knowing anything changed.
 *
 * Ticking is owned by the render loop (see the scene's frame driver) rather
 * than by a timer here, so cues can never drift from the frame that dresses
 * them.
 */
export const cueBus = createCueBus({ now: () => presentationNow() / 1000 });
