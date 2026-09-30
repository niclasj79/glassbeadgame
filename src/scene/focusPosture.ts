import * as THREE from "three";
import { ARENA_RADIUS } from "@/game/layout";
import { MAX_BEAD_EXTENT } from "./rings";
import {
  ARENA_FOV,
  FOCUS_ATTENDED_BEARING,
  FOCUS_ATTENDED_REACH,
  FOCUS_EDGE_CLEARANCE,
  FOCUS_FOOT_VH,
  FOCUS_NEAREST_RATIO,
  MAX_ELEVATION,
  PAIR_ATTENDED_NEAR_WEIGHT,
  PAIR_ATTENDED_WEIGHT,
  PAIR_DIRECTION_WEIGHT,
  PAIR_SECOND_BEARING,
  PAIR_SECOND_NEAR_WEIGHT,
  PAIR_SECOND_REACH,
  PAIR_SECOND_WEIGHT,
  PAIR_TURN_WEIGHT,
  PORTRAIT_ASPECT,
  READING_COLUMN_BREAKPOINT_PX,
  attendedFraming,
  compositionBox,
  createOrbitPose,
  homeComposition,
  orbitFromPosition,
  positionFromOrbit,
  projectFromPose,
  shiftNdc,
  unshiftArea,
  unshiftNdc,
  withinSafeArea,
  wrapAngle,
  type SafeArea,
  type Viewport,
} from "./framing";

/**
 * THE FOCUS VIEW'S TWO POSTURES, SOLVED (I-017).
 *
 * The laws and every number they spend are in `framing.ts` §6, where the
 * director tunes them; this is the arithmetic that spends them. It is its own
 * module for one reason: the camera fetches it after the first paint, because
 * nothing here is needed until a bead is attended and the first download is a
 * budget the project defends with dynamic imports (`scripts/bundle-budgets.json`).
 *
 * Pure, and therefore testable without a renderer, like the rest of the
 * framing. Nothing here runs on a frame: a posture is solved when the focus
 * view asks for one — Attend, Lock, a reopened thread, a resize.
 */

const clamp = (value: number, lo: number, hi: number): number =>
  value < lo ? lo : value > hi ? hi : value;

const tanHalfFov = (fov: number): number => Math.tan((fov * Math.PI) / 360);

