import type { ResonanceBand } from "@/domain/relations/resonance";
import type { SceneBudget } from "./quality";
import { COMFORT } from "./threadGrammar";

/**
 * THE FOCUS FOG (I-017)
 *
 * On Attend the world dims and softens into fog; the attended bead stays sharp,
 * the lens is a disc of clear air under the pointer, and every other bead glows
 * through the fog by its relation-neutral band — high brightest, weak never
 * below a visible floor — so nothing hides and nothing is nominated.
 *
 * Everything the fog *decides* is here, pure, and tested: how bright a bead of
 * each band is drawn, how fast the fog may come and go, which discs of clear
 * air the frame gets and in what order, and when the softening is withheld.
 * `FocusFogEffect.tsx` only measures the frame and hands these answers to one
 * full-screen pass; it decides nothing of its own.
 *
 * THE LEVEL IS A FRACTION OF ROAMING BRIGHTNESS, MEASURED ABOVE THE GROUND.
 *
 * The fog pulls the world toward the page's own ground — never toward black,
 * which would dye the page darker than its deepest ink — and the world outside
 * every clear disc keeps exactly `FOG_FLOOR` of its roaming brightness. That is
 * what "never below a visible floor" means: a bead in the fog is dimmed and
 * softened, never removed. A bead of level L is drawn at L of its roaming
 * brightness because its disc is given the clarity that lifts it from the
 * floor to L (`clarityForLevel`), and `fogPixel` restates the pass's own
 * arithmetic so a test can hold that promise rather than a screenshot.
 *
 * WHAT THE LEVEL MAY BE MADE OF. The accepted band and nothing else (I-017,
 * CAV-003, CAV-004). There is no argument here that could carry a documented
 * flag, a source count or a fit — which is the point. The lens clears whatever
 * is under it and never ranks or filters: it is presentation of the accepted
 * directional sweep, not a judgement.
 */

/* ────────────────────────────────────────────────────────────────────── *
 * 1. HOW BRIGHT
 * ────────────────────────────────────────────────────────────────────── */

/**
 * The director's initial values, as fractions of roaming brightness: all
 * tunable. They may be retuned freely; they may not fall below the floor, and
 * `fogLevelForBand` will not let them.
 */
export const FOG_LEVELS: Readonly<Record<ResonanceBand, number>> = Object.freeze({
  high: 0.7,
  medium: 0.45,
  weak: 0.25,
});

/**
 * The fog's own depth: the brightness the world keeps outside every clear
 * disc, and therefore the least any bead is ever drawn at. Never lower than
 * 0.2 (M2-012, "Fog and lens").
 */
export const FOG_FLOOR = 0.2;

const clamp01 = (value: number): number =>
  value < 0 ? 0 : value > 1 ? 1 : value;

/**
 * How bright a bead of this band is drawn in the fog, as a fraction of its
 * roaming brightness. A bead with no band — nothing is being sought, as when a
 * committed thread is reopened — stands in the fog at the floor.
 */
export function fogLevelForBand(band: ResonanceBand | null): number {
  const level = band === null ? FOG_FLOOR : FOG_LEVELS[band];
  if (!Number.isFinite(level)) return FOG_FLOOR;
  return level < FOG_FLOOR ? FOG_FLOOR : level > 1 ? 1 : level;
}

/**
 * The clarity a disc needs for its bead to be drawn at `level`: 0 leaves it at
 * the floor, 1 leaves it exactly as it was in clear air.
 */
export function clarityForLevel(level: number): number {
  if (FOG_FLOOR >= 1) return 1;
  return clamp01((level - FOG_FLOOR) / (1 - FOG_FLOOR));
}

/**
 * The one rule: a bead the focus view names as sharp — the attended bead, the
 * sighted or locked second, a reopened pair — is fully clear; every other bead
 * is as clear as its band, and no clearer.
 */
export function fogClarityTarget(sharp: boolean, band: ResonanceBand | null): number {
  return sharp ? 1 : clarityForLevel(fogLevelForBand(band));
}

