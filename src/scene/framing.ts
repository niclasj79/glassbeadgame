import * as THREE from "three";
import { ARENA_RADIUS } from "@/game/layout";

/**
 * HOW THE WORLD IS COMPOSED ON THE SCREEN
 *
 * Four things live here, and they live together because they are one problem:
 * a frame is only well composed if the camera, the instrument, the plate and
 * the phrasing of the move all agree about where the edges are.
 *
 *   1. THE FRAME     the safe area — how close anything drawn around a bead
 *                    may come to a viewport edge, and how large the intention
 *                    plate actually is once its labels are counted.
 *   2. THE LEVEL     where the world's horizon lands for a given elevation,
 *                    and therefore how far the camera may rise before the
 *                    level sweeps out of frame.
 *   3. THE POSTURE   the attended pose, solved rather than nudged.
 *   4. THE PHRASING  one tempo, and every camera move a whole or half multiple
 *                    of it, damped in orbit coordinates so a move is always a
 *                    turn of the instrument and never a cut through it.
 *
 * All of it is pure, and therefore testable without a renderer. Nothing here
 * allocates on a frame path: the dampers write through carriers the caller
 * owns.
 */

/* ────────────────────────────────────────────────────────────────────── *
 * 1. THE FRAME
 * ────────────────────────────────────────────────────────────────────── */

/** Vertical field of view of the arena camera, in degrees. */
export const ARENA_FOV = 42;

const tanHalfFov = (fov: number): number => Math.tan((fov * Math.PI) / 360);

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/**
 * The box, in NDC, that the *anchor* of a screen-space plate must stay inside
 * so that no part of the plate — including its outermost engraved label —
 * can reach a viewport edge. It is not symmetric: the plate is not.
 */
