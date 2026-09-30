import * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";
import { arcPoint } from "./curves";
import {
  MOUSE_PICK_RADIUS_PX,
  TOUCH_PICK_RADIUS_PX,
  forgetThreadCurve,
  nearestThreadAt,
  pickRadiusFor,
  projectThreadCurves,
  threadCurves,
  writeThreadCurve,
  type ProjectedCurve,
} from "./threadPicking";

/**
 * A woven strand has no geometry a raycaster could hit — the ribbon is placed
 * in its vertex shader — so reopening one (I-019) rests entirely on this: the
 * strand projected into the canvas's pixels, and the nearest segment to a
 * click. These prove the arithmetic and the projection without a renderer.
 */

/** A straight projected strand from (x0, y0) to (x1, y1), at a constant depth. */
const strand = (
  threadId: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  depth = 10,
  samples = 8
): ProjectedCurve => {
  const xs: number[] = [];
  const ys: number[] = [];
  const depths: number[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    xs.push(x0 + (x1 - x0) * t);
    ys.push(y0 + (y1 - y0) * t);
    depths.push(depth);
  }
  return { threadId, xs, ys, depths };
};

describe("nearestThreadAt", () => {
  it("picks the strand whose nearest segment is within reach", () => {
    const curves = [strand("t1", 0, 100, 400, 100), strand("t2", 0, 300, 400, 300)];
    expect(nearestThreadAt({ x: 210, y: 108 }, curves, 14)).toBe("t1");
    expect(nearestThreadAt({ x: 210, y: 290 }, curves, 14)).toBe("t2");
  });

  it("measures to the segment, not to the nearest sample", () => {
    // Samples every 50 px; a click 10 px off the line halfway between two of
    // them is 26 px from either sample and 10 px from the strand.
    const curves = [strand("t1", 0, 100, 400, 100)];
    expect(nearestThreadAt({ x: 225, y: 110 }, curves, 14)).toBe("t1");
  });

  it("picks nothing outside the radius", () => {
    const curves = [strand("t1", 0, 100, 400, 100)];
    expect(nearestThreadAt({ x: 210, y: 115 }, curves, 14)).toBeNull();
    expect(nearestThreadAt({ x: 210, y: 115 }, curves, 22)).toBe("t1");
    // Past the strand's end, the distance is to its end point.
    expect(nearestThreadAt({ x: 420, y: 100 }, curves, 14)).toBeNull();
  });

  it("prefers the nearer strand, however the list is ordered", () => {
    const near = strand("near", 0, 104, 400, 104);
    const far = strand("far", 0, 90, 400, 90);
    expect(nearestThreadAt({ x: 200, y: 100 }, [far, near], 14)).toBe("near");
    expect(nearestThreadAt({ x: 200, y: 100 }, [near, far], 14)).toBe("near");
  });

  it("breaks a tie in favour of the strand nearer the camera", () => {
    // Two strands crossing the same pixel: the one in front is the one seen.
    const behind = strand("behind", 0, 100, 400, 100, 20);
    const front = strand("front", 200, 0, 200, 400, 8);
    expect(nearestThreadAt({ x: 200, y: 100 }, [behind, front], 14)).toBe("front");
    expect(nearestThreadAt({ x: 200, y: 100 }, [front, behind], 14)).toBe("front");
  });

  it("never picks a strand through samples behind the camera", () => {
    const curve = strand("t1", 0, 100, 400, 100);
    const xs = Array.from(curve.xs);
    const ys = Array.from(curve.ys);
    // Samples 3–5 are behind the camera: the segments touching them are gone.
    for (const index of [3, 4, 5]) {
      xs[index] = Number.NaN;
      ys[index] = Number.NaN;
    }
    const broken: ProjectedCurve = { ...curve, xs, ys };
    expect(nearestThreadAt({ x: 200, y: 100 }, [broken], 14)).toBeNull();
    expect(nearestThreadAt({ x: 25, y: 100 }, [broken], 14)).toBe("t1");
  });

  it("gives a finger more room than a cursor", () => {
    expect(pickRadiusFor("mouse")).toBe(MOUSE_PICK_RADIUS_PX);
    expect(pickRadiusFor(undefined)).toBe(MOUSE_PICK_RADIUS_PX);
    expect(pickRadiusFor("touch")).toBe(TOUCH_PICK_RADIUS_PX);
    expect(pickRadiusFor("pen")).toBe(TOUCH_PICK_RADIUS_PX);
    expect(MOUSE_PICK_RADIUS_PX).toBe(14);
    expect(TOUCH_PICK_RADIUS_PX).toBe(22);
  });
});

describe("projectThreadCurves", () => {
  afterEach(() => {
    threadCurves.clear();
  });

  const camera = () => {
    const perspective = new THREE.PerspectiveCamera(50, 1280 / 800, 0.1, 200);
    perspective.position.set(0, 0, 24);
    perspective.lookAt(0, 0, 0);
    perspective.updateMatrixWorld();
    return perspective;
  };

  it("projects each registered strand along the curve the ribbon draws", () => {
    const a = new THREE.Vector3(-3, 0, 0);
    const m = new THREE.Vector3(0, 2, 0);
    const b = new THREE.Vector3(3, 0, 0);
    writeThreadCurve("t1", a, m, b);
    const view = camera();
    const [curve] = projectThreadCurves(view, 1280, 800, threadCurves, 4);
    expect(curve.threadId).toBe("t1");
    expect(curve.xs).toHaveLength(5);

    // The middle sample is the Bézier's midpoint, projected like any bead.
    const middle = arcPoint(a, m, b, 0.5, new THREE.Vector3()).project(view);
    expect(curve.xs[2]).toBeCloseTo(((middle.x + 1) / 2) * 1280, 3);
    expect(curve.ys[2]).toBeCloseTo(((1 - middle.y) / 2) * 800, 3);
    // Symmetric strand, centred camera: the two ends mirror about the centre.
    expect(curve.xs[0] + curve.xs[4]).toBeCloseTo(1280, 3);
    // Its depth is its distance from the camera: (0, 1, 0) seen from (0, 0, 24).
    expect(curve.depths[2]).toBeCloseTo(Math.hypot(1, 24), 3);

    // And a click on the projected middle picks it.
    expect(
      nearestThreadAt({ x: curve.xs[2], y: curve.ys[2] + 6 }, [curve], 14)
    ).toBe("t1");
  });

  it("marks samples behind the camera instead of projecting them", () => {
    writeThreadCurve(
      "t1",
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 30),
      new THREE.Vector3(0, 0, 40)
    );
    const [curve] = projectThreadCurves(camera(), 1280, 800, threadCurves, 4);
    expect(Number.isFinite(curve.xs[0])).toBe(true);
    expect(Number.isNaN(curve.xs[4])).toBe(true);
    expect(Number.isNaN(curve.ys[4])).toBe(true);
  });

  it("keeps one entry per strand, current, and forgets a strand no longer drawn", () => {
    const a = new THREE.Vector3(1, 0, 0);
    const b = new THREE.Vector3(0, 1, 0);
    writeThreadCurve("t1", a, a, b);
    const entry = threadCurves.get("t1");
    writeThreadCurve("t1", b, b, a);
    // Written through, not reallocated: the frame loop allocates nothing.
    expect(threadCurves.get("t1")).toBe(entry);
    expect(entry?.a.toArray()).toEqual([0, 1, 0]);
    // A copy, not the caller's scratch vector.
    expect(entry?.a).not.toBe(b);
    forgetThreadCurve("t1");
    expect(threadCurves.size).toBe(0);
  });
});