/**
 * The pass's arithmetic for one channel of one pixel, restated. `blurred` is
 * the softened frame at that pixel, `ground` the page's own ground colour,
 * `amount` the eased fog, `clarity` the strongest clear disc over the pixel and
 * `blur` the eased softening. `FocusFogEffect`'s fragment shader is this, per
 * channel; nothing else touches the colour.
 */
export function fogPixel(
  input: number,
  blurred: number,
  ground: number,
  amount: number,
  clarity: number,
  blur: number
): number {
  const fogged = input + (blurred - input) * blur;
  const dimmed = ground + (fogged - ground) * FOG_FLOOR;
  const veiled = dimmed + (input - dimmed) * clarity;
  return input + (veiled - input) * amount;
}

/* ────────────────────────────────────────────────────────────────────── *
 * 2. WHEN THE SOFTENING IS WITHHELD
 * ────────────────────────────────────────────────────────────────────── */

export interface FogTreatment {
  /**
   * Blur taps compiled into the pass: 0, 9 or 13. 0 is the dim-only fog — the
   * softening is not turned down, it is never compiled.
   */
  readonly blurTaps: number;
}

/**
 * Dim-only under reduced motion and on the engraved tier (I-017). This is the
 * same rule `deriveFocusView` states as `fog.blur`, and a test holds the two
 * together: what the view says and what the pass compiles cannot disagree.
 */
export function fogTreatment(
  budget: Pick<SceneBudget, "fogBlurTaps">,
  reducedMotion: boolean
): FogTreatment {
  if (reducedMotion) return DIM_ONLY;
  const taps = budget.fogBlurTaps;
  if (!(taps > 0)) return DIM_ONLY;
  return taps >= 13 ? THIRTEEN_TAPS : NINE_TAPS;
}

const DIM_ONLY: FogTreatment = Object.freeze({ blurTaps: 0 });
const NINE_TAPS: FogTreatment = Object.freeze({ blurTaps: 9 });
const THIRTEEN_TAPS: FogTreatment = Object.freeze({ blurTaps: 13 });

/** How far the softening reaches, in CSS pixels. Slight, by instruction. */
export const FOG_BLUR_RADIUS_PX = 2.5;

/* ────────────────────────────────────────────────────────────────────── *
 * 3. HOW FAST — CAV-007
 * ────────────────────────────────────────────────────────────────────── */

/**
 * NOTHING IN THE FOG FLICKERS.
 *
 * CAV-007: never a flicker of luminance above 3 Hz, at any amplitude. The fog
 * is not an oscillation — it comes and goes as single, monotone eases — but a
 * step would be a flash, and a flash is the comfort failure the bound exists
 * for. So every change the fog makes is slower than the steepest slope of a
 * full-swing flicker *at* the ceiling: a sinusoid at f hertz changes by at most
 * π·f of its swing per second, and no fog change is allowed to be faster. A
 * change that slow cannot be read as a flicker at or above the ceiling however
 * it is sampled.
 */
export const FOG_MAX_LUMINANCE_RATE = Math.PI * COMFORT.maxLuminanceHz;

/** The fog's arrival and departure: about half a second, eased at both ends. */
export const FOG_EASE_SECONDS = 0.5;

/**
 * The longest a lift may take. After a commit the fog lifts over the commit's
 * own performance (M2-012 "Return"), which the planner bounds at a few
 * seconds; this is the bound on the bound.
 */
export const FOG_LIFT_MAX_SECONDS = 4;

/**
 * The lens follows the hand through a first-order filter whose cutoff *is*
 * the ceiling: a hand that shakes faster than 3 Hz moves the disc of clear air
 * less and less the faster it shakes. Light damping, and never an animation of
 * its own — under reduced motion there is none at all (I-017).
 */
export const LENS_DAMPING_SECONDS = 1 / (2 * Math.PI * COMFORT.maxLuminanceHz);

/** A linear approach, never overshooting. */
export function approach(current: number, target: number, maxStep: number): number {
  const step = maxStep > 0 ? maxStep : 0;
  if (current < target) return current + step >= target ? target : current + step;
  if (current > target) return current - step <= target ? target : current - step;
  return target;
}

