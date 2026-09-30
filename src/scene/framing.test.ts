import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ARENA_RADIUS, fibonacciSpherePositions } from "@/game/layout";
import { deriveFocusView } from "@/runtime/interactionDraft";
import { toConceptId, toThreadId } from "@/domain/ids";
import type { ConceptPair } from "@/domain/events";
import { THEMES } from "@/themes";
import { aurora, castalia, ember, tide } from "@/themes/worlds";
import { COMFORT } from "./threadGrammar";
import {
  ARENA_FOV,
  CAMERA_BEAT_PER_SLOT,
  CAMERA_PHRASES,
  arenaFov,
  cameraBeatSeconds,
  cameraBreath,
  type CameraPhrase,
  CONTROL_CLEARANCE,
  FOCUS_FOOT_VH,
  FOCUS_NEAREST_RATIO,
  FRAME_RULE_INSET,
  INSTRUMENT_HALF_SPAN,
  MAX_ELEVATION,
  MAX_HORIZON_NDC,
  MIN_RING_RADIUS,
  PORTRAIT_ASPECT,
  READING_COLUMN_BREAKPOINT_PX,
  attendedFraming,
  focusPoseKey,
  focusPoseRequest,
  boxGap,
  clampToSafeArea,
  createDamped,
  createOrbitDamper,
  createOrbitPose,
  dampAngle,
  dampOrbitToward,
  dampScalar,
  ABANDONED_FILL,
  INSTRUMENT_EDGE_CLEARANCE,
  MARGIN_RESERVE,
  REST_SUBJECT_BOX,
  WORLD_SAFE_CLEARANCE,
  axesAgree,
  compositionBox,
  frameRuleNdc,
  homeComposition,
  marginReserve,
  restFrame,
  titleComposition,
  horizonNdcY,
  maxTargetOffset,
  orbitFromPosition,
  phraseSmoothTime,
  plateBoxes,
  plateGeometry,
  plateSafeArea,
  positionFromOrbit,
  projectFromPose,
  shiftNdc,
  unshiftNdc,
  withinSafeArea,
  worldSafeArea,
  wrapAngle,
  type PlateBox,
  type SafeArea,
  type Viewport,
} from "./framing";
import {
  focusBeadArea,
  focusDistance,
  focusFootEdge,
  focusFrameBox,
  focusFraming,
  pairFraming,
  shellOvershoot,
  sphereHalfExtent,
} from "./focusPosture";

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
  it("is one beat and a closed set of ratios of it, in every world", () => {
    expect(CAMERA_PHRASES.length).toBeGreaterThan(0);
    expect(THEMES.length).toBe(4);
    for (const world of THEMES) {
      const slot = world.music.slotSeconds;
      const beat = cameraBeatSeconds(slot);
      for (const phrase of CAMERA_PHRASES) {
        const ratio = phraseSmoothTime(phrase, slot) / beat;
        expect(Math.abs(ratio * 2 - Math.round(ratio * 2))).toBeLessThan(1e-9);
        expect(ratio).toBeGreaterThan(0);
        expect(ratio).toBeLessThanOrEqual(2);
      }
      const time = (phrase: CameraPhrase): number => phraseSmoothTime(phrase, slot);
      expect(time("breath")).toBeLessThan(time("lean"));
      expect(time("lean")).toBe(time("release"));
      expect(time("crown")).toBeGreaterThan(time("dwell"));
      // The lock is a turn of the same look as the attend, in the same tempo.
      expect(time("frame")).toBe(time("lean"));
    }
  });

  /**
   * ADR-016: the camera counts the bar the world's music keeps. The beat is a
   * share of the slot, so it is the world's, never a constant of the camera's.
   */
  it("counts the world's slot: a beat is 0.35 of it", () => {
    expect(CAMERA_BEAT_PER_SLOT).toBe(0.35);
    expect(castalia.music.slotSeconds).toBe(2);
    expect(cameraBeatSeconds(castalia.music.slotSeconds)).toBe(0.7);
    expect(cameraBeatSeconds(tide.music.slotSeconds)).toBeCloseTo(0.84, 12);
    expect(cameraBeatSeconds(ember.music.slotSeconds)).toBeCloseTo(0.63, 12);
    expect(cameraBeatSeconds(aurora.music.slotSeconds)).toBeCloseTo(0.77, 12);
    // A longer slot is a slower camera, in proportion and in nothing else.
    for (const world of THEMES) {
      expect(cameraBeatSeconds(world.music.slotSeconds) / world.music.slotSeconds).toBeCloseTo(
        CAMERA_BEAT_PER_SLOT,
        12
      );
    }
  });

  it("leaves Castalia's phrases exactly where the fixed beat had them", () => {
    // Before the beat was the world's it was 0.7 s everywhere; Castalia's
    // two-second slot keeps every phrase to well within a millisecond.
    const fixedBeat: Readonly<Record<CameraPhrase, number>> = {
      breath: 0.35,
      lean: 0.7,
      frame: 0.7,
      release: 0.7,
      square: 0.7,
      settle: 1.05,
      dwell: 1.05,
      crown: 1.4,
    };
    for (const phrase of CAMERA_PHRASES) {
      expect(phraseSmoothTime(phrase, castalia.music.slotSeconds)).toBeCloseTo(
        fixedBeat[phrase],
        9
      );
    }
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

/**
 * ADR-016 — THE LENS BREATHES ON THE BAR.
 *
 * The field of view widens and narrows with the world's one breath, by at most
 * the comfort table's share of itself; it is still on the engraved tier and
 * under reduced motion, and it composes with the impact kick without changing
 * it. The rig applies exactly these two functions (see `musicalTime.test.ts`).
 */
describe("the lens's breath", () => {
  const phases = Array.from({ length: 160 }, (_, i) => (i * Math.PI) / 40 - Math.PI);

  it("moves the field of view by at most the comfort table's share", () => {
    expect(COMFORT.cameraBreath).toBe(0.006);
    for (const depth of [0.1, 0.25, 0.5, 1, 1.4]) {
      for (const phase of phases) {
        const share = cameraBreath(true, depth, phase);
        expect(Math.abs(share)).toBeLessThanOrEqual(COMFORT.cameraBreath + 1e-15);
        const fov = arenaFov(0, share);
        expect(Math.abs(fov - ARENA_FOV) / ARENA_FOV).toBeLessThanOrEqual(
          COMFORT.cameraBreath + 1e-12
        );
      }
    }
    // A quarter of a degree at the most: felt, never watched.
    expect(ARENA_FOV * COMFORT.cameraBreath).toBeLessThan(0.26);
  });

  it("follows the breath's own phase, narrowest where the breath crests", () => {
    expect(cameraBreath(true, 1, Math.PI / 2)).toBeCloseTo(COMFORT.cameraBreath, 15);
    expect(cameraBreath(true, 1, -Math.PI / 2)).toBeCloseTo(-COMFORT.cameraBreath, 15);
    expect(arenaFov(0, cameraBreath(true, 1, Math.PI / 2))).toBeLessThan(ARENA_FOV);
    expect(arenaFov(0, cameraBreath(true, 1, -Math.PI / 2))).toBeGreaterThan(ARENA_FOV);
    // Depth scales it, as it scales the bloom's breath.
    for (const phase of phases) {
      expect(cameraBreath(true, 0.25, phase)).toBeCloseTo(
        0.25 * cameraBreath(true, 1, phase),
        15
      );
    }
  });

  it("is still under reduced motion and on the engraved tier", () => {
    for (const phase of phases) {
      // Reduced motion: the depth is zero, and the rig withholds it as well.
      expect(cameraBreath(true, 0, phase)).toBe(0);
      expect(cameraBreath(false, 1, phase)).toBe(0);
      expect(arenaFov(0, cameraBreath(false, 1, phase))).toBe(ARENA_FOV);
    }
    expect(cameraBreath(true, Number.NaN, 1)).toBe(0);
    expect(cameraBreath(true, -1, 1)).toBe(0);
  });

  it("leaves the kick exactly as it was, and composes with it", () => {
    for (let kick = 0; kick <= 1; kick += 0.01) {
      // The kick's own formula, unchanged: a 4 % punch at its height.
      expect(arenaFov(kick, 0)).toBe(ARENA_FOV * (1 - 0.04 * Math.sin(kick * Math.PI)));
      for (const phase of [-1.2, 0.3, Math.PI / 2]) {
        const share = cameraBreath(true, 1, phase);
        expect(arenaFov(kick, share)).toBeCloseTo(arenaFov(kick, 0) * (1 - share), 12);
      }
    }
    expect(arenaFov(0.5, 0) / ARENA_FOV).toBeCloseTo(0.96, 12);
    expect(arenaFov(0, 0)).toBe(ARENA_FOV);
  });
});

/**
 * A1 / A5 — THE ARENA IS COMPOSED, NOT CENTRED
 *
 * Measured on the shipped build: the opening arena frame's centre of visual
 * mass sat at (1469, 812) against a frame centre of (1440, 810) — off by 1.0%
 * horizontally and 0.1% vertically, with column-thirds mass 20/63/17 and
 * row-thirds 31/37/32. The same signature reproduced on a second seed, because
 * nothing about the framing depended on the content: a round object dropped in
 * the middle of a rectangle.
 *
 * And on 414x896 the same non-decision put the sphere off the left edge with
 * 118 px of margin unused on the right, the world overrunning its own ruling.
 *
 * These are the laws that replaced it. Every one of them is a property of
 * `homeComposition`, so a future tuning pass cannot quietly re-centre the arena
 * without a red test.
 */
describe("the composed home frame", () => {
  const VIEWPORTS: readonly (Viewport & { readonly name: string })[] = [
    { name: "desktop 1440x810", width: 1440, height: 810 },
    { name: "desktop 1920x1080", width: 1920, height: 1080 },
    { name: "laptop 1280x800", width: 1280, height: 800 },
    { name: "ultrawide 2560x1080", width: 2560, height: 1080 },
    { name: "tablet landscape 1024x768", width: 1024, height: 768 },
    { name: "tablet portrait 768x1024", width: 768, height: 1024 },
    { name: "phone 414x896", width: 414, height: 896 },
    { name: "phone 390x844", width: 390, height: 844 },
    { name: "phone 360x740", width: 360, height: 740 },
  ];

  /** The box the old build's centre of mass sat inside on every seed. */
  const CENTRAL_BOX = 0.2;

  it("never puts the instrument's centre in the middle of the frame", () => {
    for (const viewport of VIEWPORTS) {
      const home = homeComposition(viewport);
      const centred =
        Math.abs(home.centre.x) <= CENTRAL_BOX &&
        Math.abs(home.centre.y) <= CENTRAL_BOX;
      expect(`${viewport.name}: ${centred ? "centred" : "composed"}`).toBe(
        `${viewport.name}: composed`
      );
    }
  });

  it("keeps every bead inside the page's ruling on every viewport", () => {
    for (const viewport of VIEWPORTS) {
      const home = homeComposition(viewport);
      const aspect = viewport.width / viewport.height;
      const rule = frameRuleNdc(aspect);
      // The widest a bead ever reaches, carried to the composed anchor.
      expect(Math.abs(home.centre.x) + home.beads.x).toBeLessThanOrEqual(rule.x);
      expect(Math.abs(home.centre.y) + home.beads.y).toBeLessThanOrEqual(rule.y);
    }
  });

  /**
   * B5 — THE RESTING FRAME ABANDONED THE RIGHT 40 PERCENT.
   *
   * Measured on the running build at 1440x810, golden seed: the instrument's
   * silhouette stood between screen x 143 and 847 — the left 59% of the page —
   * with 25 px between its lowest brass and the bottom edge of the viewport,
   * and 40% of the width carrying two nav pills, a mute button and the page's
   * rule. Scaled to the frame's height, seated at its left.
   *
   * Two of the three faults are properties of the fit and are held here. The
   * third — that the width the composition *reserved* stood empty — is a
   * property of a rendered frame, and is held in `tests/browser/rest-frame`.
   */
  it("seats the subject inside the stated box on every viewport", () => {
    for (const viewport of VIEWPORTS) {
      const rest = restFrame(viewport);
      const box =
        viewport.width / viewport.height < PORTRAIT_ASPECT
          ? REST_SUBJECT_BOX.portrait
          : REST_SUBJECT_BOX.landscape;
      const inside =
        rest.centre.x >= box.minX &&
        rest.centre.x <= box.maxX &&
        rest.centre.y >= box.minY &&
        rest.centre.y <= box.maxY;
      expect(
        `${viewport.name} ${inside ? "seated" : `at ${rest.centre.x.toFixed(3)}, ${rest.centre.y.toFixed(3)}`}`
      ).toBe(`${viewport.name} seated`);
    }
  });

  it("never crops one axis while abandoning the other", () => {
    for (const viewport of VIEWPORTS) {
      const rest = restFrame(viewport);
      // The silhouette may cross the page's *ruling* — that is the
      // composition — but it may never reach the page.
      for (const edge of ["left", "right", "top", "bottom"] as const) {
        expect(
          `${viewport.name} ${edge} ${rest.clearance[edge] >= INSTRUMENT_EDGE_CLEARANCE / 2 - 1e-9 ? "clear" : rest.clearance[edge].toFixed(4)}`
        ).toBe(`${viewport.name} ${edge} clear`);
      }
      // And neither axis is abandoned by the subject that fills the other.
      expect(
        `${viewport.name} ${Math.min(rest.fill.x, rest.fill.y) >= ABANDONED_FILL ? "filled" : `${Math.min(rest.fill.x, rest.fill.y).toFixed(3)}`}`
      ).toBe(`${viewport.name} filled`);
      expect(axesAgree(rest)).toBe(true);
    }
  });

  /**
   * VC-05 — THE TITLE'S TWO HALVES SEESAWED.
   *
   * Measured on the running build: the landscape title's luminance centroid sat
   * at 55.4% of the width, with two thirds of its energy right of centre, while
   * the armillary behind it centred at about 34% — image and wordmark pulling
   * opposite ways with a collision in the middle. The cause was that the title
   * used the arena's composition, and the arena leans off centre because a
   * column is held down its right for readings the title does not have.
   */
  it("composes the title concentrically, and the arena off centre", () => {
    for (const viewport of VIEWPORTS) {
      const title = titleComposition(viewport);
      const arena = homeComposition(viewport);
      expect(`${viewport.name} ${title.centre.x} ${title.centre.y}`).toBe(
        `${viewport.name} 0 0`
      );
      expect(title.viewOffset).toEqual({ x: 0, y: 0 });
      // The fit is untouched: only where the frame is carried to differs, so
      // the opening move keeps the dolly `scene/opening.ts` authored.
      expect(title.distance).toBe(arena.distance);
      expect(title.instrument).toEqual(arena.instrument);
      // And the arena is still not concentric — which is the whole reason the
      // title could not go on using it.
      expect(Math.hypot(arena.centre.x, arena.centre.y)).toBeGreaterThan(0.2);
    }
  });

  it("shows the defect: the frame it replaced was fitted to one axis and left of the other", () => {
    // The old law, restated: a flat 0.36 reserve on every viewport, and the
    // instrument centred in whatever box that left. Both numbers here are the
    // shipped ones, so this fails the moment the composition drifts back.
    const OLD_RESERVE = 0.36;
    for (const viewport of VIEWPORTS) {
      const aspect = viewport.width / viewport.height;
      if (aspect < PORTRAIT_ASPECT) continue;
      const safe = worldSafeArea(aspect);
      const oldCentreX = (safe.minX + (1 - 2 * OLD_RESERVE)) / 2;
      const rest = restFrame(viewport);
      // The instrument used to be seated further from the page's centre than
      // it is now, on every wide page — and on 1440x810 it stood at 34.4%.
      expect(Math.abs(oldCentreX)).toBeGreaterThan(
        Math.abs(2 * rest.centre.x - 1) - 1e-9
      );
      expect(restFrame(viewport).centre.x).toBeGreaterThan((1 + oldCentreX) / 2);
    }
    // The reserve the DOM actually takes, which the flat constant overstated
    // by 13.5 points on a 1920 desktop and by 19 on an ultrawide.
    expect(marginReserve({ width: 1920, height: 1080 })).toBeCloseTo(0.225, 6);
    expect(marginReserve({ width: 2560, height: 1080 })).toBeCloseTo(0.16875, 6);
    expect(marginReserve({ width: 1024, height: 768 })).toBeCloseTo(0.32, 6);
    expect(marginReserve({ width: 414, height: 896 })).toBeCloseTo(0.3, 6);
  });

  it("breaks the ruling with the silhouette instead of floating clear of it", () => {
    for (const viewport of VIEWPORTS) {
      const aspect = viewport.width / viewport.height;
      // Every page a player actually holds: a wide screen, or a phone.
      if (aspect < 1.55 && aspect > 0.6) continue;
      const home = homeComposition(viewport);
      expect(`${viewport.name} ${home.broken.length}`).not.toBe(
        `${viewport.name} 0`
      );
      // Never all four: an instrument that overruns the page on every side is
      // not composed either, it is merely too close.
      expect(home.broken.length).toBeLessThan(4);
    }
  });

  it("always overhangs the side it was fitted to", () => {
    // The silhouette is 11% wider than the shell the fit is solved against, so
    // whichever boundary is tight, brass crosses it. That is the composition's
    // one guarantee that the instrument sits *on* the page rather than in a box
    // drawn on it — and it holds at every aspect, ruled edge or margin.
    for (const viewport of VIEWPORTS) {
      const home = homeComposition(viewport);
      const overhang =
        home.tight === "bottom" || home.tight === "top"
          ? home.instrument.y - home.beads.y
          : home.instrument.x - home.beads.x;
      expect(overhang).toBeGreaterThan(WORLD_SAFE_CLEARANCE);
    }
  });

  it("crosses the bottom rule, and only that one, on a wide page", () => {
    for (const viewport of VIEWPORTS) {
      const aspect = viewport.width / viewport.height;
      if (aspect < 1.55) continue;
      expect(`${viewport.name} ${homeComposition(viewport).broken}`).toBe(
        `${viewport.name} bottom`
      );
    }
  });

  it("never overruns the margin it reserved", () => {
    for (const viewport of VIEWPORTS) {
      const home = homeComposition(viewport);
      expect(home.broken).not.toContain(home.margin);
      // `ui/components/ReadingColumn` takes min(27rem, 32vw) of the width in
      // landscape and min-h-[30vh] at the foot of a portrait page. The
      // composition reserves *that*, on this viewport, rather than a flat
      // constant that was the right answer on one tablet and 13.5 points too
      // much on a 1920 desktop — which is what pushed the instrument off to the
      // left of a frame nothing else was standing in (B5).
      expect(home.reserve).toBeGreaterThanOrEqual(marginReserve(viewport) - 1e-9);
      expect(home.reserve).toBeGreaterThanOrEqual(MARGIN_RESERVE - 1e-9);
    }
  });

  it("rules a phone's page with a margin and not with a quarter of its width", () => {
    // The rule used to be struck at FRAME_RULE_INSET half-heights on both
    // axes, which on 414x896 stands the side rules at NDC ±0.75.
    const phone = 414 / 896;
    expect(1 - FRAME_RULE_INSET / phone).toBeLessThan(0.76);
    expect(frameRuleNdc(phone).x).toBeGreaterThan(0.86);
    // A landscape page is untouched: one number, two readings of it.
    const desktop = 1440 / 810;
    expect(frameRuleNdc(desktop).x).toBeCloseTo(1 - FRAME_RULE_INSET / desktop, 9);
    expect(frameRuleNdc(desktop).y).toBeCloseTo(1 - FRAME_RULE_INSET, 9);
  });

  it("shows the defect: the pose it replaced put the arena in the bullseye", () => {
    // The old rest pose was the literal (0, 0.85, 10.4) aimed at the origin in
    // landscape, and a width fit aimed at the origin in portrait. Aiming at the
    // arena's centre lands the arena's centre at NDC (0, 0) by definition — on
    // every viewport, every seed, and every session. There was no composition
    // to regress; there was an object in the middle of a rectangle.
    for (const viewport of VIEWPORTS) {
      const aspect = viewport.width / viewport.height;
      const camera = new THREE.Vector3(0, 0.85, aspect < 0.75 ? 21 : 10.4);
      const landed = projectFromPose(ORIGIN, camera, ORIGIN, aspect);
      expect(Math.hypot(landed.x, landed.y)).toBeLessThan(1e-9);

      // And the instrument then sat clear of the top and bottom rules by the
      // same margin on both, which is the visual signature the critic measured.
      const halfH = camera.length() * Math.tan((ARENA_FOV * Math.PI) / 360);
      const above = 1 - INSTRUMENT_HALF_SPAN / halfH;
      const below = 1 - INSTRUMENT_HALF_SPAN / halfH;
      expect(above).toBeCloseTo(below, 12);

      // The composed pose is asymmetric on every axis by construction.
      const home = homeComposition(viewport);
      expect(
        Math.abs(
          home.centre.y + home.instrument.y - (home.instrument.y - home.centre.y)
        )
      ).toBeGreaterThan(0.05);
    }
  });

  it("carries the arena to the anchor through three's own projection", () => {
    // The lens shift is only a composition if three's asymmetric frustum
    // agrees with the sign convention this module hands it. Projected here by
    // the real camera rather than by a restatement of it.
    for (const viewport of VIEWPORTS) {
      const home = homeComposition(viewport);
      const camera = new THREE.PerspectiveCamera(
        ARENA_FOV,
        viewport.width / viewport.height,
        0.1,
        160
      );
      camera.position.set(0, 0.3, home.distance);
      camera.lookAt(ORIGIN);
      camera.setViewOffset(
        viewport.width,
        viewport.height,
        home.viewOffset.x,
        home.viewOffset.y,
        viewport.width,
        viewport.height
      );
      camera.updateMatrixWorld();
      const landed = ORIGIN.clone().project(camera);
      expect(landed.x).toBeCloseTo(home.centre.x, 6);
      expect(landed.y).toBeCloseTo(home.centre.y, 6);

      // And the shift is a *translation*: the same constant at every depth, or
      // the plate solver's round trip through it would be a lie.
      const deep = new THREE.Vector3(1.4, -0.9, -2.6);
      const shifted = deep.clone().project(camera);
      camera.clearViewOffset();
      const plain = deep.clone().project(camera);
      expect(shifted.x - plain.x).toBeCloseTo(home.centre.x, 6);
      expect(shifted.y - plain.y).toBeCloseTo(home.centre.y, 6);
      expect(shiftNdc(plain.x, plain.y, home).x).toBeCloseTo(shifted.x, 6);
      expect(unshiftNdc(shifted.x, shifted.y, home).y).toBeCloseTo(plain.y, 6);
    }
  });

  it("stands back far enough to fit its box, and no further", () => {
    for (const viewport of VIEWPORTS) {
      const home = homeComposition(viewport);
      const aspect = viewport.width / viewport.height;
      const safe = worldSafeArea(aspect);
      const box = compositionBox(viewport);
      // Whichever law the fit is tight against, it is tight to the pixel: the
      // distance is solved from the frame, not chosen and then defended. Three
      // laws can bind, and `home.against` names which one did, so this reads
      // the composition rather than re-deriving it.
      const slack =
        home.against === "margin"
          ? aspect < PORTRAIT_ASPECT
            ? home.centre.y - home.instrument.y - box.minY
            : box.maxX - (home.centre.x + home.instrument.x)
          : home.against === "page"
            ? Math.min(
                1 -
                  INSTRUMENT_EDGE_CLEARANCE -
                  (Math.abs(home.centre.y) + home.instrument.y),
                1 -
                  INSTRUMENT_EDGE_CLEARANCE -
                  (Math.abs(home.centre.x) + home.instrument.x)
              )
            : Math.min(
                safe.maxY - (Math.abs(home.centre.y) + home.beads.y),
                safe.maxX - (Math.abs(home.centre.x) + home.beads.x)
              );
      expect(`${viewport.name} ${slack < 1e-9 ? "tight" : "slack"}`).toBe(
        `${viewport.name} tight`
      );
    }
  });
});

/**
 * I-017 — ATTENTION IS UNMISTAKABLE: THE CAMERA CLOSES IN, AND TURNS TO THE PAIR
 *
 * Played end to end, the attended "lean" stood the camera 1.18 times *further*
 * back than rest and kept the bead on whichever side it already was: Attend was
 * not visibly different from roaming. These are the laws that replaced it,
 * each stated as what it is for.
 */
describe("the focus view's postures", () => {
  const VIEWPORTS: readonly (Viewport & { readonly name: string })[] = [
    { name: "desktop 1440x810", width: 1440, height: 810 },
    { name: "desktop 1920x1080", width: 1920, height: 1080 },
    { name: "tablet landscape 1024x768", width: 1024, height: 768 },
    { name: "ultrawide 2560x1080", width: 2560, height: 1080 },
    { name: "tablet portrait 768x1024", width: 768, height: 1024 },
    { name: "phone 414x896", width: 414, height: 896 },
    { name: "phone 360x740", width: 360, height: 740 },
  ];
  /** The orbit ceiling the controls enforce (CameraRig.maxOrbit). */
  const ceilingFor = (viewport: Viewport): number =>
    viewport.width / viewport.height < 0.75 ? 26 : 18;
  const MIN_ORBIT = 5.2;
  const draw = beads(12);
  const depthOf = (
    bead: THREE.Vector3,
    position: THREE.Vector3,
    target: THREE.Vector3
  ): number =>
    bead.clone().sub(position).dot(target.clone().sub(position).normalize());
  const attendOn = (viewport: Viewport, bead: THREE.Vector3) =>
    focusFraming({
      bead,
      viewport,
      minDistance: MIN_ORBIT,
      maxDistance: ceilingFor(viewport),
    });

  it("closes in: nearer than rest, never nearer than its floor, the shell still fitting", () => {
    for (const viewport of VIEWPORTS) {
      const home = homeComposition(viewport);
      const distance = focusDistance(viewport);
      expect(`${viewport.name} ${distance < home.distance * 0.96}`).toBe(
        `${viewport.name} true`
      );
      expect(distance).toBeGreaterThanOrEqual(home.distance * FOCUS_NEAREST_RATIO - 1e-9);
      // From every direction, aimed at the centre, the shell is inside the
      // focus frame: the viewport less its clearance, and out of the column.
      const box = focusFrameBox(viewport);
      const aspect = viewport.width / viewport.height;
      const half = sphereHalfExtent(distance);
      expect(home.centre.y + half).toBeLessThanOrEqual(box.maxY + 1e-6);
      expect(home.centre.y - half).toBeGreaterThanOrEqual(box.minY - 1e-6);
      expect(home.centre.x + half / aspect).toBeLessThanOrEqual(box.maxX + 1e-6);
      expect(home.centre.x - half / aspect).toBeGreaterThanOrEqual(box.minX - 1e-6);
    }
  });

  it("never lets the shell into the reading column, where the two cards are", () => {
    for (const viewport of VIEWPORTS) {
      const box = focusFrameBox(viewport);
      const column = compositionBox(viewport);
      if (viewport.width / viewport.height < PORTRAIT_ASPECT) {
        expect(box.minY).toBeGreaterThanOrEqual(column.minY - 1e-9);
      } else {
        expect(box.maxX).toBeLessThanOrEqual(column.maxX + 1e-9);
      }
    }
  });

  it("keeps a phone's attended bead and whole sphere above the band of cards at its foot", () => {
    // On a narrow page the column is a band along the foot, and in the focus
    // view it holds two cards side by side: roughly a third of the page with
    // its padding. The focus view keeps clear of `FOCUS_FOOT_VH` of it; the
    // rest composition's own reserve is untouched.
    expect(FOCUS_FOOT_VH).toBeGreaterThanOrEqual(0.38);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 414, height: 896 },
      { width: 360, height: 740 },
    ]) {
      const band = -1 + 2 * FOCUS_FOOT_VH;
      expect(focusFootEdge(viewport)).toBeCloseTo(band, 12);
      expect(focusFrameBox(viewport).minY).toBeGreaterThanOrEqual(band - 1e-9);
      const bandTopPx = (1 - FOCUS_FOOT_VH) * viewport.height;
      const home = homeComposition(viewport);
      for (const bead of draw) {
        const framing = attendOn(viewport, bead)!;
        // The attended bead, and room for its name beneath it, above the band.
        const beadPx = ((1 - framing.landed.y) / 2) * viewport.height;
        expect(beadPx).toBeLessThan(bandTopPx - 40);
        // And no bead of the sphere under it.
        expect(
          shellOvershoot(framing.position, framing.target, viewport, focusFrameBox(viewport))
        ).toBeLessThanOrEqual(1 + 1e-4);
      }
      // Roaming is untouched: the rest composition still reserves its own foot.
      expect(compositionBox(viewport).minY).toBeCloseTo(-1 + 2 * MARGIN_RESERVE, 12);
      expect(home.distance).toBeGreaterThan(focusDistance(viewport) - 1e-9);
    }
    // A page wide enough to carry the column down its side has no foot band.
    const tablet = { width: 768, height: 1024 };
    expect(tablet.width).toBeGreaterThanOrEqual(READING_COLUMN_BREAKPOINT_PX);
    expect(focusFootEdge(tablet)).toBeCloseTo(compositionBox(tablet).minY, 12);
  });

  it("carries every attended bead left, and lower-left wherever the level allows", () => {
    for (const viewport of VIEWPORTS) {
      const home = homeComposition(viewport);
      for (const bead of draw) {
        const framing = attendOn(viewport, bead);
        expect(framing).not.toBeNull();
        if (!framing) continue;
        // Always the left of the sphere: a turn to one corner, whatever side
        // the bead started on.
        expect(`${viewport.name} ${framing.landed.x < home.centre.x}`).toBe(
          `${viewport.name} true`
        );
        // And below its centre, except for a bead on the crown of the
        // instrument, which the level will not carry that far (§3).
        if (bead.y <= ARENA_RADIUS * 0.3) {
          expect(framing.landed.y).toBeLessThan(home.centre.y);
        }
        // Where the bead lands, it lands on the page and out of the column.
        expect(
          withinSafeArea(framing.landed.x, framing.landed.y, focusBeadArea(viewport), 2e-3)
        ).toBe(true);
      }
    }
  });

  it("keeps the whole sphere legible: the bead shell inside the frame from every attended pose", () => {
    for (const viewport of VIEWPORTS) {
      const box = focusFrameBox(viewport);
      for (const bead of draw) {
        const framing = attendOn(viewport, bead);
        if (!framing) continue;
        expect(framing.shellInside).toBe(true);
        expect(
          shellOvershoot(framing.position, framing.target, viewport, box)
        ).toBeLessThanOrEqual(1 + 1e-4);
      }
    }
  });

  it("draws the attended bead clearly larger than the lean it replaced, and than rest", () => {
    for (const viewport of VIEWPORTS) {
      const aspect = viewport.width / viewport.height;
      const home = homeComposition(viewport);
      const ceiling = ceilingFor(viewport);
      const restPosition = new THREE.Vector3(0, 0, home.distance);
      for (const bead of draw) {
        const framing = attendOn(viewport, bead);
        if (!framing) continue;
        const near = depthOf(bead, framing.position, framing.target);
        // The old lean, restated: 1.18 of rest, the bead kept on its side.
        const side = framing.landed.x >= 0 ? 1 : -1;
        const portrait = aspect < PORTRAIT_ASPECT;
        const want = unshiftNdc(
          side * (portrait ? 0.3 : 0.34),
          portrait ? -0.32 : -0.28,
          home
        );
        const lean = attendedFraming({
          bead,
          distance: Math.min(home.distance * 1.18, ceiling),
          aspect,
          ndcX: want.x,
          ndcY: want.y,
          maxDistance: ceiling,
        });
        if (lean) {
          const gain = depthOf(bead, lean.position, lean.target) / near;
          expect(`${viewport.name} ${gain > 1.15}`).toBe(`${viewport.name} true`);
        }
        // …and nearer than wherever it stood at rest.
        expect(near).toBeLessThan(depthOf(bead, restPosition, ORIGIN));
      }
    }
  });

  it("keeps the level and the aim: a turn of the instrument, not a pan", () => {
    for (const viewport of VIEWPORTS) {
      for (const bead of draw) {
        const framing = attendOn(viewport, bead);
        if (!framing) continue;
        const elevation = Math.asin(framing.position.y / framing.position.length());
        expect(Math.abs(elevation)).toBeLessThanOrEqual(MAX_ELEVATION + 1e-6);
        // No aim offset: at the focus distance the sphere has no room to be
        // carried across the screen.
        expect(framing.target.length()).toBeLessThan(1e-9);
      }
    }
  });

  it("is deterministic for the same bead", () => {
    const viewport = VIEWPORTS[0];
    const a = attendOn(viewport, draw[5])!;
    const b = attendOn(viewport, draw[5])!;
    expect(a.position.toArray()).toEqual(b.position.toArray());
    expect(a.target.toArray()).toEqual(b.target.toArray());
  });

  it("frames a pair: both in frame, the second to the right, and up wherever it is the higher bead", () => {
    for (const viewport of VIEWPORTS) {
      const box = focusFrameBox(viewport);
      const home = homeComposition(viewport);
      let pairs = 0;
      let right = 0;
      let higher = 0;
      let upRight = 0;
      let attendedLeft = 0;
      for (let i = 0; i < draw.length; i++) {
        const from = attendOn(viewport, draw[i])!.position;
        for (let j = 0; j < draw.length; j++) {
          if (i === j) continue;
          const framing = pairFraming({
            attended: draw[i],
            second: draw[j],
            viewport,
            from,
            minDistance: MIN_ORBIT,
            maxDistance: ceilingFor(viewport),
          });
          expect(framing).not.toBeNull();
          if (!framing) continue;
          pairs++;
          // Both beads, and the whole shell, in frame — every pair.
          expect(withinSafeArea(framing.attended.x, framing.attended.y, box, 1e-6)).toBe(true);
          expect(withinSafeArea(framing.second.x, framing.second.y, box, 1e-6)).toBe(true);
          expect(
            shellOvershoot(framing.position, framing.target, viewport, box)
          ).toBeLessThanOrEqual(1 + 1e-4);
          const elevation = Math.asin(framing.position.y / framing.position.length());
          expect(Math.abs(elevation)).toBeLessThanOrEqual(MAX_ELEVATION + 1e-6);
          if (framing.second.x > framing.attended.x) right++;
          if (framing.attended.x < home.centre.x) attendedLeft++;
          // "Where the sphere allows": the level keeps the screen's up close
          // to the world's, so only a second bead that is the higher of the
          // two can be carried above the attended one.
          if (draw[j].y > draw[i].y + ARENA_RADIUS * 0.1) {
            higher++;
            if (
              framing.second.x > framing.attended.x &&
              framing.second.y > framing.attended.y
            ) {
              upRight++;
            }
          }
        }
      }
      expect(`${viewport.name} right ${right / pairs >= 0.95}`).toBe(
        `${viewport.name} right true`
      );
      expect(`${viewport.name} up-right ${upRight / higher >= 0.9}`).toBe(
        `${viewport.name} up-right true`
      );
      expect(attendedLeft / pairs).toBeGreaterThanOrEqual(0.85);
    }
  });

  it("frames the pair at the attended posture's distance, so the lock is a turn and not a new shot", () => {
    const viewport = VIEWPORTS[0];
    const attended = attendOn(viewport, draw[3])!;
    const pair = pairFraming({
      attended: draw[3],
      second: draw[8],
      viewport,
      from: attended.position,
      minDistance: MIN_ORBIT,
      maxDistance: 18,
    })!;
    expect(pair.distance).toBeCloseTo(focusDistance(viewport), 9);
    expect(pair.position.length()).toBeCloseTo(pair.distance, 9);
    expect(pair.target.length()).toBe(0);
  });

  it("prefers the smaller turn when two framings are nearly as good", () => {
    // The same pair, asked for from two cameras half a turn apart: each lock
    // turns no further from where it started than the other lock would have.
    const viewport = VIEWPORTS[0];
    const pair = (from: THREE.Vector3) =>
      pairFraming({
        attended: draw[2],
        second: draw[9],
        viewport,
        from,
        minDistance: MIN_ORBIT,
        maxDistance: 18,
      })!;
    const east = new THREE.Vector3(10, 0.5, 0);
    const west = new THREE.Vector3(-10, 0.5, 0);
    const fromEast = pair(east);
    const fromWest = pair(west);
    const turn = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b);
    expect(turn(east, fromEast.position)).toBeLessThanOrEqual(
      turn(east, fromWest.position) + 1e-9
    );
    expect(turn(west, fromWest.position)).toBeLessThanOrEqual(
      turn(west, fromEast.position) + 1e-9
    );
  });

  it("is deterministic for the same pair from the same camera", () => {
    const viewport = VIEWPORTS[5];
    const from = new THREE.Vector3(0, 1, 20);
    const request = {
      attended: draw[1],
      second: draw[7],
      viewport,
      from,
      minDistance: MIN_ORBIT,
      maxDistance: 26,
    };
    expect(pairFraming(request)!.position.toArray()).toEqual(
      pairFraming(request)!.position.toArray()
    );
  });

  it("declines rather than guessing for a degenerate pair", () => {
    expect(
      pairFraming({
        attended: new THREE.Vector3(0, 0, 0),
        second: draw[1],
        viewport: VIEWPORTS[0],
        from: new THREE.Vector3(0, 0, 11),
      })
    ).toBeNull();
  });
});

