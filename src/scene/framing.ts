import * as THREE from "three";

/**
 * THE ATTENDED POSTURE, SOLVED RATHER THAN NUDGED
 *
 * I-012 asks for a situated lower-corner posture that still preserves the
 * whole spherical arena. Panning the target to shove the bead into a corner
 * drags the arena out of frame with it, so the instrument is *turned* instead:
 * the camera orbits to a position from which the attended bead falls where we
 * want it, while still aimed at the arena's centre.
 *
 * With no camera roll the camera's right vector is always horizontal, which
 * makes the azimuth a closed form. The elevation is bounded to a comfortable
 * range — the camera never flies to the pole to chase a bead that is already
 * overhead — so it is solved by search within that range, and whatever the
 * rotation could not deliver is absorbed by a small, bounded target offset.
 * That bound is what guarantees the armillary stays in frame.
 *
 * Pure, and therefore testable without a renderer.
 */

/** Vertical field of view of the arena camera, in degrees. */
export const ARENA_FOV = 42;

/** How far the camera may rise or fall, in radians. About 72°. */
export const MAX_ELEVATION = 1.25;

/**
 * How far the aim point may leave the arena's centre, in world units. Chosen
 * so an armillary of radius ~3.5 seen from ~10.5 units still fits vertically;
 * `framing.test.ts` holds this to account.
 */
export const MAX_TARGET_OFFSET = 0.95;

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export interface AttendedFramingRequest {
  /** World position of the attended bead. Must not be the arena's centre. */
  readonly bead: THREE.Vector3;
  /** Orbit distance the camera should hold. */
  readonly distance: number;
  /** Viewport aspect ratio. */
  readonly aspect: number;
  /** Where the bead should land, in NDC. Negative y is the lower half. */
  readonly ndcX: number;
  readonly ndcY: number;
  /** Vertical field of view in degrees. */
  readonly fov?: number;
}

export interface AttendedFraming {
  /** Camera position, at exactly the requested orbit distance. */
  readonly position: THREE.Vector3;
  /** Aim point, at most `MAX_TARGET_OFFSET` from the arena's centre. */
  readonly target: THREE.Vector3;
}

/**
 * A camera pose from which `bead` lands as near as comfort allows to
 * `(ndcX, ndcY)`. Returns `null` for a degenerate request — a bead at the
 * arena's centre, or directly over a pole, where no azimuth solves it — so
 * the caller can fall back to the home pose rather than snap somewhere absurd.
 */
