import { describe, expect, it } from "vitest";
import { ARENA_RADIUS } from "@/game/layout";
import {
  MAX_BEAD_EXTENT,
  armillaryRings,
  ringInnerReach,
  ringOuterReach,
} from "./rings";
import { INSTRUMENT_HALF_SPAN } from "./framing";

/**
 * ARM-01. An armillary is nested turned brass with beads inside it, not a
 * wireframe sphere drawn through them.
 */

const PARALLELS = [1.8, 0.6, -0.9, -2.1];
const rings = () => armillaryRings(PARALLELS, 72);

describe("the armillary as an instrument", () => {
  it("keeps every ring outside the widest a bead ever reaches", () => {
    expect(MAX_BEAD_EXTENT).toBeGreaterThan(ARENA_RADIUS);
    for (const spec of rings()) {
      expect(ringInnerReach(spec)).toBeGreaterThan(MAX_BEAD_EXTENT);
    }
  });

  it("shows the defect: the parallels used to be struck on the bead shell", () => {
    // `sqrt(R^2 - y^2) * 1.03` puts a small circle three percent outside the
    // *bead* shell — which is inside the beads standing on it, because a bead
    // is drawn a good deal wider than a point.
    for (const y of PARALLELS) {
      const previous = Math.sqrt(Math.max(0.04, ARENA_RADIUS * ARENA_RADIUS - y * y)) * 1.03;
      const reach = Math.hypot(previous - 0.022, y);
      expect(reach).toBeLessThan(MAX_BEAD_EXTENT);
    }
  });

  it("nests the principal rings at their own radii", () => {
    const specs = rings();
    const prime = specs.find((s) => s.key === "prime")!;
    const colure = specs.find((s) => s.key === "colure-a")!;
    const index = specs.find((s) => s.key === "index")!;
    expect(prime.radius).toBeGreaterThan(colure.radius);
    expect(colure.radius).toBeGreaterThan(index.radius);
    // The two colures are one pair of rings and share a radius; everything
    // else is turned to its own.
    const other = specs.find((s) => s.key === "colure-b")!;
    expect(other.radius).toBe(colure.radius);
  });

  it("carries the tilted index ring its own comment has always claimed", () => {
    const index = rings().find((s) => s.key === "index");
    expect(index).toBeDefined();
    // Not in the equatorial plane, and not in either colure's plane.
    expect(index!.rotation[0]).not.toBeCloseTo(-Math.PI / 2, 6);
    expect(index!.rotation[0]).not.toBeCloseTo(0, 6);
  });

  it("stays inside the span the camera promises to frame", () => {
    for (const spec of rings()) {
      expect(ringOuterReach(spec)).toBeLessThanOrEqual(INSTRUMENT_HALF_SPAN);
    }
  });

  it("strikes every parallel on one shell, so none of them wanders", () => {
    const parallels = rings().filter((s) => s.key.startsWith("parallel-"));
    expect(parallels).toHaveLength(PARALLELS.length);
    const shells = parallels.map((s) =>
      Math.hypot(s.radius, s.position[1]).toFixed(6)
    );
    expect(new Set(shells).size).toBe(1);
  });

  it("gives the prime circle the weight, and only it the stations", () => {
    const specs = rings();
    const prime = specs.find((s) => s.key === "prime")!;
    for (const spec of specs) {
      if (spec.key === "prime") continue;
      expect(spec.opacity).toBeLessThan(prime.opacity);
      expect(spec.stations).toBe(false);
      // Drawn under the prime circle, so the graduated ring reads on top.
      expect(spec.order).toBeLessThan(prime.order);
    }
    expect(prime.stations).toBe(true);
  });

  it("derives one small circle per faculty boundary and no more", () => {
    expect(armillaryRings([], 72).filter((s) => s.key.startsWith("parallel"))).toHaveLength(0);
    expect(
      armillaryRings([1, -1], 72).filter((s) => s.key.startsWith("parallel"))
    ).toHaveLength(2);
  });
});

/**
 * A3 — THE ARMILLARY IS AN INSTRUMENT, AND AN INSTRUMENT MOVES
 *
 * Frame-diffing a 30-second idle screencast of the shipped build: the rings did
 * not rotate. Not slowly — not at all. Every ring's turn was hard zero, so the
 * lattice was a fixed wireframe that could only be distinguished from a still
 * image by the star field twinkling behind it.
 */
describe("the armillary's idle turn", () => {
  it("turns its rings, and turns them at rates that differ", () => {
    const turning = rings().filter((spec) => spec.precession !== 0);
    expect(turning.length).toBeGreaterThanOrEqual(3);
    const rates = new Set(turning.map((spec) => spec.precession));
    expect(rates.size).toBe(turning.length);
    // Both senses. Rings that all turn the same way read as one turning object.
    expect(turning.some((spec) => spec.precession > 0)).toBe(true);
    expect(turning.some((spec) => spec.precession < 0)).toBe(true);
  });

  it("holds the station-bearing ring still so the gold cannot drift", () => {
    // A committed thread leaves gold at the longitude its endpoints occupy.
    // Turning the ring the gold is struck on would slide the record of the
    // player's own composition away from the beads it belongs to.
    for (const spec of rings()) {
      if (spec.stations) expect(spec.precession).toBe(0);
    }
  });

  it("gives a ring that cannot show rotation a creeping engraving instead", () => {
    // The prime circle and the parallels are circles about the world's axis:
    // they map onto themselves when they turn, so rotation is invisible on
    // them. Every ring is alive in the channel it actually has.
    for (const spec of rings()) {
      expect(Math.abs(spec.precession) + Math.abs(spec.creep)).toBeGreaterThan(0);
    }
  });

  it("never lets a turning ring reach the beads it is turning around", () => {
    // Precession is about the world's axis, which every ring's own reach is
    // already measured against — but say it out loud, because a turn that
    // swept a ring through the arena would be a new way to slice the beads.
    for (const spec of rings()) {
      expect(ringInnerReach(spec)).toBeGreaterThan(MAX_BEAD_EXTENT);
    }
  });
});