export interface SafeArea {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Fingertip minimum for a verb station, in CSS pixels. */
export const STATION_SIZE = 48;
/** The two utility controls are smaller, because they are not verbs. */
export const UTILITY_SIZE = 44;
/**
 * No two controls — and no control and a neighbouring label — may come closer
 * than this. Below it two targets are one target, whatever the design says.
 */
export const CONTROL_CLEARANCE = 24;

/**
 * The smallest ring radius at which two adjacent verb stations are still two
 * separate targets. Four cardinal stations on a ring of radius r are separated
 * by (r, r), so their boxes clear each other by exactly `r - STATION_SIZE`.
 */
export const MIN_RING_RADIUS = STATION_SIZE + CONTROL_CLEARANCE;

/**
 * A narrow viewport is a phone whatever it claims about pointers, and a coarse
 * pointer is a finger at any width — either one gets the open plate. The plate
 * used to *shrink* below this width, which put four fingertip targets and two
 * more inside a 124 px circle.
 */
export const COMPACT_VIEWPORT = 560;

const RING_RADIUS_FINE = 86;
const RING_RADIUS_TOUCH = 80;

/** Nominal box of an engraved station label, in CSS pixels. */
const LABEL_HALF_WIDTH = 30;
const LABEL_HEIGHT = 11;
/** Gap between a station and its label, above/below and beside. */
const LABEL_GAP = 6;
const LABEL_GAP_SIDE = 8;

/**
 * How far beneath the plate the attended bead's own name hangs.
 *
 * INTEGRATOR NOTE: `scene/Beads.tsx` hard-codes this same number as
 * `ATTENDED_LABEL_DROP_PX`. It should import this one; two copies of a
 * composition constant is one copy too many, and that file is not mine.
 */
export const ATTENDED_LABEL_DROP_PX = 148;
const ATTENDED_LABEL_HALF_HEIGHT = 10;

/**
 * A few pixels of air past the outermost thing the plate draws. "Must not
 * reach the edge" is not "may be tangent to it": a bound solved to exactly
 * zero clearance lands on the edge as soon as anything rounds.
 */
const SAFE_MARGIN = 3;

/**
 * The measured plate. Every number is derived from the clearance law rather
 * than authored, so a change to the fingertip minimum moves the whole plate
 * instead of quietly breaking one gap.
 */
export interface PlateGeometry {
  /** Radius of the engraved ring the four verbs stand on, in CSS pixels. */
  readonly ring: number;
  /** Hit size of a verb station. */
  readonly station: number;
  /** Hit size of a utility control. */
  readonly utility: number;
  /** Radius of the utility rail, outside the graduated circle. */
  readonly railRadius: number;
  /** Bearings of the two utility controls, degrees counter-clockwise of east. */
  readonly railBearings: readonly [number, number];
  /** Side of the square the plate is drawn into. */
  readonly box: number;
  /** Distance from the anchored bead to the plate's outermost pixel, per side. */
  readonly extentUp: number;
  readonly extentDown: number;
  readonly extentSide: number;
}

/**
 * The utility rail is not placed, it is solved: the smallest radius on the
 * upper diagonals at which a utility control clears every verb station, and
 * every verb's engraved label, by `CONTROL_CLEARANCE`.
 */
function railRadiusFor(ring: number, station: number, utility: number): number {
  const widest = Math.max(station, LABEL_HALF_WIDTH * 2);
  const diagonal =
    Math.SQRT2 * (widest / 2 + utility / 2 + CONTROL_CLEARANCE);
  const clearOfRing = ring + utility / 2 + CONTROL_CLEARANCE;
  return Math.max(diagonal, clearOfRing);
}

/** Where the four verbs stand, and which side their engraved name sits on. */
export type PlateStation = "north" | "east" | "south" | "west";

export interface PlateStationLayout {
  /** Bearing in degrees, measured counter-clockwise from east. */
  readonly bearing: number;
  readonly labelPlacement: "above" | "below" | "left" | "right";
}

export const PLATE_STATIONS: Readonly<
  Record<PlateStation, PlateStationLayout>
> = Object.freeze({
  north: { bearing: 90, labelPlacement: "above" },
  east: { bearing: 0, labelPlacement: "right" },
  south: { bearing: 270, labelPlacement: "below" },
  west: { bearing: 180, labelPlacement: "left" },
});

/** A measured box on the plate, in CSS pixels, +x right and +y down. */
export interface PlateBox {
  readonly id: string;
  readonly kind: "verb" | "utility" | "label";
  /** The control a label belongs to, so a control is not measured against it. */
  readonly owner: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Separation between two boxes. Negative means they overlap. */
export function boxGap(a: PlateBox, b: PlateBox): number {
  return Math.max(
    Math.abs(a.x - b.x) - (a.width + b.width) / 2,
    Math.abs(a.y - b.y) - (a.height + b.height) / 2
  );
}

function atBearing(
  bearing: number,
  radius: number
): { readonly x: number; readonly y: number } {
  const radians = (bearing * Math.PI) / 180;
  return { x: Math.cos(radians) * radius, y: -Math.sin(radians) * radius };
}

/**
 * Every box the plate puts on the screen. This is what the clearance law is
 * asserted against — a law nobody can measure is a law nobody keeps.
 */
export function plateBoxes(plate: PlateGeometry): PlateBox[] {
  const boxes: PlateBox[] = [];
  for (const key of Object.keys(PLATE_STATIONS) as PlateStation[]) {
    const layout = PLATE_STATIONS[key];
    const at = atBearing(layout.bearing, plate.ring);
    boxes.push({
      id: key,
      kind: "verb",
      owner: key,
      x: at.x,
      y: at.y,
      width: plate.station,
      height: plate.station,
    });
    const outward = plate.station / 2;
    const label =
      layout.labelPlacement === "above"
        ? { dx: 0, dy: -(outward + LABEL_GAP + LABEL_HEIGHT / 2) }
        : layout.labelPlacement === "below"
          ? { dx: 0, dy: outward + LABEL_GAP + LABEL_HEIGHT / 2 }
          : layout.labelPlacement === "left"
            ? { dx: -(outward + LABEL_GAP_SIDE + LABEL_HALF_WIDTH), dy: 0 }
            : { dx: outward + LABEL_GAP_SIDE + LABEL_HALF_WIDTH, dy: 0 };
    boxes.push({
      id: `${key}-label`,
      kind: "label",
      owner: key,
      x: at.x + label.dx,
      y: at.y + label.dy,
      width: LABEL_HALF_WIDTH * 2,
      height: LABEL_HEIGHT,
    });
  }
  plate.railBearings.forEach((bearing, index) => {
    const at = atBearing(bearing, plate.railRadius);
    const id = index === 0 ? "cancel" : "inspect";
    boxes.push({
      id,
      kind: "utility",
      owner: id,
      x: at.x,
      y: at.y,
      width: plate.utility,
      height: plate.utility,
    });
  });
  return boxes;
}

export function plateGeometry(
  viewportWidth: number,
  coarsePointer: boolean
): PlateGeometry {
  const touch = coarsePointer || viewportWidth < COMPACT_VIEWPORT;
  const ring = Math.max(
    MIN_RING_RADIUS,
    touch ? RING_RADIUS_TOUCH : RING_RADIUS_FINE
  );
  const station = STATION_SIZE;
  const utility = UTILITY_SIZE;
  const railRadius = railRadiusFor(ring, station, utility);
  const extentUp = railRadius + utility / 2 + SAFE_MARGIN;
  const extentDown =
    Math.max(
      ring + station / 2 + LABEL_GAP + LABEL_HEIGHT,
      ATTENDED_LABEL_DROP_PX + ATTENDED_LABEL_HALF_HEIGHT
    ) + SAFE_MARGIN;
  const extentSide =
    Math.max(
      ring + station / 2 + LABEL_GAP_SIDE + LABEL_HALF_WIDTH * 2,
      railRadius / Math.SQRT2 + utility / 2
    ) + SAFE_MARGIN;
  return {
    ring,
    station,
    utility,
    railRadius,
    railBearings: [135, 45],
    box: Math.ceil(2 * extentUp),
    extentUp,
    extentDown,
    extentSide,
  };
}

/**
 * The margin's inner ruling, as a fraction of a half-height. Inside it is the
 * reading area; a plate that crosses it is drawn on the page's margin.
 *
 * INTEGRATOR NOTE: `scene/MarginRule.tsx` strikes this rule at 0.115 in its
 * own shader. Two copies again, and that file is not mine either.
 */
export const FRAME_RULE_INSET = 0.115;

/**
 * The safe area for a plate of this size in this viewport, in three steps of
 * degradation, because a phone genuinely cannot hold a fingertip-sized plate
 * inside the ruled margin and saying so is better than pretending:
 *
 *   1. inside the ruled margin, if the plate fits there;
 *   2. otherwise inside the viewport, which is the hard bound — nothing may
 *      ever be clipped;
 *   3. otherwise the centre of the frame, which is the best a viewport that
 *      small can offer.
 */
export function plateSafeArea(
  plate: PlateGeometry,
  viewport: Viewport
): SafeArea {
  const halfW = Math.max(1, viewport.width) / 2;
  const halfH = Math.max(1, viewport.height) / 2;
  const aspect = Math.max(0.1, viewport.width / Math.max(1, viewport.height));
  const horizontal = safeInterval(
    plate.extentSide / halfW,
    plate.extentSide / halfW,
    FRAME_RULE_INSET / aspect
  );
  const vertical = safeInterval(
    plate.extentDown / halfH,
    plate.extentUp / halfH,
    FRAME_RULE_INSET
  );
  return {
    minX: horizontal.min,
    maxX: horizontal.max,
    minY: vertical.min,
    maxY: vertical.max,
  };
}

/** One axis of the safe area: ruled margin, then viewport, then the centre. */
function safeInterval(
  low: number,
  high: number,
  rule: number
): { readonly min: number; readonly max: number } {
  const inset = low + high + rule * 2 < 2 ? rule : 0;
  if (low + high + inset * 2 >= 2) return { min: 0, max: 0 };
  return { min: -1 + inset + low, max: 1 - inset - high };
}

export function clampToSafeArea(
  ndcX: number,
  ndcY: number,
  area: SafeArea
): { readonly x: number; readonly y: number } {
  return {
    x: clamp(ndcX, area.minX, area.maxX),
    y: clamp(ndcY, area.minY, area.maxY),
  };
}

export function withinSafeArea(
  ndcX: number,
  ndcY: number,
  area: SafeArea,
  epsilon = 1e-3
): boolean {
  return (
    ndcX >= area.minX - epsilon &&
    ndcX <= area.maxX + epsilon &&
    ndcY >= area.minY - epsilon &&
    ndcY <= area.maxY + epsilon
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 * 2. THE LEVEL
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Where the world's horizon lands, in NDC, for a roll-free camera at this
 * elevation aimed at the arena's centre. The environment's lit band is the
 * y = 0 great circle of the sky, so the horizon is exactly `tan(elevation)`
 * over `tan(fov/2)` — it leaves the frame the moment the camera climbs past
 * half the field of view.
 */
export function horizonNdcY(elevation: number, fov: number = ARENA_FOV): number {
  return Math.tan(elevation) / tanHalfFov(fov);
}

/**
 * How far from the centre line a scripted move may carry the level. Under 1,
 * so the horizon is still a straight rule near the frame edge rather than a
 * swooping arc through the corners.
 */
export const MAX_HORIZON_NDC = 0.9;

/**
 * The elevation band a *composing* move may use. The old bound was 1.25 rad —
 * 72° — from which the horizon sits at NDC 7.8 and the world reads as a
 * tumbling wireframe. Bounding the level is why the attend now leaves some
 * beads above the centre line: a bead on the crown of the instrument cannot
 * be carried below centre without throwing the world's level away, and the
 * level is worth more than the corner.
 */
export const MAX_ELEVATION = Math.atan(MAX_HORIZON_NDC * tanHalfFov(ARENA_FOV));

/**
 * Half-height of the instrument that must never leave the frame: the outer
 * edge of the armillary's prime circle, with a little air. `Armillary.tsx`
 * strikes that circle at 1.21 arena radii and rolls it 0.07 wide, and its own
 * test holds it inside this.
 */
export const INSTRUMENT_HALF_SPAN = ARENA_RADIUS * 1.24;

/** Absolute ceiling on the aim offset, whatever the distance allows. */
const TARGET_OFFSET_CEILING = 1.6;

/**
 * How far the aim point may leave the arena's centre at a given distance:
 * exactly the room left over once the instrument has been fitted vertically.
 * It used to be a single constant tuned for one distance, which was either
 * timid when the camera stood back or a promise it could not keep when it
 * came close.
 */
export function maxTargetOffset(
  distance: number,
  fov: number = ARENA_FOV
): number {
  return clamp(
    distance * tanHalfFov(fov) - INSTRUMENT_HALF_SPAN,
    0,
    TARGET_OFFSET_CEILING
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 * 3. THE ATTENDED POSTURE, SOLVED RATHER THAN NUDGED
 * ────────────────────────────────────────────────────────────────────── */

/**
 * I-012 asks for a situated, off-centre posture that still preserves the whole
 * spherical arena. Panning the target to shove the bead into a corner drags
 * the arena out of frame with it, so the instrument is *turned* instead: the
 * camera orbits to a position from which the attended bead falls where we
 * want it, while still aimed at the arena's centre.
 *
 * With no camera roll the camera's right vector is always horizontal, which
 * makes the azimuth a closed form. The elevation is bounded by the level
 * (§2) — the camera never flies to the pole to chase a bead that is already
 * overhead — so it is solved by search within that range, and whatever the
 * rotation could not deliver is absorbed by a bounded target offset.
 *
 * Finally the pose is checked against the safe area, and if the plate would
 * not fit the camera *stands back* until it does. Standing back is the only
 * honest remedy: cropping the plate is the defect this exists to prevent.
 */

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
  /** Box the bead's plate must fit inside. Omit to compose without one. */
  readonly safeArea?: SafeArea;
  /** How far back the camera may stand to make the plate fit. */
  readonly maxDistance?: number;
}

export interface AttendedFraming {
  /** Camera position, on the orbit sphere. */
  readonly position: THREE.Vector3;
  /** Aim point, within `maxTargetOffset` of the arena's centre. */
  readonly target: THREE.Vector3;
  /** Where the bead actually lands, in NDC. */
  readonly landed: { readonly x: number; readonly y: number };
  /** False when even the furthest allowed pose could not fit the plate. */
  readonly safe: boolean;
}

/**
 * The azimuth is solved against the frame measured at the *arena's* depth,
 * but the bead is nearer the camera than that, so the frame is narrower where
 * it actually sits and the first solve always lands the bead further out than
 * asked. The vertical solve has always corrected for this by measuring; the
 * horizontal one did not, and on a portrait viewport — where the frame is
 * narrow and the safe area correspondingly tight — that error was the
 * difference between the plate fitting and the plate hanging off the side.
 *
 * Four passes of the same measured correction, sharing the elevation and lift
 * solve underneath.
 */
function solvePose(
  bead: THREE.Vector3,
  distance: number,
  aspect: number,
  ndcX: number,
  ndcY: number,
  fov: number
): { position: THREE.Vector3; target: THREE.Vector3 } | null {
  let asked = ndcX;
  let pose = solveOnce(bead, distance, aspect, asked, ndcY, fov);
  for (let pass = 0; pass < 7 && pose; pass++) {
    const landed = projectFromPose(bead, pose.position, pose.target, aspect, fov);
    const error = ndcX - landed.x;
    if (Math.abs(error) < 2e-4) break;
    asked = clamp(asked + error, -1.4, 1.4);
    pose = solveOnce(bead, distance, aspect, asked, ndcY, fov);
  }
  return pose;
}

function solveOnce(
  bead: THREE.Vector3,
  distance: number,
  aspect: number,
  ndcX: number,
  ndcY: number,
  fov: number
): { position: THREE.Vector3; target: THREE.Vector3 } | null {
  const radius = bead.length();
  if (radius < 1e-4 || distance <= 0) return null;

  const ux = bead.x / radius;
  const uy = bead.y / radius;
  const uz = bead.z / radius;

  const halfH = distance * tanHalfFov(fov);
  const halfW = halfH * Math.max(aspect, 0.1);
  // The components of the unit bead direction along the camera's right and up.
  const wantRight = (ndcX * halfW) / radius;
  const wantUp = (ndcY * halfH) / radius;

  const rho = Math.hypot(ux, uz);
  if (rho < 1e-3) return null; // directly over a pole: no azimuth solves it

  // Azimuth: closed form. a = rho * sin(lambda - phi).
  const a = clamp(wantRight, -0.94 * rho, 0.94 * rho);
  const lambda = Math.atan2(ux, uz);
  const phi = lambda - Math.asin(a / rho);
  const q = Math.sqrt(Math.max(0, rho * rho - a * a));

  // Elevation: b(psi) = uy*cos(psi) - q*sin(psi), searched inside the level
  // bound rather than inverted, because the exact inverse regularly lies
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
  // up to the limit that keeps the whole instrument in frame.
  //
  // Solved against the *real* projection rather than the linearised one: a
  // bead is nearer the camera than the arena's centre, so the frame is
  // narrower where it sits, and a lift computed at the centre's depth
  // consistently undershoots. Four passes converge well inside a pixel.
  const bound = maxTargetOffset(distance, fov);
  const up = cameraUp(position, ORIGIN_READONLY, new THREE.Vector3());
  const target = new THREE.Vector3();
  const viewDepth = distance - bead.dot(position.clone().normalize());
  const halfHAtBead = Math.max(0.1, viewDepth) * tanHalfFov(fov);
  let lift = 0;
  for (let i = 0; i < 4; i++) {
    target.copy(up).multiplyScalar(lift);
    const landed = projectFromPose(bead, position, target, aspect, fov);
    lift = clamp(lift + (landed.y - ndcY) * halfHAtBead, -bound, bound);
  }
  target.copy(up).multiplyScalar(lift);

  return { position, target };
}

/**
 * A camera pose from which `bead` lands as near as the level allows to
 * `(ndcX, ndcY)`, and — when a safe area is supplied — never outside it.
 * Returns `null` for a degenerate request (a bead at the arena's centre, or
 * directly over a pole, where no azimuth solves it) so the caller can fall
 * back rather than snap somewhere absurd.
 */
export function attendedFraming(
  request: AttendedFramingRequest
): AttendedFraming | null {
  const fov = request.fov ?? ARENA_FOV;
  const { bead, aspect, safeArea } = request;
  // Aim a hair inside the box, and judge the answer against the box itself:
  // a pose solved to land exactly on the boundary lands *just* over it as
  // often as it lands just under, and just over is a clipped plate.
  const wanted = safeArea
    ? clampToSafeArea(request.ndcX, request.ndcY, insetArea(safeArea, 3e-3))
    : { x: request.ndcX, y: request.ndcY };

  const ceiling = Math.max(request.distance, request.maxDistance ?? request.distance);
  let distance = request.distance;
  let solved: AttendedFraming | null = null;

  for (let pass = 0; pass < 4; pass++) {
    const pose = solvePose(bead, distance, aspect, wanted.x, wanted.y, fov);
    if (!pose) return null;
    const landed = projectFromPose(bead, pose.position, pose.target, aspect, fov);
    const safe = safeArea
      ? withinSafeArea(landed.x, landed.y, safeArea, 0)
      : true;
    solved = { position: pose.position, target: pose.target, landed, safe };
    if (safe || !safeArea || distance >= ceiling - 1e-3) break;

    // Standing back shrinks every screen offset in proportion, so the factor
    // that would have fitted the worst axis is the factor to stand back by.
    const grow = Math.max(
      overshoot(landed.x, safeArea.minX, safeArea.maxX),
      overshoot(landed.y, safeArea.minY, safeArea.maxY)
    );
    const next = clamp(distance * Math.max(grow, 1.02), distance, ceiling);
    if (next <= distance + 1e-3) break;
    distance = next;
  }
  return solved;
}

/** The same box, pulled in by `by` on every side, never past its centre. */
function insetArea(area: SafeArea, by: number): SafeArea {
  const midX = (area.minX + area.maxX) / 2;
  const midY = (area.minY + area.maxY) / 2;
  return {
    minX: Math.min(area.minX + by, midX),
    maxX: Math.max(area.maxX - by, midX),
    minY: Math.min(area.minY + by, midY),
    maxY: Math.max(area.maxY - by, midY),
  };
}

/** How much further out a landed coordinate is than its allowed bound. */
function overshoot(value: number, min: number, max: number): number {
  if (value > max && max > 1e-3) return value / max;
  if (value < min && min < -1e-3) return value / min;
  return 1;
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
  const halfH = depth * tanHalfFov(fov);
  const halfW = halfH * aspect;
  return { x: offset.dot(xAxis) / halfW, y: offset.dot(yAxis) / halfH };
}

/* ────────────────────────────────────────────────────────────────────── *
 * 4. THE PHRASING
 * ────────────────────────────────────────────────────────────────────── */

/**
 * ONE TEMPO.
 *
 * Every scripted camera move used to carry its own hand-picked smoothing time
 * — 0.5, 0.8, 0.85, 0.9, 0.95, 1.0, 1.1, 1.3, 1.4 — which is nine motion
 * characters, not one. They are now named phrases, and every phrase is a whole
 * or half multiple of a single beat, so the moves are *related* to each other
 * the way the intervals of a scale are.
 *
 *   breath   ½   arming: a short inward breath, no re-framing
 *   lean     1   attending: the instrument turns toward an idea
 *   release  1   the same length, reversed: attention let go of
 *   square   1   the Lens: squaring up to a plane reading
 *   settle  1½   a phase arriving
 *   dwell   1½   a reveal: staying with what was found
 *   crown    2   the concluding rise. The one phrase that leaves the level
 *                behind, and it announces that by taking twice as long.
 */
export const CAMERA_BEAT_SECONDS = 0.7;

export type CameraPhrase =
  | "breath"
  | "lean"
  | "release"
  | "square"
  | "settle"
  | "dwell"
  | "crown";

const PHRASE_BEATS: Readonly<Record<CameraPhrase, number>> = Object.freeze({
  breath: 0.5,
  lean: 1,
  release: 1,
  square: 1,
  settle: 1.5,
  dwell: 1.5,
  crown: 2,
});

export function phraseSmoothTime(phrase: CameraPhrase): number {
  return CAMERA_BEAT_SECONDS * PHRASE_BEATS[phrase];
}

/** Every phrase, for tests that assert the language is closed. */
export const CAMERA_PHRASES = Object.freeze(
  Object.keys(PHRASE_BEATS) as CameraPhrase[]
);

/**
 * ORBIT COORDINATES.
 *
 * Damping a camera's Cartesian position drives it along a chord — straight
 * through the instrument — so the elevation changes fastest in the middle of
 * the move and the horizon whips. Damping distance, azimuth and elevation
 * makes every scripted move a *turn* of the instrument at a controlled rate,
 * which is what gives the camera one motion character instead of several.
 */
export interface OrbitPose {
  distance: number;
  azimuth: number;
  elevation: number;
}

export function createOrbitPose(): OrbitPose {
  return { distance: 0, azimuth: 0, elevation: 0 };
}

export function orbitFromPosition(
  position: THREE.Vector3,
  out: OrbitPose
): OrbitPose {
  const distance = position.length();
  out.distance = distance;
  out.azimuth = Math.atan2(position.x, position.z);
  out.elevation =
    distance < 1e-6 ? 0 : Math.asin(clamp(position.y / distance, -1, 1));
  return out;
}

export function positionFromOrbit(
  orbit: OrbitPose,
  out: THREE.Vector3
): THREE.Vector3 {
  const cos = Math.cos(orbit.elevation);
  return out
    .set(
      cos * Math.sin(orbit.azimuth),
      Math.sin(orbit.elevation),
      cos * Math.cos(orbit.azimuth)
    )
    .multiplyScalar(orbit.distance);
}

/** To (-PI, PI]. */
export function wrapAngle(radians: number): number {
  const wrapped = ((radians + Math.PI) % (Math.PI * 2) + Math.PI * 2) %
    (Math.PI * 2);
  return wrapped - Math.PI;
}

/**
 * A critically damped scalar, carrying its own velocity. This is the same
 * formulation `maath`'s `damp` uses, restated here so the phrasing can be
 * exercised without a renderer — the motion *character* of an orbit move and
 * a position move therefore stays identical.
 */
export interface Damped {
  value: number;
  velocity: number;
}

export function createDamped(value = 0): Damped {
  return { value, velocity: 0 };
}

export function dampScalar(
  state: Damped,
  goal: number,
  smoothTime: number,
  dt: number
): number {
  const time = Math.max(1e-4, smoothTime);
  const omega = 2 / time;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = state.value - goal;
  const temp = (state.velocity + omega * change) * dt;
  state.velocity = (state.velocity - omega * temp) * decay;
  let next = goal + (change + temp) * decay;
  // Never sail past the goal; an overshooting camera reads as a stumble.
  // `change < 0` means the goal was above us, so landing above it overshot.
  if (change < 0 === next > goal) {
    next = goal;
    state.velocity = 0;
  }
  state.value = next;
  return next;
}

/** The same damper on a circle: always the short way round. */
export function dampAngle(
  state: Damped,
  goal: number,
  smoothTime: number,
  dt: number
): number {
  const nearest = state.value + wrapAngle(goal - state.value);
  const next = dampScalar(state, nearest, smoothTime, dt);
  state.value = wrapAngle(next);
  return state.value;
}

export interface OrbitDamper {
  readonly distance: Damped;
  readonly azimuth: Damped;
  readonly elevation: Damped;
}

export function createOrbitDamper(): OrbitDamper {
  return {
    distance: createDamped(),
    azimuth: createDamped(),
    elevation: createDamped(),
  };
}

/**
 * Step the camera one frame along its orbit toward `goal`.
 *
 * The camera's *current* position is authoritative — the player's own orbit,
 * and the controls' damping, move it between frames — so the damper carries
 * only velocity. Writes through `out`; allocates nothing.
 */
export function dampOrbitToward(
  damper: OrbitDamper,
  current: THREE.Vector3,
  goal: OrbitPose,
  smoothTime: number,
  dt: number,
  scratch: OrbitPose,
  out: THREE.Vector3
): THREE.Vector3 {
  orbitFromPosition(current, scratch);
  damper.distance.value = scratch.distance;
  damper.azimuth.value = scratch.azimuth;
  damper.elevation.value = scratch.elevation;
  scratch.distance = dampScalar(damper.distance, goal.distance, smoothTime, dt);
  scratch.azimuth = dampAngle(damper.azimuth, goal.azimuth, smoothTime, dt);
  scratch.elevation = dampScalar(
    damper.elevation,
    goal.elevation,
    smoothTime,
    dt
  );
  return positionFromOrbit(scratch, out);
}
