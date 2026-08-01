import { CASTALIA_CONCEPTS } from "@/content/castalia/concepts";

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

/* --------------------------------------------------------- the world's door */

/**
 * THE WORLD IS BUILT WHILE THE PLAYER IS READING.
 *
 * The acknowledgement above answered the press. It did not make the press
 * *work*: measured on a cold profile, headed, on a GTX 1080 Ti, the worst frame
 * gap after the first BEGIN was 2236 ms, 1956 ms and 2140 ms over three cold
 * runs, beginning about 140 ms after the press. In a warm browser process the
 * same press costs 33 ms. So the two seconds are the first-time player's, and
 * nobody else's — which is the one player whose next decision is whether to
 * continue at all.
 *
 * Instrumenting `WebGLRenderingContext` on a cold profile named it exactly.
 * Four programs are linked in answer to the press, and the second of them —
 * the bead glass, whose fragment shader solves a sphere, marches a refracted
 * chord through it and draws an authored figure inside — blocks the main thread
 * for **1914 ms** inside `getProgramInfoLog`. That is three.js, at the first
 * draw, waiting for a link the driver has not finished. Everything else in the
 * press is noise beside it: 29 ms, 8 ms, 27 ms.
 *
 * A link cannot be made cheaper and cannot be split across frames. It can only
 * be moved. `KHR_parallel_shader_compile` lets the driver link on its own
 * thread while the main thread carries on, so the whole build — the glass, the
 * label's derived material, and the glyph atlas the names are drawn from — is
 * started when the title appears and waited for with `compileAsync`, which
 * polls `COMPLETION_STATUS_KHR` instead of blocking on it.
 *
 * And then the door waits for it. A press that cannot be honoured is worse than
 * a door that arrives a second late, and the title has an epigraph to read: the
 * hold is silent, has no progress bar and no spinner, and on any warm load it
 * is not there at all. `ArenaCanvas` builds the world and opens this gate;
 * `TitleScreen` holds the door on it.
 */

/**
 * How long the door will wait for a world that never says it is ready, in
 * milliseconds. This is not a budget — it is the failure case. A gate that can
 * jam is a gate that can lock the player out of the Game entirely, so it opens
 * anyway, and the worst that costs is the freeze this whole mechanism exists to
 * remove.
 *
 * It is deliberately far longer than the wait it is insuring against, because
 * firing early is not a safety net — it is the freeze, back again, on exactly
 * the slow devices that can least afford it. Measured from the title's first
 * paint, cold profile, GTX 1080 Ti: the world was ready in 3.4, 3.7 and 4.8
 * seconds; on a warm load, in 0.85 and 1.3, which is inside the title's own
 * stagger and therefore not a wait at all. Twelve seconds leaves room for a
 * device several times slower than this one and still bounds the pathological
 * case — a font that never arrives, a renderer that never answers.
 */
export const OPENING_DOOR_DEADLINE_MS = 12_000;

/** Where the door falls in the title's own stagger, in seconds. */
export const OPENING_DOOR_DELAY_S = 0.75;

/**
 * EVERY LETTER THE WORLD MAY HAVE TO DRAW.
 *
 * The names are drawn from a signed-distance atlas troika fills a glyph at a
 * time, and a name whose glyphs are not in it yet does not render as nothing —
 * it renders as the wrong pixels. That is what the first live arena frame
 * showed: one bead captioned with garbage, because the atlas was half built
 * when the frame it was read for was drawn.
 *
 * Which names a Game needs is not known until the draw exists, and the draw
 * does not exist until BEGIN is pressed — so the atlas is filled with the whole
 * pack's alphabet instead of one draw's. It is derived rather than written out
 * because the pack has an ö in it, and the next concept added may have
 * something else; a hand-kept list would be wrong the first time it mattered
 * and silently so.
 */
export const OPENING_ALPHABET: string = Array.from(
  new Set(CASTALIA_CONCEPTS.flatMap((concept) => Array.from(concept.name)))
)
  .sort()
  .join("");

type OpeningListener = () => void;

let worldReady = false;
const openingListeners = new Set<OpeningListener>();

/**
 * Whether the world behind the title has been built. One boolean, no payload:
 * there is nothing to report and nothing to draw about it.
 */
export const openingWorld = {
  isReady(): boolean {
    return worldReady;
  },
  /** Idempotent: a canvas that remounts does not re-open an open door. */
  open(): void {
    if (worldReady) return;
    worldReady = true;
    for (const listener of [...openingListeners]) listener();
  },
  subscribe(listener: OpeningListener): () => void {
    openingListeners.add(listener);
    return () => {
      openingListeners.delete(listener);
    };
  },
  /** Tests only. Nothing in the running build ever shuts this again. */
  reset(): void {
    worldReady = false;
    openingListeners.clear();
  },
};
