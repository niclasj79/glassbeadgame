/**
 * THE OPENING
 *
 * Frame-diffed from a CDP screencast of the shipped build, from the instant
 * BEGIN was pressed: 0.3% of pixels changed in the first 808 ms, 2.2% by
 * 2200 ms, and the largest deltas in that whole window were stars twinkling.
 * The title did not begin to dim until about 2.6 seconds after the press.
 *
 * Four things were wrong, and they compounded:
 *
 *   NOTHING ANSWERED THE PRESS. `startSession` builds a draw, resets three
 *   stores, and mounts the entire arena — materials, shaders, a font — all
 *   synchronously on the click. The browser cannot paint until that returns, so
 *   the first honest frame after the press was already hundreds of milliseconds
 *   late. The fix is not to make it faster; it is to *paint the acknowledgement
 *   first* and do the work on the other side of it.
 *
 *   THE MOVE HAD NOTHING TO ACT ON. The armillary did not exist until a session
 *   did, so the camera moved through an empty sky. A dolly with no parallax is
 *   not a move; it is a change of numbers.
 *
 *   THE MOVE HAD NO AZIMUTH. (0, 0.5, 15.2) to (0, 0.85, 10.4) is a pure axial
 *   dolly. Even with something to look at, a straight push-in is the one camera
 *   move a viewer is worst at perceiving. The instrument now stands turned away
 *   and swings into view: the lattice assembles rather than fading up.
 *
 *   THE PHASES QUEUED. `AnimatePresence mode="wait"` held the arena's chrome
 *   until the title had finished leaving, so the two halves of one gesture were
 *   played one after the other instead of through each other.
 *
 * The numbers live here, out of both components, because the departure of the
 * type and the arrival of the camera are one move and have to be phrased
 * together.
 */

/**
 * The longest a press may go unanswered before the player believes it missed.
 *
 * This is not a performance budget for the work — it is the deadline for the
 * *acknowledgement*, which is why the work is deliberately deferred behind a
 * paint rather than optimised.
 *
 * The operational form of it, and the one that can actually be held to on any
 * hardware, is `ACKNOWLEDGE_FRAMES`: the press is answered on the next frame
 * the browser paints, whenever that is. At 60 Hz that is inside 34 ms. On the
 * software renderer the capture harness uses — measured at 2.7–3.5 fps — one
 * frame is 285–365 ms, and no amount of correctness can beat it.
 */
export const ACKNOWLEDGE_MS = 120;

/** Painted frames the acknowledgement may take. Two: the press, and the answer. */
export const ACKNOWLEDGE_FRAMES = 2;

/**
 * THE ACKNOWLEDGEMENT IS AN ANIMATION, NOT A TRANSITION — AND IT ANSWERS THE
 * PRESS, NOT THE RELEASE.
 *
 * Traced on the running build, from `pointerdown` on BEGIN, at both quality
 * tiers:
 *
 *     0 ms    pointerdown
 *     4 ms    frame painted — the rule is still `scaleX(0)`, opacity 0
 *   227 ms    pointerup, then click; the style write finally lands
 *   236 ms    frame painted — computed transform still `scaleX(0)`
 *   467 ms    frame painted — computed transform still `scaleX(0)`
 *   860 ms    the rule is at last visibly moving
 *
 * Two separate faults, and each alone would have lost the press. The
 * acknowledgement hung off `click`, which cannot fire until the finger comes
 * *up* — a fifth of a second gone before anything had even been asked for. And
 * what it then asked for was a CSS **transition**, which is started by the main
 * thread during a rendering update: the same main thread `startSession` takes
 * for the whole of the arena build. Two painted frames went by with the style
 * committed and the transition not yet begun.
 *
 * Both are answered by issuing the acknowledgement imperatively from
 * `pointerdown` with `Element.animate()`. A Web Animation on `transform` and
 * `opacity` is handed to the compositor and timed from its own start, so it is
 * running before the draw is built and keeps running while the draw is built.
 */

/** How long the rule under the door takes to be struck, in milliseconds. */
export const STRIKE_MS = 460;
/** How long it takes to come up to full strength. Shorter: light, then travel. */
export const STRIKE_FADE_MS = 220;
/** The strike's curve — fast away from the press, long settle. */
export const STRIKE_EASING = "cubic-bezier(.22,1,.36,1)";
/** The title block's own curve, shared with the per-line departure below. */
export const DEPARTURE_EASING = "cubic-bezier(.32,0,.24,1)";
/** How far the whole block lifts as the acknowledgement, in rem. */
export const ACKNOWLEDGE_LIFT_REM = 1.1;
/** And how much it grows, as though it had begun to pass the lens. */
export const ACKNOWLEDGE_SCALE = 1.014;

/**
 * How far round the instrument stands before the press, in radians. A third of
 * a right angle: enough that the near colure crosses the frame during the move
 * and the lattice visibly assembles, and not so much that the arena arrives
 * from somewhere the player was not looking.
 */
export const TITLE_AZIMUTH = 0.52;

/** How much higher the title stands than the rest pose. */
export const TITLE_ELEVATION = 0.2;

/** And how much further out, as a multiple of the composed rest distance. */
export const TITLE_DOLLY = 1.34;

/** The rest pose's elevation, landscape and portrait. */
export const HOME_ELEVATION = 0.084;
export const HOME_ELEVATION_PORTRAIT = 0.038;

/**
 * THE TYPE IS CARRIED OUT BY THE MOVE.
 *
 * The title used to dissolve — one opacity ramp on the whole block, which reads
 * as the page being switched off rather than as the player being taken
 * somewhere. Each line now leaves along the same axis the camera is travelling,
 * lifted and scaled a little as though it were passing the lens, and the lines
 * leave in order from the top so the block *unthreads* instead of vanishing.
 *
 * The first line starts moving on the frame the press is painted, which is what
 * puts the acknowledgement inside `ACKNOWLEDGE_MS`.
 */
export const OPENING_STAGGER_MS = 42;
export const OPENING_DURATION_MS = 820;

export interface OpeningStep {
  /** Seconds before this line starts to move. Zero for the first. */
  readonly delay: number;
  /** Seconds the line takes to leave. */
  readonly duration: number;
  /** How far up the frame it is carried, in rem. */
  readonly lift: number;
  /** How much it grows as it passes the lens. */
  readonly scale: number;
}

/** The number of lines the title block leaves in. */
export const OPENING_LINES = 5;

export function openingStep(index: number): OpeningStep {
  const i = Math.max(0, Math.min(OPENING_LINES - 1, Math.round(index)));
  return {
    delay: (i * OPENING_STAGGER_MS) / 1000,
    duration: OPENING_DURATION_MS / 1000,
    // The block unthreads: the epigraph goes furthest, the door goes least, so
    // the type opens away from the instrument arriving behind it.
    lift: 3.4 - i * 0.45,
    scale: 1 + (OPENING_LINES - i) * 0.012,
  };
}

/**
 * How long after the press the frame first changes, in milliseconds. The
 * acknowledgement is the first line beginning to move, and it must land inside
 * `ACKNOWLEDGE_MS` — not the whole departure, and certainly not the session.
 */
export function acknowledgementMs(): number {
  return openingStep(0).delay * 1000;
}