const smoothstep01 = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** The fog's own ease: a linear progress, drawn through an S-curve. */
export interface FogEase {
  progress: number;
  amount: number;
}

export function createFogEase(): FogEase {
  return { progress: 0, amount: 0 };
}

/**
 * One frame of the fog coming or going. `seconds` is how long a whole change
 * takes; it may be longer than `FOG_EASE_SECONDS` (the lift after a commit) and
 * never shorter, so the bound above holds whoever calls this.
 */
export function stepFogEase(
  ease: FogEase,
  target: number,
  dt: number,
  seconds: number = FOG_EASE_SECONDS
): number {
  const span = Math.max(FOG_EASE_SECONDS, Number.isFinite(seconds) ? seconds : 0);
  ease.progress = approach(ease.progress, clamp01(target), Math.max(0, dt) / span);
  ease.amount = smoothstep01(ease.progress);
  return ease.amount;
}

/**
 * One frame of a single disc changing its clarity — a bead sighted, a lens
 * arriving. Linear and bounded, so the sweep of a lens across the draw is a
 * succession of eases and never a succession of steps.
 */
export function stepClarity(current: number, target: number, dt: number): number {
  return approach(current, clamp01(target), Math.max(0, dt) / FOG_EASE_SECONDS);
}

/** One frame of the lens following the hand. Instant under reduced motion. */
export function stepLens(
  current: number,
  target: number,
  dt: number,
  reducedMotion: boolean
): number {
  if (reducedMotion) return target;
  const k = 1 - Math.exp(-Math.max(0, dt) / LENS_DAMPING_SECONDS);
  return current + (target - current) * k;
}

/* ────────────────────────────────────────────────────────────────────── *
 * 4. WHERE THE AIR IS CLEAR
 * ────────────────────────────────────────────────────────────────────── */

/**
 * The pass's own space, used by everything below: one unit is the frame's
 * *full* height, x carries the aspect ratio, and y runs up the frame — so a
 * circle is a circle on every page.
 */

/** The most discs one frame may clear, lens aside. A shader array bound. */
export const FOG_MAX_CIRCLES = 24;

/** Below this a disc clears nothing worth drawing. */
export const CLARITY_EPSILON = 1e-3;

/**
 * A bead's disc of clear air, in multiples of its drawn glass radius: fully
 * clear out to its lit rim, fog again past the edge. The soft edge is what
 * lets a disc arrive and leave without a line.
 */
export const BEAD_CLEAR_CORE = 1.12;
export const BEAD_CLEAR_EDGE = 1.75;

/**
 * A sharp bead's name is cleared with it — a softened caption is not a
 * caption. It follows the glass in from this clarity, so a band's glow (which
 * never reaches it) clears the glass alone and only a sharp bead's name comes
 * sharp.
 */
export const NAME_CLEAR_FROM = 0.75;

/** A name's clear ellipse: the box sits in its core, the edge falls off past it. */
export const NAME_CLEAR_CORE = 0.8;

/**
 * The lens: a disc about one sixth of the viewport's width across (M2-012
 * "Fog and lens"), measured where the air is half clear, with a soft edge of
 * this fraction of its radius.
 */
export const LENS_DIAMETER = 1 / 6;
export const LENS_EDGE = 0.5;

/** The strength a sharp bead's name is cleared with, given the bead's own. */
export function nameClarity(clarity: number): number {
  if (NAME_CLEAR_FROM >= 1) return clarity >= 1 ? 1 : 0;
  return clamp01((clarity - NAME_CLEAR_FROM) / (1 - NAME_CLEAR_FROM));
}

export interface LensShape {
  /** Outer radius in the pass's space: past it the lens clears nothing. */
  readonly radius: number;
  /** Fraction of the outer radius that is fully clear. */
  readonly core: number;
}

/**
 * The lens as the pass draws it, for a frame of this aspect. Its half-clear
 * radius is exactly a twelfth of the width; the soft edge straddles it.
 */
