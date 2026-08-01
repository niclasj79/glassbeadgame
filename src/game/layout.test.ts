import { describe, expect, it } from "vitest";
import { CASTALIA_CONCEPTS } from "@/content/castalia/concepts";
import {
  LENS_EXTENT,
  LENS_VIEWS,
  LENS_DISCLOSURE,
  lensAxisValue,
  lensPlanePositions,
  type LensView,
} from "./layout";

const draw = CASTALIA_CONCEPTS.slice(0, 12);
const VIEWS: readonly LensView[] = [1, 2, 3];

/**
 * The whole point of re-basing the Lens was that a bead's place on the plane
 * has to be something the player can check against the bead itself. These tests
 * pin exactly that: each axis is one authored field, and nothing else moves it.
 */
describe("lens axes read one authored field each", () => {
  it("reads each axis off its own authored standing and nothing else", () => {
    for (const concept of CASTALIA_CONCEPTS) {
      expect(lensAxisValue(concept, "True")).toBeCloseTo(concept.standing.truth, 9);
      expect(lensAxisValue(concept, "Beautiful")).toBeCloseTo(
        concept.standing.beauty,
        9
      );
      expect(lensAxisValue(concept, "Good")).toBeCloseTo(concept.standing.good, 9);
    }
  });

  it("moves a bead only when its own standing moves", () => {
    // Nothing else about a concept may push it around the plane — not its
    // faculty, not its register, not how full its figure is.
    const base = CASTALIA_CONCEPTS[0];
    const elsewhere = {
      ...base,
      faculty: "image" as const,
      motif: { ...base.motif, register: "air" as const },
      sigil: { ...base.sigil, density: 0.01 },
    };
    for (const axis of ["True", "Beautiful", "Good"] as const) {
      expect(lensAxisValue(elsewhere, axis)).toBe(lensAxisValue(base, axis));
    }
  });

  it("says on its face that it is a reading and not a measurement", () => {
    // The Lens is the one arrangement in the game that cannot be sourced, so
    // the disclosure is part of the feature rather than a footnote to it.
    expect(LENS_DISCLOSURE).toMatch(/not a measurement/i);
    expect(LENS_DISCLOSURE.toLowerCase()).toContain("disagree");
  });

  it("keeps every axis inside [-1, 1] for every authored concept", () => {
    for (const concept of CASTALIA_CONCEPTS) {
      for (const axis of ["Good", "True", "Beautiful"] as const) {
        const value = lensAxisValue(concept, axis);
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("lens plane positions", () => {
  it("places one bead per concept, in order, for every view", () => {
    for (const view of VIEWS) {
      expect(lensPlanePositions(draw, view)).toHaveLength(draw.length * 3);
    }
  });

  it("is deterministic — the same draw gives byte-identical coordinates", () => {
    for (const view of VIEWS) {
      expect([...lensPlanePositions(draw, view)]).toEqual([
        ...lensPlanePositions(draw, view),
      ]);
    }
  });

  it("fans beads that read identically apart instead of hiding one behind another", () => {
    // Two `measure` concepts that also share a register read the same on both
    // axes of view 1. They belong in the same place; they must still be two
    // visible beads.
    const base = CASTALIA_CONCEPTS[0];
    const same = [base, { ...CASTALIA_CONCEPTS[1], standing: base.standing }];
    const p = lensPlanePositions(same, 1);
    // A bead's own width, so two are legibly two.
    expect(Math.hypot(p[0] - p[3], p[1] - p[4])).toBeCloseTo(0.5, 6);
  });

  it("displaces every member of a shared cell equally — none is the real one", () => {
    const base = CASTALIA_CONCEPTS[0];
    const same = [0, 1, 2].map((i) => ({
      ...CASTALIA_CONCEPTS[i],
      standing: base.standing,
    }));
    const p = lensPlanePositions(same, 1);
    const centre = lensAxisValue(same[0], "Good") * LENS_EXTENT;
    const offsets = same.map((_, i) =>
      Math.hypot(p[i * 3] - centre, p[i * 3 + 1] - lensAxisValue(same[0], "True") * LENS_EXTENT)
    );
    for (const offset of offsets) expect(offset).toBeCloseTo(offsets[0], 6);
    expect(offsets[0]).toBeGreaterThan(0);
  });

  it("stays inside the plane the axes are drawn on", () => {
    for (const view of VIEWS) {
      const p = lensPlanePositions(draw, view);
      for (let i = 0; i < draw.length; i++) {
        expect(Math.abs(p[i * 3])).toBeLessThanOrEqual(LENS_EXTENT * 1.15);
        expect(Math.abs(p[i * 3 + 1])).toBeLessThanOrEqual(LENS_EXTENT * 1.15);
      }
    }
  });

  it("separates beads the Game reads differently on the visible axis", () => {
    // Two concepts the Game places far apart on Good must not share a column,
    // in the two views whose x axis is Good.
    const low = CASTALIA_CONCEPTS.reduce((a, b) =>
      a.standing.good <= b.standing.good ? a : b
    );
    const high = CASTALIA_CONCEPTS.reduce((a, b) =>
      a.standing.good >= b.standing.good ? a : b
    );
    expect(high.standing.good - low.standing.good).toBeGreaterThan(0.5);
    for (const view of [1, 2] as const) {
      const p = lensPlanePositions([low, high], view);
      expect(p[3] - p[0]).toBeGreaterThan(1);
    }
  });

  it("names three views, each pairing two of the three readings", () => {
    const pairs = LENS_VIEWS.map((v) => [v.xAxis, v.yAxis].sort().join("×"));
    expect(new Set(pairs).size).toBe(3);
  });
});
