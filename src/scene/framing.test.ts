import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ARENA_RADIUS, fibonacciSpherePositions } from "@/game/layout";
import {
  MAX_ELEVATION,
  MAX_TARGET_OFFSET,
  attendedFraming,
  projectFromPose,
} from "./framing";

const ORIGIN = new THREE.Vector3(0, 0, 0);
const DISTANCE = 12.3;
const LANDSCAPE = 1440 / 810;
/** The armillary's outermost ring, which must stay in frame. */
const INSTRUMENT_RADIUS = ARENA_RADIUS * 1.17;

function beads(n: number): THREE.Vector3[] {
  const positions = fibonacciSpherePositions(n);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    );
  }
  return out;
}

const attend = (bead: THREE.Vector3, ndcX = -0.34, ndcY = -0.34, aspect = LANDSCAPE) =>
  attendedFraming({ bead, distance: DISTANCE, aspect, ndcX, ndcY });

describe("attended camera framing", () => {
  it("puts the bead on the requested side of the frame", () => {
    let solved = 0;
    for (const bead of beads(24)) {
      const framing = attend(bead);
      if (!framing) continue;
      solved++;
      const ndc = projectFromPose(bead, framing.position, framing.target, LANDSCAPE);
      expect(ndc.x).toBeLessThan(0);
      expect(Math.abs(ndc.x)).toBeLessThan(1);
    }
    expect(solved).toBeGreaterThan(20);
  });

  it("places every bead in the lower half it can reach, and none above centre", () => {
    for (const bead of beads(24)) {
      const framing = attend(bead);
      if (!framing) continue;
      const ndc = projectFromPose(bead, framing.position, framing.target, LANDSCAPE);
      // Every bead, including the ones sitting on top of the armillary, must
      // end up below the centre line: that is what "situated lower corner"
      // means, and the comfort bounds have to be wide enough to deliver it.
      expect(ndc.y).toBeLessThan(0);
    }
  });

  it("mirrors exactly when the other corner is requested", () => {
    const bead = new THREE.Vector3(2.1, 0.9, 1.8);
    const left = attend(bead, -0.34, -0.34)!;
    const right = attend(bead, 0.34, -0.34)!;
    const l = projectFromPose(bead, left.position, left.target, LANDSCAPE);
    const r = projectFromPose(bead, right.position, right.target, LANDSCAPE);
    expect(l.x).toBeLessThan(0);
    expect(r.x).toBeGreaterThan(0);
    expect(l.y).toBeCloseTo(r.y, 6);
  });

  it("keeps the whole instrument legible from every attended pose", () => {
    const probes = [
      new THREE.Vector3(0, INSTRUMENT_RADIUS, 0),
      new THREE.Vector3(0, -INSTRUMENT_RADIUS, 0),
      ORIGIN,
    ];
    for (const bead of beads(24)) {
      const framing = attend(bead, 0.34, -0.34);
      if (!framing) continue;
      for (const probe of probes) {
        const ndc = projectFromPose(probe, framing.position, framing.target, LANDSCAPE);
        expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1.02);
      }
    }
  });

  it("respects both comfort bounds: elevation and aim offset", () => {
    for (const bead of beads(24)) {
      const framing = attend(bead);
      if (!framing) continue;
      const elevation = Math.asin(framing.position.y / framing.position.length());
      expect(Math.abs(elevation)).toBeLessThanOrEqual(MAX_ELEVATION + 1e-6);
      expect(framing.target.length()).toBeLessThanOrEqual(MAX_TARGET_OFFSET + 1e-6);
    }
  });

  it("holds the requested orbit distance exactly", () => {
    for (const bead of beads(12)) {
      const framing = attend(bead, -0.3, -0.36);
      if (!framing) continue;
      expect(framing.position.length()).toBeCloseTo(DISTANCE, 6);
    }
  });

  it("keeps the bead in front of the camera", () => {
    for (const bead of beads(24)) {
      const framing = attend(bead);
      if (!framing) continue;
      const toBead = bead.clone().sub(framing.position);
      const forward = framing.target.clone().sub(framing.position).normalize();
      expect(toBead.dot(forward)).toBeGreaterThan(0);
    }
  });

  it("is deterministic for the same request", () => {
    const bead = new THREE.Vector3(1.7, -1.2, 2.1);
    const a = attend(bead)!;
    const b = attend(bead)!;
    expect(a.position.toArray()).toEqual(b.position.toArray());
    expect(a.target.toArray()).toEqual(b.target.toArray());
  });

  it("declines rather than guessing for a degenerate request", () => {
    expect(attend(new THREE.Vector3(0, 0, 0), 0, 0)).toBeNull();
    expect(attend(new THREE.Vector3(0, ARENA_RADIUS, 0))).toBeNull();
  });

  it("solves the portrait viewport too", () => {
    const portrait = 414 / 896;
    const bead = new THREE.Vector3(1.4, -0.8, 2.5);
    const framing = attendedFraming({
      bead,
      distance: 12.4,
      aspect: portrait,
      ndcX: -0.3,
      ndcY: -0.38,
    })!;
    const ndc = projectFromPose(bead, framing.position, framing.target, portrait);
    expect(ndc.x).toBeLessThan(0);
    expect(ndc.y).toBeLessThan(0);
    expect(Math.abs(ndc.x)).toBeLessThan(1);
  });
});
