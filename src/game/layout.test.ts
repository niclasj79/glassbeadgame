import { describe, expect, it } from "vitest";
import { CASTALIA_CONCEPTS } from "@/content/castalia/concepts";
import { FACULTY_IDS, MOTIF_REGISTERS } from "@/content/castalia/schema";
import {
  LENS_EXTENT,
  LENS_VIEWS,
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
  it("puts every concept of a faculty in the same column, and each faculty in its own", () => {
    const columns = new Map<string, Set<number>>();
    for (const concept of CASTALIA_CONCEPTS) {
      const x = lensAxisValue(concept, "Faculty");
      const seen = columns.get(concept.faculty) ?? new Set<number>();
      seen.add(x);
      columns.set(concept.faculty, seen);
    }
    for (const [, xs] of columns) expect(xs.size).toBe(1);
    const distinct = new Set([...columns.values()].map((xs) => [...xs][0]));
    expect(distinct.size).toBe(FACULTY_IDS.length);
  });

  it("orders registers from sub at the bottom to air at the top", () => {
    const heights = MOTIF_REGISTERS.map((register) =>
      lensAxisValue(
        { ...CASTALIA_CONCEPTS[0], motif: { ...CASTALIA_CONCEPTS[0].motif, register } },
        "Register"
      )
    );
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }
  });

  it("reads density straight off the sigil, monotonically", () => {
    const sorted = [...CASTALIA_CONCEPTS].sort(
      (a, b) => a.sigil.density - b.sigil.density
    );
    const values = sorted.map((c) => lensAxisValue(c, "Density"));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it("keeps every axis inside [-1, 1] for every authored concept", () => {
    for (const concept of CASTALIA_CONCEPTS) {
      for (const axis of ["Faculty", "Register", "Density"] as const) {
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
    const same = CASTALIA_CONCEPTS.filter(
      (c) => c.faculty === "measure" && c.motif.register === "mid"
    );
    expect(same.length).toBeGreaterThan(1);
    const p = lensPlanePositions(same.slice(0, 2), 1);
    // A bead's own width, so two are legibly two.
    expect(Math.hypot(p[0] - p[3], p[1] - p[4])).toBeCloseTo(0.5, 6);
  });

  it("displaces every member of a shared cell equally — none is the real one", () => {
    const same = CASTALIA_CONCEPTS.filter(
      (c) => c.faculty === "measure" && c.motif.register === "mid"
    );
    const p = lensPlanePositions(same, 1);
    const centre = lensAxisValue(same[0], "Faculty") * LENS_EXTENT;
    const offsets = same.map((_, i) =>
      Math.hypot(p[i * 3] - centre, p[i * 3 + 1] - lensAxisValue(same[0], "Register") * LENS_EXTENT)
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

  it("columns beads by faculty in the two views whose x axis is Faculty", () => {
    const measure = CASTALIA_CONCEPTS.filter((c) => c.faculty === "measure");
    const image = CASTALIA_CONCEPTS.filter((c) => c.faculty === "image");
    for (const view of [1, 2] as const) {
      const own = lensPlanePositions(measure, view);
      const other = lensPlanePositions(image, view);
      // Same faculty: one column, give or take the fan inside a cell.
      const xs = measure.map((_, i) => own[i * 3]);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.8);
      // A different faculty is a different column entirely.
      expect(Math.min(...image.map((_, i) => other[i * 3]))).toBeGreaterThan(
        Math.max(...xs) + 0.5
      );
    }
  });

  it("names three views, each pairing two of the three readings", () => {
    const pairs = LENS_VIEWS.map((v) => [v.xAxis, v.yAxis].sort().join("×"));
    expect(new Set(pairs).size).toBe(3);
  });
});
