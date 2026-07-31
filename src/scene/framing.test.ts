import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ARENA_RADIUS, fibonacciSpherePositions } from "@/game/layout";
import {
  CAMERA_BEAT_SECONDS,
  CAMERA_PHRASES,
  CONTROL_CLEARANCE,
  INSTRUMENT_HALF_SPAN,
  MAX_ELEVATION,
  MAX_HORIZON_NDC,
  MIN_RING_RADIUS,
  attendedFraming,
  boxGap,
  clampToSafeArea,
  createDamped,
  createOrbitDamper,
  createOrbitPose,
  dampAngle,
  dampOrbitToward,
  dampScalar,
  horizonNdcY,
  maxTargetOffset,
  orbitFromPosition,
  phraseSmoothTime,
  plateBoxes,
  plateGeometry,
  plateSafeArea,
  positionFromOrbit,
  projectFromPose,
  withinSafeArea,
  wrapAngle,
  type PlateBox,
  type SafeArea,
} from "./framing";

const ORIGIN = new THREE.Vector3(0, 0, 0);
const DISTANCE = 12.3;
const LANDSCAPE = 1440 / 810;
/** The armillary's outermost ring, which must stay in frame. */
const INSTRUMENT_RADIUS = INSTRUMENT_HALF_SPAN;

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

  it("never lands the bead further from centre than it was asked to", () => {
    // The horizontal solve measured the frame at the *arena's* depth and never
    // checked the answer. A bead is nearer the camera than that, so the frame
    // is narrower where it sits and the bead came out consistently further
    // out than requested — on a portrait viewport, far enough out to hang the
    // plate off the side. It can still land *short* of the request: a bead
    // near a pole has no azimuth that reaches the corner.
    for (const [aspect, distance] of [
      [LANDSCAPE, DISTANCE],
      [414 / 896, 24.8],
    ] as const) {
      for (const bead of beads(16)) {
        const framing = attendedFraming({
          bead,
          distance,
          aspect,
          ndcX: 0.3,
          ndcY: -0.28,
        });
        if (!framing) continue;
        expect(framing.landed.x).toBeLessThanOrEqual(0.3 + 0.005);
        expect(framing.landed.x).toBeGreaterThan(0);
      }
    }
  });

  it("carries a bead below the centre line whenever the level allows it", () => {
    // Not "always": a bead on the crown of the instrument cannot be brought
    // below centre without throwing the world's level out of frame, and the
    // level is worth more than the corner (see MAX_ELEVATION).
    for (const bead of beads(24)) {
      if (bead.y > ARENA_RADIUS * 0.3) continue;
      const framing = attend(bead);
      if (!framing) continue;
      const ndc = projectFromPose(bead, framing.position, framing.target, LANDSCAPE);
      expect(ndc.y).toBeLessThan(0);
    }
  });

  it("never lets a composing move carry the horizon out of frame", () => {
    // The defect: the attend pose reached 1.25 rad of elevation, which puts
    // the world's level at NDC 7.8 — off the top of the frame — and the
    // horizon rolls across the picture on the way there.
    expect(Math.abs(horizonNdcY(1.25))).toBeGreaterThan(1);
    expect(Math.abs(horizonNdcY(MAX_ELEVATION))).toBeLessThanOrEqual(
      MAX_HORIZON_NDC + 1e-9
    );
    for (const bead of beads(24)) {
      const framing = attend(bead, 0.34, -0.28);
      if (!framing) continue;
      const elevation = Math.asin(framing.position.y / framing.position.length());
      expect(Math.abs(horizonNdcY(elevation))).toBeLessThanOrEqual(
        MAX_HORIZON_NDC + 1e-6
      );
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
      expect(framing.target.length()).toBeLessThanOrEqual(
        maxTargetOffset(DISTANCE) + 1e-6
      );
    }
  });

  it("spends the aim offset the distance actually affords", () => {
    // A single tuned constant was either timid when the camera stood back or
    // a promise it could not keep when it came close.
    expect(maxTargetOffset(INSTRUMENT_HALF_SPAN)).toBe(0);
    expect(maxTargetOffset(12.3)).toBeGreaterThan(maxTargetOffset(10.4));
    for (const distance of [8, 10.4, 12.3, 18, 26]) {
      const halfHeight = distance * Math.tan((42 * Math.PI) / 360);
      expect(maxTargetOffset(distance) + INSTRUMENT_HALF_SPAN).toBeLessThanOrEqual(
        Math.max(halfHeight, INSTRUMENT_HALF_SPAN) + 1e-9
      );
    }
  });

  it("holds the requested orbit distance exactly when nothing forces it back", () => {
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

/**
 * B1. The intention plate is drawn in screen space around the attended bead,
 * so a pose is only acceptable if the plate fits. Under reduced motion this
 * solve did not run at all, and the measured consequence was the "ECHO" label
 * at y = 11.8 px in an 810 px viewport — sliced by the top of the screen.
 */
describe("the plate never reaches a viewport edge", () => {
  const VARIANTS = [
    { name: "desktop", width: 1440, height: 810, coarse: false, ndcX: 0.34, ndcY: -0.28 },
    { name: "laptop", width: 1280, height: 720, coarse: false, ndcX: 0.34, ndcY: -0.28 },
    { name: "phone", width: 414, height: 896, coarse: true, ndcX: 0.3, ndcY: -0.32 },
    { name: "small phone", width: 360, height: 640, coarse: true, ndcX: 0.3, ndcY: -0.32 },
  ] as const;

  for (const variant of VARIANTS) {
    it(`fits every attended bead on ${variant.name}`, () => {
      const aspect = variant.width / variant.height;
      const plate = plateGeometry(variant.width, variant.coarse);
      const area = plateSafeArea(plate, variant);
      const distance = aspect >= 0.75 ? 12.3 : 24.8;
      const ceiling = aspect < 0.75 ? 26 : 18;
      for (const bead of beads(14)) {
        const framing = attendedFraming({
          bead,
          distance,
          aspect,
          ndcX: variant.ndcX,
          ndcY: variant.ndcY,
          safeArea: area,
          maxDistance: ceiling,
        });
        expect(framing).not.toBeNull();
        if (!framing) continue;
        expect(framing.safe).toBe(true);

        // And in pixels, which is the thing a player can actually see clipped.
        const left = ((framing.landed.x + 1) / 2) * variant.width - plate.extentSide;
        const right = ((framing.landed.x + 1) / 2) * variant.width + plate.extentSide;
        const top = ((1 - framing.landed.y) / 2) * variant.height - plate.extentUp;
        const bottom =
          ((1 - framing.landed.y) / 2) * variant.height + plate.extentDown;
        expect(left).toBeGreaterThan(0);
        expect(right).toBeLessThan(variant.width);
        expect(top).toBeGreaterThan(0);
        expect(bottom).toBeLessThan(variant.height);
      }
    });
  }

  it("shows the defect: the home pose alone cannot hold a high bead's plate", () => {
    // Reduced motion used to leave the camera in the arena's home pose and
    // never compose at all. From there the top of the instrument projects
    // clean off the top of the viewport, plate and all.
    const viewport = { width: 1440, height: 810 };
    const plate = plateGeometry(viewport.width, false);
    const area = plateSafeArea(plate, viewport);
    const home = new THREE.Vector3(0, 0.85, 10.4);
    const high = new THREE.Vector3(0.1, ARENA_RADIUS * 0.93, 1.05);
    const ndc = projectFromPose(high, home, ORIGIN, viewport.width / viewport.height);
    expect(withinSafeArea(ndc.x, ndc.y, area)).toBe(false);
    const top = ((1 - ndc.y) / 2) * viewport.height - plate.extentUp;
    expect(top).toBeLessThan(0);
  });

  it("clamps a request into the safe area rather than trusting it", () => {
    const area: SafeArea = { minX: -0.5, maxX: 0.5, minY: -0.4, maxY: 0.4 };
    expect(clampToSafeArea(0.9, -0.9, area)).toEqual({ x: 0.5, y: -0.4 });
    expect(clampToSafeArea(0.2, 0.1, area)).toEqual({ x: 0.2, y: 0.1 });
    expect(withinSafeArea(0.5, 0.4, area)).toBe(true);
    expect(withinSafeArea(0.51, 0, area)).toBe(false);
  });

  it("collapses to the centre rather than inverting on a viewport that cannot hold it", () => {
    const plate = plateGeometry(320, true);
    const area = plateSafeArea(plate, { width: 200, height: 200 });
    expect(area.minX).toBeLessThanOrEqual(area.maxX);
    expect(area.minY).toBeLessThanOrEqual(area.maxY);
  });

  it("keeps the plate inside the ruled margin where the viewport allows it", () => {
    const viewport = { width: 1440, height: 810 };
    const area = plateSafeArea(plateGeometry(viewport.width, false), viewport);
    // The margin's inner rule sits 0.115 of a half-height in from the edge.
    expect(area.maxY).toBeLessThan(1 - 0.115);
    expect(area.minY).toBeGreaterThan(-1 + 0.115);
  });
});

/**
 * B2. Six controls in one diamond, 0.6 px apart on a 414x896 touch viewport.
 * The law is measured here rather than described in a comment.
 */
describe("the intention plate's clearance law", () => {
  const clearances = (boxes: readonly PlateBox[]): number => {
    let worst = Number.POSITIVE_INFINITY;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.kind === "label" && b.kind === "label") continue;
        if (a.owner === b.owner) continue;
        worst = Math.min(worst, boxGap(a, b));
      }
    }
    return worst;
  };

  for (const [name, width, coarse] of [
    ["a desktop", 1440, false],
    ["a laptop", 1280, false],
    ["a phone", 414, true],
    ["a narrow viewport reporting a fine pointer", 414, false],
  ] as const) {
    it(`clears every control and label by ${CONTROL_CLEARANCE}px on ${name}`, () => {
      const plate = plateGeometry(width, coarse);
      expect(plate.ring).toBeGreaterThanOrEqual(MIN_RING_RADIUS);
      expect(clearances(plateBoxes(plate))).toBeGreaterThanOrEqual(
        CONTROL_CLEARANCE
      );
    });
  }

  it("puts the two utilities outside the graduated circle, not inside it", () => {
    for (const width of [1440, 414]) {
      const plate = plateGeometry(width, width < 560);
      expect(plate.railRadius).toBeGreaterThan(plate.ring + plate.utility / 2);
      // Upper diagonals: the four verbs own the cardinal points and the ring.
      expect([...plate.railBearings].sort((a, b) => a - b)).toEqual([45, 135]);
    }
  });

  it("shows the defect: the previous plate put two targets 0.7px apart", () => {
    // Ring 62 on any viewport under 560 wide, with cancel and inspect on the
    // lower diagonals at ring + 4 — the layout the critic measured.
    const previous = plateGeometry(414, true);
    const old: PlateBox[] = [
      { id: "north", kind: "verb", owner: "north", x: 0, y: -62, width: 48, height: 48 },
      { id: "east", kind: "verb", owner: "east", x: 62, y: 0, width: 48, height: 48 },
      { id: "south", kind: "verb", owner: "south", x: 0, y: 62, width: 48, height: 48 },
      { id: "west", kind: "verb", owner: "west", x: -62, y: 0, width: 48, height: 48 },
      {
        id: "cancel",
        kind: "utility",
        owner: "cancel",
        x: Math.cos((225 * Math.PI) / 180) * 66,
        y: -Math.sin((225 * Math.PI) / 180) * 66,
        width: 44,
        height: 44,
      },
      {
        id: "inspect",
        kind: "utility",
        owner: "inspect",
        x: Math.cos((315 * Math.PI) / 180) * 66,
        y: -Math.sin((315 * Math.PI) / 180) * 66,
        width: 44,
        height: 44,
      },
    ];
    expect(clearances(old)).toBeLessThan(1);
    expect(clearances(plateBoxes(previous))).toBeGreaterThanOrEqual(
      CONTROL_CLEARANCE
    );
  });

  it("opens the plate on a narrow viewport instead of shrinking it", () => {
    expect(plateGeometry(414, false).ring).toBeGreaterThanOrEqual(
      MIN_RING_RADIUS
    );
    expect(plateGeometry(414, true).ring).toBeGreaterThanOrEqual(
      MIN_RING_RADIUS
    );
  });
});

