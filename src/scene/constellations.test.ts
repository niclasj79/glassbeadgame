import { describe, expect, it } from "vitest";
import { CONSTELLATIONS, buildSky } from "./constellations";

describe("authored figures", () => {
  it("gives every star a magnitude and every edge two real endpoints", () => {
    for (const figure of CONSTELLATIONS) {
      expect(figure.magnitudes).toHaveLength(figure.stars.length);
      for (const [a, b] of figure.edges) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(figure.stars.length);
        expect(b).toBeLessThan(figure.stars.length);
        expect(a).not.toBe(b);
      }
    }
  });

  it("draws a figure, not a scatter: every star is joined to something", () => {
    for (const figure of CONSTELLATIONS) {
      const joined = new Set(figure.edges.flat());
      expect(joined.size).toBe(figure.stars.length);
    }
  });

  it("keeps plate coordinates inside the drawing area", () => {
    for (const figure of CONSTELLATIONS) {
      for (const [x, y] of figure.stars) {
        expect(Math.abs(x)).toBeLessThanOrEqual(1);
        expect(Math.abs(y)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("hangs the figures at distinct bearings so the sky has an order", () => {
    const bearings = CONSTELLATIONS.map((f) => f.bearing);
    expect(new Set(bearings).size).toBe(bearings.length);
    for (const bearing of bearings) {
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(1);
    }
  });

  it("draws the monochord at its actual string divisions", () => {
    const monochord = CONSTELLATIONS.find((f) => f.id === "monochord");
    expect(monochord).toBeDefined();
    // Stops at the whole string, the half, the two-thirds and the three-
    // quarters: the figure is the ratio, so it cannot drift from the fact.
    const xs = monochord!.stars.slice(0, 5).map(([x]) => x);
    const length = 2; // from -1 to +1
    const fromLeft = xs.map((x) => (x - -1) / length);
    expect(fromLeft[0]).toBeCloseTo(0, 6);
    expect(fromLeft[1]).toBeCloseTo(1 / 4, 6);
    expect(fromLeft[2]).toBeCloseTo(1 / 3, 2);
    expect(fromLeft[3]).toBeCloseTo(1 / 2, 6);
    expect(fromLeft[4]).toBeCloseTo(1, 6);
  });
});

describe("buildSky", () => {
  const RADIUS = 40;

  it("places every star on the sky's shell", () => {
    const sky = buildSky(RADIUS, CONSTELLATIONS.length, 50);
    for (let i = 0; i < sky.starMagnitudes.length; i++) {
      const r = Math.hypot(
        sky.starPositions[i * 3],
        sky.starPositions[i * 3 + 1],
        sky.starPositions[i * 3 + 2]
      );
      expect(r).toBeCloseTo(RADIUS, 4);
    }
  });

  it("emits two vertices per drawn line", () => {
    const edges = CONSTELLATIONS.reduce((n, f) => n + f.edges.length, 0);
    const sky = buildSky(RADIUS, CONSTELLATIONS.length, 0);
    expect(sky.linePositions).toHaveLength(edges * 6);
  });

  it("takes the first N authored figures at a reduced tier", () => {
    const reduced = buildSky(RADIUS, 4, 10);
    expect(reduced.figureCount).toBe(4);
    const stars = CONSTELLATIONS.slice(0, 4).reduce((n, f) => n + f.stars.length, 0);
    expect(reduced.starMagnitudes).toHaveLength(stars + 10);
  });

  it("is deterministic — the sky is the same every session", () => {
    const a = buildSky(RADIUS, 6, 40);
    const b = buildSky(RADIUS, 6, 40);
    expect(Array.from(a.starPositions)).toEqual(Array.from(b.starPositions));
    expect(Array.from(a.linePositions)).toEqual(Array.from(b.linePositions));
  });

  it("keeps the unaffiliated field fainter than the drawn figures", () => {
    const figures = CONSTELLATIONS.slice(0, 6);
    const figureStars = figures.reduce((n, f) => n + f.stars.length, 0);
    const sky = buildSky(RADIUS, 6, 60);
    const brightestField = Math.max(
      ...Array.from(sky.starMagnitudes.slice(figureStars))
    );
    const faintestFigure = Math.min(
      ...Array.from(sky.starMagnitudes.slice(0, figureStars))
    );
    expect(brightestField).toBeLessThan(faintestFigure);
  });
});
