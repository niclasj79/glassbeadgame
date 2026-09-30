import * as THREE from "three";
import { arcPoint } from "./curves";

/**
 * PICKING A COMMITTED THREAD (I-019).
 *
 * A thread is drawn in the vertex shader from three points, so there is no
 * geometry a raycaster could hit — which is right for drawing and useless for
 * pointing. What a hand can point at is the strand *on the screen*. So every
 * committed ribbon writes the three points it was drawn from into the registry
 * below, once per frame and without allocating, and a click projects them —
 * sampled along the same Bézier the shader evaluates — into the canvas's own
 * pixels and asks which strand passes nearest.
 *
 * The registry is module state, like `frameState`, because it moves at the
 * rate of the world: no store, no React state, no re-render. Projection happens
 * only when a pointer asks, which is at most once per pointer event rather than
 * once per thread per frame.
 *
 * Nothing here decides what reopening means or when it is allowed; that is the
 * interpretation's (`reopenThread`, roaming only). This only answers "which
 * strand is under this point".
 */

/** A committed thread as the ribbon draws it, in world space. */
export interface ThreadCurve {
  readonly a: THREE.Vector3;
  readonly m: THREE.Vector3;
  readonly b: THREE.Vector3;
}

/** Every committed ribbon's curve, as of the last frame it was drawn in. */
export const threadCurves = new Map<string, ThreadCurve>();

/** Called by a committed ribbon every frame; allocates only the first time. */
export function writeThreadCurve(
  threadId: string,
  a: THREE.Vector3,
  m: THREE.Vector3,
  b: THREE.Vector3
): void {
  let curve = threadCurves.get(threadId);
  if (curve === undefined) {
    curve = { a: new THREE.Vector3(), m: new THREE.Vector3(), b: new THREE.Vector3() };
    threadCurves.set(threadId, curve);
  }
  curve.a.copy(a);
  curve.m.copy(m);
  curve.b.copy(b);
}

/** Called when a ribbon unmounts: a strand no longer drawn cannot be pointed at. */
export function forgetThreadCurve(threadId: string): void {
  threadCurves.delete(threadId);
}

/**
 * A strand on the screen: samples along the curve in CSS pixels, relative to
 * the canvas's top-left, with each sample's distance from the camera. A sample
 * behind the camera is NaN on both axes, and no segment touching it can be
 * picked — a strand is not under the pointer because its reflection would be.
 */
export interface ProjectedCurve {
  readonly threadId: string;
  readonly xs: ArrayLike<number>;
  readonly ys: ArrayLike<number>;
  readonly depths: ArrayLike<number>;
}

/** How many segments a strand is cut into for picking. */
export const PICK_SEGMENTS = 24;
/**
 * How near a click must fall to a strand to reopen it (I-019). Generous rather
 * than exact: a thread is a fine line, and nothing here asks for aim.
 */
export const MOUSE_PICK_RADIUS_PX = 14;
export const TOUCH_PICK_RADIUS_PX = 22;
/** Two strands this close to equally near are a tie, and the nearer one to the eye wins. */
const TIE_PX = 0.5;

export function pickRadiusFor(pointerType: string | undefined): number {
  return pointerType === "touch" || pointerType === "pen"
    ? TOUCH_PICK_RADIUS_PX
    : MOUSE_PICK_RADIUS_PX;
}

interface SegmentHit {
  readonly distance: number;
  readonly depth: number;
}

/** Nearest approach of a point to one strand, with the depth where it happens. */
function nearestOnCurve(
  x: number,
  y: number,
  curve: ProjectedCurve
): SegmentHit | null {
  let best: SegmentHit | null = null;
  const count = Math.min(curve.xs.length, curve.ys.length, curve.depths.length);
  for (let i = 1; i < count; i += 1) {
    const ax = curve.xs[i - 1];
    const ay = curve.ys[i - 1];
    const bx = curve.xs[i];
    const by = curve.ys[i];
    if (
      !Number.isFinite(ax) ||
      !Number.isFinite(ay) ||
      !Number.isFinite(bx) ||
      !Number.isFinite(by)
    ) {
      continue;
    }
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t =
      lengthSq === 0
        ? 0
        : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq));
    const distance = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
    const depth = curve.depths[i - 1] + (curve.depths[i] - curve.depths[i - 1]) * t;
    if (best === null || distance < best.distance) best = { distance, depth };
  }
  return best;
}

/**
 * The committed thread whose strand passes nearest `point`, within
 * `radiusPx` — or none. When two strands pass equally near (within half a
 * pixel), the one nearer the camera wins, so the strand you can see in front
 * is the one you reopen.
 */
export function nearestThreadAt(
  point: Readonly<{ x: number; y: number }>,
  curves: readonly ProjectedCurve[],
  radiusPx: number
): string | null {
  let bestId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestDepth = Number.POSITIVE_INFINITY;
  for (const curve of curves) {
    const hit = nearestOnCurve(point.x, point.y, curve);
    if (hit === null || hit.distance > radiusPx) continue;
    if (
      hit.distance < bestDistance - TIE_PX ||
      (Math.abs(hit.distance - bestDistance) <= TIE_PX && hit.depth < bestDepth)
    ) {
      bestId = curve.threadId;
      bestDistance = hit.distance;
      bestDepth = hit.depth;
    }
  }
  return bestId;
}

const sample = new THREE.Vector3();
const viewSpace = new THREE.Vector3();
const cameraPosition = new THREE.Vector3();

/**
 * Every registered strand, projected through `camera` into a canvas of
 * `width` × `height` CSS pixels. The camera's matrices must be current — call
 * `camera.updateMatrixWorld()` first, as the bead picking does.
 */
export function projectThreadCurves(
  camera: THREE.Camera,
  width: number,
  height: number,
  curves: ReadonlyMap<string, ThreadCurve> = threadCurves,
  segments: number = PICK_SEGMENTS
): ProjectedCurve[] {
  camera.getWorldPosition(cameraPosition);
  const projected: ProjectedCurve[] = [];
  for (const [threadId, curve] of curves) {
    const xs = new Float32Array(segments + 1);
    const ys = new Float32Array(segments + 1);
    const depths = new Float32Array(segments + 1);
    for (let i = 0; i <= segments; i += 1) {
      arcPoint(curve.a, curve.m, curve.b, i / segments, sample);
      depths[i] = sample.distanceTo(cameraPosition);
      viewSpace.copy(sample).applyMatrix4(camera.matrixWorldInverse);
      if (viewSpace.z >= 0) {
        xs[i] = Number.NaN;
        ys[i] = Number.NaN;
        continue;
      }
      sample.project(camera);
      xs[i] = ((sample.x + 1) / 2) * width;
      ys[i] = ((1 - sample.y) / 2) * height;
    }
    projected.push({ threadId, xs, ys, depths });
  }
  return projected;
}
