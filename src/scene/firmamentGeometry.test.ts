import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW,
  VAULT,
  courseColatitudes,
  glslFloat,
  roseOuterColatitude,
  vaultPresence,
  visibleColatitudes,
  wellPresence,
  withinBand,
} from "./firmamentGeometry";

/**
 * THE AUTHORED FIRMAMENT NEVER REACHED THE PIXELS.
 *
 * The room was authored above the frustum. Every number below is measured
 * against the view the arena actually opens on, and the comments record what
 * the pre-fix values gave at the same place, so the regression is legible as a
 * measurement rather than as an opinion about a screenshot.
 *
 *   old springing ramp   smoothstep(1.42, 0.95, colat) → 0.34 at the top of frame
 *   old courses          0.42 + i * 0.23, i < 4 → highest 1.11, above the frame
 *   old impost           did not exist
 *   old well             smoothstep(1.75, 2.60, colat) → 0.17 at the bottom
 */

const band = visibleColatitudes(DEFAULT_VIEW);

/** The pre-fix ramp, kept so the improvement is a number and not a claim. */
function oldVaultPresence(colat: number): number {
  const t = Math.min(1, Math.max(0, (1.42 - colat) / (1.42 - 0.95)));
  return t * t * (3 - 2 * t);
}

describe("the view the arena opens on", () => {
  it("sees a band of sky either side of the horizon", () => {
    expect(band.top).toBeGreaterThan(0);
    expect(band.bottom).toBeLessThan(Math.PI);
    expect(band.top).toBeLessThan(Math.PI / 2);
    expect(band.bottom).toBeGreaterThan(Math.PI / 2);
    // A 42° field, and the camera sits a little above the arena's centre.
    expect(band.bottom - band.top).toBeCloseTo((42 * Math.PI) / 180, 6);
  });
});

describe("the vault reaches the frame", () => {
  it("is substantially present at the top of the default view", () => {
    const now = vaultPresence(band.top);
    expect(now).toBeGreaterThan(0.6);
    // It was about a third of that before, which is why the room read as sky.
    expect(now).toBeGreaterThan(oldVaultPresence(band.top) * 1.8);
  });

  it("has begun by the time the eye reaches the horizon", () => {
    expect(vaultPresence(Math.PI / 2)).toBeGreaterThan(0.1);
  });

  /**
   * Two, drawn where they can be seen. With the old ladder (0.42 + i * 0.23,
   * four of them, highest at 1.11) not one course fell inside the frame.
   */
  it("crosses the default view with at least two of its courses", () => {
    const inside = courseColatitudes().filter(
      (colat) => withinBand(band, colat) && vaultPresence(colat) > 0.25
    );
    expect(inside.length).toBeGreaterThanOrEqual(2);
  });

  it("strikes its impost course inside the default view, and draws it", () => {
    expect(withinBand(band, VAULT.impost)).toBe(true);
    expect(vaultPresence(VAULT.impost)).toBeGreaterThan(0.25);
    expect(VAULT.impostWidth).toBeGreaterThan(0);
  });

  it("gives the well below the instrument a floor inside the frame", () => {
    expect(wellPresence(band.bottom)).toBeGreaterThan(0.3);
    expect(wellPresence(Math.PI / 2)).toBe(0);
  });

  /**
   * The other half of the fix: the ornament stays overhead. If the rose window
   * were dragged into the default view there would be nothing left to find by
   * looking up, and a firmament whose whole content is on screen at once is a
   * backdrop.
   */
  it("keeps the rose window and the boss above the default view", () => {
    expect(roseOuterColatitude()).toBeLessThan(band.top);
    expect(withinBand(band, roseOuterColatitude())) .toBe(false);
  });

  it("springs from below the crown, not above it", () => {
    expect(VAULT.springing).toBeGreaterThan(VAULT.crown);
    expect(vaultPresence(VAULT.crown)).toBe(1);
    expect(vaultPresence(VAULT.springing)).toBe(0);
  });
});

describe("glslFloat", () => {
  it("never hands a shader an integer literal", () => {
    expect(glslFloat(1)).toBe("1.0");
    expect(glslFloat(12)).toBe("12.0");
    expect(glslFloat(0.34)).toBe("0.34");
  });
});