export function attendedFraming(
  request: AttendedFramingRequest
): AttendedFraming | null {
  const { bead, distance, aspect } = request;
  const radius = bead.length();
  if (radius < 1e-4 || distance <= 0) return null;

  const ux = bead.x / radius;
  const uy = bead.y / radius;
  const uz = bead.z / radius;

  const halfH = distance * Math.tan(((request.fov ?? ARENA_FOV) * Math.PI) / 360);
  const halfW = halfH * Math.max(aspect, 0.1);
  // The components of the unit bead direction along the camera's right and up.
  const wantRight = (request.ndcX * halfW) / radius;
  const wantUp = (request.ndcY * halfH) / radius;

  const rho = Math.hypot(ux, uz);
  if (rho < 1e-3) return null; // directly over a pole: no azimuth solves it

  // Azimuth: closed form. a = rho * sin(lambda - phi).
  const a = clamp(wantRight, -0.94 * rho, 0.94 * rho);
  const lambda = Math.atan2(ux, uz);
  const phi = lambda - Math.asin(a / rho);
  const q = Math.sqrt(Math.max(0, rho * rho - a * a));

  // Elevation: b(psi) = uy*cos(psi) - q*sin(psi), searched inside the comfort
  // range rather than inverted, because the exact inverse regularly lies
  // outside it and a clamped inverse silently returns the wrong hemisphere.
  const b = (psi: number): number => uy * Math.cos(psi) - q * Math.sin(psi);
  let best = -MAX_ELEVATION;
  let bestError = Number.POSITIVE_INFINITY;
  const STEPS = 96;
  for (let i = 0; i <= STEPS; i++) {
    const psi = -MAX_ELEVATION + (2 * MAX_ELEVATION * i) / STEPS;
    const error = Math.abs(b(psi) - wantUp);
    if (error < bestError) {
      bestError = error;
      best = psi;
    }
  }
  // Refine around the winner; the function is smooth over this interval.
  const span = (2 * MAX_ELEVATION) / STEPS;
  let lo = Math.max(-MAX_ELEVATION, best - span);
  let hi = Math.min(MAX_ELEVATION, best + span);
  for (let i = 0; i < 24; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (Math.abs(b(m1) - wantUp) <= Math.abs(b(m2) - wantUp)) hi = m2;
    else lo = m1;
  }
  const psi = (lo + hi) / 2;

  const cosPsi = Math.cos(psi);
  const position = new THREE.Vector3(
    cosPsi * Math.sin(phi),
    Math.sin(psi),
    cosPsi * Math.cos(phi)
  ).multiplyScalar(distance);

  // Whatever the bounded rotation could not deliver, the aim point absorbs —
  // up to a hard limit, so the arena never leaves the frame chasing a bead.
  //
  // Solved against the *real* projection rather than the linearised one: a
  // bead is nearer the camera than the arena's centre, so the frame is
  // narrower where it sits, and a lift computed at the centre's depth
  // consistently undershoots. Four passes converge well inside a pixel.
  const up = cameraUp(position, ORIGIN_READONLY, new THREE.Vector3());
  const target = new THREE.Vector3();
  const viewDepth = distance - bead.dot(position.clone().normalize());
  const halfHAtBead =
    Math.max(0.1, viewDepth) * Math.tan(((request.fov ?? ARENA_FOV) * Math.PI) / 360);
  let lift = 0;
  for (let i = 0; i < 4; i++) {
    target.copy(up).multiplyScalar(lift);
    const landed = projectFromPose(bead, position, target, aspect, request.fov);
    lift = clamp(
      lift + (landed.y - request.ndcY) * halfHAtBead,
      -MAX_TARGET_OFFSET,
      MAX_TARGET_OFFSET
    );
  }
  target.copy(up).multiplyScalar(lift);

  return { position, target };
}

const ORIGIN_READONLY = new THREE.Vector3(0, 0, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const zAxis = new THREE.Vector3();
const xAxis = new THREE.Vector3();
const yAxis = new THREE.Vector3();
const offset = new THREE.Vector3();

/** The camera's up vector for a roll-free pose. */
export function cameraUp(
  cameraPosition: THREE.Vector3,
  target: THREE.Vector3,
  out: THREE.Vector3
): THREE.Vector3 {
  zAxis.copy(cameraPosition).sub(target).normalize();
  xAxis.copy(WORLD_UP).cross(zAxis).normalize();
  return out.copy(zAxis).cross(xAxis);
}

/**
 * Where a world point lands in NDC for a camera at `cameraPosition` looking at
 * `target` with no roll. Used by the tests to verify the solver, and cheap
 * enough that a caller may use it to sanity-check a pose.
 */
export function projectFromPose(
  point: THREE.Vector3,
  cameraPosition: THREE.Vector3,
  target: THREE.Vector3,
  aspect: number,
  fov: number = ARENA_FOV
): { x: number; y: number } {
  zAxis.copy(cameraPosition).sub(target).normalize();
  xAxis.copy(WORLD_UP).cross(zAxis).normalize();
  yAxis.copy(zAxis).cross(xAxis);
  offset.copy(point).sub(cameraPosition);
  const depth = -offset.dot(zAxis);
  const halfH = depth * Math.tan((fov * Math.PI) / 360);
  const halfW = halfH * aspect;
  return { x: offset.dot(xAxis) / halfW, y: offset.dot(yAxis) / halfH };
}
