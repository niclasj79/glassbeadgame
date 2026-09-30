import { RELATION_INTENTIONS, type RelationIntention } from "@/domain/events";

/**
 * THE FOUR THREAD MATERIALS
 *
 * Echo, Passage, Tension and Ground must be told apart with the colour removed
 * and the sound off. Each therefore owns a *construction*, a *motion*, and a
 * *mark* — three independent channels — and hue is the fourth, least load-
 * bearing one (VERTICAL-SLICE-SPEC §19, CONTENT-AUDIOVISUAL-REFERENCE
 * cross-category grammar).
 *
 *   Echo     two mirrored strands, growth from both ends toward the middle,
 *            paired ticks at mirrored stations. Nothing travels one way.
 *   Passage  one strand, tapering, whose mark transforms along its length;
 *            chevrons travel source → destination and never back.
 *   Ground   one heavy strand that sinks *inside* the arena sphere and settles
 *            onto a base rule beneath the supported bead. It comes to rest.
 *   Tension  two strands wound in opposite senses that never phase-align, over
 *            a beat that decays to a floor but is never resolved.
 *
 * CAV-007 is enforced here rather than in the shader, because a bound that
 * lives in a shader is a bound that the next shader forgets.
 */

/** Accepted comfort envelope, CAV-007. Shared by scene and audio grammar. */
export const COMFORT = Object.freeze({
  /** Torsion is bounded to ±14° of counter-rotation, with continuous easing. */
  maxTorsionRadians: (14 * Math.PI) / 180,
  /** Beating between 0.8 and 6.5 Hz; never above 7. */
  minBeatHz: 0.8,
  maxBeatHz: 6.5,
  /** No luminance flicker above 3 Hz at any amplitude. */
  maxLuminanceHz: 3,
  /**
   * The most the world's breath may move the camera's field of view, as a
   * share of it (ADR-016): 0.6 %, a quarter of a degree at 42°. Felt, never
   * watched; off under reduced motion and on the engraved tier.
   */
  cameraBreath: 0.006,
  /** Instability persists, but its amplitude decays to a floor by ~12 s. */
  unrestSettleSeconds: 12,
  /** The floor the unrest decays to — legible, never resolved to zero. */
  unrestFloor: 0.22,
});

/** Geometric construction of a thread. Never carried by hue. */
export type ThreadConstruction =
  | "mirrored-pair"
  | "single-transforming"
  | "counter-wound-pair"
  | "seated-single";

/** How the thread moves once it exists. */
export type ThreadMotion =
  | "bilateral"
  | "directional"
  | "unresolved"
  | "settling";

/** The repeating mark along the thread — the shape a screenshot preserves. */
export type ThreadMark = "paired-tick" | "chevron" | "crossed-hatch" | "base-rule";

export interface ThreadForm {
  readonly intention: RelationIntention;
  readonly construction: ThreadConstruction;
  readonly motion: ThreadMotion;
  readonly mark: ThreadMark;
  /**
   * Radial multiplier applied to the arc's midpoint. Above 1 the thread bows
   * out over the armillary; below 1 it passes *inside* it. Ground is the only
   * relation that goes under the surface, which is what "beneath" means here.
   */
  readonly arcLift: number;
  /** Number of parallel strands drawn. */
  readonly strands: 1 | 2;
  /** Beat frequency in Hz, 0 for a thread that does not beat. */
  readonly beatHz: number;
  /** Peak torsion in radians. 0 for a thread that does not twist. */
  readonly torsion: number;
  /** Travel speed of the mark along the thread, in lengths per second. */
  readonly travel: number;
  /** Accessible sentence; the text channel of the same distinction. */
  readonly phrase: string;
  /** GLSL branch index. Order is a shader ABI. */
  readonly code: number;
}

const clampHz = (hz: number): number =>
  hz === 0
    ? 0
    : Math.min(COMFORT.maxBeatHz, Math.max(COMFORT.minBeatHz, hz));

const clampTorsion = (radians: number): number =>
  Math.min(COMFORT.maxTorsionRadians, Math.max(0, radians));

const form = (value: ThreadForm): ThreadForm => Object.freeze(value);

const FORMS: Readonly<Record<RelationIntention, ThreadForm>> = Object.freeze({
  echo: form({
    intention: "echo",
    construction: "mirrored-pair",
    motion: "bilateral",
    mark: "paired-tick",
    arcLift: 1.16,
    strands: 2,
    beatHz: 0,
    torsion: 0,
    travel: 0.34,
    phrase: "The two ideas repeat a related structure.",
    code: 0,
  }),
  passage: form({
    intention: "passage",
    construction: "single-transforming",
    motion: "directional",
    mark: "chevron",
    arcLift: 1.2,
    strands: 1,
    beatHz: 0,
    torsion: 0,
    travel: 0.52,
    phrase: "One idea is carried into the other and changes on the way.",
    code: 1,
  }),
  tension: form({
    intention: "tension",
    construction: "counter-wound-pair",
    motion: "unresolved",
    mark: "crossed-hatch",
    arcLift: 1.1,
    strands: 2,
    beatHz: clampHz(1.35),
    torsion: clampTorsion(COMFORT.maxTorsionRadians),
    travel: 0.18,
    phrase: "The ideas pull against each other and are not reconciled.",
    code: 2,
  }),
  ground: form({
    intention: "ground",
    construction: "seated-single",
    motion: "settling",
    mark: "base-rule",
    arcLift: 0.72,
    strands: 1,
    beatHz: 0,
    torsion: 0,
    travel: 0.08,
    phrase: "One idea supports and carries the weight of the other.",
    code: 3,
  }),
});

export function threadForm(intention: RelationIntention): ThreadForm {
  return FORMS[intention];
}

export const THREAD_FORMS: readonly ThreadForm[] = Object.freeze(
  RELATION_INTENTIONS.map((intention) => FORMS[intention])
);

/**
 * Unrest amplitude of a Tension thread `seconds` after it was committed.
 * Decays exponentially to `COMFORT.unrestFloor`: the instability remains a
 * visual fact indefinitely, but stops being an irritant (CAV-007 duration).
 */
export function unrestAmplitude(seconds: number): number {
  if (seconds <= 0) return 1;
  const k = Math.exp(-(3 * seconds) / COMFORT.unrestSettleSeconds);
  return COMFORT.unrestFloor + (1 - COMFORT.unrestFloor) * k;
}

/**
 * Luminance modulation is the one channel with a hard cap: whatever the form
 * asks for, brightness may not oscillate above 3 Hz at any amplitude.
 */
export function luminanceHz(requestedHz: number): number {
  return Math.min(COMFORT.maxLuminanceHz, Math.max(0, requestedHz));
}