/**
 * A LOOK NEVER MOVES THE CAMERA.
 *
 * The bead under the lens changes the view — it is sharp, it has a card — but
 * sighting reaches neither the camera nor the hand (the cue plan says so, and
 * so does this). Only Attend, Lock and a reopened thread ask for a pose.
 */
describe("what the focus view asks of the camera", () => {
  const profile = { reducedMotion: false, qualityTier: "base" as const };
  const fib = toConceptId("measure.fibonacci-sequence");
  const counterpoint = toConceptId("sound.counterpoint");
  const prime = toConceptId("measure.prime-numbers");
  type ViewInput = Parameters<typeof deriveFocusView>[0];
  const view = (draft: ViewInput["draft"], extra: Partial<ViewInput> = {}) =>
    deriveFocusView({
      draft,
      sightedConceptId: null,
      dwellConceptId: null,
      previewIntention: null,
      reopened: null,
      holding: false,
      profile,
      ...extra,
    });

  it("asks for rest while roaming, even with a bead dwelt on", () => {
    const roaming = view({ stage: "inactive" }, { dwellConceptId: fib });
    expect(focusPoseRequest(roaming)).toEqual({ kind: "rest" });
    expect(focusPoseKey(focusPoseRequest(roaming))).toBe("rest");
  });

  it("asks for the attended posture, and the same one whatever is sighted", () => {
    const attending = { stage: "attending", attendedConceptId: fib } as const;
    const plain = focusPoseKey(focusPoseRequest(view(attending)));
    const sighting = focusPoseKey(
      focusPoseRequest(view(attending, { sightedConceptId: prime }))
    );
    expect(plain).toBe(`attend:${fib}`);
    expect(sighting).toBe(plain);
  });

  it("asks for the pair on Lock and on a reopened thread", () => {
    const pair: ConceptPair = [fib, counterpoint];
    const locked = view({
      stage: "locked",
      attendedConceptId: fib,
      candidateConceptId: counterpoint,
      pair,
    });
    expect(focusPoseRequest(locked)).toEqual({
      kind: "pair",
      attended: String(fib),
      second: String(counterpoint),
    });
    // Choosing a reading re-frames nothing: the pair is the same pair.
    const reading = view({
      stage: "reading",
      attendedConceptId: fib,
      candidateConceptId: counterpoint,
      intention: "echo",
      pair,
    });
    expect(focusPoseKey(focusPoseRequest(reading))).toBe(
      focusPoseKey(focusPoseRequest(locked))
    );
    const held = view(
      { stage: "inactive" },
      { reopened: { threadId: toThreadId("thread-1"), pair } }
    );
    expect(focusPoseKey(focusPoseRequest(held))).toBe(`pair:${fib}:${counterpoint}`);
  });
});
