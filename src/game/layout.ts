import type { Concept } from "@/content/types";

/** Radius of the arena sphere the beads rest on. */
export const ARENA_RADIUS = 3;
/** Half-extent of the True/Good/Beautiful axis space in lens mode. */
export const LENS_EXTENT = 2.6;

/**
 * Golden-angle spiral on a sphere — even distribution for any bead count.
 * Uses the midpoint variant so no bead lands exactly on a pole.
 */
export function fibonacciSpherePositions(n: number, radius = ARENA_RADIUS): Float32Array {
  const out = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out[i * 3] = Math.cos(theta) * r * radius;
    out[i * 3 + 1] = y * radius;
    out[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  return out;
}

/**
 * Lens-mode position: the transcendental axes.
 * Truth rises (y), Beauty spans (x), Good advances (z).
 */
export function tbgPositions(concepts: readonly Concept[], extent = LENS_EXTENT): Float32Array {
  const out = new Float32Array(concepts.length * 3);
  for (let i = 0; i < concepts.length; i++) {
    const [t, b, g] = concepts[i].tbg;
    out[i * 3] = b * extent;
    out[i * 3 + 1] = t * extent;
    out[i * 3 + 2] = g * extent;
  }
  return out;
}
