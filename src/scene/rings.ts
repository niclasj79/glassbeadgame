import { ARENA_RADIUS } from "@/game/layout";
import { CREEP_RATES, PRECESSION_RATES } from "./idle";

/**
 * THE ARMILLARY'S RINGS, AS GEOMETRY
 *
 * Extracted from `Armillary.tsx` for the same reason `stations.ts` was: a rule
 * that can only be seen by looking at a screenshot is a rule nobody keeps. The
 * component turns these specs into meshes and does not decide anything.
 *
 * Three laws live here, and `rings.test.ts` holds all three to account:
 *
 *   NESTING. Every ring has its own radius, so they sit inside one another the
 *   way turned brass does. They used to share one radius, which is a wireframe
 *   sphere, not an armillary — and the component's own comment already claimed
 *   a tilted index ring that existed nowhere in the code.
 *
 *   CLEARANCE. Every ring stands outside the bead shell at its widest —
 *   attended, breathing and bobbing all at once. The parallels used to be
 *   struck on the *bead* shell, three percent out, so a small circle passed
 *   straight through the beads standing on it. That is the slicing.
 *
 *   CONTAINMENT. Nothing reaches past the span the camera promises to frame
 *   (`framing.INSTRUMENT_HALF_SPAN`).
 */

/**
 * The furthest any bead ever reaches from the arena's centre.
 *
 * `Beads.tsx` draws a bead at `BEAD_RADIUS(0.15) * GLASS_SCALE(1.72)` scaled
 * by at most the snapped emphasis (1.3) and the breath (1.01), bobbing up to
 * `BOB_AMPLITUDE` (0.03) off the shell. This is a *bound* on that, not a
 * second copy of it: no ring may come inside it.
 */
export const MAX_BEAD_EXTENT = ARENA_RADIUS + 0.03 + 0.15 * 1.72 * 1.3 * 1.01;

/** The instrument's shells, outermost first. */
export const PRIME_SHELL = ARENA_RADIUS * 1.21;
export const COLURE_SHELL = ARENA_RADIUS * 1.18;
export const INDEX_SHELL = ARENA_RADIUS * 1.15;

/** The obliquity the index ring is set at, and the twist of its node. */
const INDEX_OBLIQUITY = 0.409;
const INDEX_NODE = 0.62;

export interface RingSpec {
  readonly key: string;
  readonly radius: number;
  readonly halfWidth: number;
  readonly major: number;
  readonly minor: number;
  readonly opacity: number;
  readonly rotation: readonly [number, number, number];
  readonly position: readonly [number, number, number];
  readonly stations: boolean;
  /** Sort order inside the transparent pass. The prime circle reads on top. */
  readonly order: number;
  /**
   * How fast this ring turns about the world's axis, in radians per second.
   *
   * An armillary that does not move is a wireframe sphere with a caption. The
   * colures and the index ring precess at three unrelated rates so the lattice
   * *reconfigures* — intersections migrate, the cage opens and closes — inside
   * the twenty seconds a stranger gives a screen before deciding it has
   * stalled. See `scene/idle.ts` for why these three numbers and not others.
   */
  readonly precession: number;
  /**
   * How fast the engraving slides along a ring that cannot show rotation.
   * A circle about the world's axis maps onto itself when it turns, so the
   * prime circle and the parallels would move without moving; their graduations
   * creep instead, which is the same life in the channel that can carry it.
   */
  readonly creep: number;
}

export function armillaryRings(
  parallels: readonly number[],
  graduations: number
): RingSpec[] {
  const specs: RingSpec[] = [
    {
      key: "prime",
      radius: PRIME_SHELL,
      halfWidth: 0.07,
      major: 12,
      minor: graduations,
      opacity: 0.66,
      rotation: [-Math.PI / 2, 0, 0],
      position: [0, 0, 0],
      stations: true,
      order: -1,
      precession: PRECESSION_RATES.prime,
      creep: CREEP_RATES.prime,
    },
    {
      key: "colure-a",
      radius: COLURE_SHELL,
      halfWidth: 0.045,
      major: 4,
      minor: graduations / 2,
      opacity: 0.34,
      rotation: [0, 0, 0],
      position: [0, 0, 0],
      stations: false,
      order: -2,
      precession: PRECESSION_RATES.colureA,
      creep: 0,
    },
    {
      key: "colure-b",
      radius: COLURE_SHELL,
      halfWidth: 0.045,
      major: 4,
      minor: graduations / 2,
      opacity: 0.34,
      rotation: [0, Math.PI / 2, 0],
      position: [0, 0, 0],
      stations: false,
      order: -2,
      precession: PRECESSION_RATES.colureB,
      creep: 0,
    },
    {
      key: "index",
      radius: INDEX_SHELL,
      halfWidth: 0.03,
      major: 6,
      minor: Math.max(12, graduations / 3),
      opacity: 0.24,
      rotation: [-Math.PI / 2 + INDEX_OBLIQUITY, INDEX_NODE, 0],
      position: [0, 0, 0],
      stations: false,
      order: -3,
      precession: PRECESSION_RATES.index,
      creep: 0,
    },
  ];

  parallels.forEach((y, index) => {
    // Struck on the colure shell, not on the bead shell: a small circle of
    // this sphere passes outside every bead standing at that latitude.
    const r = Math.sqrt(Math.max(0.04, COLURE_SHELL * COLURE_SHELL - y * y));
    specs.push({
      key: `parallel-${index}`,
      radius: r,
      halfWidth: 0.024,
      major: 6,
      minor: Math.max(12, graduations / 3),
      opacity: 0.3,
      rotation: [-Math.PI / 2, 0, 0],
      position: [0, y, 0],
      stations: false,
      order: -4,
      precession: PRECESSION_RATES.parallel,
      creep: CREEP_RATES.parallel,
    });
  });

  return specs;
}

/** Distance from the arena's centre to the nearest point of a ring's band. */
export function ringInnerReach(spec: RingSpec): number {
  return Math.hypot(spec.radius - spec.halfWidth, spec.position[1]);
}

/** Distance from the arena's centre to the furthest point of a ring's band. */
export function ringOuterReach(spec: RingSpec): number {
  return Math.hypot(spec.radius + spec.halfWidth, spec.position[1]);
}
