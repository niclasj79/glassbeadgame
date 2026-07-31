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
