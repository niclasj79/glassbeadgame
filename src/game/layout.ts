import type { CastaliaConcept } from "@/content/castalia/schema";
import { FACULTY_IDS, MOTIF_REGISTERS } from "@/content/castalia/schema";

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
 * THE LENS — a rearrangement the player can check.
 *
 * The Lens used to plot each bead at its `tbg` coordinate: an authored triple
 * saying how True, Beautiful and Good the concept was. The Castalia pack does
 * not carry that triple, and it should not: those coordinates were a fixed
 * answer to a question the Game has no standing to settle, which is exactly
 * what `docs/CURRENT-STATE-AUDIT.md` lists the Lens for evolving away from.
 *
 * So the axes now read fields the pack actually authors, chosen because each
 * one is verifiable from the arena itself rather than taken on trust:
 *
 *   Faculty    which of the four a bead belongs to — visible in its collar
 *              geometry and its ink, before any hue is read.
 *   Register   where its motif sits in pitch — audible the moment it is
 *              touched, since `motif.register` is what `playVoice` renders.
 *   Density    how much of the glass its figure fills — visible in the bead.
 *
 * Three views pair them three ways, so the same three readings are seen from
 * every side. Nothing here is derived, averaged, or invented: a bead's place on
 * the plane is one authored field per axis, and a player who disagrees with a
 * position can look at the bead and hear it.
 */
export const LENS_VIEWS = [
  { id: "faculty-register", xAxis: "Faculty", yAxis: "Register", label: "Faculty × Register" },
  { id: "faculty-density", xAxis: "Faculty", yAxis: "Density", label: "Faculty × Density" },
  { id: "register-density", xAxis: "Register", yAxis: "Density", label: "Register × Density" },
] as const;

export type LensView = 1 | 2 | 3;
export type LensAxis = (typeof LENS_VIEWS)[number]["xAxis" | "yAxis"];

/** Centre of the i-th of n equal bands across [-1, 1]. */
const band = (i: number, n: number): number => ((i + 0.5) / n) * 2 - 1;

/** One authored field, normalised to [-1, 1]. No axis reads more than one. */
export function lensAxisValue(concept: CastaliaConcept, axis: LensAxis): number {
  switch (axis) {
    case "Faculty":
      return band(FACULTY_IDS.indexOf(concept.faculty), FACULTY_IDS.length);
    case "Register":
      return band(
        MOTIF_REGISTERS.indexOf(concept.motif.register),
        MOTIF_REGISTERS.length
      );
    case "Density":
      return concept.sigil.density * 2 - 1;
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
