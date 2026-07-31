import { mulberry32 } from "@/lib/utils";

/**
 * THE ORDER'S OWN SKY
 *
 * A random point cloud reads as outer space; the eye finds no author in it.
 * These six figures are drawn by hand, in local plate coordinates, and hung at
 * fixed bearings — so the sky above Castalia is a diagram someone made, which
 * is the entire difference between a starfield and a firmament.
 *
 * They are the Order's instruments, not the historical constellations of any
 * culture: nothing here claims to be a real asterism, and nothing is named on
 * screen. The one figure with real content is `monochord`, whose stars sit at
 * the string divisions 1, 3/4, 2/3, 1/2 — the ratios themselves, drawn.
 */
export interface ConstellationFigure {
  readonly id: string;
  /** Plate coordinates, roughly within [-1, 1]. */
  readonly stars: readonly (readonly [number, number])[];
  /** Relative brightness per star, 0.3–1. */
  readonly magnitudes: readonly number[];
  /** Index pairs joined by a drawn line. */
  readonly edges: readonly (readonly [number, number])[];
  /** Where the figure hangs: turns around the sky, [0,1). */
  readonly bearing: number;
  /** Altitude above the arena's equator, in turns of a half-circle [-0.5,0.5]. */
  readonly altitude: number;
  /** Angular half-width of the figure on the sky, in radians. */
  readonly spread: number;
}

const figure = (value: ConstellationFigure): ConstellationFigure =>
  Object.freeze(value);

/** The armilla: a ring seen obliquely, pierced by its axis. */
const ARMILLA = figure({
  id: "armilla",
  stars: [
    [0, 0.46],
    [0.78, 0.24],
    [0.9, -0.12],
    [0.16, -0.46],
    [-0.72, -0.28],
    [-0.9, 0.08],
    [-0.1, 0.92],
    [0.1, -0.94],
  ],
  magnitudes: [0.8, 0.55, 0.7, 0.9, 0.5, 0.62, 0.45, 0.4],
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 0],
    [6, 7],
  ],
  bearing: 0.04,
  altitude: 0.16,
  spread: 0.24,
});

/** The dividers: an apex and two legs, set to a fixed span. */
const DIVIDERS = figure({
  id: "dividers",
  stars: [
    [0, 0.95],
    [-0.55, -0.6],
    [0.52, -0.66],
    [-0.28, 0.18],
    [0.26, 0.14],
  ],
  magnitudes: [0.95, 0.7, 0.66, 0.42, 0.4],
  edges: [
    [0, 3],
    [3, 1],
    [0, 4],
    [4, 2],
    [3, 4],
  ],
  bearing: 0.22,
  altitude: -0.08,
  spread: 0.2,
});

/**
 * The monochord: one string, stopped at 1, 3/4, 2/3 and 1/2 of its length.
 * The spacing is the ratio, so the figure is the fact.
 */
const MONOCHORD = figure({
  id: "monochord",
  stars: [
    [-1, 0],
    [-0.5, 0],
    [-0.34, 0],
    [0, 0],
    [1, 0],
    [-0.5, 0.22],
    [0, 0.2],
  ],
  magnitudes: [0.85, 0.6, 0.55, 0.72, 0.85, 0.35, 0.33],
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [1, 5],
    [3, 6],
  ],
  bearing: 0.39,
  altitude: 0.28,
  spread: 0.27,
});

/** The lens: two arcs meeting at their edges. */
const LENS = figure({
  id: "lens",
  stars: [
    [-0.92, 0],
    [-0.5, 0.42],
    [0.5, 0.42],
    [0.92, 0],
    [0.5, -0.42],
    [-0.5, -0.42],
    [0, 0],
  ],
  magnitudes: [0.75, 0.5, 0.5, 0.75, 0.5, 0.5, 0.95],
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 0],
    // The optical axis, struck through the focus.
    [0, 6],
    [6, 3],
  ],
  bearing: 0.56,
  altitude: -0.22,
  spread: 0.21,
});

/** The vault: two springing points, two curving sides, a keystone. */
const VAULT = figure({
  id: "vault",
  stars: [
    [-0.85, -0.8],
    [-0.72, -0.1],
    [-0.4, 0.5],
    [0, 0.86],
    [0.4, 0.5],
    [0.72, -0.1],
    [0.85, -0.8],
  ],
  magnitudes: [0.6, 0.45, 0.55, 1, 0.55, 0.45, 0.6],
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
  ],
  bearing: 0.71,
  altitude: 0.34,
  spread: 0.25,
});

