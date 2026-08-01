import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW,
  VAULT,
  vaultPresence,
  visibleColatitudes,
  withinBand,
} from "./firmamentGeometry";
import {
  FLOOR_RADII,
  LEVEL_COLATITUDE,
  LEVEL_WIDTH,
  WALL_FOOT,
  floorCourseColatitude,
  floorCourses,
  marksInDefaultView,
  roomMarks,
  wallPresence,
  wallReachesFloor,
} from "./firmamentRoom";

/**
 * B5 — THE RESTING FRAME ABANDONED THE RIGHT 40 PERCENT.
 *
 * The instrument cannot fill a wide page: at 16:9 a sphere fitted to the ruled
 * height covers 44% of the width, and at 21:9 it covers 37%. The room has to
 * carry the rest, and the room could not, because everything it draws below
 * the springing line was authored where the camera does not look — the same
 * defect `firmamentGeometry.ts` was extracted to stop, one storey lower down.
 *
 * These hold the room's marks against the view a player actually gets.
 */
describe("the room below the springing line", () => {
  const band = visibleColatitudes(DEFAULT_VIEW);

  it("strikes the level inside the default view", () => {
    expect(withinBand(band, LEVEL_COLATITUDE)).toBe(true);
    // A rule, not a band: half a degree of colatitude, which is about two
    // pixels on an 810px frame at this field of view.
    expect(LEVEL_WIDTH).toBeLessThan(0.004);
    expect(LEVEL_WIDTH).toBeGreaterThan(0.0018);
  });

  it("puts the whole floor inside the default view", () => {
    const visible = floorCourses().filter((course) =>
      withinBand(band, course.colatitude)
    );
    expect(
      `${visible.length} of ${FLOOR_RADII.length} courses in view`
    ).toBe(`${FLOOR_RADII.length} of ${FLOOR_RADII.length} courses in view`);
    // Every mark this module draws, counted the way the room is judged.
    expect(marksInDefaultView()).toBe(FLOOR_RADII.length + 1);
    expect(roomMarks()).toHaveLength(FLOOR_RADII.length + 1);
    // The nearest course is nearer than the nearest floor the frame reaches,
    // so the recession starts inside the page rather than under it.
    const nearestInFrame = 1 / Math.tan(band.bottom - LEVEL_COLATITUDE);
    expect(FLOOR_RADII[0]).toBeGreaterThan(nearestInFrame);
    expect(FLOOR_RADII[0]).toBeLessThan(nearestInFrame * 1.6);
  });

  it("recedes: each course is nearer the level, finer and fainter than the last", () => {
    const courses = floorCourses();
    for (let i = 1; i < courses.length; i++) {
      expect(courses[i].colatitude).toBeLessThan(courses[i - 1].colatitude);
      expect(courses[i].width).toBeLessThan(courses[i - 1].width);
      expect(courses[i].weight).toBeLessThan(courses[i - 1].weight);
    }
    // Every course is below the level, because a floor is.
    for (const course of courses) {
      expect(course.colatitude).toBeGreaterThan(LEVEL_COLATITUDE);
    }
    // And no course is so fine it cannot be struck: at this field of view one
    // pixel of an 810px frame is about 0.0009 rad of colatitude.
    for (const course of courses) {
      expect(course.width).toBeGreaterThan(0.0018);
    }
  });

  it("stands the wall's ribs on the floor rather than on the springing line", () => {
    expect(wallReachesFloor()).toBe(true);
    expect(WALL_FOOT).toBeGreaterThan(band.bottom);
    // The whole point, stated against the ramp it replaced: the vault's own
    // springing line is *inside* the frame, so a rib gated on it is 18% struck
    // at the instrument's level and nothing at all at the frame's floor.
    expect(VAULT.springing).toBeLessThan(band.bottom);
    expect(vaultPresence(LEVEL_COLATITUDE)).toBeLessThan(0.2);
    expect(vaultPresence(band.bottom)).toBe(0);
    expect(wallPresence(LEVEL_COLATITUDE)).toBeGreaterThan(
      vaultPresence(LEVEL_COLATITUDE) * 3
    );
    expect(wallPresence(band.bottom)).toBeGreaterThan(0.15);
  });

  it("shows the defect: the well it replaced could not put a course in the frame", () => {
    // The old floor was `fract(colat * 3.2 / PI)` gated on a presence ramp from
    // wellStart to wellEnd, struck at 0.09 of the engraving colour. Its period
    // is 56 degrees of colatitude; the whole default view is 42.
    const period = Math.PI / 3.2;
    expect(period).toBeGreaterThan(band.bottom - band.top);

    // And the ramp was shut at the level and barely open at the frame's floor,
    // so the strongest mark it could make anywhere on the page was 4% of the
    // engraving colour — about ten of 255 over a ground that already sits near
    // twenty. That is the smear B5 measured, not a floor.
    const presence = (colat: number): number => {
      const t = Math.min(
        1,
        Math.max(0, (colat - VAULT.wellStart) / (VAULT.wellEnd - VAULT.wellStart))
      );
      return t * t * (3 - 2 * t);
    };
    expect(presence(LEVEL_COLATITUDE)).toBe(0);
    expect(presence(band.bottom) * 0.09).toBeLessThan(0.05);

    // The replacement puts its whole ladder in the same band, at strengths a
    // struck rule is actually struck at.
    const visible = floorCourses().filter((course) =>
      withinBand(band, course.colatitude)
    );
    expect(visible.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...visible.map((course) => course.weight)) * 0.2).toBeGreaterThan(
      presence(band.bottom) * 0.09 * 2
    );
  });

  it("derives a course's colatitude from its radius on the floor", () => {
    // A course twice as far away sits half as far below the level, near enough,
    // which is what makes the spacing read as recession rather than as stripes.
    expect(floorCourseColatitude(1)).toBeCloseTo(Math.PI / 2 + Math.PI / 4, 9);
    expect(floorCourseColatitude(1e9) - LEVEL_COLATITUDE).toBeLessThan(1e-8);
    expect(floorCourseColatitude(FLOOR_RADII[0])).toBeGreaterThan(
      floorCourseColatitude(FLOOR_RADII[1])
    );
  });
});
