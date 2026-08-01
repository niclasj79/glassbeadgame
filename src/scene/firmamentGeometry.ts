/**
 * WHERE THE ROOM IS, IN COLATITUDE.
 *
 * The firmament's architecture is drawn by a shader, and a shader's numbers are
 * unreviewable: nobody reading `smoothstep(1.42, 0.95, colat)` can tell whether
 * the vault it springs is in front of the player or over their head. For the
 * whole life of the campaign it was over their head — the springing line opened
 * at about 9° of elevation and only reached full strength at 33°, the transverse
 * courses started at 66°, and the default camera can see about 21°. The largest
 * surface in the product rendered as a two-colour gradient.
 *
 * So the geometry lives here, as data, and `Firmament.tsx` interpolates these
 * numbers into its GLSL. The description the tests measure is the description
 * that renders.
 *
 * Colatitude is the angle from straight up: 0 at the zenith, π/2 at the horizon,
 * π at the floor. Radians throughout. Pure — no Three, no React, no shader.
 */

export interface CameraView {
  /** Vertical field of view, in degrees. */
  readonly fovDegrees: number;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

/**
 * The arena's default view, as `scene/ArenaCanvas.tsx` declares it and
 * `scene/CameraRig.tsx` frames it. Stated here so the room can be authored
 * against the thing a player actually sees on the first frame.
 */
export const DEFAULT_VIEW: CameraView = Object.freeze({
  fovDegrees: 42,
  position: Object.freeze([0, 0.5, 15.2] as const),
  target: Object.freeze([0, 0, 0] as const),
});

export interface ColatitudeBand {
  /** Nearest the zenith the view reaches. */
  readonly top: number;
  /** Nearest the floor the view reaches. */
  readonly bottom: number;
}

/** The band of sky a view can see, ignoring the (wider) horizontal spread. */
export function visibleColatitudes(view: CameraView): ColatitudeBand {
  const dx = view.target[0] - view.position[0];
  const dy = view.target[1] - view.position[1];
  const dz = view.target[2] - view.position[2];
  const horizontal = Math.hypot(dx, dz);
  const pitch = Math.atan2(dy, horizontal);
  const half = ((view.fovDegrees / 2) * Math.PI) / 180;
  // Colatitude falls as elevation rises.
  return Object.freeze({
    top: Math.max(0, Math.PI / 2 - (pitch + half)),
    bottom: Math.min(Math.PI, Math.PI / 2 - (pitch - half)),
  });
}

/** True when a colatitude is inside the band. */
export function withinBand(band: ColatitudeBand, colat: number): boolean {
  return colat >= band.top && colat <= band.bottom;
}

/**
 * The room, in one table.
 *
 * `springing` / `crown` are the two ends of the vault's presence ramp: the
 * architecture fades in below the instrument's own level and is fully itself by
 * the time the eye reaches the crown. The impost is the one drawn rule that
 * tells the eye it is indoors, and it sits inside the default view on purpose.
 * The rose and the boss are deliberately *outside* it — looking up is still
 * worth doing.
 */
export const VAULT = Object.freeze({
  /**
   * Where the vault's presence begins, and where it is fully itself.
   *
   * Both are chosen against `DEFAULT_VIEW`: the ramp has to be most of the way
   * up by the top of the frame, or the room's architecture is a rumour. It was
   * 1.42 → 0.95, which put the whole ramp above what the camera can see.
   */
  springing: 1.72,
  crown: 1.15,
  /** The impost course: one struck rule where the wall becomes the vault. */
  impost: 1.42,
  /** Half-width of the impost rule, in radians of colatitude. */
  impostWidth: 0.011,
  /** Twelve meridian ribs rising to the boss. */
  ribs: 12,
  /** Transverse courses: the vault's own coursing, from the crown downward. */
  courseFirst: 0.42,
  courseStep: 0.22,
  courseCount: 6,
  courseWidth: 0.005,
  /** The rose window's unit radius, and how far past it the tracery reaches. */
  roseUnit: 0.34,
  roseReach: 1.35,
  /** The well below the instrument: where its courses begin and end. */
  wellStart: 1.6,
  wellEnd: 2.4,
});

/** The rose window's outer edge, as a colatitude from the zenith. */
export function roseOuterColatitude(): number {
  return VAULT.roseUnit * VAULT.roseReach;
}

/** How present the vault's architecture is at a colatitude. 0..1. */
export function vaultPresence(colat: number): number {
  const t = Math.min(
    1,
    Math.max(0, (VAULT.springing - colat) / (VAULT.springing - VAULT.crown))
  );
  return t * t * (3 - 2 * t);
}

/** How present the well's courses are at a colatitude. 0..1. */
export function wellPresence(colat: number): number {
  const t = Math.min(
    1,
    Math.max(0, (colat - VAULT.wellStart) / (VAULT.wellEnd - VAULT.wellStart))
  );
  return t * t * (3 - 2 * t);
}

/** The colatitudes of the vault's transverse courses, crown first. */
export function courseColatitudes(): readonly number[] {
  return Object.freeze(
    Array.from(
      { length: VAULT.courseCount },
      (_, i) => VAULT.courseFirst + i * VAULT.courseStep
    )
  );
}

/** A GLSL float literal. `1` must not reach a shader as `1`. */
export function glslFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}