/** The balance: a beam, a fulcrum, and two pans that do not agree. */
const BALANCE = figure({
  id: "balance",
  stars: [
    [0, 0.5],
    [-0.86, 0.28],
    [0.86, 0.12],
    [-0.86, -0.34],
    [0.86, -0.56],
    [0, -0.1],
  ],
  magnitudes: [0.9, 0.55, 0.55, 0.7, 0.7, 0.4],
  edges: [
    [1, 0],
    [0, 2],
    [1, 3],
    [2, 4],
    [0, 5],
  ],
  bearing: 0.87,
  altitude: -0.34,
  spread: 0.22,
});

/** Authored order is the drawing order; lower tiers take the first N. */
export const CONSTELLATIONS: readonly ConstellationFigure[] = Object.freeze([
  ARMILLA,
  MONOCHORD,
  VAULT,
  DIVIDERS,
  LENS,
  BALANCE,
]);

/** Unit direction for a plate coordinate hung at a bearing and altitude. */
function skyDirection(
  figureAt: ConstellationFigure,
  x: number,
  y: number
): [number, number, number] {
  const lon = figureAt.bearing * Math.PI * 2 + x * figureAt.spread;
  const lat = figureAt.altitude * Math.PI + y * figureAt.spread;
  const cosLat = Math.cos(lat);
  return [Math.sin(lon) * cosLat, Math.sin(lat), Math.cos(lon) * cosLat];
}

export interface SkyGeometry {
  /** xyz per star. */
  readonly starPositions: Float32Array;
  /** Per-star brightness, aligned to `starPositions`. */
  readonly starMagnitudes: Float32Array;
  /** xyz pairs, two vertices per drawn line. */
  readonly linePositions: Float32Array;
  readonly figureCount: number;
}

/**
 * Build the drawn sky. `figures` selects how many authored figures to include
 * (the budget's tier), `fieldStars` adds unaffiliated stars between them.
 * Deterministic for a given argument set — the sky is the same every session.
 */
export function buildSky(
  radius: number,
  figures: number,
  fieldStars: number
): SkyGeometry {
  const used = CONSTELLATIONS.slice(0, Math.max(0, figures));
  const figureStarCount = used.reduce((n, f) => n + f.stars.length, 0);
  const edgeCount = used.reduce((n, f) => n + f.edges.length, 0);

  const starPositions = new Float32Array((figureStarCount + fieldStars) * 3);
  const starMagnitudes = new Float32Array(figureStarCount + fieldStars);
  const linePositions = new Float32Array(edgeCount * 6);

  let s = 0;
  let l = 0;
  for (const f of used) {
    const base = s;
    for (let i = 0; i < f.stars.length; i++) {
      const [x, y] = f.stars[i];
      const dir = skyDirection(f, x, y);
      starPositions[s * 3] = dir[0] * radius;
      starPositions[s * 3 + 1] = dir[1] * radius;
      starPositions[s * 3 + 2] = dir[2] * radius;
      starMagnitudes[s] = f.magnitudes[i] ?? 0.5;
      s++;
    }
    for (const [a, b] of f.edges) {
      for (const index of [base + a, base + b]) {
        linePositions[l++] = starPositions[index * 3];
        linePositions[l++] = starPositions[index * 3 + 1];
        linePositions[l++] = starPositions[index * 3 + 2];
      }
    }
  }

  // The unaffiliated field: sparse, faint, and deliberately not clustered
  // into shapes, so the authored figures remain the only readable forms.
  const rng = mulberry32(0x0ca57a);
  for (let i = 0; i < fieldStars; i++) {
    const u = rng() * 2 - 1;
    const theta = rng() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    starPositions[s * 3] = Math.cos(theta) * r * radius;
    starPositions[s * 3 + 1] = u * radius;
    starPositions[s * 3 + 2] = Math.sin(theta) * r * radius;
    starMagnitudes[s] = 0.1 + rng() * 0.22;
    s++;
  }

  return {
    starPositions,
    starMagnitudes,
    linePositions,
    figureCount: used.length,
  };
}
