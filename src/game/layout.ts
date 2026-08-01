import type { CastaliaConcept } from "@/content/castalia/schema";

/** Radius of the arena sphere the beads rest on. */
export const ARENA_RADIUS = 3;
/** Half-extent of the Lens plane the beads are laid out on. */
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
 * THE LENS — Castalia's own three axes.
 *
 * True, Beautiful and Good are the frame the whole fiction rests on, and the
 * Lens exists to lay the arena out along them.
 *
 * An earlier pass replaced them with faculty, register and density, on the
 * reasoning that a transcendental coordinate is "a fixed answer to a question
 * the Game has no standing to settle". That reasoning is right about a
 * *measurement* and wrong about this. The Game is not measuring how true Prime
 * Numbers is; it is saying where it would place it, which is a reading — and a
 * reading is a thing this pack already knows how to declare rather than hide.
 * `TranscendentalStanding` carries that declaration, the Lens repeats it on
 * screen every time it opens, and a player who disagrees with a position is
 * having precisely the argument the Lens is for.
 *
 * Three views pair the three axes three ways, so the same reading is seen from
 * every side.
 */
export const LENS_VIEWS = [
  { id: "good-true", xAxis: "Good", yAxis: "True", label: "Good × True" },
  { id: "good-beautiful", xAxis: "Good", yAxis: "Beautiful", label: "Good × Beautiful" },
  { id: "true-beautiful", xAxis: "True", yAxis: "Beautiful", label: "True × Beautiful" },
] as const;

/**
 * Shown wherever the Lens is. It is not a disclaimer to be skipped — it is the
 * difference between an arrangement and a verdict.
 */
export const LENS_DISCLOSURE =
  "An arrangement the Game offers, not a measurement. Disagreeing with a bead's place is the point.";

export type LensView = 1 | 2 | 3;
export type LensAxis = (typeof LENS_VIEWS)[number]["xAxis" | "yAxis"];


/** One authored reading, already in [-1, 1]. No axis reads more than one. */
export function lensAxisValue(concept: CastaliaConcept, axis: LensAxis): number {
  const clamp = (value: number): number => Math.max(-1, Math.min(1, value));
  switch (axis) {
    case "True":
      return clamp(concept.standing.truth);
    case "Beautiful":
      return clamp(concept.standing.beauty);
    case "Good":
      return clamp(concept.standing.good);
  }
}

/** Roughly a bead's diameter. Two beads closer than this read as one bead. */
const MIN_SEPARATION = 0.5;

/** A phase that leaves a pair neither level nor stacked, so it reads as two. */
const FAN_PHASE = Math.PI / 3;

/**
 * Beads that read the same on both axes belong in the same place, so they are
 * given the same place — a shared cell — and then arranged on the smallest ring
 * inside it that keeps them a bead's width apart. Every member of a cell is
 * displaced equally: none of them is the "real" one, because none of them is
 * more true than the others.
 *
 * The ring is legibility, not data. Its radius is bounded by the cell it sits
 * in, so a bead never wanders into the column or the band next door — a
 * displaced bead still reads correctly on both axes.
 */
export function lensPlanePositions(
  concepts: readonly CastaliaConcept[],
  view: LensView,
  extent = LENS_EXTENT
): Float32Array {
  const { xAxis, yAxis } = LENS_VIEWS[view - 1] ?? LENS_VIEWS[0];
  const out = new Float32Array(concepts.length * 3);

  const cells = new Map<string, number[]>();
  const reading: [number, number][] = concepts.map((concept) => [
    lensAxisValue(concept, xAxis),
    lensAxisValue(concept, yAxis),
  ]);
  reading.forEach(([x, y], i) => {
    const key = `${x.toFixed(3)}:${y.toFixed(3)}`;
    const bucket = cells.get(key);
    if (bucket === undefined) cells.set(key, [i]);
    else bucket.push(i);
  });

  for (const members of cells.values()) {
    const n = members.length;
    const radius = n < 2 ? 0 : MIN_SEPARATION / (2 * Math.sin(Math.PI / n));
    members.forEach((i, k) => {
      const angle = FAN_PHASE + (2 * Math.PI * k) / n;
      const [x, y] = reading[i];
      out[i * 3] = x * extent + Math.cos(angle) * radius;
      out[i * 3 + 1] = y * extent + Math.sin(angle) * radius;
      // The plane is flat; a whisper of deterministic depth keeps beads that
      // share a cell from z-fighting.
      out[i * 3 + 2] = ((i % 7) - 3) * 0.045;
    });
  }
  return out;
}