const ORIGIN = new THREE.Vector3(0, 0, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const aspectOf = (viewport: Viewport): number =>
  Math.max(0.1, Math.max(1, viewport.width) / Math.max(1, viewport.height));

/**
 * Half-extent, in NDC-y, of a sphere of `radius` seen from `distance` with the
 * camera aimed at its centre. The exact silhouette, not the linearisation the
 * rest fit can afford: close in, the difference is the edge of the frame.
 */
export function sphereHalfExtent(
  distance: number,
  radius: number = MAX_BEAD_EXTENT,
  fov: number = ARENA_FOV
): number {
  if (!(distance > radius)) return Number.POSITIVE_INFINITY;
  return Math.tan(Math.asin(radius / distance)) / tanHalfFov(fov);
}

/**
 * Where the reading column's band stands along a portrait page's foot in the
 * focus view, in NDC-y: the rest reserve, or — on a page narrow enough for the
 * column to be a band at all — the taller band the two cards need
 * (`FOCUS_FOOT_VH`). Roaming keeps the rest reserve; only the focus view asks
 * for more.
 */
export function focusFootEdge(viewport: Viewport): number {
  const column = compositionBox(viewport).minY;
  if (viewport.width >= READING_COLUMN_BREAKPOINT_PX) return column;
  return Math.max(column, -1 + 2 * FOCUS_FOOT_VH);
}

/**
 * The box, in screen NDC (lens shift included), that the bead shell must stay
 * inside in the focus view: the viewport less `FOCUS_EDGE_CLEARANCE`, and never
 * the reading column, which holds the two cards the focus view is read in.
 */
export function focusFrameBox(viewport: Viewport): SafeArea {
  const aspect = aspectOf(viewport);
  const edgeY = 1 - FOCUS_EDGE_CLEARANCE;
  const edgeX = 1 - FOCUS_EDGE_CLEARANCE / aspect;
  const column = compositionBox(viewport);
  return aspect < PORTRAIT_ASPECT
    ? { minX: -edgeX, maxX: edgeX, minY: Math.max(-edgeY, focusFootEdge(viewport)), maxY: edgeY }
    : { minX: -edgeX, maxX: Math.min(edgeX, column.maxX), minY: -edgeY, maxY: edgeY };
}

/**
 * Where the attended bead itself may land: inside the page's ruling, out of
 * the column, with room below it for its name.
 */
export function focusBeadArea(viewport: Viewport): SafeArea {
  const aspect = aspectOf(viewport);
  const composed = compositionBox(viewport);
  const box =
    aspect < PORTRAIT_ASPECT
      ? { ...composed, minY: Math.max(composed.minY, focusFootEdge(viewport)) }
      : composed;
  const insetY = 0.06;
  const insetX = insetY / aspect;
  return {
    minX: Math.min(box.minX + insetX, (box.minX + box.maxX) / 2),
    maxX: Math.max(box.maxX - insetX, (box.minX + box.maxX) / 2),
    minY: Math.min(box.minY + insetY * 2, (box.minY + box.maxY) / 2),
    maxY: Math.max(box.maxY - insetY, (box.minY + box.maxY) / 2),
  };
}

/**
 * The focus view's distance: the nearest at which the whole bead shell, seen
 * from any direction with the camera aimed at the arena's centre, still fits
 * `focusFrameBox` — clamped between `FOCUS_NEAREST_RATIO` of rest and rest
 * itself, because the focus view closes in and never stands back.
 */
export function focusDistance(viewport: Viewport, fov: number = ARENA_FOV): number {
  const home = homeComposition(viewport, fov);
  const aspect = aspectOf(viewport);
  const box = focusFrameBox(viewport);
  const centre = home.centre;
  // The room the shell has on its tightest side, in NDC-y units.
  const room = Math.min(
    box.maxY - centre.y,
    centre.y - box.minY,
    (box.maxX - centre.x) * aspect,
    (centre.x - box.minX) * aspect
  );
  if (!(room > 0)) return home.distance;
  const fit = MAX_BEAD_EXTENT / Math.sin(Math.atan(room * tanHalfFov(fov)));
  return clamp(fit, home.distance * FOCUS_NEAREST_RATIO, home.distance);
}

/**
 * A point on the bead sphere's projected disc, in screen NDC: `bearing` degrees
 * counter-clockwise from the right, `reach` of the disc's radius out from the
 * arena's composed centre. The disc is the sphere the bead *centres* lie on,
 * so a reach of 1 is the limb a bead can at most be carried to.
 */
export function focusAnchor(
  viewport: Viewport,
  distance: number,
  bearing: number,
  reach: number,
  fov: number = ARENA_FOV
): { readonly x: number; readonly y: number } {
  const home = homeComposition(viewport, fov);
  const aspect = aspectOf(viewport);
  const disc = sphereHalfExtent(distance, ARENA_RADIUS, fov);
  const radians = (bearing * Math.PI) / 180;
  const extent = Number.isFinite(disc) ? disc : 1;
  return {
    x: home.centre.x + (reach * extent * Math.cos(radians)) / aspect,
    y: home.centre.y + reach * extent * Math.sin(radians),
  };
}

const SILHOUETTE_SAMPLES = 32;
const silhouetteCentre = new THREE.Vector3();
const silhouetteU = new THREE.Vector3();
const silhouetteW = new THREE.Vector3();
const silhouettePoint = new THREE.Vector3();

/**
 * How far past `box` the bead shell's silhouette reaches from this pose, as
 * the factor the camera would have to stand back by: 1 when it fits. Measured
 * by projecting the circle of tangency itself — the exact silhouette, through
 * whatever aim offset the pose carries — rather than by a formula that assumes
 * the camera is aimed at the arena's centre.
 */
export function shellOvershoot(
  position: THREE.Vector3,
  target: THREE.Vector3,
  viewport: Viewport,
  box: SafeArea,
  fov: number = ARENA_FOV
): number {
  const home = homeComposition(viewport, fov);
  const aspect = aspectOf(viewport);
  const distance = position.length();
  const shell = MAX_BEAD_EXTENT;
  if (!(distance > shell)) return Number.POSITIVE_INFINITY;

  // The circle of tangency: nearer the camera than the centre, smaller than
  // the sphere, in the plane square to the line of sight.
  const k = (shell * shell) / (distance * distance);
  silhouetteCentre.copy(position).multiplyScalar(k);
  const ring = shell * Math.sqrt(1 - k);
  silhouetteU.copy(position).cross(WORLD_UP);
  if (silhouetteU.lengthSq() < 1e-9) silhouetteU.set(1, 0, 0);
  silhouetteU.normalize();
  silhouetteW.copy(position).cross(silhouetteU).normalize();

  const origin = projectFromPose(ORIGIN, position, target, aspect, fov);
  const ox = origin.x + home.centre.x;
  const oy = origin.y + home.centre.y;
  if (!withinSafeArea(ox, oy, box, 0)) return Number.POSITIVE_INFINITY;

  let over = 1;
  for (let i = 0; i < SILHOUETTE_SAMPLES; i++) {
    const t = (i / SILHOUETTE_SAMPLES) * Math.PI * 2;
    silhouettePoint
      .copy(silhouetteCentre)
      .addScaledVector(silhouetteU, Math.cos(t) * ring)
      .addScaledVector(silhouetteW, Math.sin(t) * ring);
    const at = projectFromPose(silhouettePoint, position, target, aspect, fov);
    const x = at.x + home.centre.x;
    const y = at.y + home.centre.y;
    over = Math.max(
      over,
      x > ox ? (x - ox) / Math.max(1e-6, box.maxX - ox) : (ox - x) / Math.max(1e-6, ox - box.minX),
      y > oy ? (y - oy) / Math.max(1e-6, box.maxY - oy) : (oy - y) / Math.max(1e-6, oy - box.minY)
    );
  }
  return over;
}

export interface FocusFramingRequest {
  /** World position of the attended bead. */
  readonly bead: THREE.Vector3;
  readonly viewport: Viewport;
  readonly fov?: number;
  /** The orbit floor and ceiling the controls enforce. */
  readonly minDistance?: number;
  readonly maxDistance?: number;
}

export interface FocusFraming {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
  readonly distance: number;
  /** Where the attended bead lands on the screen, lens shift included. */
  readonly landed: { readonly x: number; readonly y: number };
  /** False only when even rest distance could not hold the whole shell. */
  readonly shellInside: boolean;
}

/**
 * THE ATTENDED POSTURE (I-017): the lean of §4, asked for something new.
 *
 * `attendedFraming` already turns the instrument so a bead lands where it is
 * asked, inside the level and a bounded aim offset. It is asked here for the
 * lower-left anchor, at the focus distance, with the bead kept on the page and
 * out of the column, and with no aim offset at all — an offset carries the
 * whole sphere across the screen, and at the focus distance the sphere has no
 * room to be carried. The answer is then checked against the shell's own
 * silhouette, and the camera stands back — never further than rest — until the
 * shell fits.
 */
export function focusFraming(request: FocusFramingRequest): FocusFraming | null {
  const fov = request.fov ?? ARENA_FOV;
  const { viewport, bead } = request;
  const aspect = aspectOf(viewport);
  const home = homeComposition(viewport, fov);
  const ceiling = Math.max(
    request.minDistance ?? 0,
    Math.min(home.distance, request.maxDistance ?? home.distance)
  );
  const box = focusFrameBox(viewport);
  const area = unshiftArea(focusBeadArea(viewport), home);
  let distance = clamp(focusDistance(viewport, fov), request.minDistance ?? 0, ceiling);

  let result: FocusFraming | null = null;
  for (let pass = 0; pass < 5; pass++) {
    const anchor = focusAnchor(
      viewport,
      distance,
      FOCUS_ATTENDED_BEARING,
      FOCUS_ATTENDED_REACH,
      fov
    );
    const aim = unshiftNdc(anchor.x, anchor.y, home);
    const framing = attendedFraming({
      bead,
      distance,
      aspect,
      ndcX: aim.x,
      ndcY: aim.y,
      fov,
      safeArea: area,
      maxDistance: ceiling,
      maxLift: 0,
    });
    if (!framing) return result;
    const reached = framing.position.length();
    const over = shellOvershoot(framing.position, framing.target, viewport, box, fov);
    result = {
      position: framing.position,
      target: framing.target,
      distance: reached,
      landed: shiftNdc(framing.landed.x, framing.landed.y, home),
      shellInside: over <= 1 + 1e-4,
    };
    if (result.shellInside || reached >= ceiling - 1e-3) break;
    distance = Math.min(ceiling, reached * Math.max(over, 1.01));
  }
  return result;
}

export interface PairFramingRequest {
  readonly attended: THREE.Vector3;
  readonly second: THREE.Vector3;
  readonly viewport: Viewport;
  /** Where the camera is now: of two framings nearly as good, the nearer wins. */
  readonly from: THREE.Vector3;
  readonly fov?: number;
  readonly minDistance?: number;
  readonly maxDistance?: number;
}

export interface PairFraming {
  readonly position: THREE.Vector3;
  /** Always the arena's centre: the pair is framed by turning, not by aiming. */
  readonly target: THREE.Vector3;
  readonly distance: number;
  /** Where each bead lands on the screen, lens shift included. */
  readonly attended: { readonly x: number; readonly y: number };
  readonly second: { readonly x: number; readonly y: number };
}

const PAIR_AZIMUTH_STEPS = 72;
const PAIR_ELEVATION_STEPS = 12;
const PAIR_REFINE_PASSES = 24;
const PAIR_NEIGHBOURS: readonly (readonly [number, number])[] = Object.freeze([
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]);

/**
 * THE PAIR FRAMING (I-017): both beads in frame, the attended one lower-left,
 * the second up and to the right where the sphere allows — a turn, never a cut.
 *
 * Two beads and a roll-free camera leave two degrees of freedom, azimuth and
 * elevation, for four wishes, so this is a search rather than a solve: a
 * coarse sweep of the whole orbit inside the level (§3), then a pattern search
 * round the best of it. The aim stays on the arena's centre, which keeps the
 * whole shell inside the frame at the focus distance from every direction —
 * the fit is a property of the distance alone. Deterministic: the same pair
 * from the same camera is always framed the same way.
 */
export function pairFraming(request: PairFramingRequest): PairFraming | null {
  const fov = request.fov ?? ARENA_FOV;
  const { viewport, attended, second } = request;
  const lengthA = attended.length();
  const lengthB = second.length();
  if (lengthA < 1e-4 || lengthB < 1e-4) return null;
  const aspect = aspectOf(viewport);
  const home = homeComposition(viewport, fov);
  const ceiling = Math.max(
    request.minDistance ?? 0,
    Math.min(home.distance, request.maxDistance ?? home.distance)
  );
  const distance = clamp(focusDistance(viewport, fov), request.minDistance ?? 0, ceiling);
  const wantA = focusAnchor(viewport, distance, FOCUS_ATTENDED_BEARING, FOCUS_ATTENDED_REACH, fov);
  const wantB = focusAnchor(viewport, distance, PAIR_SECOND_BEARING, PAIR_SECOND_REACH, fov);
  const from = orbitFromPosition(request.from, createOrbitPose());

  const pose = createOrbitPose();
  pose.distance = distance;
  const camera = new THREE.Vector3();
  const score = (azimuth: number, elevation: number): number => {
    pose.azimuth = azimuth;
    pose.elevation = elevation;
    positionFromOrbit(pose, camera);
    const a = projectFromPose(attended, camera, ORIGIN, aspect, fov);
    const b = projectFromPose(second, camera, ORIGIN, aspect, fov);
    const ax = (a.x + home.centre.x - wantA.x) * aspect;
    const ay = a.y + home.centre.y - wantA.y;
    const bx = (b.x + home.centre.x - wantB.x) * aspect;
    const by = b.y + home.centre.y - wantB.y;
    // The line from the attended bead to the second, against the diagonal.
    const chordX = (b.x - a.x) * aspect;
    const chordY = b.y - a.y;
    const chord = Math.hypot(chordX, chordY);
    const astray = chord > 1e-6 ? 1 - (chordX + chordY) / (chord * Math.SQRT2) : 1;
    // The far side of the instrument, measured along the line of sight.
    const farA = Math.max(0, -attended.dot(camera) / (lengthA * distance));
    const farB = Math.max(0, -second.dot(camera) / (lengthB * distance));
    const turnAz = wrapAngle(azimuth - from.azimuth);
    const turnEl = elevation - from.elevation;
    return (
      PAIR_DIRECTION_WEIGHT * astray +
      PAIR_ATTENDED_WEIGHT * (ax * ax + ay * ay) +
      PAIR_SECOND_WEIGHT * (bx * bx + by * by) +
      PAIR_ATTENDED_NEAR_WEIGHT * farA +
      PAIR_SECOND_NEAR_WEIGHT * farB +
      PAIR_TURN_WEIGHT * (turnAz * turnAz + turnEl * turnEl)
    );
  };

  let bestAzimuth = 0;
  let bestElevation = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < PAIR_AZIMUTH_STEPS; i++) {
    const azimuth = -Math.PI + (i * Math.PI * 2) / PAIR_AZIMUTH_STEPS;
    for (let j = 0; j <= PAIR_ELEVATION_STEPS; j++) {
      const elevation = -MAX_ELEVATION + (j * 2 * MAX_ELEVATION) / PAIR_ELEVATION_STEPS;
      const value = score(azimuth, elevation);
      if (value < best) {
        best = value;
        bestAzimuth = azimuth;
        bestElevation = elevation;
      }
    }
  }

  let stepAzimuth = Math.PI / PAIR_AZIMUTH_STEPS;
  let stepElevation = MAX_ELEVATION / PAIR_ELEVATION_STEPS;
  for (let pass = 0; pass < PAIR_REFINE_PASSES; pass++) {
    let moved = false;
    for (const [dAz, dEl] of PAIR_NEIGHBOURS) {
      const azimuth = wrapAngle(bestAzimuth + dAz * stepAzimuth);
      const elevation = clamp(bestElevation + dEl * stepElevation, -MAX_ELEVATION, MAX_ELEVATION);
      const value = score(azimuth, elevation);
      if (value < best - 1e-12) {
        best = value;
        bestAzimuth = azimuth;
        bestElevation = elevation;
        moved = true;
      }
    }
    if (!moved) {
      stepAzimuth /= 2;
      stepElevation /= 2;
    }
  }

  pose.azimuth = bestAzimuth;
  pose.elevation = bestElevation;
  const position = positionFromOrbit(pose, new THREE.Vector3());
  const a = projectFromPose(attended, position, ORIGIN, aspect, fov);
  const b = projectFromPose(second, position, ORIGIN, aspect, fov);
  return {
    position,
    target: new THREE.Vector3(0, 0, 0),
    distance,
    attended: shiftNdc(a.x, a.y, home),
    second: shiftNdc(b.x, b.y, home),
  };
}
