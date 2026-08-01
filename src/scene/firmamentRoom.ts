import { DEFAULT_VIEW, VAULT, visibleColatitudes, withinBand } from "./firmamentGeometry";

/**
 * THE ROOM AT THE LEVEL AND BELOW IT.
 *
 * `firmamentGeometry.ts` states the vault — everything from the springing line
 * up. This states the two things under it that B5 found missing, for the same
 * reason and by the same discipline: a shader's numbers are unreviewable, so
 * the geometry lives where a test can read it and `Firmament.tsx` interpolates
 * it into GLSL.
 *
 * B5, measured at 1440x810 on the golden seed: the instrument's silhouette
 * covered the left 59% of the page and the remaining 40% carried two nav pills,
 * a mute button, the page's rule, and "three stray light streaks" — which were
 * the vault's transverse courses and the impost, arriving in a part of the
 * frame where *nothing else was drawn at all*. A sphere fitted to the ruled
 * height of a 16:9 page covers 44% of its width and no framing decision changes
 * that, so the width the instrument cannot fill has to be filled by the room.
 *
 *   THE LEVEL is the room's horizon: one struck rule at colatitude π/2, the
 *   line the whole composition is measured from. The world had only
 *   `gbgEnvironment`'s lit band there, which is a glow and not a line.
 *
 *   THE FLOOR is courses on a plane one eye-height below the level, at radii
 *   that recede by a constant ratio. The well used to repeat every 56° of
 *   colatitude behind a presence ramp that was a fifth open at the bottom of
 *   the frame, so at most one course rendered and it rendered as a smear.
 *
 *   THE WALL is where the ribs stand. They used to be gated on the *vault's*
 *   ramp, which is 18% open at the level and nothing at the floor: ribs with
 *   nothing under them.
 *
 * Colatitude is the angle from straight up, as in `firmamentGeometry.ts`.
 * Pure — no Three, no React, no shader. This module and that one describe one
 * room and should be one file; they are two because the vault's half was owned
 * elsewhere when the room's floor was put in.
 */

/** The room's own horizon: the level the instrument stands at. */
export const LEVEL_COLATITUDE = Math.PI / 2;

/**
 * Half-width of the struck level, in radians of colatitude.
 *
 * At the arena's field of view one pixel of an 810 px frame is about 0.0009 rad
 * of colatitude, so this is a two-pixel rule. It matters more than it looks:
 * struck at 0.0075 — eight pixels either side — the same line came back from
 * the compositor through the bloom as a *band*, and a room whose horizon is a
 * band is a room with venetian blinds in it. Every horizontal in here is cut
 * fine for that reason, and it is why they gain weight by being *drawn* rather
 * than by being wide.
 */
export const LEVEL_WIDTH = 0.0022;

/**
 * Where the wall's ribs stand — the foot of their presence ramp, which closes
 * on the vault's own crown.
 *
 * Well below the bottom of the default view, so a rib is still a rib at the
 * frame's floor instead of having faded out one storey above it. The vault's
 * ramp (`VAULT.springing`, 1.72) is *inside* the view, which is why ribs gated
 * on it stood on nothing: 18% at the level, zero at the frame's own floor.
 */
export const WALL_FOOT = 2.3;

/** How present the wall's ribs are at a colatitude. 0..1. Mirrors `vaultPresence`. */
export function wallPresence(colat: number): number {
  const t = Math.min(1, Math.max(0, (WALL_FOOT - colat) / (WALL_FOOT - VAULT.crown)));
  return t * t * (3 - 2 * t);
}

/**
 * The floor's courses, as radii on a plane one eye-height below the level.
 *
 * A constant ratio, which is what a receding floor does. The three nearest are
 * inside the default view; the fourth is what the eye is promised when it looks
 * down, and is the reason the ladder is stated in full rather than clipped to
 * what one camera happens to see.
 */
export const FLOOR_RADII: readonly number[] = Object.freeze([2.45, 3.68, 5.52]);

/** Where a floor course at this radius lands, for a unit eye height. */
export function floorCourseColatitude(radius: number): number {
  return LEVEL_COLATITUDE + Math.atan(1 / Math.max(radius, 1e-6));
}

export interface FloorCourse {
  /** Where the rule is struck. */
  readonly colatitude: number;
  /** Half-width, in radians of colatitude. */
  readonly width: number;
  /** How strongly it is struck, relative to the nearest course. */
  readonly weight: number;
}

/**
 * The drawn floor, exactly as the shader receives it.
 *
 * Width and weight both fall with distance, so a receding course goes *pale*
 * rather than breaking into dots — the same law `glsl.gbgCoverage` keeps for
 * every other fine line in this world. The widths are stated as a ratio of the
 * nearest course's rather than solved from the projection, because the
 * projection is the camera's business and this is the room's.
 */
export function floorCourses(): readonly FloorCourse[] {
  return FLOOR_RADII.map((radius, index) => ({
    colatitude: Number(floorCourseColatitude(radius).toFixed(5)),
    width: Number((0.0034 / Math.pow(1.35, index)).toFixed(5)),
    weight: Number((1 - index * 0.22).toFixed(3)),
  }));
}

/** Every mark this module puts in the room, named, for the tests. */
export function roomMarks(): readonly {
  readonly name: string;
  readonly colatitude: number;
}[] {
  return [
    { name: "level", colatitude: LEVEL_COLATITUDE },
    ...floorCourses().map((course, index) => ({
      name: `floor-${index}`,
      colatitude: course.colatitude,
    })),
  ];
}

/** How many of the room's marks the default view can actually see. */
export function marksInDefaultView(): number {
  const band = visibleColatitudes(DEFAULT_VIEW);
  return roomMarks().filter((mark) => withinBand(band, mark.colatitude)).length;
}

/**
 * The wall's ribs reach the floor only if their ramp is still open there. The
 * bar is deliberately low — a rib should *recede* into the dye at the bottom of
 * the frame, not stop a third of the way down it.
 */
export function wallReachesFloor(): boolean {
  const band = visibleColatitudes(DEFAULT_VIEW);
  return (
    WALL_FOOT > band.bottom &&
    wallPresence(band.bottom) > 0.15 &&
    wallPresence(LEVEL_COLATITUDE) > 0.6
  );
}