/**
 * CAM-01 / TR-01. One tempo, and every move a turn of the instrument.
 */
describe("the camera's motion language", () => {
  it("is one beat and a closed set of ratios of it", () => {
    expect(CAMERA_PHRASES.length).toBeGreaterThan(0);
    for (const phrase of CAMERA_PHRASES) {
      const ratio = phraseSmoothTime(phrase) / CAMERA_BEAT_SECONDS;
      expect(Math.abs(ratio * 2 - Math.round(ratio * 2))).toBeLessThan(1e-9);
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThanOrEqual(2);
    }
    expect(phraseSmoothTime("breath")).toBeLessThan(phraseSmoothTime("lean"));
    expect(phraseSmoothTime("lean")).toBe(phraseSmoothTime("release"));
    expect(phraseSmoothTime("crown")).toBeGreaterThan(phraseSmoothTime("dwell"));
  });

  it("wraps angles the short way round", () => {
    expect(Math.abs(wrapAngle(Math.PI * 3))).toBeCloseTo(Math.PI, 9);
    expect(Math.abs(wrapAngle(-Math.PI * 3))).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(0.4)).toBeCloseTo(0.4, 9);
    expect(wrapAngle(Math.PI * 2 + 0.4)).toBeCloseTo(0.4, 9);
    expect(wrapAngle(-Math.PI * 2 - 0.4)).toBeCloseTo(-0.4, 9);
  });

  it("round-trips a pose through orbit coordinates", () => {
    const pose = createOrbitPose();
    const out = new THREE.Vector3();
    for (const p of [
      new THREE.Vector3(0, 0.85, 10.4),
      new THREE.Vector3(-3.2, 4.4, 9.1),
      new THREE.Vector3(0.01, 9.6, 0.01),
    ]) {
      orbitFromPosition(p, pose);
      positionFromOrbit(pose, out);
      expect(out.distanceTo(p)).toBeLessThan(1e-9);
    }
  });

  it("damps to the goal without overshooting it", () => {
    const state = createDamped(10);
    let previous = 10;
    for (let i = 0; i < 400; i++) {
      const value = dampScalar(state, 0, 0.7, 1 / 60);
      expect(value).toBeLessThanOrEqual(previous + 1e-9);
      expect(value).toBeGreaterThanOrEqual(-1e-9);
      previous = value;
    }
    expect(previous).toBeLessThan(0.001);
  });

  it("turns the short way on the azimuth", () => {
    const state = createDamped(Math.PI - 0.1);
    // The goal is 0.2 rad away across the seam, not 6.08 rad the other way.
    for (let i = 0; i < 5; i++) dampAngle(state, -Math.PI + 0.1, 0.7, 1 / 60);
    expect(Math.abs(wrapAngle(state.value - (Math.PI - 0.1)))).toBeLessThan(0.2);
  });

  it("moves a scripted transit along the orbit sphere, never through the arena", () => {
    // A Cartesian damp drags the camera along a chord: it dips inside the
    // instrument, and the elevation — and with it the horizon — changes
    // fastest in the middle of the move.
    const damper = createOrbitDamper();
    const goal = createOrbitPose();
    const scratch = createOrbitPose();
    const out = new THREE.Vector3();
    const camera = new THREE.Vector3(0, 0.85, 10.4);
    const from = camera.clone();
    orbitFromPosition(new THREE.Vector3(-9.4, 3.6, -4.1), goal);

    const chord = from.clone().lerp(positionFromOrbit(goal, new THREE.Vector3()), 0.5);
    expect(chord.length()).toBeLessThan(from.length() * 0.85);

    let minDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 400; i++) {
      dampOrbitToward(damper, camera, goal, 0.7, 1 / 60, scratch, out);
      camera.copy(out);
      minDistance = Math.min(minDistance, camera.length());
    }
    expect(minDistance).toBeGreaterThan(
      Math.min(from.length(), goal.distance) - 1e-6
    );
    expect(camera.distanceTo(positionFromOrbit(goal, out))).toBeLessThan(0.01);
  });

  it("keeps the horizon's travel monotone through a turn", () => {
    const damper = createOrbitDamper();
    const goal = createOrbitPose();
    const scratch = createOrbitPose();
    const out = new THREE.Vector3();
    const camera = new THREE.Vector3(0, 0.85, 10.4);
    orbitFromPosition(new THREE.Vector3(-6.2, -3.9, -8.9), goal);
    let previous = horizonNdcY(Math.asin(camera.y / camera.length()));
    for (let i = 0; i < 300; i++) {
      dampOrbitToward(damper, camera, goal, 0.7, 1 / 60, scratch, out);
      camera.copy(out);
      const level = horizonNdcY(Math.asin(camera.y / camera.length()));
      expect(level).toBeLessThanOrEqual(previous + 1e-6);
      previous = level;
    }
  });
});