export function lensShape(aspect: number): LensShape {
  const half = (LENS_DIAMETER * Math.max(0.1, aspect)) / 2;
  const outer = half * (1 + LENS_EDGE / 2);
  return { radius: outer, core: (half * (1 - LENS_EDGE / 2)) / outer };
}

/**
 * One bead as the pass sees it, interleaved `FOG_BEAD_STRIDE` floats apart:
 *
 *   0 x, 1 y          centre, in the pass's space
 *   2 radius          drawn glass radius; ≤ 0 when the bead is not drawn
 *   3 clarity         eased, 0..1
 *   4 nameDx, 5 nameDy  its name's box centre, relative to the bead
 *   6 nameHx, 7 nameHy  the box's half extents; nameHx ≤ 0 = no name drawn
 */
export const FOG_BEAD_STRIDE = 8;

/**
 * THE DISCS OF CLEAR AIR, IN ORDER.
 *
 * Clearest first — ties by the draw's own order, so the list is the same list
 * on every frame the same world is drawn — and a sharp bead's name straight
 * after its bead, so a crowded frame that runs out of discs loses the faintest
 * band glow and never the attended bead's caption. A bead with nothing to
 * clear takes no disc at all: at the floor the fog is already right.
 *
 * Writes `(cx, cy, 1/rx, 1/ry)` into `shape` and `(strength, core)` into
 * `weight` per disc and returns how many it wrote — never more than `max`, nor
 * than the arrays hold. `order` is the caller's scratch. Allocates nothing.
 */
export function buildFogCircles(
  beads: Float32Array,
  count: number,
  order: Int32Array,
  shape: Float32Array,
  weight: Float32Array,
  max: number = FOG_MAX_CIRCLES
): number {
  const n = Math.max(
    0,
    Math.min(count, Math.floor(beads.length / FOG_BEAD_STRIDE), order.length)
  );
  const limit = Math.max(
    0,
    Math.min(max, Math.floor(shape.length / 4), Math.floor(weight.length / 2))
  );

  // Insertion sort, clearest first and stable: two dozen beads, no allocation.
  for (let i = 0; i < n; i++) {
    let j = i - 1;
    const clarity = beads[i * FOG_BEAD_STRIDE + 3];
    while (j >= 0 && beads[order[j] * FOG_BEAD_STRIDE + 3] < clarity) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = i;
  }

  let written = 0;
  const beadCore = BEAD_CLEAR_CORE / BEAD_CLEAR_EDGE;
  for (let rank = 0; rank < n && written < limit; rank++) {
    const at = order[rank] * FOG_BEAD_STRIDE;
    const clarity = clamp01(beads[at + 3]);
    // Clearest first: once one bead has nothing to clear, none after it has.
    if (clarity <= CLARITY_EPSILON) break;
    const radius = beads[at + 2];
    if (!(radius > 0)) continue;

    const outer = radius * BEAD_CLEAR_EDGE;
    shape[written * 4] = beads[at];
    shape[written * 4 + 1] = beads[at + 1];
    shape[written * 4 + 2] = 1 / outer;
    shape[written * 4 + 3] = 1 / outer;
    weight[written * 2] = clarity;
    weight[written * 2 + 1] = beadCore;
    written++;

    const name = nameClarity(clarity);
    const hx = beads[at + 6];
    const hy = beads[at + 7];
    if (written >= limit || name <= CLARITY_EPSILON || !(hx > 0) || !(hy > 0)) {
      continue;
    }
    // The box is inscribed in the ellipse's core: its corners sit on the
    // ellipse of semi-axes (hx·√2, hy·√2), and the core is that ellipse.
    shape[written * 4] = beads[at] + beads[at + 4];
    shape[written * 4 + 1] = beads[at + 1] + beads[at + 5];
    shape[written * 4 + 2] = NAME_CLEAR_CORE / (hx * Math.SQRT2);
    shape[written * 4 + 3] = NAME_CLEAR_CORE / (hy * Math.SQRT2);
    weight[written * 2] = name;
    weight[written * 2 + 1] = NAME_CLEAR_CORE;
    written++;
  }
  return written;
}
